import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SetupPage } from "./SetupPage";

// Mock fetch globally for HTTP API calls
global.fetch = vi.fn();

describe("SetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch for HTTP API calls (default happy path).
    (fetch as any).mockImplementation(async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      const path = url.toString();

      // Initial config prefill
      if (method === "GET" && path.includes("/bamboo/config")) {
        return {
          ok: true,
          headers: { get: () => "application/json" },
          json: async () => ({ http_proxy: "", https_proxy: "" }),
        };
      }
      if (method === "GET" && path.includes("/bamboo/proxy-auth/status")) {
        return {
          ok: true,
          headers: { get: () => "application/json" },
          json: async () => ({ configured: false, username: null }),
        };
      }

      // Setup status
      if (method === "GET" && path.includes("/bamboo/setup/status")) {
        return {
          ok: true,
          headers: { get: () => "application/json" },
          json: async () => ({
            is_complete: false,
            has_proxy_config: false,
            has_proxy_env: false,
            message:
              "No proxy environment variables detected. You can proceed without proxy or configure one manually if needed.",
          }),
        };
      }

      // Save config/auth + mark setup complete
      if (method === "POST" && path.includes("/bamboo/config")) {
        return {
          ok: true,
          headers: { get: () => "application/json" },
          json: async () => ({}),
        };
      }
      if (method === "POST" && path.includes("/bamboo/proxy-auth")) {
        return {
          ok: true,
          headers: { get: () => "application/json" },
          json: async () => ({ success: true }),
        };
      }
      if (method === "POST" && path.includes("/bamboo/setup/complete")) {
        return {
          ok: true,
          headers: { get: () => "application/json" },
          json: async () => ({ success: true }),
        };
      }

      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({}),
      };
    });
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
      // setBambooConfig + setProxyAuth + markSetupComplete
      expect(
        (fetch as any).mock.calls.some(
          (call: any[]) =>
            call[0].includes("/bamboo/config") &&
            ((call[1]?.method || "GET") as string).toUpperCase() === "POST",
        ),
      ).toBe(true);
      expect(
        (fetch as any).mock.calls.some(
          (call: any[]) =>
            call[0].includes("/bamboo/proxy-auth") &&
            !call[0].includes("/bamboo/proxy-auth/status") &&
            ((call[1]?.method || "GET") as string).toUpperCase() === "POST",
        ),
      ).toBe(true);
      expect(
        (fetch as any).mock.calls.some((call: any[]) =>
          call[0].includes("/bamboo/setup/complete"),
        ),
      ).toBe(true);
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
        (fetch as any).mock.calls.some(
          (call: any[]) =>
            call[0].includes("/bamboo/config") &&
            ((call[1]?.method || "GET") as string).toUpperCase() === "POST",
        ),
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
