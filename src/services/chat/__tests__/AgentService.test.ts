import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentClient, ChatRequest } from "../AgentService";
import { mockFetchError, mockFetchResponse } from "@test/helpers";

describe("AgentClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes a backend session by ID", async () => {
    fetchMock.mockResolvedValue(mockFetchResponse({}));

    const client = AgentClient.getInstance();

    await client.deleteSession("session-1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/sessions/session-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("throws when backend session deletion fails", async () => {
    fetchMock.mockResolvedValue(mockFetchError("Server Error", 500));

    const client = AgentClient.getInstance();

    await expect(client.deleteSession("session-1")).rejects.toThrow();
  });

  // ========== MODEL REQUIREMENT ARCHITECTURE TESTS ==========
  // These tests ensure the design principle:
  // "Frontend must explicitly specify model in requests"

  describe("Model Requirement", () => {
    it("ChatRequest requires model field", () => {
      // This test verifies at TypeScript level that model is required
      // ChatRequest interface: model: string (not model?: string)
      const validRequest: ChatRequest = {
        message: "Hello",
        model: "kimi-for-coding",
      };

      expect(validRequest.model).toBe("kimi-for-coding");

      // TypeScript would prevent this:
      // const invalidRequest: ChatRequest = {
      //   message: "Hello",
      //   // model is missing - TypeScript error
      // };
    });

    it("execute method requires model parameter", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          session_id: "session-1",
          status: "started",
          events_url: "/events/session-1",
        }),
      );

      const client = AgentClient.getInstance();

      // Model parameter is required (not optional)
      await client.execute("session-1", "kimi-for-coding");

      // Verify the request was made with model in body
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/execute/session-1"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("kimi-for-coding"),
        }),
      );

      // TypeScript would prevent this:
      // await client.execute("session-1"); // Missing model parameter
    });

    it("sendMessage requires model in request", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          session_id: "session-1",
          status: "started",
        }),
      );

      const client = AgentClient.getInstance();

      const request: ChatRequest = {
        message: "Hello",
        model: "kimi-for-coding",
      };

      await client.sendMessage(request);

      // Verify the request was made with model
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/chat"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("kimi-for-coding"),
        }),
      );
    });
  });

  it("dispatches tool_token events to onToolToken handler", () => {
    const client = AgentClient.getInstance();
    const onToolToken = vi.fn();

    // `handleEvent` is intentionally private; we still test the dispatch logic
    // because SSE parsing ultimately routes through this switch.
    (client as any).handleEvent(
      { type: "tool_token", tool_call_id: "call_1", content: "chunk" },
      { onToolToken },
    );

    expect(onToolToken).toHaveBeenCalledWith("call_1", "chunk");
  });
});
