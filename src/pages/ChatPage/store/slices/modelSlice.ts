import { StateCreator } from "zustand";
import {
  modelService,
  ProxyAuthRequiredError,
} from "../../services/ModelService";
import { serviceFactory } from "@services/common/ServiceFactory";
import type { AppState } from "../";

let fetchModelsInFlight: Promise<void> | null = null;

export interface ModelSlice {
  // Model Management State
  models: string[];
  selectedModel: string | undefined;
  isLoadingModels: boolean;
  modelsError: string | null;
  configModel: string | undefined; // model from config.json

  // Actions
  fetchModels: () => Promise<void>;
  setSelectedModel: (modelId: string) => void;
  loadConfigModel: () => Promise<void>;
}

export const createModelSlice: StateCreator<AppState, [], [], ModelSlice> = (
  set,
  get,
) => ({
  // Initial state - Don't read from localStorage anymore (provider-specific models)
  models: [],
  selectedModel: undefined,
  isLoadingModels: false,
  modelsError: null,
  configModel: undefined,

  // Model Management Actions
  setSelectedModel: (modelId) => {
    set({ selectedModel: modelId });
  },

  // Load model from config.json
  // NOTE: This is deprecated - models should be configured per-provider
  // Keeping this for backward compatibility with Copilot model list
  loadConfigModel: async () => {
    try {
      const config = await serviceFactory.getBambooConfig();
      const configModel =
        typeof config?.model === "string" ? config.model : undefined;
      if (configModel) {
        set({ configModel });
        // Don't write to localStorage anymore - provider-specific models are used now
        // const currentSelected = get().selectedModel;
        // if (!currentSelected) {
        //   set({ selectedModel: configModel });
        //   localStorage.setItem(SELECTED_MODEL_LS_KEY, configModel);
        // }
      }
    } catch (error) {
      console.error("Failed to load model from config:", error);
    }
  },

  fetchModels: async () => {
    if (fetchModelsInFlight) {
      return fetchModelsInFlight;
    }

    fetchModelsInFlight = (async () => {
      set({ isLoadingModels: true, modelsError: null });
      try {
        // Check setup status before fetching models
        try {
          const setupStatus = await serviceFactory.getSetupStatus();
          if (!setupStatus.is_complete) {
            console.log("Setup not complete, skipping model fetch");
            set({
              models: [],
              selectedModel: undefined,
              isLoadingModels: false,
              modelsError: "Complete setup to access all models",
            });
            return;
          }
        } catch (setupError) {
          console.error("Failed to check setup status:", setupError);
          // Continue with fetch if setup status check fails
        }

        const availableModels = await modelService.getModels();
        set((state) => {
          const currentSelected = state.selectedModel;

          let newSelectedModel = state.selectedModel;

          if (currentSelected && availableModels.includes(currentSelected)) {
            // Current selection is valid, do nothing
          } else if (availableModels.length > 0) {
            newSelectedModel = availableModels[0];
          } else {
            newSelectedModel = undefined; // No models available
          }

          return {
            ...state,
            models: availableModels,
            selectedModel: newSelectedModel,
            modelsError:
              availableModels.length > 0 ? null : "No available model options",
          };
        });

        if (get().models.length === 0) {
          console.warn("No models available from service");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Failed to fetch models:", err);

        if (err instanceof ProxyAuthRequiredError) {
          set((state) => {
            return {
              ...state,
              models: state.models,
              selectedModel: state.selectedModel,
              modelsError:
                errorMessage ||
                "Proxy authentication required. Please configure proxy auth.",
            };
          });
          return;
        }

        set((state) => ({
          ...state,
          models: [],
          selectedModel: state.selectedModel,
          modelsError: errorMessage,
        }));
      } finally {
        set({ isLoadingModels: false });
      }
    })();

    try {
      await fetchModelsInFlight;
    } finally {
      fetchModelsInFlight = null;
    }
  },
});
