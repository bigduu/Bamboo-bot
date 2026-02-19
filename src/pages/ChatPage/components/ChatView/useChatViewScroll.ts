import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import { streamingMessageBus } from "../../utils/streamingMessageBus";
import type { RenderableEntry } from "./useChatViewMessages";
import { useScrollAnchorPersistence } from "./useScrollAnchorPersistence";

type InteractionState = {
  value: "IDLE" | "THINKING" | "AWAITING_APPROVAL";
  matches: (stateName: "IDLE" | "THINKING" | "AWAITING_APPROVAL") => boolean;
};

type UseChatViewScrollArgs = {
  currentChatId: string | null;
  interactionState: InteractionState;
  messagesListRef: RefObject<HTMLDivElement>;
  renderableMessages: RenderableEntry[];
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
};

export const useChatViewScroll = ({
  currentChatId,
  interactionState,
  messagesListRef,
  renderableMessages,
  rowVirtualizer,
}: UseChatViewScrollArgs) => {
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const userHasScrolledUpRef = useRef(false);
  const isFirstLoadRef = useRef(true);

  // Use scroll anchor persistence
  const { handleScroll: handleScrollPersistence } = useScrollAnchorPersistence({
    currentChatId,
    messagesListRef,
    renderableMessages,
    rowVirtualizer,
  });

  const handleMessagesScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      const el = messagesListRef.current;
      if (!el) return;
      // 没有消息时不显示滚动按钮
      if (renderableMessages.length === 0) {
        setShowScrollToBottom(false);
        setShowScrollToTop(false);
        return;
      }
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      const scrollTop = el.scrollTop;
      // 使用统一的阈值：距离底部 150px 以内都视为"在底部"
      const bottomThreshold = 150;
      const topThreshold = 150;
      const atBottom = distanceFromBottom < bottomThreshold;
      const atTop = scrollTop < topThreshold;
      setShowScrollToBottom(!atBottom);
      setShowScrollToTop(!atTop && renderableMessages.length > 3);
      // 用户主动向上滚动超过阈值时，标记为已滚动
      if (distanceFromBottom > bottomThreshold * 2) {
        userHasScrolledUpRef.current = true;
      } else if (atBottom) {
        userHasScrolledUpRef.current = false;
      }

      // Save scroll position (pass event to handler)
      handleScrollPersistence(e);
    },
    [renderableMessages.length, handleScrollPersistence],
  );

  const scrollToBottom = useCallback(() => {
    const el = messagesListRef.current;
    if (!el) return;
    if (renderableMessages.length === 0) return;
    requestAnimationFrame(() => {
      // 直接滚动到容器底部，确保到达最底部
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [renderableMessages.length]);

  const scrollToTop = useCallback(() => {
    const el = messagesListRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      // 直接滚动到容器顶部
      el.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, []);

  const resetUserScroll = useCallback(() => {
    userHasScrolledUpRef.current = false;
  }, []);

  useEffect(() => {
    const handleMessageNavigation = (event: Event) => {
      const customEvent = event as CustomEvent<{ messageId: string }>;
      const messageId = customEvent.detail?.messageId;

      if (!messageId) {
        console.error("No messageId provided for navigation");
        return;
      }

      const targetIndex = renderableMessages.findIndex((item) => {
        if ("message" in item && item.message) {
          return item.message.id === messageId;
        }
        if ("id" in item) {
          return item.id === messageId;
        }
        return false;
      });

      if (targetIndex === -1) {
        console.warn("Message not found for navigation:", messageId);
        return;
      }

      rowVirtualizer.scrollToIndex(targetIndex, { align: "center" });

      setTimeout(() => {
        const messageElement = document.getElementById(`message-${messageId}`);
        if (messageElement) {
          messageElement.classList.add("highlight-message");
          setTimeout(() => {
            messageElement.classList.remove("highlight-message");
          }, 2000);
        }
      }, 200);
    };

    window.addEventListener(
      "navigate-to-message",
      handleMessageNavigation as EventListener,
    );
    return () => {
      window.removeEventListener(
        "navigate-to-message",
        handleMessageNavigation as EventListener,
      );
    };
  }, [renderableMessages, rowVirtualizer]);

  const previousStateRef = useRef(interactionState.value);
  useEffect(() => {
    const currentState = interactionState.value;
    const previousState = previousStateRef.current;

    if (previousState === "IDLE" && currentState === "THINKING") {
      resetUserScroll();
      scrollToBottom();
    }

    previousStateRef.current = currentState;
  }, [interactionState.value, resetUserScroll, scrollToBottom]);

  useEffect(() => {
    return streamingMessageBus.subscribe((update) => {
      if (update.chatId !== currentChatId) return;
      if (userHasScrolledUpRef.current) return;
      if (!update.content) return;
      scrollToBottom();
    });
  }, [currentChatId, scrollToBottom]);

  useEffect(() => {
    // Only auto-scroll when streaming, not on initial load
    if (!userHasScrolledUpRef.current && renderableMessages.length > 0 && !isFirstLoadRef.current) {
      scrollToBottom();
    }
    isFirstLoadRef.current = false;
  }, [renderableMessages.length, scrollToBottom]);

  // 当消息数量变化或切换聊天时，主动检查是否应该显示滚动按钮
  useEffect(() => {
    const el = messagesListRef.current;
    if (!el) {
      setShowScrollToBottom(false);
      setShowScrollToTop(false);
      return;
    }
    // 没有消息时不显示按钮
    if (renderableMessages.length === 0) {
      setShowScrollToBottom(false);
      setShowScrollToTop(false);
      return;
    }
    // 检查当前滚动位置
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const scrollTop = el.scrollTop;
    const bottomThreshold = 150;
    const topThreshold = 150;
    const atBottom = distanceFromBottom < bottomThreshold;
    const atTop = scrollTop < topThreshold;
    setShowScrollToBottom(!atBottom);
    setShowScrollToTop(!atTop && renderableMessages.length > 3);
  }, [renderableMessages.length, currentChatId]);

  // Reset first load flag when switching chats
  useEffect(() => {
    isFirstLoadRef.current = true;
    userHasScrolledUpRef.current = false;
  }, [currentChatId]);

  return {
    handleMessagesScroll,
    resetUserScroll,
    scrollToBottom,
    scrollToTop,
    showScrollToBottom,
    showScrollToTop,
  };
};
