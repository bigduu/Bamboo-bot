const EPS = 1;
const STABLE_FRAMES = 3;
const RESTORE_TIMEOUT_MS = 2000;

function clampToMaxScrollTop(el: HTMLElement, target: number) {
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  return Math.min(Math.max(0, target), max);
}

export function restoreScrollTopUntilStable(
  el: HTMLElement,
  targetScrollTop: number,
  isCancelled: () => boolean,
) {
  return new Promise<void>((resolve) => {
    let stable = 0;
    let last = -1;
    const start = performance.now();

    const tick = () => {
      if (isCancelled()) {
        resolve();
        return;
      }

      const desired = clampToMaxScrollTop(el, targetScrollTop);

      // 目标在增长（虚拟列表总高度变大）时，desired 也会随之变大；这里会持续"补偿"
      if (Math.abs(el.scrollTop - desired) > EPS) {
        el.scrollTop = desired;
        stable = 0;
      } else {
        stable = Math.abs(el.scrollTop - last) <= EPS ? stable + 1 : 0;
      }

      last = el.scrollTop;

      const timedOut = performance.now() - start > RESTORE_TIMEOUT_MS;
      if (stable >= STABLE_FRAMES || timedOut) {
        console.log("[ScrollRestore] Stabilized", {
          finalScrollTop: el.scrollTop,
          stable,
          timedOut,
          frames: Math.round((performance.now() - start) / 16.67),
        });
        resolve();
        return;
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}
