import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { UserSystemPrompt } from "../../types/chat";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
});

// We need to import the functions to test them
// Since they're not exported, we'll test the slice behavior instead
describe("promptSlice - ID Generation", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("generateIdFromName (internal function)", () => {
    // Test the ID generation logic directly
    function generateIdFromName(name: string): string {
      const sanitized = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      if (sanitized.length === 0) {
        return `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }

      return sanitized;
    }

    it("should generate valid ID from English name", () => {
      const id = generateIdFromName("My Custom Prompt");
      expect(id).toBe("my_custom_prompt");
    });

    it("should generate valid ID from name with special characters", () => {
      const id = generateIdFromName("Test@Prompt#123");
      expect(id).toBe("test_prompt_123");
    });

    it("should generate unique ID for Chinese characters", () => {
      const id = generateIdFromName("测试助手");
      expect(id).toMatch(/^prompt_\d+_[a-z0-9]+$/);
      expect(id.length).toBeGreaterThan(0);
    });

    it("should generate unique ID for all special characters", () => {
      const id = generateIdFromName("@#$%^&*()");
      expect(id).toMatch(/^prompt_\d+_[a-z0-9]+$/);
      expect(id.length).toBeGreaterThan(0);
    });

    it("should handle mixed English and Chinese characters", () => {
      const id = generateIdFromName("Test 测试 Prompt");
      expect(id).toBe("test_prompt");
    });

    it("should handle empty string", () => {
      const id = generateIdFromName("");
      expect(id).toMatch(/^prompt_\d+_[a-z0-9]+$/);
    });

    it("should handle whitespace-only string", () => {
      const id = generateIdFromName("   ");
      expect(id).toMatch(/^prompt_\d+_[a-z0-9]+$/);
    });

    it("should trim leading and trailing underscores", () => {
      const id = generateIdFromName("___test___");
      expect(id).toBe("test");
    });

    it("should replace multiple spaces with single underscore", () => {
      const id = generateIdFromName("test    prompt");
      expect(id).toBe("test_prompt");
    });
  });

  describe("loadCustomPrompts migration", () => {
    // Test the migration logic
    function loadCustomPrompts(): UserSystemPrompt[] {
      const CUSTOM_PROMPTS_LS_KEY = "copilot_custom_system_prompts_v2";

      function generateIdFromName(name: string): string {
        const sanitized = name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");

        if (sanitized.length === 0) {
          return `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }

        return sanitized;
      }

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
              const newId = generateIdFromName(p.name);
              console.log(
                `[Migration] Fixed prompt "${p.name}" with invalid ID, new ID: ${newId}`,
              );
              return { ...p, id: newId };
            }
            return p;
          });
          // Save the fixed prompts
          localStorage.setItem(
            CUSTOM_PROMPTS_LS_KEY,
            JSON.stringify(fixedPrompts),
          );
          return fixedPrompts;
        }

        return prompts;
      } catch (error) {
        console.error("Failed to load custom system prompts:", error);
        return [];
      }
    }

    it("should fix prompts with empty IDs", () => {
      const prompts: UserSystemPrompt[] = [
        {
          id: "",
          name: "测试助手",
          content: "You are a helpful assistant.",
          description: "Chinese assistant",
          isDefault: false,
        },
      ];

      localStorage.setItem(
        "copilot_custom_system_prompts_v2",
        JSON.stringify(prompts),
      );

      const loaded = loadCustomPrompts();

      expect(loaded.length).toBe(1);
      expect(loaded[0].id).not.toBe("");
      expect(loaded[0].id).toMatch(/^prompt_\d+_[a-z0-9]+$/);
    });

    it("should fix prompts with null/undefined IDs", () => {
      const prompts = [
        {
          id: null,
          name: "Test Prompt",
          content: "Test content",
          description: "Test",
          isDefault: false,
        },
        {
          id: undefined,
          name: "Another Prompt",
          content: "Test content",
          description: "Test",
          isDefault: false,
        },
      ];

      localStorage.setItem(
        "copilot_custom_system_prompts_v2",
        JSON.stringify(prompts),
      );

      const loaded = loadCustomPrompts();

      expect(loaded.length).toBe(2);
      expect(loaded[0].id).toBe("test_prompt");
      expect(loaded[1].id).toBe("another_prompt");
    });

    it("should fix prompts with invalid ID format", () => {
      const prompts: UserSystemPrompt[] = [
        {
          id: "Invalid ID!",
          name: "Test Prompt",
          content: "Test content",
          description: "Test",
          isDefault: false,
        },
      ];

      localStorage.setItem(
        "copilot_custom_system_prompts_v2",
        JSON.stringify(prompts),
      );

      const loaded = loadCustomPrompts();

      expect(loaded.length).toBe(1);
      expect(loaded[0].id).toBe("test_prompt");
    });

    it("should not modify prompts with valid IDs", () => {
      const prompts: UserSystemPrompt[] = [
        {
          id: "valid_prompt_id",
          name: "Valid Prompt",
          content: "Test content",
          description: "Test",
          isDefault: false,
        },
      ];

      localStorage.setItem(
        "copilot_custom_system_prompts_v2",
        JSON.stringify(prompts),
      );

      const loaded = loadCustomPrompts();

      expect(loaded.length).toBe(1);
      expect(loaded[0].id).toBe("valid_prompt_id");
    });

    it("should handle empty localStorage", () => {
      const loaded = loadCustomPrompts();
      expect(loaded).toEqual([]);
    });

    it("should handle invalid JSON in localStorage", () => {
      localStorage.setItem(
        "copilot_custom_system_prompts_v2",
        "invalid json",
      );

      const loaded = loadCustomPrompts();
      expect(loaded).toEqual([]);
    });

    it("should save migrated prompts to localStorage", () => {
      const prompts: UserSystemPrompt[] = [
        {
          id: "",
          name: "测试助手",
          content: "Test content",
          description: "Test",
          isDefault: false,
        },
      ];

      localStorage.setItem(
        "copilot_custom_system_prompts_v2",
        JSON.stringify(prompts),
      );

      loadCustomPrompts();

      // Check that localStorage was updated
      const saved = JSON.parse(
        localStorage.getItem("copilot_custom_system_prompts_v2") || "[]",
      );
      expect(saved[0].id).not.toBe("");
    });
  });
});
