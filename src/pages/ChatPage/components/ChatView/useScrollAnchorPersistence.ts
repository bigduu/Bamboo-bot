import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { RenderableEntry } from "./useChatViewMessages";
import {
  loadScrollAnchor,
  saveScrollAnchor,
  type ScrollAnchorV1,
} from "./scrollAnchorStorage";
import { restoreScrollAnchorUntilStable } from "./scrollAnchorRestore";

const SAVE_DEBOUNCE_MS = 300;
const OFFSET_EPS = 0.5; // localStorage write-threshold

function getPaddingTopPx(el: HTMLElement): number {
  const v =
    typeof window !== "undefined"
      ? window.getComputedStyle(el).paddingTop
      : "0";
  const n = Number.parseFloat(v || "0");
  return Number.isFinite(n) ? n : 0;
}

function entryId(entry: RenderableEntry): string | null {
  if ("type" in entry && entry.type === "tool_session") return entry.id;
  if ("message" in entry && entry.message) return entry.message.id;
  return null;
}

function entryCreatedAt(entry: RenderableEntry): string | undefined {
  if ("type" in entry && entry.type === "tool_session") return entry.createdAt;
  if ("message" in entry && entry.message) return entry.message.createdAt;
  return undefined;
}

function parseTimeMs(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function resolveIndexFromDeletedAnchor(
  saved: ScrollAnchorV1,
  entries: RenderableEntry[],
): number | null {
  // 1) createdAt nearest
  const targetT = parseTimeMs(saved.createdAt);
  if (targetT != null) {
    let bestIdx: number | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < entries.length; i++) {
      const t = parseTimeMs(entryCreatedAt(entries[i]));
      if (t == null) continue;
      const d = Math.abs(t - targetT);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx != null) return bestIdx;
  }

  // 2) index hint
  if (typeof saved.indexHint === "number") {
    const clamped = Math.max(0, Math.min(entries.length - 1, saved.indexHint));
    return Number.isFinite(clamped) ? clamped : null;
  }

  return null;
}

export function useScrollAnchorPersistence(args: {
  currentChatId: string | null;
  messagesListRef: RefObject<HTMLDivElement>;
  renderableMessages: RenderableEntry[];
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
}) {
  const { currentChatId, messagesListRef, renderableMessages, rowVirtualizer } =
    args;

  const restoredChatsRef = useRef<Set<string>>(new Set());
  const isRestoringRef = useRef(false);
  const restoreTokenRef = useRef(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<ScrollAnchorV1 | null>(null);
  const userInteractedRef = useRef(false);

  // Mark user interaction
  useEffect(() => {
    const el = messagesListRef.current;
    if (!el) return;

    const mark = () => {
      userInteractedRef.current = true;
    };

    el.addEventListener("wheel", mark, { passive: true });
    el.addEventListener("touchmove", mark, { passive: true });
    el.addEventListener("pointerdown", mark);

    return () => {
      el.removeEventListener("wheel", mark);
      el.removeEventListener("touchmove", mark);
      el.removeEventListener("pointerdown", mark);
    };
  }, [messagesListRef]);

  const idToIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < renderableMessages.length; i++) {
      const id = entryId(renderableMessages[i]);
      if (id) map.set(id, i);
    }
    return map;
  }, [renderableMessages]);

  const computeAnchorNow = useCallback(
    (): ScrollAnchorV1 | null => {
      const el = messagesListRef.current;
      if (!el) return null;
      if (renderableMessages.length === 0) return null;

      const paddingTop = getPaddingTopPx(el);

      // IMPORTANT: virtualizer's coordinate assumes list starts at 0
      // Our scroll container has CSS padding, so we subtract it
      const virtualOffset = el.scrollTop - paddingTop;

      const item = rowVirtualizer.getVirtualItemForOffset(virtualOffset);
      if (!item) return null;

      const entry = renderableMessages[item.index];
      if (!entry) return null;

      const id = entryId(entry);
      if (!id) return null;

      const offsetPx = paddingTop + item.start - el.scrollTop;

      return {
        v: 1,
        anchorId: id,
        offsetPx,
        ts: Date.now(),
        indexHint: item.index,
        createdAt: entryCreatedAt(entry),
      };
    },
    [messagesListRef, renderableMessages, rowVirtualizer],
  );

  const flushSave = useCallback(
    (chatId: string) => {
      if (isRestoringRef.current) return;
      const anchor = computeAnchorNow();
      if (!anchor) return;

      const prev = lastSavedRef.current;
      if (
        prev &&
        prev.anchorId === anchor.anchorId &&
        Math.abs(prev.offsetPx - anchor.offsetPx) <= OFFSET_EPS
      ) {
        return;
      }

      saveScrollAnchor(chatId, anchor);
      lastSavedRef.current = anchor;
    },
    [computeAnchorNow],
  );

  const handleScroll = useCallback(
    (_e: React.UIEvent<HTMLElement>) => {
      if (!currentChatId) return;
      if (isRestoringRef.current) return;

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      const chatIdAtSchedule = currentChatId;
      saveTimeoutRef.current = setTimeout(() => {
        flushSave(chatIdAtSchedule);
      }, SAVE_DEBOUNCE_MS);
    },
    [currentChatId, flushSave],
  );

  // Flush pending save when switching chat/unmounting
  useEffect(() => {
    const chatIdAtRender = currentChatId;
    return () => {
      if (!chatIdAtRender) return;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      flushSave(chatIdAtRender);
    };
  }, [currentChatId, flushSave]);

  // Restore (layout effect to reduce "jump from top")
  useLayoutEffect(() => {
    if (!currentChatId) return;
    const el = messagesListRef.current;
    if (!el) return;
    if (renderableMessages.length === 0) return;

    if (restoredChatsRef.current.has(currentChatId)) return;

    const saved = loadScrollAnchor(currentChatId);
    if (!saved) {
      console.log("[ScrollAnchor] No saved anchor for", currentChatId.substring(0, 8));
      restoredChatsRef.current.add(currentChatId);
      return;
    }

    console.log("[ScrollAnchor] Will restore", saved.anchorId.substring(0, 8), "offset:", saved.offsetPx);

    const byId = idToIndex.get(saved.anchorId);
    const index =
      typeof byId === "number"
        ? byId
        : resolveIndexFromDeletedAnchor(saved, renderableMessages);

    if (index == null) {
      console.log("[ScrollAnchor] Cannot resolve index, skipping restore");
      restoredChatsRef.current.add(currentChatId);
      return;
    }

    // cancel any pending save during restore
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const token = ++restoreTokenRef.current;
    isRestoringRef.current = true;
    userInteractedRef.current = false;

    el.style.overflowAnchor = "none";

    const isCancelled = () =>
      restoreTokenRef.current !== token || userInteractedRef.current;

    restoreScrollAnchorUntilStable({
      scrollEl: el,
      rowVirtualizer,
      index,
      offsetPx: saved.offsetPx,
      isCancelled,
    }).finally(() => {
      if (restoreTokenRef.current !== token) return;

      isRestoringRef.current = false;
      restoredChatsRef.current.add(currentChatId);

      el.style.overflowAnchor = "";

      // Persist the final stabilized anchor
      flushSave(currentChatId);
    });

    return () => {
      // cancel restore loop
      if (restoreTokenRef.current === token) restoreTokenRef.current++;
    };
  }, [
    currentChatId,
    idToIndex,
    renderableMessages,
    renderableMessages.length,
    messagesListRef,
    rowVirtualizer,
    flushSave,
  ]);

  return { handleScroll };
}
