import React, { useEffect } from "react";
import { Layout, theme } from "antd";
import { ChatSidebar } from "../pages/ChatPage/components/ChatSidebar";
import { SystemSettingsPage } from "../pages/SettingsPage/components/SystemSettingsPage";
import { ChatAutoTitleEffect } from "../pages/ChatPage/components/ChatAutoTitleEffect";
import { useSettingsViewStore } from "../shared/store/settingsViewStore";
import { useMermaidTheme } from "../shared/components/MermaidChart/useMermaidTheme";
import { mermaidCache } from "../shared/components/MermaidChart/mermaidConfig";
import { clearMermaidRenderCache } from "../shared/components/MermaidChart/mermaidRenderManager";
import { useMermaidSettings } from "../shared/store/mermaidSettingsStore";
import { useAgentEventSubscription } from "@hooks/useAgentEventSubscription";
import { useProviderStore } from "../pages/ChatPage/store/slices/providerSlice";
import { MultiPaneChatView } from "../pages/ChatPage/components/MultiPaneChatView";
import { useUILayoutStore } from "../shared/store/uiLayoutStore";
import { ResizableSplit } from "../shared/components/ResizableSplit";

export const MainLayout: React.FC<{
  themeMode: "light" | "dark";
  onThemeModeChange: (mode: "light" | "dark") => void;
}> = ({ themeMode, onThemeModeChange }) => {
  const settingsOpen = useSettingsViewStore((s) => s.isOpen);
  const closeSettings = useSettingsViewStore((s) => s.close);
  const { token } = theme.useToken();
  const mermaidSettings = useMermaidSettings();

  // Load provider configuration once for the whole app.
  const loadProviderConfig = useProviderStore((state) => state.loadProviderConfig);
  useEffect(() => {
    loadProviderConfig();
  }, [loadProviderConfig]);

  // Maintain a single persistent subscription to agent events.
  useAgentEventSubscription();

  // Enable global Mermaid theme updates
  useMermaidTheme();

  // Clear Mermaid cache when theme changes to force re-render
  useEffect(() => {
    mermaidCache.clear();
    clearMermaidRenderCache();
  }, [themeMode]);

  // Clear Mermaid cache when user settings change
  useEffect(() => {
    mermaidCache.clear();
    clearMermaidRenderCache();
  }, [mermaidSettings]);

  // Sidebar sizing (persisted)
  const sidebarCollapsed = useUILayoutStore((s) => s.sidebar.collapsed);
  const sidebarWidthPx = useUILayoutStore((s) => s.sidebar.widthPx);
  const sidebarCollapsedWidthPx = useUILayoutStore((s) => s.sidebar.collapsedWidthPx);
  const sidebarMinWidthPx = useUILayoutStore((s) => s.sidebar.minWidthPx);
  const sidebarMaxWidthPx = useUILayoutStore((s) => s.sidebar.maxWidthPx);
  const setSidebarWidthPx = useUILayoutStore((s) => s.setSidebarWidthPx);

  return (
    <Layout
      style={{
        minHeight: "100vh",
        height: "100vh",
        overflow: "hidden",
        background: token.colorBgLayout,
        display: "flex",
        flexDirection: "row",
      }}
    >
      {settingsOpen ? (
        <Layout
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: token.colorBgContainer,
            minHeight: 0,
          }}
        >
          <SystemSettingsPage
            themeMode={themeMode}
            onThemeModeChange={onThemeModeChange}
            onBack={closeSettings}
          />
        </Layout>
      ) : (
        <>
          <ChatAutoTitleEffect />

          <ResizableSplit
            layout="horizontal"
            style={{
              flex: 1,
              minHeight: 0,
              height: "100%",
              background: token.colorBgContainer,
            }}
            sizesPx={[
              sidebarCollapsed ? sidebarCollapsedWidthPx : sidebarWidthPx,
              0,
            ]}
            minFirstPx={
              sidebarCollapsed ? sidebarCollapsedWidthPx : sidebarMinWidthPx
            }
            // Keep the same max behavior by clamping in the store setter.
            // We still want the drag interaction to feel bounded though.
            minSecondPx={320}
            disabled={sidebarCollapsed}
            handleSizePx={sidebarCollapsed ? 0 : 6}
            onResizeEnd={([firstPx]) => {
              if (sidebarCollapsed) return;
              const clamped = Math.max(
                sidebarMinWidthPx,
                Math.min(sidebarMaxWidthPx, firstPx),
              );
              setSidebarWidthPx(clamped);
            }}
            first={<ChatSidebar />}
            second={
              <Layout
                style={{
                  display: "flex",
                  flexDirection: "column",
                  background: token.colorBgContainer,
                  minHeight: 0,
                  height: "100%",
                }}
              >
                <MultiPaneChatView />
              </Layout>
            }
          />
        </>
      )}
    </Layout>
  );
};
