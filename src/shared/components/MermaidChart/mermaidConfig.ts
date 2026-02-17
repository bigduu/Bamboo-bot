import mermaid from "mermaid";

// Initialize with minimal config - theme will be set dynamically by useMermaidTheme hook
mermaid.initialize({
  startOnLoad: false,
  theme: "dark", // Default, will be overridden by useMermaidTheme
  securityLevel: "loose",
  suppressErrorRendering: true,
});

mermaid.parseError = function (err) {
  console.warn("Mermaid parse error (handled gracefully):", err);
};

export const mermaidCache = new Map<
  string,
  { svg: string; height: number; svgWidth: number; svgHeight: number }
>();

export const errorCache = new Map<
  string,
  { count: number; lastSeen: number }
>();

export const normalizeMermaidChart = (chart: string): string => {
  return chart.replace(/\[([\s\S]*?)\]/g, (match, rawLabel) => {
    const label = String(rawLabel);
    const hasNewline = /\r?\n/.test(label);
    const hasParen = /[()]/.test(label);
    if (!hasNewline && !hasParen) {
      return match;
    }

    const trimmed = label.trim();
    const parensAreShape =
      trimmed.startsWith("(") && trimmed.endsWith(")") && trimmed.length >= 2;

    let nextLabel = label;
    if (hasNewline) {
      nextLabel = nextLabel.replace(/\r?\n/g, "<br/>");
    }
    if (hasParen && !parensAreShape) {
      nextLabel = nextLabel.replace(/\(/g, "&#40;").replace(/\)/g, "&#41;");
    }

    return nextLabel === label ? match : `[${nextLabel}]`;
  });
};

export const cleanupErrorCache = () => {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  for (const [key, value] of errorCache.entries()) {
    if (now - value.lastSeen > fiveMinutes) {
      errorCache.delete(key);
    }
  }
};

export default mermaid;
