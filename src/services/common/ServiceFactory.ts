import { invoke } from "@tauri-apps/api/core";
import { apiClient } from "../api";

/**
 * Bamboo configuration structure
 */
export interface BambooConfig {
  model?: string;
  api_key?: string;
  api_base?: string;
  http_proxy?: string;
  https_proxy?: string;
  headless_auth?: boolean;
  [key: string]: unknown;
}

/**
 * Anthropic model mapping configuration
 */
export interface AnthropicModelMapping {
  mappings: Record<string, string>;
}

/**
 * Generic API success response
 */
export interface ApiSuccessResponse {
  success: boolean;
}

export interface UtilityService {
  /**
   * Copy text to clipboard
   */
  copyToClipboard(text: string): Promise<void>;

  /**
   * Get Bamboo config
   */
  getBambooConfig(): Promise<BambooConfig>;

  /**
   * Set Bamboo config
   */
  setBambooConfig(config: BambooConfig): Promise<BambooConfig>;

  /**
   * Set proxy auth credentials
   */
  setProxyAuth(auth: { username: string; password: string }): Promise<ApiSuccessResponse>;

  /**
   * Get proxy auth status (returns whether proxy auth is configured, without password)
   */
  getProxyAuthStatus(): Promise<{
    configured: boolean;
    username: string | null;
  }>;

  /**
   * Clear proxy auth credentials
   */
  clearProxyAuth(): Promise<ApiSuccessResponse>;

  /**
   * Get Anthropic model mapping
   */
  getAnthropicModelMapping(): Promise<AnthropicModelMapping>;

  /**
   * Set Anthropic model mapping
   */
  setAnthropicModelMapping(mapping: AnthropicModelMapping): Promise<AnthropicModelMapping>;

  /**
   * Reset Bamboo config (delete config.json)
   */
  resetBambooConfig(): Promise<ApiSuccessResponse>;

  /**
   * Reset setup status (mark as incomplete)
   */
  resetSetupStatus(): Promise<void>;

  /**
   * Generic invoke method for custom commands
   */
  invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;
}

class HttpUtilityService implements Partial<UtilityService> {
  async getBambooConfig(): Promise<BambooConfig> {
    try {
      return await apiClient.get<BambooConfig>("bamboo/config");
    } catch (error) {
      console.error("Failed to fetch Bamboo config:", error);
      return {};
    }
  }

  async setBambooConfig(config: BambooConfig): Promise<BambooConfig> {
    return apiClient.post<BambooConfig>("bamboo/config", config);
  }

  async setProxyAuth(auth: {
    username: string;
    password: string;
  }): Promise<ApiSuccessResponse> {
    return apiClient.post<ApiSuccessResponse>("bamboo/proxy-auth", auth);
  }

  async getProxyAuthStatus(): Promise<{
    configured: boolean;
    username: string | null;
  }> {
    try {
      return await apiClient.get<{
        configured: boolean;
        username: string | null;
      }>("bamboo/proxy-auth/status");
    } catch (error) {
      console.error("Failed to fetch proxy auth status:", error);
      return { configured: false, username: null };
    }
  }

  async clearProxyAuth(): Promise<ApiSuccessResponse> {
    return apiClient.post<ApiSuccessResponse>("bamboo/proxy-auth", {
      username: "",
      password: "",
    });
  }

  async getAnthropicModelMapping(): Promise<AnthropicModelMapping> {
    try {
      return await apiClient.get<AnthropicModelMapping>(
        "bamboo/anthropic-model-mapping",
      );
    } catch (error) {
      console.error("Failed to fetch Anthropic model mapping:", error);
      return { mappings: {} };
    }
  }

  async setAnthropicModelMapping(
    mapping: AnthropicModelMapping,
  ): Promise<AnthropicModelMapping> {
    return apiClient.post<AnthropicModelMapping>(
      "bamboo/anthropic-model-mapping",
      mapping,
    );
  }

  async resetBambooConfig(): Promise<ApiSuccessResponse> {
    return apiClient.post<ApiSuccessResponse>("bamboo/config/reset", {});
  }
}

