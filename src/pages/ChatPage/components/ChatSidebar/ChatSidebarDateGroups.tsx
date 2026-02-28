import React, { useMemo } from "react";
import { Button, Empty, Flex, List, Space } from "antd";
import {
  CalendarOutlined,
  DeleteOutlined,
  DownOutlined,
  RightOutlined,
} from "@ant-design/icons";

import { ChatItem as ChatItemComponent } from "../ChatItem";
import type { ChatItem } from "../../types/chat";
import { getChatCountByDate } from "../../utils/chatUtils";

type ChatSidebarDateGroupsProps = {
  groupedChatsByDate: Record<string, ChatItem[]>;
  sortedDateKeys: string[];
  expandedKeys: string[];
  onCollapseChange: (keys: string | string[]) => void;
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onDeleteByDate: (dateKey: string) => void;
  onPinChat: (chatId: string) => void;
  onUnpinChat: (chatId: string) => void;
  onEditTitle: (chatId: string, title: string) => void;
  onGenerateTitle: (chatId: string) => void;
  titleGenerationState: Record<
    string,
    { status: "loading" | "error" | "idle"; error?: string }
  >;
  token: any;
};

export const ChatSidebarDateGroups: React.FC<ChatSidebarDateGroupsProps> = ({
  groupedChatsByDate,
  sortedDateKeys,
  expandedKeys,
  onCollapseChange,
  currentChatId,
  onSelectChat,
  onDeleteChat,
  onDeleteByDate,
  onPinChat,
  onUnpinChat,
  onEditTitle,
  onGenerateTitle,
  titleGenerationState,
  token,
}) => {
  const groups = useMemo(() => {
    if (!sortedDateKeys.length) {
      return [];
    }

    return sortedDateKeys.map((dateKey) => {
      const dateGroup = groupedChatsByDate[dateKey];
      const totalChatsInDate = getChatCountByDate(groupedChatsByDate, dateKey);

      return {
        dateKey,
        dateGroup,
        totalChatsInDate,
      };
    });
  }, [
    groupedChatsByDate,
    sortedDateKeys,
    onDeleteChat,
    onEditTitle,
    onGenerateTitle,
    onPinChat,
    onSelectChat,
    onUnpinChat,
    titleGenerationState,
  ]);

  if (!sortedDateKeys.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Space direction="vertical" size={4}>
            <span style={{ color: token.colorTextSecondary }}>
              No chats yet
            </span>
            <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>
              Click "New Chat" to get started
            </span>
          </Space>
        }
      />
    );
  }

  const expanded = new Set(expandedKeys);

  return (
    <Space direction="vertical" size="small" style={{ width: "100%" }}>
      {groups.map(({ dateKey, dateGroup, totalChatsInDate }) => {
        const isExpanded = expanded.has(dateKey);

        return (
          <div
            key={dateKey}
            style={{
              borderRadius: token.borderRadiusSM,
              background: isExpanded ? token.colorFillQuaternary : "transparent",
              padding: 4,
            }}
          >
            <Flex
              align="center"
              justify="space-between"
              style={{ cursor: "pointer" }}
              onClick={() => {
                const next = new Set(expanded);
                if (next.has(dateKey)) {
                  next.delete(dateKey);
                } else {
                  next.add(dateKey);
                }
                onCollapseChange(Array.from(next));
              }}
            >
              <Flex align="center" gap="small" style={{ minWidth: 0 }}>
                {isExpanded ? <DownOutlined /> : <RightOutlined />}
                <CalendarOutlined />
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color:
                      dateKey === "Today"
                        ? token.colorPrimary
                        : token.colorText,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {dateKey} ({totalChatsInDate})
                </span>
              </Flex>

              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                danger
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteByDate(dateKey);
                }}
              />
            </Flex>

            {isExpanded ? (
              <div style={{ marginTop: 4 }}>
                <List
                  itemLayout="horizontal"
                  dataSource={dateGroup}
                  split={false}
                  renderItem={(chat: ChatItem) => (
                    <ChatItemComponent
                      key={chat.id}
                      chat={chat}
                      isSelected={chat.id === currentChatId}
                      onSelect={onSelectChat}
                      onDelete={onDeleteChat}
                      onPin={onPinChat}
                      onUnpin={onUnpinChat}
                      onEdit={onEditTitle}
                      onGenerateTitle={onGenerateTitle}
                      isGeneratingTitle={
                        titleGenerationState[chat.id]?.status === "loading"
                      }
                      titleGenerationError={
                        titleGenerationState[chat.id]?.status === "error"
                          ? titleGenerationState[chat.id]?.error
                          : undefined
                      }
                    />
                  )}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </Space>
  );
};
