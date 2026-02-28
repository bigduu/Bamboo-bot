import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FloatButton, Grid, Layout, theme, Flex } from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { useVirtualizer } from "@tanstack/react-virtual";

import { useAppStore } from "../../store";
import { useProviderStore } from "../../store/slices/providerSlice";
import type { Message } from "../../types/chat";
import { ChatInputArea } from "./ChatInputArea";
import { ChatMessagesList } from "./ChatMessagesList";
import { TodoList } from "@components/TodoList";
import { QuestionDialog } from "@components/QuestionDialog";
import { useAgentEventSubscription } from "@hooks/useAgentEventSubscription";
import { TokenUsageDisplay } from "../TokenUsageDisplay";
import "./styles.css";
import { useChatViewScroll } from "./useChatViewScroll";
import type { WorkflowDraft } from "../InputContainer";
import {
  useChatViewMessages,
  type RenderableEntry,
} from "./useChatViewMessages";

const { useToken } = theme;
const { useBreakpoint } = Grid;

export type ChatViewProps = {
  /**
   * If omitted, falls back to the globally selected chat.
   * Multi-pane mode should always pass an explicit chatId.
   */
  chatId?: string | null;
  /**
   * When embedded in split panes, use full width and tighter spacing.
   */
  embedded?: boolean;
};

