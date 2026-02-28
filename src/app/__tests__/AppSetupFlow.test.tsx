import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInitializeStore } = vi.hoisted(() => ({
  mockInitializeStore: vi.fn(),
}));

// Mock fetch globally
global.fetch = vi.fn();

vi.mock("../MainLayout", () => ({
  MainLayout: () => <div>MainLayout</div>,
}));

vi.mock("../../pages/SetupPage", () => ({
  SetupPage: () => <div>SetupPage</div>,
}));

vi.mock("../../pages/ChatPage/store", () => ({
  initializeStore: mockInitializeStore,
}));

import App from "../App";

const mockSetupStatus = (status: {
  is_complete: boolean;
  has_proxy_config: boolean;
  has_proxy_env: boolean;
  message: string;
}) => {
  (fetch as any).mockImplementation(async () => ({
    ok: true,
    json: async () => status,
  }));
};

describe("App setup flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitializeStore.mockReset();
  });

  it("renders SetupPage when setup has not been completed", async () => {
    mockSetupStatus({
      is_complete: false,
      has_proxy_config: false,
      has_proxy_env: true,
      message:
        "Detected proxy environment variables: HTTP_PROXY. You may need to configure proxy settings.",
    });

    render(<App />);

    expect(await screen.findByText("SetupPage")).toBeTruthy();
    expect(screen.queryByText("MainLayout")).toBeNull();
    expect(mockInitializeStore).not.toHaveBeenCalled();
  });

  it("renders MainLayout and initializes store when proxy config exists", async () => {
    mockSetupStatus({
      is_complete: true,
      has_proxy_config: true,
      has_proxy_env: true,
      message: "Setup already completed.",
    });

    render(<App />);

    expect(await screen.findByText("MainLayout")).toBeTruthy();
    await waitFor(() => {
      expect(mockInitializeStore).toHaveBeenCalledTimes(1);
    });
  });

  it("renders MainLayout when backend marks setup complete", async () => {
    mockSetupStatus({
      is_complete: true,
      has_proxy_config: false,
      has_proxy_env: true,
      message: "Setup already completed.",
    });

    render(<App />);

    expect(await screen.findByText("MainLayout")).toBeTruthy();
    await waitFor(() => {
      expect(mockInitializeStore).toHaveBeenCalledTimes(1);
    });
  });

  it("skips setup when backend reports no setup needed", async () => {
    mockSetupStatus({
      is_complete: true,
      has_proxy_config: false,
      has_proxy_env: false,
      message:
        "No proxy environment variables detected. You can proceed without proxy.",
    });

    render(<App />);

    expect(await screen.findByText("MainLayout")).toBeTruthy();
    await waitFor(() => {
      expect(mockInitializeStore).toHaveBeenCalledTimes(1);
    });
  });

  it("renders SetupPage when setup status check fails", async () => {
    // Mock all retry attempts to fail
    (fetch as any).mockRejectedValue(new Error("fetch failed"));

    render(<App />);

    // Wait longer because of retry logic (3 attempts with backoff)
    expect(
      await screen.findByText("SetupPage", {}, { timeout: 10000 }),
    ).toBeTruthy();
    expect(screen.queryByText("MainLayout")).toBeNull();
  });
});
