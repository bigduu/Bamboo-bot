import { useEffect, useRef, useCallback } from "react";
import {
  AgentClient,
  TokenBudgetUsage,
  ContextSummaryInfo,
  TodoList,
  TodoListDelta,
  AgentEvent,
} from "../services/chat/AgentService";
import { useAppStore } from "../pages/ChatPage/store";
import { streamingMessageBus } from "../pages/ChatPage/utils/streamingMessageBus";
import { message } from "antd";

type SubscriptionEntry = {
  chatId: string;
  sessionId: string;
  controller: AbortController;
};

const isAbortError = (err: unknown) =>
  (err as any)?.name === "AbortError" || (err as any)?.code === 20;

export function useAgentEventSubscription() {
  const processingChats = useAppStore((state) => state.processingChats);

  // Stable store actions
  const addMessage = useAppStore((state) => state.addMessage);
  const setChatProcessing = useAppStore((state) => state.setChatProcessing);
  const updateTokenUsage = useAppStore((state) => state.updateTokenUsage);
  const setTruncationInfo = useAppStore((state) => state.setTruncationInfo);
  const updateChat = useAppStore((state) => state.updateChat);
  const setTodoList = useAppStore((state) => state.setTodoList);
  const updateTodoListDelta = useAppStore((state) => state.updateTodoListDelta);
  const setEvaluationState = useAppStore((state) => state.setEvaluationState);
  const clearEvaluationState = useAppStore(
    (state) => state.clearEvaluationState,
  );

  const agentClientRef = useRef(new AgentClient());

  // chatId -> subscription
  const subscriptionsByChatRef = useRef<Map<string, SubscriptionEntry>>(
    new Map(),
  );

  // sessionId -> streaming state
  const streamingStateBySessionRef = useRef<
    Map<string, { chatId: string; messageId: string; content: string }>
  >(new Map());

  // Chats that are processing but we couldn't subscribe yet (missing sessionId)
  const pendingChatIdsRef = useRef<Set<string>>(new Set());

  const cleanupChat = useCallback((chatId: string) => {
    pendingChatIdsRef.current.delete(chatId);

    const existing = subscriptionsByChatRef.current.get(chatId);
    if (!existing) return;

    subscriptionsByChatRef.current.delete(chatId);

    // Abort SSE
    existing.controller.abort();

    // Clear streaming placeholder
    const streaming = streamingStateBySessionRef.current.get(existing.sessionId);
    if (streaming) {
      streamingMessageBus.clear(streaming.chatId, streaming.messageId);
      streamingStateBySessionRef.current.delete(existing.sessionId);
    } else {
      streamingMessageBus.clear(chatId, `streaming-${chatId}`);
    }
  }, []);

  const startSubscription = useCallback(
    (chatId: string, sessionId: string) => {
      const controller = new AbortController();
      subscriptionsByChatRef.current.set(chatId, {
        chatId,
        sessionId,
        controller,
      });

      const messageId = `streaming-${chatId}`;
      streamingStateBySessionRef.current.set(sessionId, {
        chatId,
        messageId,
        content: "",
      });

      streamingMessageBus.publish({ chatId, messageId, content: "" });

      agentClientRef.current
        .subscribeToEvents(
          sessionId,
          {
            onToken: (tokenContent: string) => {
              const state = streamingStateBySessionRef.current.get(sessionId);
              if (!state) return;
              state.content += tokenContent;
              streamingMessageBus.publish({
                chatId: state.chatId,
                messageId: state.messageId,
                content: state.content,
              });
            },

            onToolStart: (toolCallId, toolName, args) => {
              void addMessage(chatId, {
                id: crypto.randomUUID(),
                role: "assistant",
                type: "tool_call",
                toolCalls: [{ toolCallId, toolName, parameters: args || {} }],
                createdAt: new Date().toISOString(),
              });
            },

            onToolComplete: (toolCallId, result: AgentEvent["result"]) => {
              const toolName = result?.tool_name || "unknown";
              const displayPreference =
                (result?.display_preference as
                  | "Default"
                  | "Collapsible"
                  | "Hidden") || "Default";

              void addMessage(chatId, {
                id: crypto.randomUUID(),
                role: "assistant",
                type: "tool_result",
                toolName,
                toolCallId,
                result: {
                  tool_name: toolName,
                  result: result?.result ?? "",
                  display_preference: displayPreference,
                },
                isError: !result?.success,
                createdAt: new Date().toISOString(),
              });
            },

            onToolError: (toolCallId, error: string) => {
              void addMessage(chatId, {
                id: crypto.randomUUID(),
                role: "assistant",
                type: "tool_result",
                toolName: "unknown",
                toolCallId,
                result: {
                  tool_name: "unknown",
                  result: error,
                  display_preference: "Default",
                },
                isError: true,
                createdAt: new Date().toISOString(),
              });
            },

            onTokenBudgetUpdated: (usage: TokenBudgetUsage) => {
              const tokenUsage = {
                systemTokens: usage.system_tokens,
                summaryTokens: usage.summary_tokens,
                windowTokens: usage.window_tokens,
                totalTokens: usage.total_tokens,
                budgetLimit: usage.budget_limit,
              };

              updateTokenUsage(chatId, tokenUsage);
              setTruncationInfo(
                chatId,
                usage.truncation_occurred,
                usage.segments_removed,
              );

              // Persist in chat config without causing resubscribe:
              const chat = useAppStore
                .getState()
                .chats.find((c) => c.id === chatId);

              if (chat) {
                updateChat(chatId, {
                  config: {
                    ...chat.config,
                    tokenUsage,
                    truncationOccurred: usage.truncation_occurred,
                    segmentsRemoved: usage.segments_removed,
                  },
                });
              }
            },

            onContextSummarized: (summaryInfo: ContextSummaryInfo) => {
              message.info(
                `Conversation summarized: ${summaryInfo.messages_summarized} messages compressed, saved ${summaryInfo.tokens_saved.toLocaleString()} tokens`,
                5,
              );
            },

            onTodoListUpdated: (todoList: TodoList) => {
              if (todoList.session_id) {
                setTodoList(todoList.session_id, todoList);
              }
            },

            onTodoListItemProgress: (delta: TodoListDelta) => {
              if (delta.session_id) {
                updateTodoListDelta(delta.session_id, delta);
              }
            },

            onTodoListCompleted: (_sid, totalRounds, totalToolCalls) => {
              message.success(
                `All tasks completed! Total rounds: ${totalRounds}, Tool calls: ${totalToolCalls}`,
                3,
              );
            },

            onTodoEvaluationStarted: (sid, itemsCount) => {
              setEvaluationState(sid, {
                isEvaluating: true,
                reasoning: null,
                timestamp: Date.now(),
              });
              message.info(`Evaluating ${itemsCount} task(s)...`, 2);
            },

            onTodoEvaluationCompleted: (sid, updatesCount, reasoning) => {
              setEvaluationState(sid, {
                isEvaluating: false,
                reasoning,
                timestamp: Date.now(),
              });

              setTimeout(() => clearEvaluationState(sid), 5000);

              if (updatesCount > 0) {
                message.success(
                  `Evaluation complete: ${updatesCount} task(s) updated. ${reasoning}`,
                  4,
                );
              } else {
                message.info(`Evaluation complete: No updates needed`, 2);
              }
            },

            onComplete: async () => {
              const state = streamingStateBySessionRef.current.get(sessionId);
              if (state?.content) {
                await addMessage(chatId, {
                  id: `assistant-${Date.now()}`,
                  role: "assistant",
                  type: "text",
                  content: state.content,
                  createdAt: new Date().toISOString(),
                  metadata: { sessionId, model: "agent" },
                });
              }

              cleanupChat(chatId);
              setChatProcessing(chatId, false);
            },

            onError: async (errorMessage: string) => {
              await addMessage(chatId, {
                id: `error-${Date.now()}`,
                role: "assistant",
                type: "text",
                content: `❌ **Error**: ${errorMessage}`,
                createdAt: new Date().toISOString(),
                finishReason: "error",
              });

              cleanupChat(chatId);
              setChatProcessing(chatId, false);
            },
          },
          controller,
        )
        .then(() => {
          // Stream ended without throwing. If we're still active, clean up.
          if (controller.signal.aborted) return;
          const current = subscriptionsByChatRef.current.get(chatId);
          if (current?.sessionId === sessionId) {
            cleanupChat(chatId);
            setChatProcessing(chatId, false);
          }
        })
        .catch((err) => {
          if (controller.signal.aborted || isAbortError(err)) return;
          console.error(
            "[useAgentEventSubscription] Subscription error:",
            err,
          );
          cleanupChat(chatId);
          setChatProcessing(chatId, false);
        });
    },
    [
      addMessage,
      setChatProcessing,
      updateTokenUsage,
      setTruncationInfo,
      updateChat,
      setTodoList,
      updateTodoListDelta,
      setEvaluationState,
      clearEvaluationState,
      cleanupChat,
    ],
  );

  const ensureSubscription = useCallback(
    (chatId: string) => {
      const chat = useAppStore.getState().chats.find((c) => c.id === chatId);
      const sessionId = chat?.config?.agentSessionId?.trim();

      if (!sessionId) {
        pendingChatIdsRef.current.add(chatId);
        return;
      }

      pendingChatIdsRef.current.delete(chatId);

      const existing = subscriptionsByChatRef.current.get(chatId);
      if (existing?.sessionId === sessionId) return;

      if (existing) cleanupChat(chatId);
      startSubscription(chatId, sessionId);
    },
    [cleanupChat, startSubscription],
  );

  // Effect A: reconcile active subscriptions when processingChats changes (NO global cleanup return)
  useEffect(() => {
    // Start needed subscriptions
    processingChats.forEach((chatId) => ensureSubscription(chatId));

    // Stop subscriptions for chats no longer processing
    for (const chatId of Array.from(subscriptionsByChatRef.current.keys())) {
      if (!processingChats.has(chatId)) {
        cleanupChat(chatId);
      }
    }

    // Drop pending chats that are no longer processing
    for (const chatId of Array.from(pendingChatIdsRef.current)) {
      if (!processingChats.has(chatId)) {
        pendingChatIdsRef.current.delete(chatId);
      }
    }
  }, [processingChats, ensureSubscription, cleanupChat]);

  // Retry pending processing chats when chats/config updates (e.g. sessionId arrives)
  useEffect(() => {
    return useAppStore.subscribe(
      (s) => s.chats,
      () => {
        if (pendingChatIdsRef.current.size === 0) return;

        for (const chatId of Array.from(pendingChatIdsRef.current)) {
          if (!useAppStore.getState().processingChats.has(chatId)) {
            pendingChatIdsRef.current.delete(chatId);
            continue;
          }
          ensureSubscription(chatId);
        }
      },
    );
  }, [ensureSubscription]);

  // Effect B: unmount cleanup only
  useEffect(() => {
    return () => {
      for (const chatId of Array.from(subscriptionsByChatRef.current.keys())) {
        cleanupChat(chatId);
      }
    };
  }, [cleanupChat]);
}
