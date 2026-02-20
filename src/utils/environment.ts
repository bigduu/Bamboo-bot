/**
 * Environment Detection Utilities
 *
 * Detects whether the app is running in Tauri desktop or browser mode,
 * and provides feature flags for desktop-only functionality.
 */

/**
 * Check if running in Tauri desktop environment
 */
export const isTauriEnvironment = (): boolean => {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
};

/**
 * Require a desktop-only feature
 * Throws an error if not in Tauri environment
 */
export const requireDesktopFeature = (featureName: string): void => {
  if (!isTauriEnvironment()) {
    throw new Error(`"${featureName}" is only available in the desktop application`);
  }
};

/**
 * Feature flags for browser mode
 * These features are disabled when running in browser mode
 */
export const BROWSER_MODE_DISABLED_FEATURES = [
  'setup-wizard',       // Setup flow requires Tauri for some features
  'native-file-picker', // Native file dialogs
  'system-proxy-config' // System proxy configuration
] as const;

/**
 * Check if a feature is available in the current environment
 */
export const isFeatureAvailable = (feature: typeof BROWSER_MODE_DISABLED_FEATURES[number]): boolean => {
  if (BROWSER_MODE_DISABLED_FEATURES.includes(feature)) {
    return isTauriEnvironment();
  }
  return true;
};

/**
 * Get user-friendly message for disabled features
 */
export const getFeatureDisabledMessage = (feature: string): string => {
  return `"${feature}" is only available in the desktop application. Please use the Bamboo desktop app for this feature.`;
};
