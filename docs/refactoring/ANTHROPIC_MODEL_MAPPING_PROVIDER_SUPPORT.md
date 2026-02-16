# Anthropic Model Mapping 动态 Provider 支持 - 重构总结

## 📅 重构日期
2026-02-16

## 🎯 问题描述

### 原有缺陷
`ModelMappingCard` 组件硬编码使用 Copilot provider 的模型列表，当用户切换到其他 provider（OpenAI、Anthropic、Gemini）时：
- ❌ 下拉框显示的是 Copilot 的模型，而不是当前 provider 的模型
- ❌ 无法正确配置 OpenAI/Anthropic/Gemini 的模型映射
- ❌ 用户体验混乱，配置无效

### 根本原因
```
ModelMappingCard
  ↓ (接收 props)
SystemSettingsConfigTab
  ↓ (接收 props)
SystemSettingsPage
  ↓ (useModels hook)
modelService.getModels()
  ↓
GET /models
  ↓
只返回当前激活 provider 的模型（通常是 Copilot）
```

**问题**：Config 标签页显示的应该是**配置中 provider** 的模型，而不是**当前激活 provider** 的模型。

## ✅ 解决方案

### 核心思路
让 `ModelMappingCard` 自主管理模型获取逻辑：
1. 自动读取当前配置的 provider
2. 根据 provider 类型调用对应的 API
3. 显示该 provider 的可用模型列表

### 架构变更

#### Before - 层层传递
```typescript
// SystemSettingsPage/index.tsx
const { models } = useModels(); // 从全局 store 获取

<SystemSettingsConfigTab
  models={models}  // 传递给子组件
/>

// SystemSettingsConfigTab.tsx
<SystemSettingsConfigTabProps {
  models: string[];
}>

<ModelMappingCard
  models={models}  // 再次传递
/>
```

#### After - 自主管理
```typescript
// ModelMappingCard.tsx
export const ModelMappingCard: React.FC = () => {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string>("copilot");

  // 自己获取 provider 配置
  const config = await settingsService.getProviderConfig();

  // 自己获取模型列表
  if (currentProvider === "copilot") {
    const models = await modelService.getModels();
  } else {
    const models = await settingsService.fetchProviderModels(currentProvider);
  }
}
```

## 📝 修改清单

### 1. ModelMappingCard.tsx
**变更类型**: 重大重构

**移除**:
- ❌ `ModelMappingCardProps` interface
- ❌ `models: string[]` prop
- ❌ `isLoadingModels: boolean` prop
- ❌ 依赖父组件传递数据

**新增**:
- ✅ `availableModels` 内部状态
- ✅ `isLoadingModels` 内部状态
- ✅ `currentProvider` 内部状态
- ✅ `msgApi` 用于用户反馈
- ✅ 自动获取 provider 配置的逻辑
- ✅ 根据 provider 类型动态获取模型
- ✅ 显示当前 provider 信息
- ✅ 显示可用模型数量

**代码片段**:
```typescript
// 根据不同 provider 获取模型
if (currentProvider === "copilot") {
  // Copilot: 使用现有的 modelService
  const { modelService } = await import("../../../../services/chat/ModelService");
  const models = await modelService.getModels();
  setAvailableModels(models);
} else {
  // 其他 provider: 使用 settingsService.fetchProviderModels
  const models = await settingsService.fetchProviderModels(currentProvider);
  setAvailableModels(models);
}
```

### 2. SystemSettingsConfigTab.tsx
**变更类型**: 简化接口

**移除**:
- ❌ `models: string[]` prop
- ❌ `modelsError: string | null` prop
- ❌ `isLoadingModels: boolean` prop
- ❌ 传递 props 给 `ModelMappingCard`

**结果**: 组件更简洁，职责更清晰

### 3. SystemSettingsPage/index.tsx
**变更类型**: 清理未使用代码

**移除**:
- ❌ `useModels` hook 导入
- ❌ `const { models, isLoading, error } = useModels()`
- ❌ 向 `SystemSettingsConfigTab` 传递 props

**结果**: 减少不必要的全局状态依赖

## 🔄 API 调用逻辑

