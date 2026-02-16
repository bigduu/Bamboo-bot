import React, { useState, useEffect } from "react";
import {
  Collapse,
  Select,
  Space,
  Typography,
  Divider,
  theme,
  message,
} from "antd";
import { serviceFactory } from "../../../../services/common/ServiceFactory";
import { settingsService } from "../../../../services/config/SettingsService";

const { Text } = Typography;
const { useToken } = theme;

interface ModelMapping {
  [key: string]: string;
}

export const ModelMappingCard: React.FC = () => {
  const { token } = useToken();
  const [mappings, setMappings] = useState<ModelMapping>({});
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<string>("copilot");
  const [msgApi, msgContextHolder] = message.useMessage();

  // Load current provider configuration
  useEffect(() => {
    const loadProviderConfig = async () => {
      try {
        const config = await settingsService.getProviderConfig();
        setCurrentProvider(config.provider || "copilot");
      } catch (error) {
        console.error("Failed to load provider config:", error);
      }
    };
    loadProviderConfig();
  }, []);

  // Load model mappings
  useEffect(() => {
    const loadMappings = async () => {
      try {
        const response = await serviceFactory.getAnthropicModelMapping();
        setMappings(response.mappings || {});
      } catch (error) {
        console.error("Failed to load model mappings:", error);
      }
    };
    loadMappings();
  }, []);

  // Fetch models based on current provider
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoadingModels(true);
      try {
        // For Copilot provider, use the /models endpoint (via modelService)
        // For other providers, use /bamboo/settings/provider/models
        if (currentProvider === "copilot") {
          const { modelService } = await import("../../../../services/chat/ModelService");
          const models = await modelService.getModels();
          setAvailableModels(models);
        } else {
          const models = await settingsService.fetchProviderModels(currentProvider);
          setAvailableModels(models);
        }
      } catch (error) {
        console.error("Failed to fetch models:", error);
        msgApi.error("Failed to load models. Please check your provider configuration.");
        setAvailableModels([]);
      } finally {
        setIsLoadingModels(false);
      }
    };

    if (currentProvider) {
      fetchModels();
    }
  }, [currentProvider, msgApi]);

  const handleMappingChange = async (modelType: string, selectedModel: string) => {
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

  const modelTypes = [
    { key: "opus", label: "Opus", description: 'matches models containing "opus"' },
    { key: "sonnet", label: "Sonnet", description: 'matches models containing "sonnet"' },
    { key: "haiku", label: "Haiku", description: 'matches models containing "haiku"' },
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
            Configure which {currentProvider.charAt(0).toUpperCase() + currentProvider.slice(1)} models to use when Claude CLI requests
            specific models.
          </Text>

          {modelTypes.map(({ key, label, description }) => (
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
                value={mappings[key] || undefined}
                onChange={(value) => handleMappingChange(key, value)}
                placeholder={`Select ${label} model`}
                loading={isLoadingModels}
                disabled={isLoadingModels || availableModels.length === 0}
                showSearch
                optionFilterProp="children"
                options={availableModels.map((m) => ({ label: m, value: m }))}
              />
            </Space>
          ))}

          <Divider style={{ margin: `${token.marginSM} 0` }} />

          <Space direction="vertical" size={token.marginXXS} style={{ width: "100%" }}>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              Current Provider: <Text strong>{currentProvider}</Text>
            </Text>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              Available Models: <Text strong>{availableModels.length}</Text>
            </Text>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              Stored in: <Text code>~/.bamboo/anthropic-model-mapping.json</Text>
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
    </>
  );
};
