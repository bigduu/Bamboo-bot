import { useCallback } from "react";
import { getOpenAIClient } from "../../services/openaiClient";
import { useAppStore } from "../../store";
import { useActiveModel } from "../../hooks/useActiveModel";

const extractMermaidCode = (content: string) => {
  const match = content.match(/```mermaid\s*([\s\S]*?)```/i);
  if (match) return match[1].trim();
  return content.trim();
};

const replaceMermaidBlock = (
  content: string,
  originalChart: string,
  fixedChart: string,
) => {
  const normalizedOriginal = originalChart.trim();
  const normalizedFixed = extractMermaidCode(fixedChart);
  let replaced = false;
  const updated = content.replace(
    /```mermaid\s*([\s\S]*?)```/gi,
    (match, block) => {
      if (replaced) return match;
      if (block.trim() !== normalizedOriginal) return match;
      replaced = true;
      return `\`\`\`mermaid\n${normalizedFixed}\n\`\`\``;
    },
  );
  return replaced ? updated : null;
};

const fixMermaidWithAI = async (chart: string, model?: string | null) => {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    // Use provided model, or use "default" to let backend use its configured default
    model: model || "default",
    messages: [
      {
        role: "system",
        content:
          "Fix Mermaid diagrams. Return only corrected Mermaid code without markdown fences or extra text.",
      },
      {
        role: "user",
        content: chart,
      },
    ],
    temperature: 0,
  });
  const content = response.choices?.[0]?.message?.content ?? "";
  return extractMermaidCode(content);
};

export const useMessageCardMermaidFix = (messageId: string) => {
  const activeModel = useActiveModel();

  return useCallback(
    async (chart: string) => {
      const state = useAppStore.getState();
      const currentChatId = state.currentChatId;
      const currentChat = state.chats.find((c) => c.id === currentChatId);

      if (!currentChatId || !currentChat) {
        throw new Error("No active chat available");
      }

      const msg = currentChat.messages.find((m) => m.id === messageId);
      if (!msg || msg.role !== "assistant" || msg.type !== "text") {
        throw new Error(
          "Mermaid fix is only available for assistant text messages",
        );
      }

      const fixedChart = await fixMermaidWithAI(chart, activeModel);
      if (!fixedChart) throw new Error("AI did not return a Mermaid fix");

      const updatedContent = replaceMermaidBlock(
        msg.content,
        chart,
        fixedChart,
      );
      if (!updatedContent) {
        throw new Error("Unable to locate Mermaid block to update");
      }

      const updatedMessages = currentChat.messages.map((m) =>
        m.id === messageId ? { ...m, content: updatedContent } : m,
      );

      state.updateChat(currentChatId, { messages: updatedMessages });
    },
    [messageId, activeModel],
  );
};
