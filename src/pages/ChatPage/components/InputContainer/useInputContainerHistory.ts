import { useCallback } from "react";
import type { Message, UserFileReferenceMessage } from "../../types/chat";

interface UseInputContainerHistoryProps {
  currentChatId: string | null;
  currentChat: any | null;
  currentMessages: Message[];
  deleteMessage: (chatId: string, messageId: string) => void;
  sendMessage: (content: string) => Promise<void>;
  navigate: (
    direction: "previous" | "next",
    currentValue: string,
  ) => {
    applied: boolean;
    value: string | null;
  };
}

export const useInputContainerHistory = ({
  currentChatId,
  currentChat,
  currentMessages,
  deleteMessage,
  sendMessage,
  navigate,
}: UseInputContainerHistoryProps) => {
  const retryLastMessage = useCallback(async () => {
    if (!currentChatId || !currentChat) return;
    const history = [...currentMessages];
    if (history.length === 0) return;

    // Find the last user message
    const lastUserIndex = [...history]
      .reverse()
      .findIndex((msg) => msg.role === "user");

    if (lastUserIndex === -1) return;

    // Convert back to forward index
    const actualIndex = history.length - 1 - lastUserIndex;
    const lastUser = history[actualIndex];

    const content =
      "content" in lastUser
        ? lastUser.content
        : (lastUser as UserFileReferenceMessage).displayText;
    if (typeof content !== "string") return;

    // Delete the last user message and all messages after it (including any assistant responses)
    const messagesToDelete = history.slice(actualIndex);
    for (const message of messagesToDelete) {
      deleteMessage(currentChatId, message.id);
    }

    // Resend the last user message content
    await sendMessage(content);
  }, [currentChat, currentChatId, currentMessages, deleteMessage, sendMessage]);

  const handleHistoryNavigate = useCallback(
    (direction: "previous" | "next", currentValue: string): string | null => {
      const result = navigate(direction, currentValue);
      if (!result.applied) {
        return null;
      }
      return result.value;
    },
    [navigate],
  );

  return { retryLastMessage, handleHistoryNavigate };
};
