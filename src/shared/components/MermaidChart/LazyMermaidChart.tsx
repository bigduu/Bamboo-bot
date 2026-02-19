import React, { useEffect, useRef, useState } from "react";
import { Spin } from "antd";
import type { MermaidChartProps } from "./index";

// 全局"见过"集合，避免组件 remount 后再建 observer
const seen = new Set<string>();

// 简单 hash 函数
function hashChart(chart: string) {
  let h = 2166136261;
  for (let i = 0; i < chart.length; i++) {
    h = (h ^ chart.charCodeAt(i)) * 16777619;
  }
  return (h >>> 0).toString(36);
}

const LazyMermaidChart: React.FC<MermaidChartProps> = (props) => {
  const chartKey = hashChart(props.chart);
  const [shouldRender, setShouldRender] = useState(() => seen.has(chartKey));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shouldRender) return; // 关键：true 之后不再建 observer

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          console.log("[LazyMermaid] Chart entering viewport", chartKey.substring(0, 20));
          seen.add(chartKey);
          setShouldRender(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "50px",
        threshold: 0.01,
      },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [shouldRender, chartKey]);

  return (
    <div ref={containerRef} style={{ minHeight: shouldRender ? "auto" : "200px" }}>
      {shouldRender ? (
        <React.Suspense fallback={<Spin size="small" tip="Loading diagram..." />}>
          <LazyMermaidChartRenderer {...props} />
        </React.Suspense>
      ) : (
        <div style={{ minHeight: "200px" }} />
      )}
    </div>
  );
};

// 动态导入 MermaidChart
const LazyMermaidChartRenderer: React.FC<MermaidChartProps> = (props) => {
  const [MermaidChartComponent, setMermaidChartComponent] = useState<
    React.FC<MermaidChartProps> | null
  >(null);

  useEffect(() => {
    import("./index").then((module) => {
      setMermaidChartComponent(() => module.MermaidChart);
    });
  }, []);

  if (!MermaidChartComponent) {
    return <Spin size="small" tip="Loading diagram..." />;
  }

  return <MermaidChartComponent {...props} />;
};

export default React.memo(LazyMermaidChart);
