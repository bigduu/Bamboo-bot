import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Message, UserSystemPrompt } from "../../types/chat";
import { SystemPromptService } from "../../services/SystemPromptService";
import { getEffectiveSystemPrompt } from "../../../../shared/utils/systemPromptEnhancement";

type UseSystemPromptContentArgs = {
  currentChat: {
    id: string;
    config?: { systemPromptId?: string; workspacePath?: string };
  } | null;
  message: Message;
  systemPrompts: UserSystemPrompt[];
};

export const useSystemPromptContent = ({
  currentChat,
  message,
  systemPrompts,
}: UseSystemPromptContentArgs) => {
  const [presetPrompt, setPresetPrompt] = useState<{
    content?: string;
    description?: string;
  } | null>(null);
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null);
  const [loadingEnhanced, setLoadingEnhanced] = useState(false);
  const [showEnhanced, setShowEnhanced] = useState(false);

  const systemPromptService = useMemo(
    () => SystemPromptService.getInstance(),
    [],
  );
  const systemMessageContent =
    message.role === "system" && typeof message.content === "string"
      ? message.content
      : "";

  useEffect(() => {
    if (message.role === "system") {
      setEnhancedPrompt(null);
      setShowEnhanced(false);
    }
  }, [message.id, message.role, systemMessageContent]);

  const currentChatId = currentChat?.id ?? null;
  const systemPromptId = currentChat?.config?.systemPromptId ?? null;
  const workspacePath = currentChat?.config?.workspacePath ?? null;

  const userPrompt = useMemo(() => {
    if (!systemPromptId) {
      return null;
    }
    return systemPrompts.find((p) => p.id === systemPromptId) ?? null;
  }, [systemPromptId, systemPrompts]);

  const basePrompt = userPrompt?.content ?? presetPrompt?.content ?? "";
  const categoryDescription =
    userPrompt?.description ?? presetPrompt?.description ?? "";

  const lastPresetLoadKeyRef = useRef<string | null>(null);
  useEffect(() => {
    // Reset any previously fetched preset when switching chats/prompts.
    setPresetPrompt(null);
    lastPresetLoadKeyRef.current = null;
  }, [currentChatId, systemPromptId]);

  useEffect(() => {
    if (!systemPromptId) {
      return;
    }
    const promptId = systemPromptId;
    // If the user prompt already has content, prefer it and avoid preset fetching.
    if (userPrompt?.content) {
      return;
    }

    // Avoid re-fetch loops when upstream dependencies are unstable (e.g. config objects).
    const loadKey = `${currentChatId ?? "no-chat"}:${promptId}`;
    if (lastPresetLoadKeyRef.current === loadKey) {
      return;
    }
    lastPresetLoadKeyRef.current = loadKey;

    let cancelled = false;
    const loadPreset = async () => {
      try {
        const preset = await systemPromptService.findPresetById(promptId);
        if (cancelled) {
          return;
        }

        const next = preset
          ? { content: preset.content, description: preset.description }
          : null;

        setPresetPrompt((prev) => {
          if (!prev && !next) return prev;
          if (prev && next) {
            if (prev.content === next.content && prev.description === next.description) {
              return prev;
            }
          }
          return next;
        });
      } catch (error) {
        console.error("Failed to load preset prompt:", error);
      }
    };

    void loadPreset();
    return () => {
      cancelled = true;
    };
  }, [
    currentChatId,
    systemPromptId,
    systemPromptService,
    userPrompt?.content,
  ]);

  const loadEnhancedPrompt = useCallback(async () => {
    if (!basePrompt || loadingEnhanced) return;

    setLoadingEnhanced(true);
    try {
      const enhanced = getEffectiveSystemPrompt(
        basePrompt,
        workspacePath ?? undefined,
      );

      setEnhancedPrompt(enhanced);
      setShowEnhanced(true);
    } catch (error) {
      console.error("Failed to load enhanced prompt:", error);
    } finally {
      setLoadingEnhanced(false);
    }
  }, [basePrompt, loadingEnhanced, workspacePath]);

  const promptToDisplay = useMemo(() => {
    if (showEnhanced && enhancedPrompt) {
      return enhancedPrompt;
    }
    if (basePrompt) {
      return basePrompt;
    }
    if (categoryDescription) {
      return categoryDescription;
    }
    if (message.role === "system") {
      return systemMessageContent;
    }
    return "System prompt is being prepared...";
  }, [
    showEnhanced,
    enhancedPrompt,
    basePrompt,
    categoryDescription,
    message.role,
    systemMessageContent,
  ]);

  return {
    basePrompt,
    categoryDescription,
    enhancedPrompt,
    loadingEnhanced,
    loadEnhancedPrompt,
    promptToDisplay,
    showEnhanced,
    setShowEnhanced,
    systemMessageContent,
  };
};
