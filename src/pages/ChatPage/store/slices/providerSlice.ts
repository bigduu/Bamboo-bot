import { create } from "zustand";
import { settingsService } from "@services/config/SettingsService";
import type { ProviderConfig, ProviderType } from "../../types/providerConfig";

/**
 * Provider State
 *
 * Manages the current active provider and its configuration.
 * This is the single source of truth for provider-related state.
 */
interface ProviderState {
  // Current active provider
  currentProvider: ProviderType;

  // Full provider configuration loaded from backend
  providerConfig: ProviderConfig;

  // Loading state
  isLoading: boolean;

  // Error state
  error: string | null;

  // Actions
  loadProviderConfig: () => Promise<void>;
  setCurrentProvider: (provider: ProviderType) => void;
  updateProviderConfig: (config: Partial<ProviderConfig>) => void;

  // Getters
  getActiveModel: () => string | undefined;
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  // Initial state
  currentProvider: "copilot",
  providerConfig: {
    provider: "copilot",
    providers: {},
  },
  isLoading: false,
  error: null,

  // Load provider configuration from backend
  loadProviderConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await settingsService.getProviderConfig();

      // Backend handles migration from old config format
      // No need for frontend migration anymore

      set({
        providerConfig: config,
        currentProvider: config.provider as ProviderType,
        isLoading: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to load provider config",
        isLoading: false,
      });
    }
  },

  // Set current provider
  setCurrentProvider: (provider: ProviderType) => {
    set({ currentProvider: provider });
  },

  // Update provider configuration
  updateProviderConfig: (config: Partial<ProviderConfig>) => {
    set((state) => ({
      providerConfig: {
        ...state.providerConfig,
        ...config,
      },
    }));
  },

  // Get the active model for current provider
  getActiveModel: () => {
    const state = get();
    const providerConfig =
      state.providerConfig.providers[state.currentProvider];

    if (!providerConfig) {
      return undefined;
    }

    // Return the model if it exists
    if ("model" in providerConfig && providerConfig.model) {
      return providerConfig.model;
    }

    return undefined;
  },
}));