### Copilot Provider
```bash
ModelMappingCard
  → modelService.getModels()
  → GET /models
  → provider.list_models()
  → https://api.githubcopilot.com/models
  → 返回 Copilot 可用模型
```

### 其他 Provider (OpenAI/Anthropic/Gemini)
```bash
ModelMappingCard
  → settingsService.fetchProviderModels("openai")
  → POST /bamboo/settings/provider/models
  → fetch_models_from_api(provider, api_key, base_url)
  → OpenAI: https://api.openai.com/v1/models
  → Anthropic: https://api.anthropic.com/v1/models
  → Gemini: https://generativelanguage.googleapis.com/v1beta/models
  → 返回对应 provider 的可用模型
```

## 📊 使用场景对比

### 场景 1: OpenAI Provider
```
用户配置:
  Provider: openai
  API Key: sk-proj-...

Before (❌ 错误):
  Anthropic Model Mapping
  - Opus: [下拉框显示 Copilot 模型]
  - Sonnet: [下拉框显示 Copilot 模型]
  - Haiku: [下拉框显示 Copilot 模型]

After (✅ 正确):
  Anthropic Model Mapping
  - Current Provider: openai
  - Available Models: 50
  - Opus: [下拉框显示 gpt-4, gpt-4-turbo, gpt-3.5-turbo...]
  - Sonnet: [下拉框显示 gpt-4, gpt-4-turbo, gpt-3.5-turbo...]
  - Haiku: [下拉框显示 gpt-4, gpt-4-turbo, gpt-3.5-turbo...]
```

### 场景 2: Gemini Provider
```
用户配置:
  Provider: gemini
  API Key: AIza...

Before (❌ 错误):
  Anthropic Model Mapping
  - 下拉框显示: [gpt-4o, gpt-4o-mini...] (Copilot 模型)

After (✅ 正确):
  Anthropic Model Mapping
  - Current Provider: gemini
  - Available Models: 12
  - 下拉框显示: [gemini-pro, gemini-1.5-flash, gemini-1.5-pro...]
```

### 场景 3: Copilot Provider
```
用户配置:
  Provider: copilot

Before (✅ 正常):
  Anthropic Model Mapping
  - 下拉框显示: [gpt-4o, gpt-4o-mini, claude-3-5-sonnet-20241022...]

After (✅ 正常):
  Anthropic Model Mapping
  - Current Provider: copilot
  - Available Models: 8
  - 下拉框显示: [gpt-4o, gpt-4o-mini, claude-3-5-sonnet-20241022...]
```

## ✨ 用户体验改进

### 1. 信息透明度
```tsx
<Text type="secondary">
  Configure which {currentProvider} models to use when Claude CLI requests specific models.
</Text>

<Space direction="vertical">
  <Text>Current Provider: <Text strong>{currentProvider}</Text></Text>
  <Text>Available Models: <Text strong>{availableModels.length}</Text></Text>
  <Text>Stored in: <Text code>~/.bamboo/anthropic-model-mapping.json</Text></Text>
</Space>
```

### 2. 即时反馈
```typescript
// 保存成功
msgApi.success("Model mapping saved");

// 加载失败
msgApi.error("Failed to load models. Please check your provider configuration.");
```

### 3. 状态指示
```tsx
<Select
  loading={isLoadingModels}
  disabled={isLoadingModels || availableModels.length === 0}
  placeholder={isLoadingModels ? "Loading models..." : "Select model"}
/>
```

## 🔒 兼容性保证

### 向后兼容
- ✅ 现有配置文件 `~/.bamboo/anthropic-model-mapping.json` 格式不变
- ✅ 现有映射逻辑完全不受影响
- ✅ Provider 切换功能正常工作
- ✅ 所有现有功能保持不变

### 破坏性变更
- ❌ **无**破坏性变更

### API 接口
- ✅ 无新增 API
- ✅ 无修改 API
- ✅ 无删除 API
- ✅ 只是在前端调用现有 API 的方式发生变化

## 📦 文件变更统计

