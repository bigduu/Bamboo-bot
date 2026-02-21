import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  workspaceApiService,
  useWorkspaceApiService,
} from "../WorkspaceApiService";

// Mock the apiClient module - must be inside factory function
vi.mock("../../../../services/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock console methods
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
};

describe("WorkspaceApiService", () => {
  let mockApiClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    // Get the mocked apiClient
    const apiModule = await import("../../../../services/api");
    mockApiClient = apiModule.apiClient;
  });

  describe("validateWorkspacePath", () => {
    it("should validate workspace path", async () => {
      const mockResult = {
        path: "/valid/workspace",
        is_valid: true,
        file_count: 10,
        workspace_name: "workspace",
      };

      mockApiClient.post.mockResolvedValueOnce(mockResult);

      const result =
        await workspaceApiService.validateWorkspacePath("/valid/workspace");

      expect(mockApiClient.post).toHaveBeenCalledWith("workspace/validate", {
        path: "/valid/workspace",
      });

      expect(result).toEqual(mockResult);
    });

    it("should handle validation errors", async () => {
      const apiError = new Error("Invalid path");
      (apiError as any).status = 400;
      (apiError as any).statusText = "Bad Request";
      (apiError as any).body = "Invalid path";

      mockApiClient.post.mockRejectedValueOnce(apiError);

      await expect(
        workspaceApiService.validateWorkspacePath("/invalid/path"),
      ).rejects.toMatchObject({
        message: "Invalid path",
        status: 400,
      });
    });
  });

  describe("getRecentWorkspaces", () => {
    it("should get recent workspaces", async () => {
      const mockWorkspaces = [
        { path: "/workspace1", is_valid: true },
        { path: "/workspace2", is_valid: true },
      ];

      mockApiClient.get.mockResolvedValueOnce(mockWorkspaces);

      const result = await workspaceApiService.getRecentWorkspaces();

      expect(mockApiClient.get).toHaveBeenCalledWith(
        "workspace/recent",
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );

      expect(result).toEqual(mockWorkspaces);
    });
  });

  describe("addRecentWorkspace", () => {
    it("should add recent workspace", async () => {
      mockApiClient.post.mockResolvedValueOnce(undefined);

      await workspaceApiService.addRecentWorkspace("/new/workspace", {
        workspace_name: "new-workspace",
      });

      expect(mockApiClient.post).toHaveBeenCalledWith("workspace/recent", {
        path: "/new/workspace",
        metadata: { workspace_name: "new-workspace" },
      });
    });
  });

  describe("getPathSuggestions", () => {
    it("should get path suggestions", async () => {
      const mockSuggestions = {
        suggestions: [
          { path: "/home", name: "Home", suggestion_type: "home" },
          {
            path: "/documents",
            name: "Documents",
            suggestion_type: "documents",
          },
        ],
      };

      mockApiClient.get.mockResolvedValueOnce(mockSuggestions);

      const result = await workspaceApiService.getPathSuggestions();

      expect(mockApiClient.get).toHaveBeenCalledWith("workspace/suggestions");

      expect(result).toEqual(mockSuggestions);
    });
  });

  describe("listWorkspaceFiles", () => {
    it("should list workspace files", async () => {
      const mockFiles = [
        { path: "/workspace/file1.txt", name: "file1.txt", type: "file" },
        { path: "/workspace/folder", name: "folder", type: "directory" },
      ];

      mockApiClient.post.mockResolvedValueOnce(mockFiles);

      const result = await workspaceApiService.listWorkspaceFiles("/workspace");

      expect(mockApiClient.post).toHaveBeenCalledWith("workspace/files", {
        path: "/workspace",
        max_depth: 3,
        max_entries: 500,
        include_hidden: false,
      });

      expect(result).toEqual(mockFiles);
    });
  });

  describe("getHealthStatus", () => {
    it("should return available status when API is working", async () => {
      // Health check calls apiClient.get twice (once for health check, once in getRecent)
      mockApiClient.get
        .mockResolvedValueOnce([])  // First call: health check
        .mockResolvedValueOnce([]); // Second call: getRecent

      const status = await workspaceApiService.getHealthStatus();

      expect(status.available).toBe(true);
      expect(typeof status.latency).toBe("number");
      expect(status.error).toBeUndefined();
    });

    it("should return unavailable status when API fails", async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error("API unavailable"));

      const status = await workspaceApiService.getHealthStatus();

      expect(status.available).toBe(false);
      expect(status.latency).toBeUndefined();
      expect(status.error).toBe("API unavailable");
    });
  });

  describe("custom configuration", () => {
    it("should use unified apiClient with default base URL", async () => {
      const service = useWorkspaceApiService();

      mockApiClient.get.mockResolvedValueOnce([]);

      await service.getRecentWorkspaces();

      // Unified apiClient uses the global base URL with /v1 prefix
      expect(mockApiClient.get).toHaveBeenCalledWith(
        "workspace/recent",
        expect.any(Object),
      );
    });

    it("should use default base URL when no custom URL provided", async () => {
      const service = useWorkspaceApiService();

      mockApiClient.get.mockResolvedValueOnce([]);

      await service.getRecentWorkspaces();

      expect(mockApiClient.get).toHaveBeenCalledWith(
        "workspace/recent",
        expect.any(Object),
      );
    });
  });
});

describe("useWorkspaceApiService", () => {
  it("should return a new WorkspaceApiService instance", () => {
    const service = useWorkspaceApiService();

    expect(service).toHaveProperty("validateWorkspacePath");
    expect(service).toHaveProperty("getRecentWorkspaces");
    expect(service).toHaveProperty("addRecentWorkspace");
    expect(service).toHaveProperty("getPathSuggestions");
    expect(service).toHaveProperty("listWorkspaceFiles");
  });

  it("should accept custom options", () => {
    const customOptions = {
      baseUrl: "/custom/api",
      timeoutMs: 5000,
      retries: 1,
    };

    const service = useWorkspaceApiService(customOptions);

    expect(service).toHaveProperty("validateWorkspacePath");
  });
});
