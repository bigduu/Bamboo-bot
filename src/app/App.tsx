import { useEffect, useState } from "react";
import { App as AntApp, ConfigProvider, theme } from "antd";
import "./App.css";
import { MainLayout } from "./MainLayout";
import { SetupPage } from "../pages/SetupPage";
import { initializeStore } from "../pages/ChatPage/store";
import { ServiceFactory } from "../services/common/ServiceFactory";
import { StartupConfirmation } from "../shared/components/StartupConfirmation";

const THEME_STORAGE_KEY = "copilot_ui_theme_v1";

// Determine if this is an internal build
// This should be set during build time via Vite define
const IS_INTERNAL_BUILD = import.meta.env.VITE_INTERNAL_BUILD === "true";

function App() {
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return (saved as "light" | "dark") || "light";
  });
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [startupConfirmed, setStartupConfirmed] = useState(!IS_INTERNAL_BUILD);

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const serviceFactory = ServiceFactory.getInstance();
        const status = await serviceFactory.getSetupStatus();
        setIsSetupComplete(status.is_complete);
      } catch (error) {
        console.error("Failed to check setup status:", error);
        setIsSetupComplete(false);
      }
    };

    void checkSetupStatus();
  }, []);

  useEffect(() => {
    document.body.setAttribute("data-theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (isSetupComplete) {
      initializeStore();
    }
  }, [isSetupComplete]);

  // Show startup confirmation for internal builds
  if (IS_INTERNAL_BUILD && !startupConfirmed) {
    return (
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#1677ff",
            borderRadius: 6,
          },
          algorithm:
            themeMode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
        }}
      >
        <AntApp>
          <StartupConfirmation
            onConfirm={() => setStartupConfirmed(true)}
            onDecline={() => {
              // Exit the application
              if (typeof window !== "undefined" && "__TAURI__" in window) {
                // Tauri specific exit
                import("@tauri-apps/api/process").then(({ exit }) => {
                  exit(0);
                });
              } else {
                // Browser fallback - close tab
                window.close();
              }
            }}
          />
        </AntApp>
      </ConfigProvider>
    );
  }

  if (isSetupComplete === null) {
    return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;
  }

  const appContent = isSetupComplete ? (
    <MainLayout themeMode={themeMode} onThemeModeChange={setThemeMode} />
  ) : (
    <SetupPage />
  );

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 6,
        },
        algorithm:
          themeMode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <AntApp>
        <div style={{ position: "relative" }}>{appContent}</div>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
