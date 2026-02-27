import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QuestionDialog } from "../QuestionDialog";
import { useAppStore } from "../../../pages/ChatPage/store";
import { useProviderStore } from "../../../pages/ChatPage/store/slices/providerSlice";

// Mock dependencies
vi.mock("../../../pages/ChatPage/store", () => ({
  useAppStore: vi.fn(),
}));

vi.mock("../../../services/api", () => ({
  agentApiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("QuestionDialog", () => {
  const mockSetChatProcessing = vi.fn();
  const mockIsChatProcessing = vi.fn();
  const defaultProps = {
    sessionId: "test-session-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsChatProcessing.mockReturnValue(false);
    // Ensure provider store has a default model available (QuestionDialog falls back to it
    // when the per-chat selectedModel is not set).
    useProviderStore.setState({
      currentProvider: "openai",
      providerConfig: {
        provider: "openai",
        providers: {
          openai: { model: "gpt-5-mini" } as any,
        },
      } as any,
      isLoading: false,
      error: null,
    } as any);

    (useAppStore as any).mockImplementation((selector: (state: any) => any) => {
      if (typeof selector === "function") {
        return selector({
          setChatProcessing: mockSetChatProcessing,
          isChatProcessing: mockIsChatProcessing,
          chats: [],
          selectedModel: "gpt-5-mini",
        });
      }
      return {
        setChatProcessing: mockSetChatProcessing,
        isChatProcessing: mockIsChatProcessing,
        chats: [],
        selectedModel: "gpt-5-mini",
      };
    });
  });

  afterEach(() => {
    // Ensure fake timers don't leak into other tests on failure.
    vi.useRealTimers();
  });

  it("should fetch pending question on mount", async () => {
    const { agentApiClient } = await import("../../../services/api");
    (agentApiClient.get as any).mockResolvedValue({
      has_pending_question: true,
      question: "Test question?",
      options: ["Option A", "Option B"],
      allow_custom: false,
    });

    render(<QuestionDialog {...defaultProps} />);

    await waitFor(() => {
      expect(agentApiClient.get).toHaveBeenCalledWith(
        "respond/test-session-1/pending",
      );
    });
  });

  it("should display question when pending question exists", async () => {
    const { agentApiClient } = await import("../../../services/api");
    (agentApiClient.get as any).mockResolvedValue({
      has_pending_question: true,
      question: "Choose an option:",
      options: ["A", "B"],
      allow_custom: false,
    });

    await act(async () => {
      render(<QuestionDialog {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Choose an option:")).toBeInTheDocument();
    });
  });

  it("should not render when no pending question", async () => {
    const { agentApiClient } = await import("../../../services/api");
    (agentApiClient.get as any).mockResolvedValue({
      has_pending_question: false,
    });

    const { container } = render(<QuestionDialog {...defaultProps} />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("should call /respond and /execute on submit", async () => {
    const { agentApiClient } = await import("../../../services/api");
    (agentApiClient.get as any).mockResolvedValue({
      has_pending_question: true,
      question: "Test?",
      options: ["A", "B"],
      allow_custom: false,
      tool_call_id: "tool-1",
    });

    (agentApiClient.post as any)
      .mockResolvedValueOnce({}) // /respond
      .mockResolvedValueOnce({
        status: "started",
        events_url: "/events/test-session-1",
      }); // /execute

    await act(async () => {
      render(<QuestionDialog {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Test?")).toBeInTheDocument();
    });

    // Select option
    const optionA = screen.getByText("A");
    fireEvent.click(optionA);

    // Submit
    const submitButton = screen.getByText("Confirm Selection");
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      // Should call /respond first
      expect(agentApiClient.post).toHaveBeenCalledWith(
        "respond/test-session-1",
        {
          response: "A",
        },
      );

      // Then call /execute
      expect(agentApiClient.post).toHaveBeenCalledWith(
        "execute/test-session-1",
        { model: "gpt-5-mini" },
      );

      // Should set processing to activate subscription (but chatId is undefined in test)
      // Note: In real usage, chatId would be found from the sessionId
    });
  });

  it("should fall back to active provider model when selectedModel is not set", async () => {
    const { agentApiClient } = await import("../../../services/api");
    (agentApiClient.get as any).mockResolvedValue({
      has_pending_question: true,
      question: "Test?",
      options: ["A", "B"],
      allow_custom: false,
      tool_call_id: "tool-1",
    });

    (agentApiClient.post as any)
      .mockResolvedValueOnce({}) // /respond
      .mockResolvedValueOnce({
        status: "started",
        events_url: "/events/test-session-1",
      }); // /execute

    // No per-chat model selected.
    (useAppStore as any).mockImplementation((selector: (state: any) => any) => {
      if (typeof selector === "function") {
        return selector({
          setChatProcessing: mockSetChatProcessing,
          isChatProcessing: mockIsChatProcessing,
          chats: [],
          selectedModel: undefined,
        });
      }
      return {
        setChatProcessing: mockSetChatProcessing,
        isChatProcessing: mockIsChatProcessing,
        chats: [],
        selectedModel: undefined,
      };
    });

    await act(async () => {
      render(<QuestionDialog {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Test?")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("A"));
    await act(async () => {
      fireEvent.click(screen.getByText("Confirm Selection"));
    });

    await waitFor(() => {
      expect(agentApiClient.post).toHaveBeenCalledWith("execute/test-session-1", {
        model: "gpt-5-mini",
      });
    });
  });

  it("should re-enable polling after response submission", async () => {
    const { agentApiClient } = await import("../../../services/api");

    // Track how many times GET has been called
    let getCallCount = 0;
    (agentApiClient.get as any).mockImplementation(() => {
      getCallCount++;
      // First 3 calls return first question (gives time for test to interact)
      if (getCallCount <= 3) {
        return Promise.resolve({
          has_pending_question: true,
          question: "Test?",
          options: ["A"],
          allow_custom: false,
          tool_call_id: "tool-1",
        });
      }
      // Subsequent calls return second question
      return Promise.resolve({
        has_pending_question: true,
        question: "Second question?",
        options: ["C"],
        allow_custom: false,
      });
    });

    (agentApiClient.post as any)
      .mockResolvedValueOnce({}) // /respond
      .mockResolvedValueOnce({ status: "started" }); // /execute

    await act(async () => {
      render(<QuestionDialog {...defaultProps} />);
    });

    // Wait for first question to appear
    await waitFor(
      () => {
        expect(screen.getByText("Test?")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Submit first response
    const optionA = screen.getByText("A");
    fireEvent.click(optionA);

    const submitButton = screen.getByText("Confirm Selection");
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Wait for first question to disappear (setPendingQuestion(null) clears it)
    await waitFor(() => {
      expect(screen.queryByText("Test?")).not.toBeInTheDocument();
    });

    // Should detect second question (polling re-enabled)
    await waitFor(
      () => {
        expect(screen.getByText("Second question?")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should keep polling and eventually show a question after empty responses", async () => {
    vi.useFakeTimers();

    const { agentApiClient } = await import("../../../services/api");
    let callCount = 0;
    (agentApiClient.get as any).mockImplementation(() => {
      callCount += 1;
      // First few polls: nothing pending
      if (callCount <= 4) {
        return Promise.resolve({ has_pending_question: false });
      }
      return Promise.resolve({
        has_pending_question: true,
        question: "Late question?",
        options: ["A"],
        allow_custom: false,
      });
    });

    await act(async () => {
      render(<QuestionDialog {...defaultProps} />);
    });

    // Advance enough time for multiple 15s polls to happen.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    // Flush pending microtasks from async fetches.
    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/await-thenable
      await Promise.resolve();
    });

    expect(screen.getByText("Late question?")).toBeInTheDocument();
  });

  it("should handle /execute failure gracefully", async () => {
    const { agentApiClient } = await import("../../../services/api");
    (agentApiClient.get as any).mockResolvedValue({
      has_pending_question: true,
      question: "Test?",
      options: ["A"],
      allow_custom: false,
      tool_call_id: "tool-1",
    });

    (agentApiClient.post as any)
      .mockResolvedValueOnce({}) // /respond succeeds
      .mockRejectedValueOnce(new Error("Execute failed")); // /execute fails

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      render(<QuestionDialog {...defaultProps} />);
    });

    // Wait for loading to complete and question to appear
    await waitFor(
      () => {
        expect(screen.getByText("Test?")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    const optionA = screen.getByText("A");
    fireEvent.click(optionA);

    const submitButton = screen.getByText("Confirm Selection");
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      // Should still call /respond
      expect(agentApiClient.post).toHaveBeenCalledWith(
        "respond/test-session-1",
        {
          response: "A",
        },
      );

      // Should attempt /execute
      expect(agentApiClient.post).toHaveBeenCalledWith(
        "execute/test-session-1",
        { model: "gpt-5-mini" },
      );

      // Should log error
      expect(consoleSpy).toHaveBeenCalledWith(
        "[QuestionDialog] Failed to restart agent execution:",
        expect.any(Error),
      );
    });

    consoleSpy.mockRestore();
  });

  it("should reset polling state when sessionId changes", async () => {
    const { agentApiClient } = await import("../../../services/api");
    (agentApiClient.get as any).mockResolvedValue({
      has_pending_question: false,
    });

    const { rerender } = render(<QuestionDialog {...defaultProps} />);

    await waitFor(() => {
      expect(agentApiClient.get).toHaveBeenCalledWith(
        "respond/test-session-1/pending",
      );
    });

    // Change session ID
    (agentApiClient.get as any).mockClear();

    rerender(<QuestionDialog sessionId="test-session-2" />);

    await waitFor(() => {
      expect(agentApiClient.get).toHaveBeenCalledWith(
        "respond/test-session-2/pending",
      );
    });
  });

  it("should handle custom input when allow_custom is true", async () => {
    const { agentApiClient } = await import("../../../services/api");
    (agentApiClient.get as any).mockResolvedValue({
      has_pending_question: true,
      question: "Test?",
      options: ["A"],
      allow_custom: true,
      tool_call_id: "tool-1",
    });

    (agentApiClient.post as any)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ status: "started" });

    await act(async () => {
      render(<QuestionDialog {...defaultProps} />);
    });

    // Wait for loading to complete and question to appear
    await waitFor(
      () => {
        expect(screen.getByText("Other (custom input)")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Select custom option
    const customOption = screen.getByText("Other (custom input)");
    fireEvent.click(customOption);

    // Enter custom text
    const textArea = screen.getByPlaceholderText("Enter your answer...");
    fireEvent.change(textArea, { target: { value: "My custom response" } });

    // Submit
    const submitButton = screen.getByText("Confirm Selection");
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(agentApiClient.post).toHaveBeenCalledWith(
        "respond/test-session-1",
        {
          response: "My custom response",
        },
      );
    });
  });
});
