import React, { useEffect, useRef, useState } from "react";
import { Spin } from "antd";
import type { MermaidChartProps } from "./index";
import { MermaidChart } from "./index";

const LazyMermaidChart: React.FC<MermaidChartProps> = (props) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // Once visible, start rendering after a small delay to avoid layout thrashing
            requestAnimationFrame(() => {
              setShouldRender(true);
            });
            // Stop observing once visible
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "100px", // Start loading 100px before entering viewport
        threshold: 0.01, // Trigger when even 1% is visible
      },
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} style={{ minHeight: isVisible ? "auto" : "200px" }}>
      {shouldRender ? (
        <MermaidChart {...props} />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "200px",
            background: "transparent",
          }}
        >
          {isVisible && <Spin size="small" tip="Loading diagram..." />}
        </div>
      )}
    </div>
  );
};

export default React.memo(LazyMermaidChart);
