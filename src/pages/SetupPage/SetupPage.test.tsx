import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SetupPage } from "./SetupPage";

const mockInvoke = vi.fn();

// Mock fetch globally for HTTP API calls
global.fetch = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe("SetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Tauri invoke for proxy config
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_proxy_config") {
        return Promise.resolve({
          http_proxy: "",
          https_proxy: "",
          username: null,
          password: null,
          remember: false,
        });
      }

      if (command === "set_proxy_config") {
        return Promise.resolve(undefined);
      }

      return Promise.resolve(undefined);
    });

    // Mock fetch for HTTP API calls
    (fetch as any).mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        is_complete: false,
        has_proxy_config: false,
        has_proxy_env: false,
        message:
          "No proxy environment variables detected. You can proceed without proxy or configure one manually if needed.",
      }),
    }));
  });

  it("loads backend setup status and shows the status message", async () => {
    (fetch as any).mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        is_complete: false,
        has_proxy_config: false,
        has_proxy_env: true,
        message:
          "Detected proxy environment variables: HTTP_PROXY, HTTPS_PROXY. You may need to configure proxy settings.",
      }),
    }));

    render(<SetupPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Next" }));

    expect(
      await screen.findByText(
        "Detected proxy environment variables: HTTP_PROXY, HTTPS_PROXY. You may need to configure proxy settings.",
      ),
    ).toBeTruthy();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });

  it("persists proxy settings and marks setup complete", async () => {
    render(<SetupPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Next" }));

    fireEvent.change(screen.getByLabelText("HTTP Proxy URL:"), {
      target: { value: "http://proxy.example.com:8080" },
    });
    fireEvent.change(await screen.findByLabelText("Username"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Complete Setup" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_proxy_config", {
        httpProxy: "http://proxy.example.com:8080",
        httpsProxy: "",
        username: "alice",
        password: "secret",
        remember: true,
      });
      expect(fetch).toHaveBeenCalled(); // markSetupComplete
    });

    expect(await screen.findByText("Setup Complete!")).toBeTruthy();
  });

  it("allows skipping setup and marks completion in backend", async () => {
    render(<SetupPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled(); // markSetupComplete
    });
    expect(await screen.findByText("Setup Complete!")).toBeTruthy();
  });

  it("treats completing without a proxy as skipping setup", async () => {
    render(<SetupPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete Setup" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled(); // markSetupComplete
      expect(
        mockInvoke.mock.calls.some((call) => call[0] === "set_proxy_config"),
      ).toBe(false);
    });
    expect(await screen.findByText("Setup Complete!")).toBeTruthy();
  });

  it("shows error when marking setup completion fails", async () => {
    (fetch as any).mockRejectedValue(new Error("fetch failed"));

    render(<SetupPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    // Wait longer because of retry logic
    expect(
      await screen.findByText(
        "Failed to complete setup. Please try again.",
        {},
        { timeout: 10000 },
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Setup Complete!")).toBeNull();
  });
});
