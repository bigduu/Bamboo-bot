import type { ChatItem, Message, UserSystemPrompt } from "../../types/chat";

export interface UseChatState {
  chats: ChatItem[];
  currentChatId: string | null;
  currentChat: ChatItem | null;
  isProcessing: boolean;
  baseMessages: Message[];
  pinnedChats: ChatItem[];
  unpinnedChats: ChatItem[];
  chatCount: number;
  addMessage: (chatId: string, message: Message) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => void;
  selectChat: (chatId: string | null) => void;
  deleteChat: (chatId: string) => Promise<void>;
  deleteChats: (chatIds: string[]) => Promise<void>;
  pinChat: (chatId: string) => void;
  unpinChat: (chatId: string) => void;
  updateChat: (chatId: string, updates: Partial<ChatItem>) => void;
  loadChats: () => Promise<void>;
  setProcessing: (isProcessing: boolean) => void;
}

export interface UseChatTitleGeneration {
  titleGenerationState: Record<
    string,
    { status: "idle" | "loading" | "error"; error?: string }
  >;
  autoGenerateTitles: boolean;
  isUpdatingAutoTitlePreference: boolean;
  generateChatTitle: (
    chatId: string,
    options?: { force?: boolean },
  ) => Promise<void>;
  setAutoGenerateTitlesPreference: (enabled: boolean) => Promise<void>;
  isDefaultTitle: (title: string | undefined | null) => boolean;
}

export interface UseChatOperations {
  createNewChat: (
    title?: string,
    options?: Partial<Omit<ChatItem, "id">>,
  ) => Promise<void>;
  createChatWithSystemPrompt: (prompt: UserSystemPrompt) => Promise<void>;
  toggleChatPin: (chatId: string) => void;
  updateChatTitle: (chatId: string, newTitle: string) => void;
  deleteEmptyChats: () => void;
  deleteAllUnpinnedChats: () => void;
}

export interface InteractionState {
  status: "idle" | "thinking" | "awaiting_approval";
  streamingMessageId?: string | null;
  streamingContent?: string | null;
}

export interface PendingAgentApproval {
  toolCallId: string;
  toolName: string;
  parameters: Record<string, unknown>;
}

export interface UseChatStateMachine {
  interactionState: InteractionState;
  currentMessages: Message[];
  pendingAgentApproval: PendingAgentApproval | null;
  send: (event: string, payload?: unknown) => void;
  setPendingAgentApproval: (approval: PendingAgentApproval | null) => void;
  retryLastMessage: () => Promise<void>;
}
