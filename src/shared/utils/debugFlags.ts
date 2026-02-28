type DebugFlagKey =
  | "bodhi_debug_ui_layout";

const isDevRuntime = (): boolean =>
  Boolean(import.meta.env.DEV) && import.meta.env.MODE !== "test";

const readFlag = (key: DebugFlagKey): boolean => {
  if (!isDevRuntime()) return false;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

export const isUILayoutDebugEnabled = (): boolean =>
  readFlag("bodhi_debug_ui_layout");

export const uiLayoutDebug = (
  message: string,
  data?: Record<string, unknown>,
): void => {
  if (!isUILayoutDebugEnabled()) return;
  // eslint-disable-next-line no-console -- dev-only debug trace
  console.log(`[ui-layout] ${message}`, data ?? "");
};

