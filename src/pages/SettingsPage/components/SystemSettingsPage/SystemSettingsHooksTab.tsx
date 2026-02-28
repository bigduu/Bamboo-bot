import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Flex, Select, Switch, Typography, message, theme } from "antd";
import { serviceFactory } from "../../../../services/common/ServiceFactory";

const { Text } = Typography;
const { useToken } = theme;

type ImageFallbackMode = "placeholder" | "error" | "ocr";

const getImageFallbackMode = (config: any): ImageFallbackMode => {
  const mode = String(config?.hooks?.image_fallback?.mode || "placeholder")
    .trim()
    .toLowerCase();
  if (mode === "error" || mode === "ocr") return mode;
  return "placeholder";
};

const getImageFallbackEnabled = (config: any): boolean => {
  const value = config?.hooks?.image_fallback?.enabled;
  return typeof value === "boolean" ? value : false;
};

const SystemSettingsHooksTab: React.FC = () => {
  const { token } = useToken();
  const [msgApi, contextHolder] = message.useMessage();
  const [isLoading, setIsLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<ImageFallbackMode>("placeholder");

  const modeOptions = useMemo(
    () => [
      { label: "Placeholder", value: "placeholder" as const },
      { label: "Error", value: "error" as const },
      { label: "OCR (Windows)", value: "ocr" as const },
    ],
    [],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const config = await serviceFactory.getBambooConfig();
      setEnabled(getImageFallbackEnabled(config));
      setMode(getImageFallbackMode(config));
    } catch (error) {
      msgApi.error(
        error instanceof Error ? error.message : "Failed to load hooks settings",
      );
    } finally {
      setIsLoading(false);
    }
  }, [msgApi]);

  const patch = useCallback(
    async (nextEnabled: boolean, nextMode: ImageFallbackMode) => {
      await serviceFactory.setBambooConfig({
        hooks: {
          image_fallback: {
            enabled: nextEnabled,
            mode: nextMode,
          },
        },
      });
    },
    [],
  );

  const handleEnabledChange = useCallback(
    async (checked: boolean) => {
      setIsLoading(true);
      try {
        await patch(checked, mode);
        msgApi.success(checked ? "Image hooks enabled" : "Image hooks disabled");
        await load();
      } catch (error) {
        msgApi.error(
          error instanceof Error ? error.message : "Failed to update hooks",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [load, mode, msgApi, patch],
  );

  const handleModeChange = useCallback(
    async (nextMode: ImageFallbackMode) => {
      setIsLoading(true);
      try {
        await patch(enabled, nextMode);
        msgApi.success(`Image hook mode set to: ${nextMode}`);
        await load();
      } catch (error) {
        msgApi.error(
          error instanceof Error ? error.message : "Failed to update hook mode",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, load, msgApi, patch],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Flex vertical gap={token.marginLG}>
      {contextHolder}
      <Card size="small" loading={isLoading}>
        <Flex vertical gap={token.marginXS}>
          <Text strong>Image Hooks</Text>
          <Flex align="center" justify="space-between">
            <Text>Enable image preflight hook</Text>
            <Switch checked={enabled} onChange={handleEnabledChange} />
          </Flex>
          <Flex align="center" justify="space-between">
            <Text>Mode</Text>
            <Select
              style={{ width: 180 }}
              value={mode}
              options={modeOptions}
              onChange={handleModeChange}
              disabled={!enabled}
            />
          </Flex>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            Placeholder mode rewrites images into text summaries (this can break
            tools that expect real image data). OCR is currently Windows-only.
          </Text>
        </Flex>
      </Card>
    </Flex>
  );
};

export default SystemSettingsHooksTab;
