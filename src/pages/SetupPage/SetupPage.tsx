import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Checkbox, Input, Spin, Steps } from "antd";
import type { CheckboxChangeEvent } from "antd/es/checkbox";
import { ServiceFactory } from "../../services/common/ServiceFactory";

import "./SetupPage.css";

interface SetupConfig {
  httpProxy: string;
  httpsProxy: string;
  proxyUsername: string;
  proxyPassword: string;
  rememberProxyAuth: boolean;
}

interface ProxyDetectionState {
  needsProxy: boolean;
  message: string;
}

const DEFAULT_CONFIG: SetupConfig = {
  httpProxy: "",
  httpsProxy: "",
  proxyUsername: "",
  proxyPassword: "",
  rememberProxyAuth: true,
};

const parseString = (value: unknown): string =>
  typeof value === "string" ? value : "";

export const SetupPage = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<SetupConfig>(DEFAULT_CONFIG);
  const [needsProxy, setNeedsProxy] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] =
    useState<ProxyDetectionState | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const checkInitialConfig = async () => {
      let hasExistingProxy = false;

      try {
        const serviceFactory = ServiceFactory.getInstance();

        const existingConfig = await serviceFactory.getBambooConfig();
        const httpProxy = parseString(existingConfig.http_proxy);
        const httpsProxy = parseString(existingConfig.https_proxy);

        // We can only prefill username (never the password).
        const authStatus = await serviceFactory.getProxyAuthStatus();
        const username = parseString(authStatus.username);

        setConfig({
          httpProxy,
          httpsProxy,
          proxyUsername: username,
          proxyPassword: "",
          rememberProxyAuth: DEFAULT_CONFIG.rememberProxyAuth,
        });

        hasExistingProxy =
          httpProxy.trim().length > 0 || httpsProxy.trim().length > 0;
        setNeedsProxy(hasExistingProxy);
      } catch (error) {
        console.error("Failed to check config:", error);
        setNeedsProxy(false);
      }

      setIsDetecting(true);
      try {
        const serviceFactory = ServiceFactory.getInstance();
        const status = await serviceFactory.getSetupStatus();
        setDetectionResult({
          needsProxy: status.has_proxy_env,
          message: status.message,
        });
        setNeedsProxy(hasExistingProxy || status.has_proxy_env);
      } catch (error) {
        console.error("Failed to check setup status:", error);
        setDetectionResult({
          needsProxy: true,
          message:
            "Unable to load setup status. You can continue with manual proxy configuration.",
        });
      } finally {
        setIsDetecting(false);
      }
    };

    void checkInitialConfig();
  }, []);

  const hasProxy =
    config.httpProxy.trim().length > 0 || config.httpsProxy.trim().length > 0;
  const shouldShowAuthFields = hasProxy || needsProxy;

  const updateConfig = (partial: Partial<SetupConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const handleSaveProxyConfig = async () => {
    const httpProxy = config.httpProxy.trim();
    const httpsProxy = config.httpsProxy.trim();
    const hasProxy = Boolean(httpProxy || httpsProxy);
    const username = config.proxyUsername.trim();
    const hasAuth = Boolean(username);

    try {
      setErrorMessage(null);
      setIsSaving(true);

      if (hasProxy) {
        const serviceFactory = ServiceFactory.getInstance();
        await serviceFactory.setBambooConfig({
          http_proxy: httpProxy,
          https_proxy: httpsProxy,
        });

        if (config.rememberProxyAuth && hasAuth) {
          await serviceFactory.setProxyAuth({
            username,
            password: config.proxyPassword || "",
          });
        } else {
          // Clear any previously-stored proxy auth to avoid stale credentials.
          await serviceFactory.clearProxyAuth();
        }
      }

      const serviceFactory = ServiceFactory.getInstance();
      await serviceFactory.markSetupComplete();
      setIsComplete(true);
    } catch (error) {
      console.error("Failed to complete setup:", error);
      setErrorMessage(
        hasProxy
          ? "Failed to save proxy configuration. Please try again."
          : "Failed to complete setup. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipSetup = async () => {
    try {
      setErrorMessage(null);
      setIsSaving(true);
      const serviceFactory = ServiceFactory.getInstance();
      await serviceFactory.markSetupComplete();
      setIsComplete(true);
    } catch (error) {
      console.error("Failed to mark setup complete:", error);
      setErrorMessage("Failed to complete setup. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const steps = useMemo(
    () => [
      {
        title: "Welcome",
        content: (
          <div>
            <h1>Welcome to Bamboo</h1>
            <p>
              Let&apos;s set up your environment before entering the main app.
            </p>
            <Alert
              message="You can skip setup now and configure proxy settings later in System Settings."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <div className="setup-page__actions">
              <Button data-testid="setup-next" type="primary" onClick={() => setCurrentStep(1)}>
                Next
              </Button>
              <Button data-testid="setup-skip" onClick={() => void handleSkipSetup()} loading={isSaving}>
                Skip for now
              </Button>
            </div>
          </div>
        ),
      },
      {
        title: "Proxy Configuration",
        content: (
          <div>
            <h2>Proxy Configuration</h2>
            <Alert
              message="If you're behind a corporate proxy, configure it below."
              type="info"
              showIcon
            />

            {isDetecting ? (
              <div style={{ marginTop: 16 }}>
                <Spin tip="Detecting network environment..." />
              </div>
            ) : null}

            {detectionResult ? (
              <Alert
                message={detectionResult.message}
                type={detectionResult.needsProxy ? "warning" : "success"}
                showIcon
                style={{ marginTop: 16 }}
              />
            ) : null}

            {!isDetecting && !detectionResult && !needsProxy ? (
              <Alert
                message="No existing proxy was detected. You can leave these fields empty if your network does not require a proxy."
                type="success"
                showIcon
                style={{ marginTop: 16 }}
              />
            ) : null}

            {errorMessage ? (
              <Alert
                message={errorMessage}
                type="error"
                showIcon
                style={{ marginTop: 16 }}
              />
            ) : null}

            <div style={{ marginTop: 16 }}>
              <label htmlFor="setup-http-proxy">HTTP Proxy URL:</label>
              <Input
                id="setup-http-proxy"
                value={config.httpProxy}
                onChange={(event) =>
                  updateConfig({ httpProxy: event.target.value })
                }
                placeholder="http://proxy.company.com:8080"
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <label htmlFor="setup-https-proxy">HTTPS Proxy URL:</label>
              <Input
                id="setup-https-proxy"
                value={config.httpsProxy}
                onChange={(event) =>
                  updateConfig({ httpsProxy: event.target.value })
                }
                placeholder="http://proxy.company.com:8080"
              />
            </div>

            {shouldShowAuthFields ? (
              <>
                <div style={{ marginTop: 16 }}>
                  <label htmlFor="setup-proxy-username">Username</label>
                  <Input
                    id="setup-proxy-username"
                    value={config.proxyUsername}
                    onChange={(event) =>
                      updateConfig({ proxyUsername: event.target.value })
                    }
                  />
                </div>

                <div style={{ marginTop: 16 }}>
                  <label htmlFor="setup-proxy-password">Password</label>
                  <Input.Password
                    id="setup-proxy-password"
                    value={config.proxyPassword}
                    onChange={(event) =>
                      updateConfig({ proxyPassword: event.target.value })
                    }
                  />
                </div>

                <div style={{ marginTop: 16 }}>
                  <Checkbox
                    checked={config.rememberProxyAuth}
                    onChange={(event: CheckboxChangeEvent) =>
                      updateConfig({ rememberProxyAuth: event.target.checked })
                    }
                  >
                    Remember credentials (encrypted)
                  </Checkbox>
                </div>
              </>
            ) : null}

            <div className="setup-page__actions" style={{ marginTop: 24 }}>
              <Button data-testid="setup-back" onClick={() => setCurrentStep(0)}>Back</Button>
              <Button data-testid="setup-skip" onClick={() => void handleSkipSetup()} loading={isSaving}>
                Skip for now
              </Button>
              <Button
                data-testid="setup-complete"
                onClick={() => void handleSaveProxyConfig()}
                type="primary"
                loading={isSaving}
              >
                Complete Setup
              </Button>
            </div>
          </div>
        ),
      },
    ],
    [
      config,
      detectionResult,
      errorMessage,
      isDetecting,
      isSaving,
      needsProxy,
      shouldShowAuthFields,
    ],
  );

  if (isComplete) {
    return (
      <div data-testid="setup-complete" className="setup-complete">
        <h1>Setup Complete!</h1>
        <p>Please restart the application to apply all settings.</p>
        <Button data-testid="setup-restart" onClick={() => window.location.reload()}>Restart</Button>
      </div>
    );
  }

  return (
    <div className="setup-page">
      <Card style={{ maxWidth: 600, margin: "40px auto" }}>
        <Steps
          current={currentStep}
          items={steps.map((step) => ({ title: step.title }))}
        />
        <div style={{ marginTop: 24 }}>{steps[currentStep].content}</div>
      </Card>
    </div>
  );
};
