import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type Layout = "horizontal" | "vertical";

export type ResizableSplitProps = {
  layout: Layout;
  first: React.ReactNode;
  second: React.ReactNode;
  /**
   * Persisted pixel sizes: [firstPx, secondPx].
   * If omitted, the split defaults to `defaultSplitRatio`.
   */
  sizesPx?: [number, number] | null;
  defaultSplitRatio?: number; // 0..1
  minFirstPx?: number;
  minSecondPx?: number;
  handleSizePx?: number;
  disabled?: boolean;
  onResizeEnd?: (sizes: [number, number]) => void;
  style?: React.CSSProperties;
  className?: string;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const getAxisSize = (el: HTMLElement, layout: Layout): number =>
  layout === "horizontal" ? el.clientWidth : el.clientHeight;

export const ResizableSplit: React.FC<ResizableSplitProps> = ({
  layout,
  first,
  second,
  sizesPx,
  defaultSplitRatio = 0.5,
  minFirstPx = 0,
  minSecondPx = 0,
  handleSizePx = 6,
  disabled = false,
  onResizeEnd,
  style,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    pointerId: number;
    startPos: number;
    startFirstPx: number;
    containerSize: number;
  } | null>(null);

  // During dragging we update only local state to keep it responsive.
  const [liveFirstPx, setLiveFirstPx] = useState<number | null>(null);
  const [computedFirstPx, setComputedFirstPx] = useState<number | null>(null);

  const persistedFirstPx = useMemo(() => {
    if (!sizesPx) return null;
    const v = Number(sizesPx[0]);
    return Number.isFinite(v) ? v : null;
  }, [sizesPx]);

  // Compute an initial pixel split once when we don't have persisted sizes.
  useLayoutEffect(() => {
    if (persistedFirstPx !== null) return;
    if (computedFirstPx !== null) {
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const size = getAxisSize(el, layout);
    if (!size) return;

    const ratio = clamp(defaultSplitRatio, 0.1, 0.9);
    const next = Math.round(size * ratio);
    setComputedFirstPx(next);
  }, [computedFirstPx, defaultSplitRatio, layout, persistedFirstPx]);

  // Keep computed value within bounds if the container resizes a lot.
  // This avoids negative/overflow sizes after window resize without using ResizeObserver.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (persistedFirstPx !== null) return;
    if (computedFirstPx === null) return;

    const onResize = () => {
      const size = getAxisSize(el, layout);
      if (!size) return;
      const maxFirst = Math.max(minFirstPx, size - minSecondPx);
      const next = clamp(computedFirstPx, minFirstPx, maxFirst);
      if (next !== computedFirstPx) {
        setComputedFirstPx(next);
      }
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [computedFirstPx, layout, minFirstPx, minSecondPx, persistedFirstPx]);

  const effectiveFirstPx = liveFirstPx ?? persistedFirstPx ?? computedFirstPx ?? 0;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      const el = containerRef.current;
      if (!el) return;

      e.preventDefault();
      e.stopPropagation();

      const axisPos = layout === "horizontal" ? e.clientX : e.clientY;
      const containerSize = getAxisSize(el, layout);
      const startFirst = effectiveFirstPx || Math.round(containerSize * clamp(defaultSplitRatio, 0.1, 0.9));

      dragStartRef.current = {
        pointerId: e.pointerId,
        startPos: axisPos,
        startFirstPx: startFirst,
        containerSize,
      };

      try {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture errors.
      }
    },
    [defaultSplitRatio, disabled, effectiveFirstPx, layout],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStartRef.current;
      if (!drag) return;
      if (e.pointerId !== drag.pointerId) return;

      e.preventDefault();
      e.stopPropagation();

      const axisPos = layout === "horizontal" ? e.clientX : e.clientY;
      const delta = axisPos - drag.startPos;

      const size = drag.containerSize;
      const maxFirst = Math.max(minFirstPx, size - minSecondPx);
      const nextFirst = clamp(Math.round(drag.startFirstPx + delta), minFirstPx, maxFirst);
      setLiveFirstPx(nextFirst);
    },
    [layout, minFirstPx, minSecondPx],
  );

  const finishDrag = useCallback(
    (pointerId: number) => {
      const drag = dragStartRef.current;
      if (!drag || drag.pointerId !== pointerId) return;

      const el = containerRef.current;
      const size = el ? getAxisSize(el, layout) : drag.containerSize;
      const firstPx = liveFirstPx ?? drag.startFirstPx;
      const maxFirst = Math.max(minFirstPx, size - minSecondPx);
      const clampedFirst = clamp(firstPx, minFirstPx, maxFirst);
      const secondPx = Math.max(minSecondPx, size - clampedFirst);

      setLiveFirstPx(null);
      setComputedFirstPx(clampedFirst);
      dragStartRef.current = null;

      onResizeEnd?.([clampedFirst, secondPx]);
    },
    [layout, liveFirstPx, minFirstPx, minSecondPx, onResizeEnd],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      finishDrag(e.pointerId);
    },
    [finishDrag],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      finishDrag(e.pointerId);
    },
    [finishDrag],
  );

  const isRow = layout === "horizontal";
  const handleCursor = disabled ? "default" : isRow ? "col-resize" : "row-resize";
  const handleThickness = Math.max(0, Math.round(handleSizePx));

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: "flex",
        flexDirection: isRow ? "row" : "column",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        width: "100%",
        ...style,
      }}
    >
      <div
        style={{
          flex: `0 0 ${effectiveFirstPx}px`,
          minWidth: isRow ? minFirstPx : 0,
          minHeight: isRow ? 0 : minFirstPx,
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{first}</div>
      </div>

      {handleThickness > 0 ? (
        <div
          role="separator"
          aria-orientation={isRow ? "vertical" : "horizontal"}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{
            flex: `0 0 ${handleThickness}px`,
            cursor: handleCursor,
            touchAction: "none",
            background: disabled ? "transparent" : "rgba(0,0,0,0.06)",
          }}
        />
      ) : null}

      <div
        style={{
          flex: "1 1 auto",
          minWidth: isRow ? minSecondPx : 0,
          minHeight: isRow ? 0 : minSecondPx,
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{second}</div>
      </div>
    </div>
  );
};
