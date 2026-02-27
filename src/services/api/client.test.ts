import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClient, ApiError } from "./client";

const makeJsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("ApiClient error parsing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts nested { error: { message } } messages", async () => {
    const client = new ApiClient({ baseUrl: "http://example.test/v1" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        makeJsonResponse(400, {
          error: { message: "Anthropic configuration required", type: "api_error" },
        }),
      ),
    );

    await expect(client.get("bamboo/config")).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Anthropic configuration required",
    } satisfies Partial<ApiError>);
  });

  it("extracts direct { success:false, error:\"...\" } messages", async () => {
    const client = new ApiClient({ baseUrl: "http://example.test/v1" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        makeJsonResponse(400, {
          success: false,
          error: "Invalid configuration: OpenAI API key is required",
        }),
      ),
    );

    await expect(client.post("bamboo/settings/provider", {})).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Invalid configuration: OpenAI API key is required",
    } satisfies Partial<ApiError>);
  });
});

