import { useCallback } from "react";
import type { Message } from "../../types/chat";

interface UseInputContainerHistoryProps {
  currentChatId: string | null;
  currentChat: any | null;
  currentMessages: Message[];
  retryLastTurn: () => Promise<void>;
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
  retryLastTurn,
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

    await retryLastTurn();
  }, [currentChat, currentChatId, currentMessages, retryLastTurn]);

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
