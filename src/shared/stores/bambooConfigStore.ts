import { create } from "zustand";
import { serviceFactory, type BambooConfig } from "@services/common/ServiceFactory";

export interface ProxyAuthStatus {
  configured: boolean;
  username: string | null;
}

type LoadOptions = { force?: boolean };

interface BambooConfigStoreState {
  config: BambooConfig | null;
  proxyAuthStatus: ProxyAuthStatus | null;
  isLoadingConfig: boolean;
  isLoadingProxyAuthStatus: boolean;
  lastLoadedAt: number | null;
  error: string | null;

  loadConfig: (options?: LoadOptions) => Promise<BambooConfig>;
  saveConfig: (config: BambooConfig) => Promise<BambooConfig>;
  patchConfig: (patch: BambooConfig) => Promise<BambooConfig>;

  loadProxyAuthStatus: (options?: LoadOptions) => Promise<ProxyAuthStatus>;
  applyProxyAuth: (auth: { username: string; password: string }) => Promise<void>;
  clearProxyAuth: () => Promise<void>;
}

let configInFlight: Promise<BambooConfig> | null = null;
let proxyStatusInFlight: Promise<ProxyAuthStatus> | null = null;

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

export const useBambooConfigStore = create<BambooConfigStoreState>((set, get) => ({
  config: null,
  proxyAuthStatus: null,
  isLoadingConfig: false,
  isLoadingProxyAuthStatus: false,
  lastLoadedAt: null,
  error: null,

  loadConfig: async ({ force = false }: LoadOptions = {}) => {
    const existing = get().config;
    if (!force && existing) {
      return existing;
    }

    if (configInFlight) {
      return configInFlight;
    }

    configInFlight = (async () => {
      set({ isLoadingConfig: true, error: null });
      try {
        const config = (await serviceFactory.getBambooConfig()) ?? {};
        set({ config, lastLoadedAt: Date.now(), error: null });
        return config;
      } catch (error) {
        const message = toErrorMessage(error, "Failed to load Bamboo config");
        set({ error: message });
        throw error;
      } finally {
        set({ isLoadingConfig: false });
      }
    })();

    try {
      return await configInFlight;
    } finally {
      configInFlight = null;
    }
  },

  saveConfig: async (config: BambooConfig) => {
    set({ isLoadingConfig: true, error: null, config });
    try {
      const saved = await serviceFactory.setBambooConfig(config);
      set({ config: saved, lastLoadedAt: Date.now(), error: null });
      return saved;
    } catch (error) {
      const message = toErrorMessage(error, "Failed to save Bamboo config");
      set({ error: message });
      throw error;
    } finally {
      set({ isLoadingConfig: false });
    }
  },

  patchConfig: async (patch: BambooConfig) => {
    const current = await get().loadConfig();
    const next: BambooConfig = { ...(current ?? {}), ...(patch ?? {}) };
    return get().saveConfig(next);
  },

  loadProxyAuthStatus: async ({ force = false }: LoadOptions = {}) => {
    const existing = get().proxyAuthStatus;
    if (!force && existing) {
      return existing;
    }

    if (proxyStatusInFlight) {
      return proxyStatusInFlight;
    }

    proxyStatusInFlight = (async () => {
      set({ isLoadingProxyAuthStatus: true, error: null });
      try {
        const status = await serviceFactory.getProxyAuthStatus();
        set({ proxyAuthStatus: status, error: null });
        return status;
      } catch (error) {
        const message = toErrorMessage(error, "Failed to load proxy auth status");
        set({ error: message });
        throw error;
      } finally {
        set({ isLoadingProxyAuthStatus: false });
      }
    })();

    try {
      return await proxyStatusInFlight;
    } finally {
      proxyStatusInFlight = null;
    }
  },

  applyProxyAuth: async (auth: { username: string; password: string }) => {
    await serviceFactory.setProxyAuth(auth);
    await get().loadProxyAuthStatus({ force: true });
  },

  clearProxyAuth: async () => {
    await serviceFactory.clearProxyAuth();
    await get().loadProxyAuthStatus({ force: true });
  },
}));

