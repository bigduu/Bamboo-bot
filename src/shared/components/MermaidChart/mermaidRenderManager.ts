export type MermaidRenderResult = {
  svg: string;
  width: number;
  height: number;
};

const MAX_CACHE = 200;

// LRU: Map 的迭代顺序就是插入顺序，get 时 refresh
const resultCache = new Map<string, MermaidRenderResult>();
const inFlight = new Map<string, Promise<MermaidRenderResult>>();

let mermaidPromise: Promise<any> | null = null;

async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid");
  }
  const mod = await mermaidPromise;
  return mod.default ?? mod;
}

function lruSet(key: string, val: MermaidRenderResult) {
  if (resultCache.has(key)) resultCache.delete(key);
  resultCache.set(key, val);
  if (resultCache.size > MAX_CACHE) {
    const firstKey = resultCache.keys().next().value as string | undefined;
    if (firstKey) resultCache.delete(firstKey);
  }
}

export function getCachedMermaid(chartKey: string) {
  const v = resultCache.get(chartKey);
  if (!v) return null;
  // refresh LRU
  resultCache.delete(chartKey);
  resultCache.set(chartKey, v);
  return v;
}

export function renderMermaidCached(
  chartKey: string,
  normalizedChart: string,
) {
  const cached = getCachedMermaid(chartKey);
  if (cached) return Promise.resolve(cached);

  const existing = inFlight.get(chartKey);
  if (existing) return existing;

  const p = (async () => {
    const mermaid = await getMermaid();

    // Initialize mermaid (only once)
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
      });
    } catch {
      // Already initialized
    }

    await mermaid.parse(normalizedChart);

    // 用 chartKey 派生一个确定性的 id，避免每次 render 生成不同 id 导致缓存难复用
    const id = `mermaid-${chartKey}`;
    const renderResult = await mermaid.render(id, normalizedChart);
    const svg = renderResult.svg ?? renderResult;

    // 使用 DOMParser 测量 SVG 尺寸
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, "image/svg+xml");
    const svgElement = doc.querySelector("svg");

    let width = 800;
    let height = 300;

    if (svgElement) {
      const viewBox = svgElement.getAttribute("viewBox");
      if (viewBox) {
        const parts = viewBox.split(/\s+/).map(Number);
        if (parts.length === 4) {
          width = parts[2] || 800;
          height = parts[3] || 300;
        }
      }

      // 备用方案：使用 getBoundingClientRect
      if (width === 800 && height === 300) {
        const tempDiv = document.createElement("div");
        tempDiv.style.cssText =
          "position:absolute;visibility:hidden;width:800px;";
        tempDiv.innerHTML = svg;
        document.body.appendChild(tempDiv);

        const rect = tempDiv.querySelector("svg")?.getBoundingClientRect();
        if (rect) {
          width = rect.width;
          height = rect.height;
        }

        document.body.removeChild(tempDiv);
      }
    }

    const out = { svg, width, height };

    // 关键：cache 不依赖组件 mounted
    lruSet(chartKey, out);

    return out;
  })().finally(() => {
    inFlight.delete(chartKey);
  });

  inFlight.set(chartKey, p);
  return p;
}

// For debugging
export function getCacheStats() {
  return {
    cacheSize: resultCache.size,
    inFlightSize: inFlight.size,
  };
}