export const ChatView: React.FC<ChatViewProps> = ({
  chatId: chatIdProp,
  embedded = false,
}) => {
  // Load provider configuration on mount
  const loadProviderConfig = useProviderStore(
    (state) => state.loadProviderConfig,
  );

  useEffect(() => {
    if (embedded) return;
    loadProviderConfig();
  }, [embedded, loadProviderConfig]);

  // Maintain persistent subscription to agent events for real-time streaming
  useAgentEventSubscription({ enabled: !embedded });

  const chatId = useAppStore((state) => chatIdProp ?? state.currentChatId);
  const currentChat = useAppStore(
    (state) =>
      chatId ? state.chats.find((chat) => chat.id === chatId) || null : null,
  );
  const deleteMessage = useAppStore((state) => state.deleteMessage);
  const updateChat = useAppStore((state) => state.updateChat);
  const processingChats = useAppStore((state) => state.processingChats);
  const tokenUsages = useAppStore((state) => state.tokenUsages);
  const truncationOccurred = useAppStore((state) => state.truncationOccurred);
  const segmentsRemoved = useAppStore((state) => state.segmentsRemoved);
  const currentMessages = useMemo(
    () => currentChat?.messages || [],
    [currentChat],
  );

  const isProcessing = chatId
    ? processingChats.has(chatId)
    : false;

  const interactionState = useMemo(() => {
    const value: "IDLE" | "THINKING" | "AWAITING_APPROVAL" = isProcessing
      ? "THINKING"
      : "IDLE";
    return {
      value,
      context: {
        streamingContent: null,
        toolCallRequest: null,
        parsedParameters: null,
      },
      matches: (stateName: "IDLE" | "THINKING" | "AWAITING_APPROVAL") =>
        stateName === value,
    };
  }, [isProcessing]);

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (chatId) {
        deleteMessage(chatId, messageId);
      }
    },
    [chatId, deleteMessage],
  );

  const messagesListRef = useRef<HTMLDivElement>(null);
  const { token } = useToken();
  const screens = useBreakpoint();
  const [workflowDraft, setWorkflowDraft] = useState<WorkflowDraft | null>(
    null,
  );

  const getContainerMaxWidth = () => {
    if (embedded) return "100%";
    if (screens.xs) return "100%";
    if (screens.sm) return "100%";
    if (screens.md) return "90%";
    if (screens.lg) return "85%";
    return "1024px";
  };

  const getContainerPadding = () => {
    if (embedded) return token.paddingSM;
    if (screens.xs) return token.paddingXS;
    if (screens.sm) return token.paddingSM;
    return token.padding;
  };

  useEffect(() => {
    if (chatId && currentMessages) {
      const messagesNeedingIds = currentMessages.some((msg) => !msg.id);

      if (messagesNeedingIds) {
        const updatedMessages = currentMessages.map((msg) => {
          if (!msg.id) {
            return { ...msg, id: crypto.randomUUID() };
          }
          return msg;
        });

        updateChat(chatId, { messages: updatedMessages });
      }
    }
  }, [chatId, currentMessages, updateChat]);

  useEffect(() => {
    setWorkflowDraft(null);
  }, [chatId]);

  const { systemPromptMessage, renderableMessages, convertRenderableEntry } =
    useChatViewMessages(currentChat, currentMessages);

  const hasMessages = currentMessages.length > 0;
  const hasWorkflowDraft = Boolean(workflowDraft?.content);
  const hasSystemPrompt = Boolean(systemPromptMessage);
  const showMessagesView =
    chatId && (hasMessages || hasSystemPrompt || hasWorkflowDraft);

  const renderableMessagesWithDraft = useMemo<RenderableEntry[]>(() => {
    if (!workflowDraft?.content) {
      return renderableMessages;
    }

    const draftEntry: RenderableEntry = {
      message: {
        id: workflowDraft.id,
        role: "user",
        content: workflowDraft.content,
        createdAt: workflowDraft.createdAt,
      } as Message,
      messageType: "text" as const,
    };

    return [...renderableMessages, draftEntry];
  }, [renderableMessages, workflowDraft]);

  // Get agent session ID from chat config (created by Agent Server)
  const agentSessionId = currentChat?.config?.agentSessionId;

  // Get token usage - prefer store (real-time), fallback to chat config (persisted)
  const storeTokenUsage = chatId ? tokenUsages[chatId] : null;
  const configTokenUsage = currentChat?.config?.tokenUsage;
  const currentTokenUsage = storeTokenUsage || configTokenUsage || null;

  const storeTruncation = chatId
    ? truncationOccurred[chatId]
    : false;
  const configTruncation = currentChat?.config?.truncationOccurred;
  const currentTruncationOccurred =
    storeTruncation || configTruncation || false;

  const storeSegments = chatId ? segmentsRemoved[chatId] : 0;
  const configSegments = currentChat?.config?.segmentsRemoved;
  const currentSegmentsRemoved = storeSegments || configSegments || 0;

  const rowVirtualizer = useVirtualizer({
    count: renderableMessagesWithDraft.length,
    getScrollElement: () => messagesListRef.current,
    estimateSize: () => 320,
    overscan: 2,
    getItemKey: (index) => {
      const entry = renderableMessagesWithDraft[index];
      if (!entry) return index;

      // stable key: matches React row key logic
      if ("type" in entry && entry.type === "tool_session") return entry.id;
      if ("message" in entry && entry.message) return entry.message.id;
      return index;
    },
  });

  const rowGap = token.marginMD;

  const {
    handleMessagesScroll,
    resetUserScroll,
    scrollToBottom,
    scrollToTop,
    showScrollToBottom,
    showScrollToTop,
  } = useChatViewScroll({
    currentChatId: chatId,
    interactionState,
    messagesListRef,
    renderableMessages: renderableMessagesWithDraft,
    rowVirtualizer,
  });

  const getScrollButtonPosition = () => {
    return screens.xs ? 16 : 32;
  };

  return (
    <Layout
      style={{
        flex: 1,
        minHeight: 0,
        height: "100%",
        background: token.colorBgContainer,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Flex
        vertical
        style={{
          flex: 1,
          minHeight: 0,
          height: "100%",
        }}
      >
        {/* TodoList - show when there is an active agent session */}
        {agentSessionId && (
          <div
            style={{
              paddingTop: getContainerPadding(),
              paddingRight: getContainerPadding(),
              paddingBottom: 0,
              paddingLeft: getContainerPadding(),
              maxWidth: getContainerMaxWidth(),
              margin: "0 auto",
              width: "100%",
            }}
          >
            <TodoList sessionId={agentSessionId} initialCollapsed={true} />
          </div>
        )}

        {/* Token Usage Display - show when there's token usage data */}
        {currentTokenUsage && currentTokenUsage.budgetLimit > 0 && (
          <div
            style={{
              paddingTop: agentSessionId
                ? token.paddingXS
                : getContainerPadding(),
              paddingRight: getContainerPadding(),
              paddingBottom: 0,
              paddingLeft: getContainerPadding(),
              maxWidth: getContainerMaxWidth(),
              margin: "0 auto",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: token.marginXS,
              }}
            >
              <TokenUsageDisplay
                usage={currentTokenUsage}
                showDetails={true}
                size="small"
              />
              {currentTruncationOccurred && (
                <span
                  style={{
                    fontSize: 11,
                    color: token.colorTextSecondary,
                  }}
                >
                  ({currentSegmentsRemoved} truncated)
                </span>
              )}
            </div>
          </div>
        )}

        <ChatMessagesList
          currentChatId={chatId}
          convertRenderableEntry={convertRenderableEntry}
          handleDeleteMessage={handleDeleteMessage}
          handleMessagesScroll={handleMessagesScroll}
          hasSystemPrompt={hasSystemPrompt}
          messagesListRef={messagesListRef}
          renderableMessages={renderableMessagesWithDraft}
          rowGap={rowGap}
          rowVirtualizer={rowVirtualizer}
          showMessagesView={Boolean(showMessagesView)}
          screens={screens}
          workflowDraftId={workflowDraft?.id}
          interactionState={interactionState}
          padding={getContainerPadding()}
        />

        {/* Scroll buttons (bottom-right) */}
        {!embedded && (showScrollToTop || showScrollToBottom) && (
          <FloatButton.Group
            style={{
              right: getScrollButtonPosition(),
              bottom: screens.xs ? 160 : 180,
              gap: token.marginSM,
              zIndex: 1000,
            }}
          >
            {showScrollToTop && (
              <FloatButton
                type="default"
                icon={<UpOutlined />}
                onClick={() => {
                  scrollToTop();
                }}
              />
            )}
            {showScrollToBottom && (
              <FloatButton
                type="primary"
                icon={<DownOutlined />}
                onClick={() => {
                  resetUserScroll();
                  scrollToBottom();
                }}
              />
            )}
          </FloatButton.Group>
        )}

        {/* QuestionDialog - show above input area when there's an active agent session */}
        {agentSessionId && (
          <div
            style={{
              padding: `0 ${getContainerPadding()}px`,
              maxWidth: showMessagesView ? getContainerMaxWidth() : "100%",
              margin: "0 auto",
              width: "100%",
            }}
          >
            <QuestionDialog sessionId={agentSessionId} />
          </div>
        )}

        <ChatInputArea
          isCenteredLayout={!showMessagesView}
          maxWidth={showMessagesView ? getContainerMaxWidth() : "100%"}
          onWorkflowDraftChange={setWorkflowDraft}
          showMessagesView={Boolean(showMessagesView)}
        />
      </Flex>
    </Layout>
  );
};
