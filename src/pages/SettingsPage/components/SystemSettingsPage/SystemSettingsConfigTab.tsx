import React, { useState, useEffect, useCallback } from "react";
import { Card, Space, Typography, Input, Button, theme, Alert } from "antd";
import { NetworkSettingsCard } from "./NetworkSettingsCard";
import { ModelMappingCard } from "./ModelMappingCard";
import { serviceFactory } from "../../../../services/common/ServiceFactory";

const { Text } = Typography;
const { useToken } = theme;

interface SystemSettingsConfigTabProps {
  msgApi: {
    success: (content: string) => void;
    error: (content: string) => void;
  };
}

export const SystemSettingsConfigTab: React.FC<
  SystemSettingsConfigTabProps
> = ({ msgApi }) => {
  const { token } = useToken();
  const [config, setConfig] = useState({
    http_proxy: "",
    https_proxy: "",
  });
  const [backendBaseUrl, setBackendBaseUrl] = useState(
    "http://127.0.0.1:8080/v1",
  );
  const [isLoading, setIsLoading] = useState(false);

  // Load config
  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const bambooConfig = await serviceFactory.getBambooConfig();
      setConfig({
        http_proxy: bambooConfig.http_proxy || "",
        https_proxy: bambooConfig.https_proxy || "",
      });
    } catch (error) {
      console.error("Failed to load config:", error);
      msgApi.error("Failed to load configuration");
    } finally {
      setIsLoading(false);
    }
  }, [msgApi]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Handlers
  const handleHttpProxyChange = (value: string) => {
    setConfig((prev) => ({ ...prev, http_proxy: value }));
  };

  const handleHttpsProxyChange = (value: string) => {
    setConfig((prev) => ({ ...prev, https_proxy: value }));
  };

  const handleSaveConfig = async () => {
    setIsLoading(true);
    try {
      await serviceFactory.setBambooConfig(config);
      msgApi.success("Configuration saved successfully");
    } catch (error) {
      console.error("Failed to save config:", error);
      msgApi.error("Failed to save configuration");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBackendUrl = async () => {
    msgApi.success("Backend URL saved");
  };

  const handleResetBackendUrl = () => {
    setBackendBaseUrl("http://127.0.0.1:8080/v1");
    msgApi.success("Backend URL reset to default");
  };

  return (
    <Space direction="vertical" size={token.marginMD} style={{ width: "100%" }}>
      {/* Info Banner */}
      <Alert
        message="Provider Configuration Moved"
        description="GitHub Copilot and other provider settings have been moved to the Provider Settings tab. Please configure your providers there."
        type="info"
        showIcon
        closable
      />

      {/* Network Settings */}
      <NetworkSettingsCard
        httpProxy={config.http_proxy}
        httpsProxy={config.https_proxy}
        onHttpProxyChange={handleHttpProxyChange}
        onHttpsProxyChange={handleHttpsProxyChange}
        onReload={loadConfig}
        onSave={handleSaveConfig}
        isLoading={isLoading}
      />

      {/* Model Mapping */}
      <ModelMappingCard />

      {/* Backend Settings */}
      <Card size="small" title={<Text strong>Backend API Base URL</Text>}>
        <Space
          direction="vertical"
          size={token.marginSM}
          style={{ width: "100%" }}
        >
          <Space
            direction="vertical"
            size={token.marginXXS}
            style={{ width: "100%" }}
          >
            <Input
              style={{ width: "100%" }}
              value={backendBaseUrl}
              onChange={(e) => setBackendBaseUrl(e.target.value)}
              placeholder="http://127.0.0.1:8080/v1"
            />
          </Space>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            Must include /v1 path
          </Text>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: token.marginSM,
            }}
          >
            <Button onClick={handleResetBackendUrl}>Reset to Default</Button>
            <Button type="primary" onClick={handleSaveBackendUrl}>
              Save
            </Button>
          </div>
        </Space>
      </Card>
    </Space>
  );
};

export default SystemSettingsConfigTab;
