import React, { useState, useEffect, useCallback } from "react";
import {
  Collapse,
  Select,
  Space,
  Typography,
  Divider,
  theme,
  message,
  Alert,
  Button,
  Spin,
  Input,
  Modal,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { serviceFactory } from "@services/common/ServiceFactory";
import { settingsService } from "@services/config/SettingsService";

const { Text } = Typography;
const { useToken } = theme;

interface ModelMapping {
  [key: string]: string;
}

// Model cache with 5-minute expiration
interface ModelCache {
  [provider: string]: {
    models: string[];
    timestamp: number;
  };
}

const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

export const ModelMappingCard: React.FC = () => {
  const { token } = useToken();
  const [mappings, setMappings] = useState<ModelMapping>({});
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [msgApi, msgContextHolder] = message.useMessage();

  // Model cache state
  const [modelCache, setModelCache] = useState<ModelCache>({});

  // Custom model input modal state
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customModelType, setCustomModelType] = useState<string>("");
  const [customModelName, setCustomModelName] = useState<string>("");

  // Load current provider configuration
  useEffect(() => {
    const loadProviderConfig = async () => {
      try {
        const config = await settingsService.getProviderConfig();
        setCurrentProvider(config.provider || "copilot");
      } catch (error) {
        console.error("Failed to load provider config:", error);
        setError("Failed to load provider configuration");
      }
    };
    loadProviderConfig();
  }, []);

  // Listen for provider config changes (polling every 10 seconds)
  useEffect(() => {
    const checkProviderChange = async () => {
      try {
        const config = await settingsService.getProviderConfig();
        const newProvider = config.provider || "copilot";

        if (newProvider !== currentProvider && currentProvider !== "") {
          console.log(
            `Provider changed from ${currentProvider} to ${newProvider}`,
          );
          setCurrentProvider(newProvider);
          setError(null);
        }
      } catch (error) {
        console.error("Failed to check provider change:", error);
      }
    };

    const interval = setInterval(checkProviderChange, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [currentProvider]);

  // Load model mappings
  useEffect(() => {
    const loadMappings = async () => {
      try {
        const response = await serviceFactory.getAnthropicModelMapping();
        setMappings(response.mappings || {});
      } catch (error) {
        console.error("Failed to load model mappings:", error);
        msgApi.error("Failed to load existing mappings");
      }
    };
    loadMappings();
  }, [msgApi]);

  // Fetch models with caching
  const fetchModels = useCallback(
    async (forceRefresh = false) => {
      if (!currentProvider) return;

      // Check cache first (unless force refresh)
      if (!forceRefresh && modelCache[currentProvider]) {
        const cached = modelCache[currentProvider];
        const now = Date.now();

        if (now - cached.timestamp < CACHE_EXPIRATION_MS) {
          console.log(`Using cached models for ${currentProvider}`);
          setAvailableModels(cached.models);
          setError(null);
          return;
        }
      }

      setIsLoadingModels(true);
      setError(null);

      try {
        let models: string[];

        // For Copilot provider, use the /models endpoint (via modelService)
        // For other providers, use /bamboo/settings/provider/models
        if (currentProvider === "copilot") {
          const { modelService } = await import(
            "../../../../services/chat/ModelService"
          );
          models = await modelService.getModels();
        } else {
          models = await settingsService.fetchProviderModels(currentProvider);
        }

        setAvailableModels(models);

        // Update cache
        setModelCache((prev) => ({
          ...prev,
          [currentProvider]: {
            models,
            timestamp: Date.now(),
          },
        }));

        console.log(`Fetched ${models.length} models for ${currentProvider}`);
      } catch (error) {
        console.error("Failed to fetch models:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load models";
        setError(errorMessage);
        msgApi.error(
          "Failed to load models. Please check your provider configuration.",
        );
        setAvailableModels([]);
      } finally {
        setIsLoadingModels(false);
      }
    },
    [currentProvider, modelCache, msgApi],
  );

  // Fetch models when provider changes
  useEffect(() => {
    if (currentProvider) {
      fetchModels();
    }
  }, [currentProvider, fetchModels]);

  const handleMappingChange = async (
    modelType: string,
    selectedModel: string,
  ) => {
    // Handle custom input
    if (selectedModel === "__custom__") {
      setCustomModelType(modelType);
      setCustomModelName("");
      setCustomModalVisible(true);
      return;
    }

    if (!selectedModel) {
      return; // Don't save empty values
    }

    const newMappings = { ...mappings, [modelType]: selectedModel };
    setMappings(newMappings);

    try {
      await serviceFactory.setAnthropicModelMapping({ mappings: newMappings });
      msgApi.success("Model mapping saved");
    } catch (error) {
      console.error("Failed to save model mapping:", error);
      msgApi.error("Failed to save model mapping");
    }
  };

  const handleCustomModelSave = async () => {
    if (!customModelName.trim()) {
      msgApi.warning("Please enter a model name");
      return;
    }

    const newMappings = {
      ...mappings,
      [customModelType]: customModelName.trim(),
    };
    setMappings(newMappings);

    try {
      await serviceFactory.setAnthropicModelMapping({ mappings: newMappings });
      msgApi.success("Custom model mapping saved");
      setCustomModalVisible(false);
      setCustomModelName("");
    } catch (error) {
      console.error("Failed to save custom model mapping:", error);
      msgApi.error("Failed to save custom model mapping");
    }
  };

  const handleRefreshModels = () => {
    fetchModels(true); // Force refresh
  };

  // Validate if a mapped model still exists in available models
  const validateMapping = (modelType: string): boolean => {
    const mappedModel = mappings[modelType];
    if (!mappedModel) return true; // No mapping is valid
    return availableModels.includes(mappedModel);
  };

  const modelTypes = [
    {
      key: "opus",
      label: "Opus",
      description: 'matches models containing "opus"',
    },
    {
      key: "sonnet",
      label: "Sonnet",
      description: 'matches models containing "sonnet"',
    },
    {
      key: "haiku",
      label: "Haiku",
      description: 'matches models containing "haiku"',
    },
  ];

  const collapseItems = [
    {
      key: "1",
      label: "Anthropic Model Mapping",
      children: (
        <Space
          direction="vertical"
          size={token.marginSM}
          style={{ width: "100%" }}
        >
          <Text type="secondary">
            Configure which{" "}
            {currentProvider.charAt(0).toUpperCase() + currentProvider.slice(1)}{" "}
            models to use when Claude CLI requests specific models.
          </Text>

          {/* Error Alert with Retry Button */}
          {error && (
            <Alert
              type="error"
              message="Failed to Load Models"
              description={error}
              showIcon
              action={
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={handleRefreshModels}
                  loading={isLoadingModels}
                >
                  Retry
                </Button>
              }
            />
          )}

          {/* Loading State */}
          {isLoadingModels && !error && (
            <div style={{ textAlign: "center", padding: token.paddingMD }}>
              <Spin tip="Loading models..." />
            </div>
          )}

          {/* Model Mapping Selections */}
          {!isLoadingModels &&
            !error &&
            modelTypes.map(({ key, label, description }) => {
              const isMappingValid = validateMapping(key);
              const mappedModel = mappings[key];

              return (
                <Space
                  key={key}
                  direction="vertical"
                  size={token.marginXXS}
                  style={{ width: "100%" }}
                >
                  <Text type="secondary">
                    {label} ({description})
                  </Text>
                  <Select
                    style={{ width: "100%" }}
                    value={mappedModel || undefined}
                    onChange={(value) => handleMappingChange(key, value)}
                    placeholder={`Select ${label} model`}
                    loading={isLoadingModels}
                    disabled={isLoadingModels || availableModels.length === 0}
                    showSearch
                    allowClear
                    optionFilterProp="children"
                    options={[
                      ...availableModels.map((m) => ({ label: m, value: m })),
                      { label: "✏️ Custom model...", value: "__custom__" },
                    ]}
                    status={!isMappingValid ? "warning" : undefined}
                    filterOption={(input, option) =>
                      (option?.label ?? "")
                        .toString()
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                  />
                  {/* Model Validation Warning */}
                  {!isMappingValid && mappedModel && (
                    <Text type="warning" style={{ fontSize: token.fontSizeSM }}>
                      ⚠️ Mapped model "{mappedModel}" not found in current
                      provider's available models
                    </Text>
                  )}
                </Space>
              );
            })}

          <Divider style={{ margin: `${token.marginSM} 0` }} />

          {/* Action Buttons */}
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={handleRefreshModels}
              loading={isLoadingModels}
              disabled={!currentProvider}
            >
              Refresh Models
            </Button>
          </Space>

          {/* Status Information */}
          <Space
            direction="vertical"
            size={token.marginXXS}
            style={{ width: "100%" }}
          >
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              Current Provider:{" "}
              <Text strong>{currentProvider || "Loading..."}</Text>
            </Text>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              Available Models: <Text strong>{availableModels.length}</Text>
              {modelCache[currentProvider] && (
                <Text type="secondary" style={{ marginLeft: token.marginXXS }}>
                  (cached)
                </Text>
              )}
            </Text>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              Stored in:{" "}
              <Text code>~/.bamboo/anthropic-model-mapping.json</Text>
            </Text>
          </Space>
        </Space>
      ),
    },
  ];

  return (
    <>
      {msgContextHolder}
      <Collapse
        size="small"
        items={collapseItems}
        style={{ marginBottom: token.marginSM }}
      />

      {/* Custom Model Input Modal */}
      <Modal
        title="Enter Custom Model Name"
        open={customModalVisible}
        onOk={handleCustomModelSave}
        onCancel={() => {
          setCustomModalVisible(false);
          setCustomModelName("");
        }}
        okText="Save"
        cancelText="Cancel"
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Text type="secondary">
            Enter a custom model name for <Text strong>{customModelType}</Text>
          </Text>
          <Input
            placeholder="e.g., gpt-4-turbo-preview"
            value={customModelName}
            onChange={(e) => setCustomModelName(e.target.value)}
            onPressEnter={handleCustomModelSave}
            autoFocus
          />
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            Note: Make sure the model name is valid for the current provider.
          </Text>
        </Space>
      </Modal>
    </>
  );
};
