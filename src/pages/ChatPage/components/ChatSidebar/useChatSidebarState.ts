import { useCallback, useMemo, useState } from "react";
import { Modal } from "antd";

import {
  getChatCountByDate,
  getChatIdsByDate,
  getDateGroupKeyForChat,
  getSortedDateKeys,
  groupChatsByDate,
} from "../../utils/chatUtils";
import { useSettingsViewStore } from "../../../../shared/store/settingsViewStore";
import { useChatTitleGeneration } from "../../hooks/useChatManager/useChatTitleGeneration";
import { selectChatById, useAppStore } from "../../store";
import type { ChatItem, UserSystemPrompt } from "../../types/chat";
import {
  findLeafIdByChatId,
  useUILayoutStore,
} from "@shared/store/uiLayoutStore";
import { uiLayoutDebug } from "@shared/utils/debugFlags";

export const useChatSidebarState = () => {
  const chats = useAppStore((state) => state.chats);
  const currentChatId = useAppStore((state) => state.currentChatId);
  const selectChatGlobal = useAppStore((state) => state.selectChat);
  const deleteChat = useAppStore((state) => state.deleteChat);
  const deleteChats = useAppStore((state) => state.deleteChats);
  const pinChat = useAppStore((state) => state.pinChat);
  const unpinChat = useAppStore((state) => state.unpinChat);
  const updateChat = useAppStore((state) => state.updateChat);
  const addChat = useAppStore((state) => state.addChat);
  const lastSelectedPromptId = useAppStore(
    (state) => state.lastSelectedPromptId,
  );
  const systemPrompts = useAppStore((state) => state.systemPrompts);

  const sidebarCollapsed = useUILayoutStore((s) => s.sidebar.collapsed);
  const setSidebarCollapsed = useUILayoutStore((s) => s.setSidebarCollapsed);
  const activeLeafId = useUILayoutStore((s) => s.activeLeafId);
  const setActiveLeafId = useUILayoutStore((s) => s.setActiveLeafId);
  const setLeafChatId = useUILayoutStore((s) => s.setLeafChatId);
  const clearChatFromAllLeaves = useUILayoutStore(
    (s) => s.clearChatFromAllLeaves,
  );

  const { generateChatTitle, titleGenerationState } = useChatTitleGeneration({
    chats,
    updateChat,
  });

  const createNewChat = useCallback(
    async (title?: string, options?: Partial<Omit<ChatItem, "id">>) => {
      const selectedPrompt = systemPrompts.find(
        (p) => p.id === lastSelectedPromptId,
      );

      const systemPromptId =
        selectedPrompt?.id ||
        (systemPrompts.length > 0
          ? systemPrompts.find((p) => p.id === "general_assistant")?.id ||
            systemPrompts[0].id
          : "");

      const newChatData: Omit<ChatItem, "id"> = {
        title: title || "New Chat",
        createdAt: Date.now(),
        messages: [],
        config: {
          systemPromptId,
          baseSystemPrompt:
            selectedPrompt?.content ||
            (systemPrompts.length > 0
              ? systemPrompts.find((p) => p.id === "general_assistant")
                  ?.content || systemPrompts[0].content
              : ""),
          lastUsedEnhancedPrompt: null,
        },
        currentInteraction: null,
        ...options,
      };
      const newChatId = await addChat(newChatData);

      // Assign the new chat to the currently active pane (read from store to
      // avoid stale closures when the user just split panes).
      const { activeLeafId: targetLeafId } = useUILayoutStore.getState();
      useUILayoutStore.getState().setLeafChatId(targetLeafId, newChatId);
      useUILayoutStore.getState().setActiveLeafId(targetLeafId);

      uiLayoutDebug("createNewChat -> assign", {
        targetLeafId,
        newChatId,
      });
    },
    [
      activeLeafId,
      addChat,
      lastSelectedPromptId,
      setActiveLeafId,
      setLeafChatId,
      systemPrompts,
    ],
  );

  const [isNewChatSelectorOpen, setIsNewChatSelectorOpen] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(
    new Set(["Today"]),
  );

  const currentChat = useAppStore(selectChatById(currentChatId));

  const currentDateGroupKey = useMemo(() => {
    return currentChat ? getDateGroupKeyForChat(currentChat) : null;
  }, [currentChat]);

  // Always keep the currently selected chat's group expanded, without causing
  // an effect-driven setState loop.
  const expandedKeys = useMemo(() => {
    const next = new Set(expandedDates);
    if (currentDateGroupKey) {
      next.add(currentDateGroupKey);
    }
    return Array.from(next);
  }, [currentDateGroupKey, expandedDates]);

  const handleCollapseChange = (keys: string | string[]) => {
    const next = new Set(Array.isArray(keys) ? keys : [keys]);
    setExpandedDates((prev) => {
      if (prev.size !== next.size) return next;
      for (const k of next) {
        if (!prev.has(k)) return next;
      }
      return prev;
    });
  };

  const groupedChatsByDate = groupChatsByDate(chats);
  const sortedDateKeys = getSortedDateKeys(groupedChatsByDate);

  const handlePinChat = useCallback(
    (chatId: string) => {
      pinChat(chatId);
      // Pinned chats move into the "Pinned" group; expand it so the chat doesn't
      // appear to "disappear" immediately after pinning.
      setExpandedDates((prev) => {
        if (prev.has("Pinned")) return prev;
        const next = new Set(prev);
        next.add("Pinned");
        return next;
      });
    },
    [pinChat],
  );

  const handleUnpinChat = useCallback(
    (chatId: string) => {
      // Compute the destination group key (best-effort) so the chat remains visible.
      const chat = chats.find((c) => c.id === chatId);
      const nextGroupKey = chat
        ? getDateGroupKeyForChat({ ...chat, pinned: false })
        : null;

      unpinChat(chatId);

      if (!nextGroupKey) return;
      setExpandedDates((prev) => {
        if (prev.has(nextGroupKey)) return prev;
        const next = new Set(prev);
        next.add(nextGroupKey);
        return next;
      });
    },
    [chats, unpinChat],
  );

  const handleDelete = (chatId: string) => {
    Modal.confirm({
      title: "Delete Chat",
      content:
        "Are you sure you want to delete this chat? This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        clearChatFromAllLeaves(chatId);
        deleteChat(chatId);
      },
    });
  };

  const openSettings = useSettingsViewStore((state) => state.open);

  const handleOpenSettings = () => {
    openSettings("chat");
  };

  const handleEditTitle = (chatId: string, newTitle: string) => {
    updateChat(chatId, { title: newTitle });
  };

  const handleGenerateTitle = async (chatId: string) => {
    try {
      await generateChatTitle(chatId, { force: true });
    } catch (error) {
      console.error("Failed to generate title:", error);
    }
  };

  const handleDeleteByDate = (dateKey: string) => {
    const chatIds = getChatIdsByDate(groupedChatsByDate, dateKey);
    const chatCount = getChatCountByDate(groupedChatsByDate, dateKey);

    Modal.confirm({
      title: `Delete all chats from ${dateKey}`,
      content: `Are you sure you want to delete all ${chatCount} chats from ${dateKey}? This action cannot be undone.`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        chatIds.forEach((id) => clearChatFromAllLeaves(id));
        deleteChats(chatIds);
      },
    });
  };

  const handleNewChat = () => {
    setIsNewChatSelectorOpen(true);
  };

  const handleNewChatSelectorClose = () => {
    setIsNewChatSelectorOpen(false);
  };

  const handleSystemPromptSelect = async (preset: UserSystemPrompt) => {
    try {
      await createNewChat(`New Chat - ${preset.name}`, {
        config: {
          systemPromptId: preset.id,
          baseSystemPrompt: preset.content,
          lastUsedEnhancedPrompt: null,
        },
      });
      setIsNewChatSelectorOpen(false);
    } catch (error) {
      console.error("Failed to create chat:", error);
      Modal.error({
        title: "Failed to Create Chat",
        content:
          error instanceof Error
            ? error.message
            : "Unknown error, please try again",
      });
    }
  };

  const selectChat = useCallback(
    (chatId: string) => {
      // Read latest layout state to avoid stale closure when split/focus changes
      // and the user immediately clicks a chat in the sidebar.
      const {
        activeLeafId: targetLeafId,
        leafChatIds: leafChatIdsNow,
      } = useUILayoutStore.getState();

      // If the chat is already open in a pane, focus it.
      const existingLeafId = findLeafIdByChatId(leafChatIdsNow, chatId);
      const activeLeafChatId = leafChatIdsNow[targetLeafId] ?? null;

      uiLayoutDebug("sidebar selectChat (input)", {
        activeLeafId: targetLeafId,
        activeLeafChatId,
        selectedChatId: chatId,
        existingLeafId,
      });

      if (existingLeafId) {
        if (existingLeafId === targetLeafId) {
          // no-op
          uiLayoutDebug("sidebar selectChat (decision)", {
            action: "noop_already_active",
            leafId: targetLeafId,
            chatId,
          });
        } else if (!activeLeafChatId) {
          // If the currently focused pane is empty, prefer filling it even if the
          // chat is already open elsewhere. This matches user expectations when
          // creating a new split and selecting a chat from the sidebar.
          useUILayoutStore.getState().setLeafChatId(targetLeafId, chatId);
          useUILayoutStore.getState().setActiveLeafId(targetLeafId);
          uiLayoutDebug("sidebar selectChat (decision)", {
            action: "assign_to_empty_active_leaf",
            fromLeafId: existingLeafId,
            toLeafId: targetLeafId,
            chatId,
          });
        } else {
          useUILayoutStore.getState().setActiveLeafId(existingLeafId);
          uiLayoutDebug("sidebar selectChat (decision)", {
            action: "focus_existing_leaf",
            leafId: existingLeafId,
            chatId,
          });
        }
      } else {
        useUILayoutStore.getState().setLeafChatId(targetLeafId, chatId);
        uiLayoutDebug("sidebar selectChat (decision)", {
          action: "assign_to_active_leaf",
          leafId: targetLeafId,
          chatId,
        });
      }

      selectChatGlobal(chatId);
    },
    [
      selectChatGlobal,
    ],
  );

  return {
    chats,
    collapsed: sidebarCollapsed,
    currentChatId,
    expandedKeys,
    groupedChatsByDate,
    handleCollapseChange,
    handleDelete,
    handleDeleteByDate,
    handleEditTitle,
    handleGenerateTitle,
    handleNewChat,
    handleNewChatSelectorClose,
    handleOpenSettings,
    handleSystemPromptSelect,
    isNewChatSelectorOpen,
    pinChat: handlePinChat,
    selectChat,
    setCollapsed: setSidebarCollapsed,
    sortedDateKeys,
    systemPrompts,
    titleGenerationState,
    unpinChat: handleUnpinChat,
  };
};
