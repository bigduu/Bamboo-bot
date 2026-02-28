import { StateCreator } from "zustand";
import { UserSystemPrompt } from "../../types/chat";
import { SystemPromptService } from "../../services/SystemPromptService";
import { getDefaultSystemPrompts } from "../../utils/defaultSystemPrompts";
import type { AppState } from "../";

const LAST_SELECTED_PROMPT_ID_LS_KEY = "copilot_last_selected_prompt_id";
const CUSTOM_PROMPTS_LS_KEY = "copilot_custom_system_prompts_v2";
const systemPromptService = SystemPromptService.getInstance();

// Helper function to generate ID from name
function generateIdFromName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  // If the name contains no ASCII characters, generate a unique ID
  if (sanitized.length === 0) {
    return `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  return sanitized;
}

export interface PromptSlice {
  // State
  systemPrompts: UserSystemPrompt[];
  lastSelectedPromptId: string | null;

  // Actions
  loadSystemPrompts: () => Promise<void>;
  addSystemPrompt: (prompt: Omit<UserSystemPrompt, "id">) => Promise<void>;
  updateSystemPrompt: (prompt: UserSystemPrompt) => Promise<void>;
  deleteSystemPrompt: (promptId: string) => Promise<void>;
  setLastSelectedPromptId: (promptId: string) => void;
}

export const createPromptSlice: StateCreator<AppState, [], [], PromptSlice> = (
  set,
  get,
) => ({
  // Initial state
  systemPrompts: [],
  lastSelectedPromptId:
    localStorage.getItem(LAST_SELECTED_PROMPT_ID_LS_KEY) || null,

  // System prompt management
  loadSystemPrompts: async () => {
    let prompts: UserSystemPrompt[] = [];
    try {
      const presets = await systemPromptService.getSystemPromptPresets();
      prompts = presets.map((p: UserSystemPrompt) => ({
        id: p.id,
        name: p.name,
        content: p.content,
        description: p.description,
        isDefault: Boolean(p.isDefault),
      }));
    } catch (error) {
      console.error("Failed to load system prompts from config:", error);
    }

    const customPrompts = loadCustomPrompts();
    let merged = mergePrompts(prompts, customPrompts);
    if (merged.length === 0) {
      merged = getDefaultSystemPrompts();
      saveCustomPrompts(merged);
    }
    set({ systemPrompts: merged });
  },

  addSystemPrompt: async (promptData) => {
    try {
      // Generate ID from name if not provided
      const id = generateIdFromName(promptData.name);

      const customPrompts = loadCustomPrompts();
      if (customPrompts.some((prompt) => prompt.id === id)) {
        throw new Error(`System prompt '${id}' already exists`);
      }

      const newPrompt: UserSystemPrompt = {
        id,
        name: promptData.name,
        content: promptData.content,
        description: promptData.description,
        isDefault: false,
      };
      const updatedCustom = [...customPrompts, newPrompt];
      saveCustomPrompts(updatedCustom);
      await get().loadSystemPrompts();
    } catch (error) {
      console.error("Failed to add system prompt:", error);
      throw error;
    }
  },

  updateSystemPrompt: async (promptToUpdate) => {
    try {
      const customPrompts = loadCustomPrompts();
      const index = customPrompts.findIndex(
        (prompt) => prompt.id === promptToUpdate.id,
      );
      if (index === -1) {
        throw new Error(`System prompt '${promptToUpdate.id}' is read-only`);
      }
      const updated = [...customPrompts];
      updated[index] = {
        ...updated[index],
        name: promptToUpdate.name,
        content: promptToUpdate.content,
        description: promptToUpdate.description,
        isDefault: false,
      };
      saveCustomPrompts(updated);

      await get().loadSystemPrompts();
    } catch (error) {
      console.error("Failed to update system prompt:", error);
      throw error;
    }
  },

  deleteSystemPrompt: async (promptId) => {
    try {
      const customPrompts = loadCustomPrompts();
      const updated = customPrompts.filter((prompt) => prompt.id !== promptId);
      if (updated.length === customPrompts.length) {
        throw new Error(`System prompt '${promptId}' is read-only`);
      }
      saveCustomPrompts(updated);
      await get().loadSystemPrompts();
    } catch (error) {
      console.error("Failed to delete system prompt:", error);
      throw error;
    }
  },

  setLastSelectedPromptId: (promptId: string) => {
    set({ lastSelectedPromptId: promptId });
    try {
      localStorage.setItem(LAST_SELECTED_PROMPT_ID_LS_KEY, promptId);
    } catch (error) {
      console.error(
        "Failed to save last selected prompt ID to localStorage:",
        error,
      );
    }
  },
});

const loadCustomPrompts = (): UserSystemPrompt[] => {
  try {
    const stored = localStorage.getItem(CUSTOM_PROMPTS_LS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    const prompts = Array.isArray(parsed) ? parsed : [];

    // Migration: Fix prompts with empty or missing IDs
    const needsMigration = prompts.some(
      (p) => !p.id || p.id.trim() === "" || !p.id.match(/^[a-z0-9_]+$/),
    );

    if (needsMigration) {
      const fixedPrompts = prompts.map((p) => {
        if (!p.id || p.id.trim() === "" || !p.id.match(/^[a-z0-9_]+$/)) {
          const newId = `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          return { ...p, id: newId };
        }
        return p;
      });
      // Save the fixed prompts
      saveCustomPrompts(fixedPrompts);
      return fixedPrompts;
    }

    return prompts;
  } catch (error) {
    console.error("Failed to load custom system prompts:", error);
    return [];
  }
};

const saveCustomPrompts = (prompts: UserSystemPrompt[]): void => {
  try {
    localStorage.setItem(CUSTOM_PROMPTS_LS_KEY, JSON.stringify(prompts));
  } catch (error) {
    console.error("Failed to save custom system prompts:", error);
  }
};

const mergePrompts = (
  presets: UserSystemPrompt[],
  customPrompts: UserSystemPrompt[],
): UserSystemPrompt[] => {
  const byId = new Map<string, UserSystemPrompt>();
  presets.forEach((prompt) => {
    byId.set(prompt.id, prompt);
  });
  customPrompts.forEach((prompt) => {
    byId.set(prompt.id, prompt);
  });
  return Array.from(byId.values());
};
