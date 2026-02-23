import React, { useEffect, useState, memo, useMemo } from "react";
import { Card, Flex, Space, Typography, theme } from "antd";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeSanitize from "rehype-sanitize";
import { streamingMessageBus } from "../../utils/streamingMessageBus";
import { renderCodeBlock } from "../../../../shared/components/Markdown/MarkdownCodeBlock";

const { Text } = Typography;
const { useToken } = theme;

/**
 * 创建流式阶段专用的 Markdown 组件
 * 与完整版的区别：
 * 1. 不渲染 Mermaid 图表（避免流式内容不完整导致的错误）
 * 2. Mermaid 代码块显示为普通代码
 */
const createStreamingMarkdownComponents = (token: any): Components => ({
  p: ({ children }) => (
    <Text
      style={{
        marginBottom: token.marginSM,
        display: "block",
      }}
    >
      {children}
    </Text>
  ),

  ol: ({ children }) => (
    <ol
      style={{
        marginBottom: token.marginSM,
        paddingLeft: 20,
      }}
    >
      {children}
    </ol>
  ),

  ul: ({ children }) => (
    <ul
      style={{
        marginBottom: token.marginSM,
        paddingLeft: 20,
      }}
    >
      {children}
    </ul>
  ),

  li: ({ children }) => (
    <li
      style={{
        marginBottom: token.marginXS,
      }}
    >
      {children}
    </li>
  ),

  code({ className, children, inline, ...props }: any) {
    const match = /language-([^\s]+)/i.exec(className || "");
    const language = match ? match[1] : "";
    const isInline = inline ?? (!match && !className);

    const codeString = children ? String(children).replace(/\n$/, "") : "";

    if (isInline) {
      return (
        <Text code className={className} {...props}>
          {children}
        </Text>
      );
    }

    if (!codeString.trim()) {
      return null;
    }

    // 流式阶段：跳过 Mermaid 渲染，显示为普通代码
    const normalizedLanguage = language.toLowerCase();
    if (normalizedLanguage === "mermaid") {
      return (
        <Card
          size="small"
          styles={{ body: { padding: 0 } }}
          style={{
            position: "relative",
            maxWidth: "100%",
            overflow: "auto",
            marginBottom: token.marginSM,
          }}
        >
          <pre
            style={{
              margin: 0,
              padding: token.paddingSM,
              background: token.colorBgContainer,
              borderRadius: token.borderRadiusSM,
              fontSize: "13px",
            }}
          >
            <code>{codeString}</code>
          </pre>
        </Card>
      );
    }

    // 其他代码块正常渲染（带语法高亮）
    return renderCodeBlock(language, codeString, token, undefined);
  },

  blockquote: ({ children }) => (
    <Card
      size="small"
      styles={{ body: { padding: `${token.paddingXS}px ${token.padding}px` } }}
      style={{
        borderLeft: `3px solid ${token.colorPrimary}`,
        background: token.colorPrimaryBg,
        margin: `${token.marginXS}px 0`,
        color: token.colorTextSecondary,
        fontStyle: "italic",
      }}
    >
      {children}
    </Card>
  ),

  a: ({ children, href }) => (
    <Text
      style={{ color: token.colorLink }}
      onClick={() => href && window.open(href, "_blank", "noopener,noreferrer")}
    >
      {children}
    </Text>
  ),

  table: ({ children }) => (
    <Card
      size="small"
      styles={{ body: { padding: 0 } }}
      style={{ overflow: "auto", margin: `${token.marginSM}px 0` }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          border: `1px solid ${token.colorBorder}`,
        }}
      >
        {children}
      </table>
    </Card>
  ),

  thead: ({ children }) => (
    <thead style={{ backgroundColor: token.colorBgContainer }}>
      {children}
    </thead>
  ),

  tbody: ({ children }) => <tbody>{children}</tbody>,

  tr: ({ children }) => (
    <tr style={{ borderBottom: `1px solid ${token.colorBorder}` }}>
      {children}
    </tr>
  ),

  th: ({ children }) => (
    <th
      style={{
        padding: `${token.paddingXS}px ${token.paddingSM}px`,
        textAlign: "left",
        fontWeight: "bold",
        borderRight: `1px solid ${token.colorBorder}`,
      }}
    >
      {children}
    </th>
  ),

  td: ({ children }) => (
    <td
      style={{
        padding: `${token.paddingXS}px ${token.paddingSM}px`,
        borderRight: `1px solid ${token.colorBorder}`,
      }}
    >
      {children}
    </td>
  ),

  input: ({ type, checked, disabled }) => {
    if (type === "checkbox") {
      return (
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          style={{
            marginRight: token.marginXS,
            accentColor: token.colorPrimary,
          }}
          readOnly
        />
      );
    }
    return <input type={type} checked={checked} disabled={disabled} />;
  },
});

interface StreamingMessageCardProps {
  chatId: string;
}

const StreamingMessageCard: React.FC<StreamingMessageCardProps> = memo(
  ({ chatId }) => {
    const { token } = useToken();
    const messageId = `streaming-${chatId}`;
    const [content, setContent] = useState<string>(
      () => streamingMessageBus.getLatest(messageId) ?? "",
    );

    useEffect(() => {
      return streamingMessageBus.subscribeMessage(messageId, (next) => {
        setContent(next ?? "");
      });
    }, [messageId]);

    // 准备 Markdown 渲染配置
    // 流式阶段使用简化版配置（不渲染 Mermaid 图表，避免内容不完整导致的错误）
    const markdownPlugins = useMemo(() => [remarkGfm, remarkBreaks], []);
    const rehypePlugins = useMemo(() => [rehypeSanitize], []);
    const markdownComponents = useMemo(
      () => createStreamingMarkdownComponents(token),
      [token],
    );

    return (
      <Card
        data-testid="streaming-indicator"
        style={{
          width: "100%",
          minWidth: "100%",
          maxWidth: "800px",
          margin: "0 auto",
          background: token.colorBgLayout,
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadow,
          position: "relative",
          wordWrap: "break-word",
          overflowWrap: "break-word",
        }}
      >
        <Space
          direction="vertical"
          size={token.marginXS}
          style={{ width: "100%", maxWidth: "100%" }}
        >
          <Flex align="baseline" justify="space-between" gap={token.marginXS}>
            <Text
              type="secondary"
              strong
              style={{ fontSize: token.fontSizeSM }}
            >
              Assistant
            </Text>
          </Flex>
          <Flex vertical style={{ width: "100%", maxWidth: "100%" }}>
            {!content ? (
              <Text italic>Assistant is thinking...</Text>
            ) : (
              <ReactMarkdown
                remarkPlugins={markdownPlugins}
                rehypePlugins={rehypePlugins}
                components={markdownComponents}
              >
                {content}
              </ReactMarkdown>
            )}
            <span
              className="blinking-cursor"
              style={{
                display: "inline-block",
                marginLeft: "0.2em",
                color: token.colorText,
              }}
            />
          </Flex>
        </Space>
      </Card>
    );
  },
);

StreamingMessageCard.displayName = "StreamingMessageCard";

export default StreamingMessageCard;
