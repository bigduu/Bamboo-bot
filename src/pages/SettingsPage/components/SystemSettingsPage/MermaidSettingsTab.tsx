import React from 'react';
import { Card, Form, InputNumber, Switch, Select, Button, Divider, Space, Typography, Row, Col, Tooltip } from 'antd';
import { RestOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import {
  useMermaidSettings,
  useUpdateMermaidSettings,
  useResetMermaidSettings,
} from '../../../../shared/store/mermaidSettingsStore';

const { Title, Text } = Typography;
const { useToken } = theme;

export const MermaidSettingsTab: React.FC = () => {
  const { token } = useToken();
  const settings = useMermaidSettings();
  const updateSettings = useUpdateMermaidSettings();
  const resetSettings = useResetMermaidSettings();
  const [form] = Form.useForm();

  // Sync form with store
  React.useEffect(() => {
    form.setFieldsValue(settings);
  }, [settings, form]);

  const handleValuesChange = (changedValues: any) => {
    updateSettings(changedValues);
  };

  const handleReset = () => {
    resetSettings();
    form.resetFields();
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: '8px' }}>
        Mermaid Diagram Settings
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: '24px' }}>
        Customize how Mermaid diagrams are rendered in your chats
      </Text>

      <Form
        form={form}
        layout="vertical"
        initialValues={settings}
        onValuesChange={handleValuesChange}
      >
      {/* Theme Selection */}
      <Card
        title="Theme"
        style={{ marginBottom: '16px' }}
        styles={{
          header: { backgroundColor: token.colorBgElevated }
        }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="theme"
              label={
                <Space>
                  Mermaid Theme
                  <Tooltip title="Choose a built-in Mermaid theme. 'Default' and 'Neutral' auto-switch between light/dark based on app theme.">
                    <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                  </Tooltip>
                </Space>
              }
            >
              <Select>
                <Select.Option value="default">Default (Auto Light/Dark)</Select.Option>
                <Select.Option value="neutral">Neutral (Auto Light/Dark)</Select.Option>
                <Select.Option value="dark">Dark</Select.Option>
                <Select.Option value="forest">Forest (Green Tones)</Select.Option>
                <Select.Option value="base">Base (Minimal)</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Text type="secondary" style={{ display: 'block', marginTop: '8px' }}>
          <strong>Theme Descriptions:</strong>
          <br />
          • <strong>Default</strong>: Classic Mermaid look, auto-adapts to light/dark
          <br />
          • <strong>Neutral</strong>: Gray tones, auto-adapts to light/dark
          <br />
          • <strong>Dark</strong>: Always dark theme
          <br />
          • <strong>Forest</strong>: Green color scheme, good for technical diagrams
          <br />
          • <strong>Base</strong>: Minimal styling, for custom theming
        </Text>
      </Card>

      {/* Global Settings */}
      <Card
        title="Global Settings"
        style={{ marginBottom: '16px' }}
        styles={{
          header: { backgroundColor: token.colorBgElevated }
        }}
      >
        <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="fontSize"
                label={
                  <Space>
                    Font Size
                    <Tooltip title="Base font size for all diagram text (in pixels)">
                      <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                    </Tooltip>
                  </Space>
                }
              >
                <InputNumber
                  min={10}
                  max={32}
                  step={1}
                  style={{ width: '100%' }}
                  addonAfter="px"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="defaultScale"
                label={
                  <Space>
                    Default Zoom
                    <Tooltip title="Initial zoom level for diagrams (1.0 = 100%)">
                      <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                    </Tooltip>
                  </Space>
                }
              >
                <InputNumber
                  min={0.1}
                  max={3}
                  step={0.1}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="useMaxWidth"
            label={
              <Space>
                Responsive Width
                <Tooltip title="Enable to make diagrams adapt to container width. Disable for fixed-width diagrams.">
                  <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                </Tooltip>
              </Space>
            }
            valuePropName="checked"
          >
            <Switch checkedChildren="Auto" unCheckedChildren="Fixed" />
          </Form.Item>
        </Card>

        {/* Flowchart Settings */}
        <Card
          title="Flowchart Settings"
          style={{ marginBottom: '16px' }}
          styles={{
            header: { backgroundColor: token.colorBgElevated }
          }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="flowchartNodeSpacing"
                label={
                  <Space>
                    Node Spacing
                    <Tooltip title="Horizontal spacing between nodes">
                      <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                    </Tooltip>
                  </Space>
                }
              >
                <InputNumber min={20} max={200} step={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                name="flowchartRankSpacing"
                label={
                  <Space>
                    Rank Spacing
                    <Tooltip title="Vertical spacing between layers">
                      <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                    </Tooltip>
                  </Space>
                }
              >
                <InputNumber min={20} max={200} step={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                name="flowchartCurve"
                label={
                  <Space>
                    Curve Type
                    <Tooltip title="Type of curve for connections">
                      <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                    </Tooltip>
                  </Space>
                }
              >
                <Select>
                  <Select.Option value="basis">Smooth (Basis)</Select.Option>
                  <Select.Option value="linear">Linear</Select.Option>
                  <Select.Option value="cardinal">Cardinal</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Sequence Diagram Settings */}
        <Card
          title="Sequence Diagram Settings"
          style={{ marginBottom: '16px' }}
          styles={{
            header: { backgroundColor: token.colorBgElevated }
          }}
        >
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                name="sequenceActorMargin"
                label={
                  <Space>
                    Actor Margin
                    <Tooltip title="Spacing between actors">
                      <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                    </Tooltip>
                  </Space>
                }
              >
                <InputNumber min={20} max={200} step={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item
                name="sequenceMessageMargin"
                label={
                  <Space>
                    Message Margin
                    <Tooltip title="Spacing between messages">
                      <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                    </Tooltip>
                  </Space>
                }
              >
                <InputNumber min={10} max={100} step={5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item
                name="sequenceWidth"
                label={
                  <Space>
                    Actor Width
                    <Tooltip title="Width of each actor box">
                      <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                    </Tooltip>
                  </Space>
                }
              >
                <InputNumber min={100} max={300} step={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item
                name="sequenceHeight"
                label={
                  <Space>
                    Actor Height
                    <Tooltip title="Height of each actor box">
                      <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                    </Tooltip>
                  </Space>
                }
              >
                <InputNumber min={40} max={150} step={5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Gantt Chart Settings */}
        <Card
          title="Gantt Chart Settings"
          style={{ marginBottom: '16px' }}
          styles={{
            header: { backgroundColor: token.colorBgElevated }
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="ganttBarHeight"
                label={
                  <Space>
                    Bar Height
                    <Tooltip title="Height of each task bar">
                      <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                    </Tooltip>
                  </Space>
                }
              >
                <InputNumber min={10} max={50} step={5} style={{ width: '100%' }} addonAfter="px" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="ganttTopPadding"
                label={
                  <Space>
                    Top Padding
                    <Tooltip title="Space at the top of the chart">
                      <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
                    </Tooltip>
                  </Space>
                }
              >
                <InputNumber min={20} max={100} step={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Actions */}
        <Space>
          <Button
            icon={<RestOutlined />}
            onClick={handleReset}
          >
            Reset to Defaults
          </Button>
        </Space>

        <Divider />

        {/* Preview */}
        <Card
          title="Preview"
          styles={{
            header: { backgroundColor: token.colorBgElevated }
          }}
        >
          <Text type="secondary">
            Changes are applied immediately. Try creating or viewing a diagram to see your settings in action.
          </Text>
        </Card>
      </Form>
    </div>
  );
};

export default MermaidSettingsTab;
