import { useEffect, useState } from "react";
import { App as AntApp, ConfigProvider, theme } from "antd";
import "./App.css";
import { MainLayout } from "./MainLayout";
import { SetupPage } from "../pages/SetupPage";
import { initializeStore } from "../pages/ChatPage/store";
import { ServiceFactory } from "../services/common/ServiceFactory";

const THEME_STORAGE_KEY = "copilot_ui_theme_v1";

function App() {
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return (saved as "light" | "dark") || "light";
  });
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);

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
