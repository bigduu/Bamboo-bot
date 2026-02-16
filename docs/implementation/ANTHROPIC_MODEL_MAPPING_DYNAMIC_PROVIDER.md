# Anthropic Model Mapping 动态 Provider 支持

## 修改日期
2026-02-16

## 问题描述

### 原有问题
`ModelMappingCard` 组件硬编码使用 Copilot provider 的模型列表，当用户切换到其他 provider（OpenAI、Anthropic、Gemini）时，模型映射功能无法正常工作。

### 原因分析
1. `ModelMappingCard` 接收 `models` props，来自全局 Zustand store
2. 全局 store 中的 models 通过 `modelService.getModels()` 获取
3. `modelService.getModels()` 调用 `/models` 端点，只返回**当前激活 provider** 的模型
4. 如果用户配置了 OpenAI provider，但想在 Config 标签页配置 Anthropic 模型映射，会看不到 OpenAI 的模型列表

## 解决方案

### 架构变更
`ModelMappingCard` 现在自主管理模型获取，根据当前配置的 provider 动态获取模型列表：

```typescript
// 1. 获取当前 provider 配置
const config = await settingsService.getProviderConfig();
setCurrentProvider(config.provider);

// 2. 根据 provider 类型获取模型
if (currentProvider === "copilot") {
  // Copilot: 使用 /models 端点（通过 modelService）
  const models = await modelService.getModels();
} else {
  // 其他 provider: 使用 /bamboo/settings/provider/models
  const models = await settingsService.fetchProviderModels(currentProvider);
}
```

### 修改文件

#### 1. `ModelMappingCard.tsx`
**变更：**
- ❌ 移除 `models` 和 `isLoadingModels` props
- ✅ 添加内部状态管理：`availableModels`, `isLoadingModels`, `currentProvider`
- ✅ 自主获取当前 provider 配置
- ✅ 根据 provider 动态获取模型列表
- ✅ 显示当前 provider 和可用模型数量
- ✅ 添加用户反馈（success/error 消息）

**新功能：**
```tsx
<Text type="secondary">
  Configure which {currentProvider} models to use when Claude CLI requests specific models.
</Text>
<Text type="secondary">
  Current Provider: <Text strong>{currentProvider}</Text>
</Text>
<Text type="secondary">
  Available Models: <Text strong>{availableModels.length}</Text>
</Text>
```

#### 2. `SystemSettingsConfigTab.tsx`
**变更：**
- ❌ 移除 `models`, `modelsError`, `isLoadingModels` props
- ❌ 移除传递 props 给 `ModelMappingCard`
- ✅ 简化组件接口

#### 3. `SystemSettingsPage/index.tsx`
**变更：**
- ❌ 移除 `useModels` hook 导入和使用
- ❌ 移除 `models`, `isLoadingModels`, `modelsError` 变量
- ✅ 简化代码逻辑

## API 端点说明

### Copilot Provider
```
GET /models
→ 调用 provider.list_models()
→ Copilot Provider: https://api.githubcopilot.com/models
```

### 其他 Provider
```
POST /bamboo/settings/provider/models
{
  "provider": "openai" | "anthropic" | "gemini"
}
→ 调用 fetch_models_from_api()
→ OpenAI: https://api.openai.com/v1/models
→ Anthropic: https://api.anthropic.com/v1/models
→ Gemini: https://generativelanguage.googleapis.com/v1beta/models
```

## 用户体验改进

### Before
```
1. 用户切换到 OpenAI provider
2. 打开 System Settings → Config 标签页
3. 查看 Anthropic Model Mapping
4. 下拉框显示：Copilot 的模型（不正确）
5. 映射无法正常工作
```

### After
```
1. 用户切换到 OpenAI provider
2. 打开 System Settings → Config 标签页
3. 查看 Anthropic Model Mapping
4. 显示：
   - Current Provider: openai
   - Available Models: 50
   - 下拉框显示：OpenAI 的模型列表
5. 可以正确配置映射
```

## 测试场景

### 场景 1: Copilot Provider
```bash
# 配置
Provider: copilot

# 预期
ModelMappingCard 显示 Copilot 模型：
- gpt-4o
- gpt-4o-mini
- claude-3-5-sonnet-20241022
- ...
```

### 场景 2: OpenAI Provider
```bash
# 配置
Provider: openai
API Key: sk-...

# 预期
ModelMappingCard 显示 OpenAI 模型：
- gpt-4
- gpt-4-turbo
- gpt-3.5-turbo
- ...
```

### 场景 3: Anthropic Provider
```bash
# 配置
Provider: anthropic
API Key: sk-ant-...

# 预期
ModelMappingCard 显示 Anthropic 模型：
- claude-3-5-sonnet-20241022
- claude-3-5-haiku-20241022
- ...
```

### 场景 4: Gemini Provider
```bash
# 配置
Provider: gemini
API Key: AIza...

# 预期
ModelMappingCard 显示 Gemini 模型：
- gemini-pro
- gemini-1.5-flash
- gemini-1.5-pro
- ...
```

## 兼容性

### 向后兼容
✅ 完全兼容现有配置文件（`~/.bamboo/anthropic-model-mapping.json`）
✅ 不影响现有映射逻辑
✅ 不影响 provider 切换功能

### 破坏性变更
❌ 无破坏性变更

## 未来改进

### 可选优化
1. **缓存模型列表** - 避免每次打开 Settings 都重新获取
2. **自动刷新** - Provider 配置变更后自动刷新模型列表
3. **模型验证** - 验证映射的模型是否真实存在于当前 provider
4. **批量配置** - 一次性配置所有 provider 的映射

### 潜在问题
1. **API 限流** - 频繁调用各 provider API 可能触发限流
   - 解决方案：添加本地缓存（5分钟有效期）
2. **网络错误** - 网络不稳定时无法获取模型列表
   - 解决方案：显示友好错误提示，允许手动输入模型名称

## 总结

这次修改让 `ModelMappingCard` 从硬编码的 Copilot 专用组件，变成了支持任意 provider 的通用组件。现在无论用户使用哪个 provider，都能正确配置 Anthropic 模型映射。

**关键收益：**
- ✅ 支持所有 provider
- ✅ 动态获取模型列表
- ✅ 更好的用户反馈
- ✅ 更清晰的状态显示
- ✅ 零破坏性变更
