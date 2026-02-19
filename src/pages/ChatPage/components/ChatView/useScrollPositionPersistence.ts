import { useCallback, useLayoutEffect, useEffect, useRef } from "react";
import { restoreScrollTopUntilStable } from "./scrollRestore";

const SCROLL_POSITION_STORAGE_KEY = "chat_scroll_positions";

type ScrollPositions = Record<string, number>;

const getScrollPositions = (): ScrollPositions => {
  try {
    const stored = localStorage.getItem(SCROLL_POSITION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveScrollPosition = (chatId: string, scrollTop: number) => {
  try {
    const positions = getScrollPositions();
    positions[chatId] = scrollTop;
    localStorage.setItem(SCROLL_POSITION_STORAGE_KEY, JSON.stringify(positions));
  } catch (error) {
    console.warn("[ScrollPosition] Failed to save:", error);
  }
};

const getScrollPosition = (chatId: string): number | null => {
  const positions = getScrollPositions();
  return positions[chatId] ?? null;
};

export const useScrollPositionPersistence = (
  currentChatId: string | null,
  messagesListRef: React.RefObject<HTMLDivElement>,
  renderableMessagesLength: number,
) => {
  const restoredChatsRef = useRef<Set<string>>(new Set());
  const isRestoringRef = useRef(false);
  const restoreTokenRef = useRef(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userInteractedRef = useRef(false);

  // 标记"是否发生过用户滚动"，避免 programmatic scroll 触发保存
  useEffect(() => {
    const el = messagesListRef.current;
    if (!el) return;

    const markUser = () => {
      userInteractedRef.current = true;
    };

    el.addEventListener("wheel", markUser, { passive: true });
    el.addEventListener("touchmove", markUser, { passive: true });
    el.addEventListener("pointerdown", markUser);

    return () => {
      el.removeEventListener("wheel", markUser);
      el.removeEventListener("touchmove", markUser);
      el.removeEventListener("pointerdown", markUser);
    };
  }, [messagesListRef]);

  // Restore (用 useLayoutEffect 尽量避免"先到顶部再跳"的闪动)
  useLayoutEffect(() => {
    if (!currentChatId) return;
    const el = messagesListRef.current;
    if (!el) return;
    if (renderableMessagesLength === 0) return;
    if (restoredChatsRef.current.has(currentChatId)) {
      console.log("[ScrollPosition] Already restored for", currentChatId.substring(0, 8));
      return;
    }

    const saved = getScrollPosition(currentChatId);
    if (saved == null) {
      console.log("[ScrollPosition] No saved position for", currentChatId.substring(0, 8));
      restoredChatsRef.current.add(currentChatId);
      return;
    }

    console.log("[ScrollPosition] Will restore to", saved, "for", currentChatId.substring(0, 8));

    // 清掉任何 pending save，避免切会话/恢复过程中"偷写"
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const token = ++restoreTokenRef.current;
    isRestoringRef.current = true;
    userInteractedRef.current = false;

    // 恢复期间禁用 scroll anchoring
    el.style.overflowAnchor = "none";

    restoreScrollTopUntilStable(el, saved, () => restoreTokenRef.current !== token)
      .finally(() => {
        if (restoreTokenRef.current !== token) return;

        isRestoringRef.current = false;
        restoredChatsRef.current.add(currentChatId);

        // 恢复完成后保存一次"最终稳定值"
        const finalScrollTop = el.scrollTop;
        console.log("[ScrollPosition] Restore complete, final:", finalScrollTop);
        saveScrollPosition(currentChatId, finalScrollTop);

        el.style.overflowAnchor = "";
      });
  }, [currentChatId, renderableMessagesLength, messagesListRef]);

  // Save on scroll (debounced)
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      if (!currentChatId) return;
      if (isRestoringRef.current) return;

      const el = e.currentTarget;

      // 关键：只在用户交互后才保存
      const isTrusted = (e.nativeEvent as Event).isTrusted === true;
      if (!userInteractedRef.current && !isTrusted) return;

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      const chatIdAtSchedule = currentChatId;
      const scrollTopAtSchedule = el.scrollTop;

      saveTimeoutRef.current = setTimeout(() => {
        if (!isRestoringRef.current) {
          console.log("[ScrollPosition] Saving", scrollTopAtSchedule, "for", chatIdAtSchedule.substring(0, 8));
          saveScrollPosition(chatIdAtSchedule, scrollTopAtSchedule);
        }
      }, 300);
    },
    [currentChatId],
  );

  // 切会话时清掉 pending save
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [currentChatId]);

  return {
    handleScroll,
  };
};
