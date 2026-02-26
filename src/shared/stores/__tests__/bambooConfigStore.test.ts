import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBambooConfigStore } from "../bambooConfigStore";
import { serviceFactory } from "@services/common/ServiceFactory";

describe("useBambooConfigStore", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useBambooConfigStore.setState({
      config: null,
      proxyAuthStatus: null,
      isLoadingConfig: false,
      isLoadingProxyAuthStatus: false,
      lastLoadedAt: null,
      error: null,
    });
  });

  it("dedupes concurrent loadConfig calls", async () => {
    const spy = vi
      .spyOn(serviceFactory, "getBambooConfig")
      .mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { provider: "openai" } as any;
      });

    const store = useBambooConfigStore.getState();
    const [a, b] = await Promise.all([store.loadConfig(), store.loadConfig()]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(a.provider).toBe("openai");
    expect(b.provider).toBe("openai");
    expect(useBambooConfigStore.getState().config?.provider).toBe("openai");
  });

  it("returns cached config unless force is true", async () => {
    const spy = vi
      .spyOn(serviceFactory, "getBambooConfig")
      .mockResolvedValue({ provider: "anthropic" } as any);

    const store = useBambooConfigStore.getState();
    await store.loadConfig();
    await store.loadConfig();

    expect(spy).toHaveBeenCalledTimes(1);

    await store.loadConfig({ force: true });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("saveConfig updates store with saved response", async () => {
    vi.spyOn(serviceFactory, "setBambooConfig").mockResolvedValue({
      provider: "gemini",
      http_proxy: "http://proxy:8080",
    } as any);

    const store = useBambooConfigStore.getState();
    const saved = await store.saveConfig({ provider: "gemini" } as any);

    expect(saved.provider).toBe("gemini");
    expect(useBambooConfigStore.getState().config?.http_proxy).toBe(
      "http://proxy:8080",
    );
  });

  it("dedupes concurrent loadProxyAuthStatus calls", async () => {
    const spy = vi
      .spyOn(serviceFactory, "getProxyAuthStatus")
      .mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { configured: true, username: "alice" };
      });

    const store = useBambooConfigStore.getState();
    const [a, b] = await Promise.all([
      store.loadProxyAuthStatus(),
      store.loadProxyAuthStatus(),
    ]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(a.configured).toBe(true);
    expect(b.username).toBe("alice");
    expect(useBambooConfigStore.getState().proxyAuthStatus?.username).toBe(
      "alice",
    );
  });

  it("applyProxyAuth refreshes proxy auth status", async () => {
    const setSpy = vi
      .spyOn(serviceFactory, "setProxyAuth")
      .mockResolvedValue({ success: true } as any);
    const statusSpy = vi
      .spyOn(serviceFactory, "getProxyAuthStatus")
      .mockResolvedValue({ configured: true, username: "bob" });

    const store = useBambooConfigStore.getState();
    await store.applyProxyAuth({ username: "bob", password: "secret" });

    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(statusSpy).toHaveBeenCalledTimes(1);
    expect(useBambooConfigStore.getState().proxyAuthStatus?.username).toBe(
      "bob",
    );
  });
});

