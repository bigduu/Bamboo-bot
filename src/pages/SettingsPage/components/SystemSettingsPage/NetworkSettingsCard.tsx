import React, { useState, useEffect } from "react";
import { Button, Card, Input, Space, Typography, Alert, theme } from "antd";
import { useBambooConfigStore } from "../../../../shared/stores/bambooConfigStore";

const { Text } = Typography;
const { useToken } = theme;

interface NetworkSettingsCardProps {
  httpProxy: string;
  httpsProxy: string;
  onHttpProxyChange: (value: string) => void;
  onHttpsProxyChange: (value: string) => void;
  onReload: () => void;
  onSave: () => void;
  isLoading: boolean;
}

export const NetworkSettingsCard: React.FC<NetworkSettingsCardProps> = ({
  httpProxy,
  httpsProxy,
  onHttpProxyChange,
  onHttpsProxyChange,
  onReload,
  onSave,
  isLoading,
}) => {
  const { token } = useToken();
  const proxyAuthStatus = useBambooConfigStore((state) => state.proxyAuthStatus);
  const isLoadingProxyAuthStatus = useBambooConfigStore(
    (state) => state.isLoadingProxyAuthStatus,
  );
  const loadProxyAuthStatus = useBambooConfigStore(
    (state) => state.loadProxyAuthStatus,
  );
  const applyProxyAuth = useBambooConfigStore((state) => state.applyProxyAuth);
  const clearProxyAuth = useBambooConfigStore((state) => state.clearProxyAuth);

  const [proxyAuthForm, setProxyAuthForm] = useState({
    username: "",
    password: "",
  });
  const [isApplyingProxyAuth, setIsApplyingProxyAuth] = useState(false);

  // Load proxy auth status (and allow manual refresh via Save/Reload buttons).
  useEffect(() => {
    void loadProxyAuthStatus();
  }, []);

  const handleApplyProxyAuth = async () => {
    const username = proxyAuthForm.username.trim();
    if (!username) {
      return;
    }

    setIsApplyingProxyAuth(true);
    try {
      await applyProxyAuth({
        username,
        password: proxyAuthForm.password,
      });
      setProxyAuthForm({ username: "", password: "" });
    } catch (error) {
      console.error("Failed to apply proxy auth:", error);
    } finally {
      setIsApplyingProxyAuth(false);
    }
  };

  const handleClearProxyAuth = async () => {
    setIsApplyingProxyAuth(true);
    try {
      await clearProxyAuth();
    } catch (error) {
      console.error("Failed to clear proxy auth:", error);
    } finally {
      setIsApplyingProxyAuth(false);
    }
  };

  return (
    <Card size="small" title={<Text strong>Network Settings</Text>}>
      <Space
        direction="vertical"
        size={token.marginSM}
        style={{ width: "100%" }}
      >
        {/* HTTP Proxy */}
        <Space
          direction="vertical"
          size={token.marginXXS}
          style={{ width: "100%" }}
        >
          <Text type="secondary">HTTP Proxy</Text>
          <Input
            data-testid="proxy-url"
            style={{ width: "100%" }}
            value={httpProxy}
            onChange={(e) => onHttpProxyChange(e.target.value)}
            placeholder="http://proxy.example.com:8080"
            disabled={isLoading}
          />
        </Space>

        {/* HTTPS Proxy */}
        <Space
          direction="vertical"
          size={token.marginXXS}
          style={{ width: "100%" }}
        >
          <Text type="secondary">HTTPS Proxy</Text>
          <Input
            style={{ width: "100%" }}
            value={httpsProxy}
            onChange={(e) => onHttpsProxyChange(e.target.value)}
            placeholder="http://proxy.example.com:8080"
            disabled={isLoading}
          />
        </Space>

        {/* Proxy Authentication */}
        <Card
          size="small"
          title="Proxy Authentication"
          style={{ marginTop: token.marginSM }}
        >
          {proxyAuthStatus?.configured ? (
            <Space direction="vertical" style={{ width: "100%" }}>
              <Alert
                type="success"
                message={`Configured for user: ${proxyAuthStatus.username ?? ""}`}
                showIcon
              />
              <Button
                onClick={handleClearProxyAuth}
                loading={isApplyingProxyAuth || isLoadingProxyAuthStatus}
                danger
              >
                Clear Credentials
              </Button>
            </Space>
          ) : (
            <Space
              direction="vertical"
              size={token.marginXS}
              style={{ width: "100%" }}
            >
              <Input
                placeholder="Username"
                value={proxyAuthForm.username}
                onChange={(e) =>
                  setProxyAuthForm((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
              />
              <Input.Password
                placeholder="Password"
                value={proxyAuthForm.password}
                onChange={(e) =>
                  setProxyAuthForm((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
              />
              <Button
                type="primary"
                onClick={handleApplyProxyAuth}
                loading={isApplyingProxyAuth || isLoadingProxyAuthStatus}
                disabled={!proxyAuthForm.username.trim()}
              >
                Apply
              </Button>
            </Space>
          )}
        </Card>

        {/* Info */}
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          Proxy credentials are stored encrypted in ~/.bamboo/config.json
        </Text>

        {/* Save buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: token.marginSM,
          }}
        >
          <Button
            onClick={() =>
              Promise.resolve(onReload()).finally(() =>
                loadProxyAuthStatus({ force: true }),
              )
            }
            disabled={isLoading}
          >
            Reload
          </Button>
          <Button
            data-testid="save-proxy-settings"
            type="primary"
            onClick={() =>
              Promise.resolve(onSave()).finally(() =>
                loadProxyAuthStatus({ force: true }),
              )
            }
            disabled={isLoading}
          >
            Save
          </Button>
        </div>
      </Space>
    </Card>
  );
};
