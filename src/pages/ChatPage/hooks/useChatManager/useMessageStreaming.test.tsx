import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockModalInfo = vi.fn();
const mockMessageApi = {
  warning: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

const mockAgentSendMessage = vi.fn();
const mockAgentStreamEvents = vi.fn();
const mockAgentHealthCheck = vi.fn();

const mockStoreState = {
  agentAvailability: null as boolean | null,
  startAgentHealthCheck: vi.fn(),
  checkAgentAvailability: vi.fn<() => Promise<boolean>>(),
  setAgentAvailability: vi.fn(),
  chats: [] as any[],
};

const mockActiveModel = "gpt-5";

vi.mock("../../hooks/useActiveModel", () => ({
  useActiveModel: () => mockActiveModel,
}));

vi.mock("antd", () => ({
  App: {
    useApp: () => ({
      modal: { info: mockModalInfo },
      message: mockMessageApi,
    }),
  },
}));

vi.mock("../../services/AgentService", () => ({
  AgentClient: class {
    sendMessage = mockAgentSendMessage;
    streamEvents = mockAgentStreamEvents;
    healthCheck = mockAgentHealthCheck;
  },
}));

vi.mock("../../utils/streamingMessageBus", () => ({
  streamingMessageBus: {
    publish: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock("../../store", () => ({
  useAppStore: (selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

import { useMessageStreaming } from "./useMessageStreaming";

describe("useMessageStreaming", () => {
  beforeEach(() => {
    mockModalInfo.mockReset();
    mockMessageApi.warning.mockReset();
    mockMessageApi.error.mockReset();
    mockMessageApi.info.mockReset();

    mockAgentSendMessage.mockReset();
    mockAgentStreamEvents.mockReset();
    mockAgentHealthCheck.mockReset();

    mockStoreState.agentAvailability = null;
    mockStoreState.startAgentHealthCheck.mockReset();
    mockStoreState.checkAgentAvailability.mockReset();
    mockStoreState.setAgentAvailability.mockReset();
  });

  it("starts global health-check polling once on mount", async () => {
    const deps = {
      chatId: null,
      addMessage: vi.fn(),
      setChatProcessing: vi.fn(),
      updateChat: vi.fn(),
    };

    renderHook(() => useMessageStreaming(deps));

    await waitFor(() => {
      expect(mockStoreState.startAgentHealthCheck).toHaveBeenCalledTimes(1);
    });
  });

  it("verifies availability from store before sending when status is unknown", async () => {
    mockStoreState.checkAgentAvailability.mockResolvedValue(false);

    const mockChat = {
      id: "chat-1",
      title: "Test Chat",
      createdAt: Date.now(),
      messages: [],
      config: {
        systemPromptId: "general_assistant",
        baseSystemPrompt: "",
        lastUsedEnhancedPrompt: null,
      },
      currentInteraction: {
        machineState: "idle",
        streamingMessageId: null,
        streamingContent: null,
      },
    };

    mockStoreState.chats = [mockChat];

    const deps = {
      chatId: "chat-1",
      addMessage: vi.fn(),
      setChatProcessing: vi.fn(),
      updateChat: vi.fn(),
    };

    const { result } = renderHook(() => useMessageStreaming(deps));

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    expect(mockStoreState.checkAgentAvailability).toHaveBeenCalledTimes(1);
    expect(deps.addMessage).not.toHaveBeenCalled();
    expect(mockMessageApi.error).toHaveBeenCalledWith(
      "Agent unavailable. Please try again later.",
    );
  });

  it("marks agent unavailable after non-abort request failures", async () => {
    mockStoreState.agentAvailability = true;
    mockAgentSendMessage.mockRejectedValueOnce(new Error("boom"));

    const mockChat = {
      id: "chat-1",
      title: "Test Chat",
      createdAt: Date.now(),
      messages: [],
      config: {
        systemPromptId: "general_assistant",
        baseSystemPrompt: "",
        lastUsedEnhancedPrompt: null,
      },
      currentInteraction: {
        machineState: "idle",
        streamingMessageId: null,
        streamingContent: null,
      },
    };

    mockStoreState.chats = [mockChat];

    const deps = {
      chatId: "chat-1",
      addMessage: vi.fn(async () => undefined),
      setChatProcessing: vi.fn(),
      updateChat: vi.fn(),
    };

    const { result } = renderHook(() => useMessageStreaming(deps));

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    expect(mockStoreState.setAgentAvailability).toHaveBeenCalledWith(false);
    expect(mockMessageApi.error).toHaveBeenCalledWith(
      "Failed to send message. Please try again.",
    );
  });

  it("passes workspace_path to agent chat requests", async () => {
    mockStoreState.agentAvailability = true;
    mockAgentSendMessage.mockResolvedValue({
      session_id: "session-1",
      stream_url: "/api/v1/stream/session-1",
      status: "streaming",
    });
    mockAgentStreamEvents.mockResolvedValue(undefined);

    const mockChat = {
      id: "chat-1",
      title: "Test Chat",
      createdAt: Date.now(),
      messages: [],
      config: {
        systemPromptId: "general_assistant",
        baseSystemPrompt: "Base prompt",
        workspacePath: "/tmp/workspace",
        lastUsedEnhancedPrompt: null,
      },
      currentInteraction: {
        machineState: "idle",
        streamingMessageId: null,
        streamingContent: null,
      },
    };

    mockStoreState.chats = [mockChat];

    const deps = {
      chatId: "chat-1",
      addMessage: vi.fn(async () => undefined),
      setChatProcessing: vi.fn(),
      updateChat: vi.fn(),
    };

    const { result } = renderHook(() => useMessageStreaming(deps));

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    expect(mockAgentSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "hello",
        workspace_path: "/tmp/workspace",
      }),
    );
  });
});