class TauriUtilityService {
  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text: string): Promise<void> {
    await invoke("copy_to_clipboard", { text });
  }

  /**
   * Reset setup status (mark as incomplete)
   */
  async resetSetupStatus(): Promise<void> {
    await invoke("mark_setup_incomplete");
  }

  /**
   * Generic invoke method for custom commands
   */
  async invoke<T = unknown>(
    command: string,
    args?: Record<string, unknown>,
  ): Promise<T> {
    return await invoke(command, args);
  }
}

/**
 * ServiceFactory - Simplified to use only Web/HTTP mode
 * All services now use HTTP API calls to the backend
 */
export class ServiceFactory {
  private static instance: ServiceFactory;

  // Service instances
  private tauriUtilityService = new TauriUtilityService();
  private httpUtilityService = new HttpUtilityService();

  private constructor() {
    // No mode switching needed - always use Web/HTTP mode
  }

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  getUtilityService(): UtilityService {
    // Composite service:
    // - Native functions (copyToClipboard, invoke) use Tauri
    return {
      copyToClipboard: (text: string) =>
        this.tauriUtilityService.copyToClipboard(text),
      invoke: <T = unknown>(
        command: string,
        args?: Record<string, unknown>,
      ): Promise<T> => this.tauriUtilityService.invoke(command, args),
      getBambooConfig: () => this.httpUtilityService.getBambooConfig(),
      setBambooConfig: (config: BambooConfig) =>
        this.httpUtilityService.setBambooConfig(config),
      setProxyAuth: (auth: { username: string; password: string }) =>
        this.httpUtilityService.setProxyAuth(auth),
      getProxyAuthStatus: () => this.httpUtilityService.getProxyAuthStatus(),
      clearProxyAuth: () => this.httpUtilityService.clearProxyAuth(),
      getAnthropicModelMapping: () =>
        this.httpUtilityService.getAnthropicModelMapping(),
      setAnthropicModelMapping: (mapping: AnthropicModelMapping) =>
        this.httpUtilityService.setAnthropicModelMapping(mapping),
      resetBambooConfig: () => this.httpUtilityService.resetBambooConfig(),
      resetSetupStatus: () => this.tauriUtilityService.resetSetupStatus(),
    };
  }

  // Convenience methods for direct access
  async copyToClipboard(text: string): Promise<void> {
    return this.getUtilityService().copyToClipboard(text);
  }

  async getBambooConfig(): Promise<BambooConfig> {
    return this.getUtilityService().getBambooConfig();
  }

  async setBambooConfig(config: BambooConfig): Promise<BambooConfig> {
    return this.getUtilityService().setBambooConfig(config);
  }

  async setProxyAuth(auth: {
    username: string;
    password: string;
  }): Promise<ApiSuccessResponse> {
    return this.getUtilityService().setProxyAuth(auth);
  }

  async getProxyAuthStatus(): Promise<{
    configured: boolean;
    username: string | null;
  }> {
    return this.getUtilityService().getProxyAuthStatus();
  }

  async clearProxyAuth(): Promise<ApiSuccessResponse> {
    return this.getUtilityService().clearProxyAuth();
  }

  async getAnthropicModelMapping(): Promise<AnthropicModelMapping> {
    return this.getUtilityService().getAnthropicModelMapping();
  }

  async setAnthropicModelMapping(
    mapping: AnthropicModelMapping,
  ): Promise<AnthropicModelMapping> {
    return this.getUtilityService().setAnthropicModelMapping(mapping);
  }

  async resetBambooConfig(): Promise<ApiSuccessResponse> {
    return this.getUtilityService().resetBambooConfig();
  }

  async resetSetupStatus(): Promise<void> {
    return this.getUtilityService().resetSetupStatus();
  }

  async invoke<T = unknown>(
    command: string,
    args?: Record<string, unknown>,
  ): Promise<T> {
    return this.getUtilityService().invoke(command, args);
  }
}

// Export singleton instance for easy access
export const serviceFactory = ServiceFactory.getInstance();
