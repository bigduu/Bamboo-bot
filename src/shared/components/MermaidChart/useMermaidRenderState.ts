import { useEffect, useMemo, useState } from "react";
import {
  getCachedMermaid,
  renderMermaidCached,
} from "./mermaidRenderManager";

export interface MermaidRenderState {
  svg: string;
  height: number;
  svgWidth: number;
  svgHeight: number;
  error: string;
  isLoading: boolean;
}

function normalizeMermaidChart(input: string) {
  return input.trim();
}

// 稳定的 hash 函数（避免随机 id）
function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) * 16777619;
  }
  return (h >>> 0).toString(36);
}

export const useMermaidRenderState = (chart: string, enabled: boolean) => {
  const normalizedChart = useMemo(() => normalizeMermaidChart(chart), [chart]);
  const chartKey = useMemo(
    () => hashString(normalizedChart),
    [normalizedChart],
  );

  const [renderState, setRenderState] = useState<MermaidRenderState>(() => {
    const cached = getCachedMermaid(chartKey);
    return cached
      ? {
          svg: cached.svg,
          height: cached.height + 80, // Add padding
          svgWidth: cached.width,
          svgHeight: cached.height,
          error: "",
          isLoading: false,
        }
      : {
          svg: "",
          height: 200,
          svgWidth: 800,
          svgHeight: 200,
          error: "",
          isLoading: false,
        };
  });

  // chartKey 变化时先同步到 cache/idle
  useEffect(() => {
    const cached = getCachedMermaid(chartKey);
    if (cached) {
      setRenderState({
        svg: cached.svg,
        height: cached.height + 80,
        svgWidth: cached.width,
        svgHeight: cached.height,
        error: "",
        isLoading: false,
      });
    } else {
      setRenderState({
        svg: "",
        height: 200,
        svgWidth: 800,
        svgHeight: 200,
        error: "",
        isLoading: false,
      });
    }
  }, [chartKey]);

  // 渲染逻辑（in-flight 去重）
  useEffect(() => {
    if (!enabled) return;

    // Already cached?
    const cached = getCachedMermaid(chartKey);
    if (cached) {
      return;
    }

    let cancelled = false;

    setRenderState((prev) => ({ ...prev, isLoading: true }));

    renderMermaidCached(chartKey, normalizedChart)
      .then((res) => {
        if (!cancelled) {
          setRenderState({
            svg: res.svg,
            height: res.height + 80,
            svgWidth: res.width,
            svgHeight: res.height,
            error: "",
            isLoading: false,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[MermaidState] Render error:", err);
          const errorMessage =
            err instanceof Error ? err.message : String(err);
          setRenderState((prev) => ({
            ...prev,
            error: errorMessage || "Failed to render Mermaid diagram",
            isLoading: false,
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chartKey, normalizedChart, enabled]);

  return { renderState, chartKey };
};
