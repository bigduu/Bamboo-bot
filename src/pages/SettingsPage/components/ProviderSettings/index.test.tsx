import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderSettings } from "./index";

// Mock fetch globally for HTTP API calls.
global.fetch = vi.fn();

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.ok === false ? "Bad Request" : "OK",
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("ProviderSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs server-side validate before saving and blocks save when invalid", async () => {
    (fetch as any).mockImplementation(async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      const path = url.toString();

      if (method === "POST" && path.includes("/bamboo/copilot/auth/status")) {
        return jsonResponse({ authenticated: false });
      }

      if (method === "GET" && path.includes("/bamboo/settings/provider")) {
        return jsonResponse({
          provider: "openai",
          providers: { openai: { api_key: "sk-masked", model: "gpt-4o" } },
        });
      }

      if (method === "POST" && path.includes("/bamboo/config/validate")) {
        return jsonResponse({
          valid: false,
          errors: {
            provider: [
              {
                path: "providers.openai.api_key",
                message: "OpenAI API key is required",
              },
            ],
          },
        });
      }

      if (method === "POST" && path.includes("/bamboo/settings/provider")) {
        throw new Error("saveProviderConfig must not be called when validation fails");
      }

      return jsonResponse({});
    });

    render(<ProviderSettings />);

    const saveButton = await screen.findByTestId("save-api-settings");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(
        (fetch as any).mock.calls.some(
          (call: any[]) =>
            call[0].includes("/bamboo/config/validate") &&
            ((call[1]?.method || "GET") as string).toUpperCase() === "POST",
        ),
      ).toBe(true);
    });

    expect(
      (fetch as any).mock.calls.some(
        (call: any[]) =>
          call[0].includes("/bamboo/settings/provider") &&
          ((call[1]?.method || "GET") as string).toUpperCase() === "POST",
      ),
    ).toBe(false);

    expect(await screen.findByText("OpenAI API key is required")).toBeTruthy();
  });

  it("saves when validation passes (and refreshes provider config during apply)", async () => {
    let providerGetCount = 0;
    (fetch as any).mockImplementation(async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      const path = url.toString();

      if (method === "POST" && path.includes("/bamboo/copilot/auth/status")) {
        return jsonResponse({ authenticated: false });
      }

      if (method === "GET" && path.includes("/bamboo/settings/provider")) {
        providerGetCount += 1;
        return jsonResponse({
          provider: "openai",
          providers: { openai: { api_key: "sk-masked", model: "gpt-4o" } },
        });
      }

      if (method === "POST" && path.includes("/bamboo/config/validate")) {
        return jsonResponse({ valid: true, errors: {} });
      }

      if (method === "POST" && path.includes("/bamboo/settings/provider")) {
        return jsonResponse({ success: true, provider: "openai" });
      }

      return jsonResponse({});
    });

    render(<ProviderSettings />);

    const saveButton = await screen.findByTestId("save-api-settings");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(
        (fetch as any).mock.calls.some(
          (call: any[]) =>
            call[0].includes("/bamboo/config/validate") &&
            ((call[1]?.method || "GET") as string).toUpperCase() === "POST",
        ),
      ).toBe(true);

      expect(
        (fetch as any).mock.calls.some(
          (call: any[]) =>
            call[0].includes("/bamboo/settings/provider") &&
            ((call[1]?.method || "GET") as string).toUpperCase() === "POST",
        ),
      ).toBe(true);
    });

    // One GET during initial loadConfig + one GET during apply (provider store refresh).
    await waitFor(() => {
      expect(providerGetCount).toBeGreaterThanOrEqual(2);
    });
  });
});