```
修改文件: 3
新增文档: 1

src/pages/SettingsPage/components/SystemSettingsPage/
  ├── ModelMappingCard.tsx           (+75 lines, -20 lines)
  ├── SystemSettingsConfigTab.tsx    (-7 lines)
  └── index.tsx                      (-9 lines)

docs/implementation/
  └── ANTHROPIC_MODEL_MAPPING_DYNAMIC_PROVIDER.md  (新增)
```

## 🧪 测试建议

### 手动测试
```bash
1. 切换到 OpenAI provider
   - 配置 API Key
   - 打开 Settings → Config
   - 检查 ModelMappingCard 显示 OpenAI 模型

2. 切换到 Anthropic provider
   - 配置 API Key
   - 打开 Settings → Config
   - 检查 ModelMappingCard 显示 Anthropic 模型

3. 切换到 Gemini provider
   - 配置 API Key
   - 打开 Settings → Config
   - 检查 ModelMappingCard 显示 Gemini 模型

4. 切换回 Copilot provider
   - 完成认证
   - 打开 Settings → Config
   - 检查 ModelMappingCard 显示 Copilot 模型
```

### 自动化测试
```typescript
describe('ModelMappingCard', () => {
  it('should fetch OpenAI models when provider is openai', async () => {
    // Mock settingsService.getProviderConfig to return { provider: 'openai' }
    // Mock settingsService.fetchProviderModels to return ['gpt-4', 'gpt-3.5-turbo']
    // Render component
    // Verify availableModels === ['gpt-4', 'gpt-3.5-turbo']
  });

  it('should fetch Copilot models when provider is copilot', async () => {
    // Mock settingsService.getProviderConfig to return { provider: 'copilot' }
    // Mock modelService.getModels to return ['gpt-4o', 'claude-3-5-sonnet-20241022']
    // Render component
    // Verify availableModels === ['gpt-4o', 'claude-3-5-sonnet-20241022']
  });
});
```

## 🚀 后续优化建议

### P1 - 高优先级
1. **模型列表缓存** - 避免每次打开 Settings 都重新获取
   ```typescript
   const [modelCache, setModelCache] = useState<Record<string, string[]>>({});

   if (modelCache[currentProvider]) {
     setAvailableModels(modelCache[currentProvider]);
   } else {
     const models = await fetchModels();
     setModelCache(prev => ({ ...prev, [currentProvider]: models }));
   }
   ```

2. **自动刷新** - Provider 配置变更后自动刷新模型列表
   ```typescript
   useEffect(() => {
     fetchModels();
   }, [currentProvider]);
   ```

### P2 - 中优先级
3. **错误恢复** - 网络错误时提供重试按钮
   ```typescript
   {error && (
     <Alert
       type="error"
       message="Failed to load models"
       action={<Button onClick={fetchModels}>Retry</Button>}
     />
   )}
   ```

4. **手动输入** - 允许用户手动输入模型名称
   ```typescript
   <Select
     mode="combobox"  // 允许手动输入
     options={availableModels.map(...)}
   />
   ```

### P3 - 低优先级
5. **模型验证** - 验证映射的模型是否真实存在
6. **批量导入** - 从配置文件批量导入映射
7. **模型测试** - 测试映射是否工作正常

## 📚 相关文档

- [Provider 动态模型选择实现](./PROVIDER_DYNAMIC_MODEL_SELECTION.md)
- [Gemini Model Mapping 实现](./GEMINI_MODEL_MAPPING_IMPLEMENTATION.md)
- [配置 UI 重构计划](../plans/2026-02-12-config-ui-redesign.md)

## 🎉 总结

这次重构将 `ModelMappingCard` 从一个**硬编码的 Copilot 专用组件**，转变为一个**支持任意 provider 的通用组件**。

**核心价值**:
- ✅ 真正的多 provider 支持
- ✅ 动态获取模型列表
- ✅ 更好的用户体验
- ✅ 更清晰的代码架构
- ✅ 零破坏性变更

**影响范围**:
- 前端组件: 3 个文件
- 后端: 无变化
- API: 无变化
- 配置文件: 无变化

**风险等级**: 低
**测试状态**: 待验证
**文档状态**: 已完成

---

**重构完成时间**: 2026-02-16
**重构作者**: Claude Code
**重构状态**: ✅ 完成
