# 重构更新日志

## 2026-02-16 - Anthropic Model Mapping 动态 Provider 支持

### 🎯 问题
`ModelMappingCard` 组件硬编码使用 Copilot provider 的模型列表，当用户切换到其他 provider（OpenAI/Anthropic/Gemini）时无法正常工作。

### ✅ 解决方案
重构 `ModelMappingCard` 组件，使其自主管理模型获取逻辑：
- 自动读取当前配置的 provider
- 根据 provider 类型调用对应的 API
- 显示该 provider 的可用模型列表

### 📝 修改文件
1. `src/pages/SettingsPage/components/SystemSettingsPage/ModelMappingCard.tsx`
   - 移除 `models` 和 `isLoadingModels` props
   - 添加内部状态管理
   - 实现 provider 配置自动获取
   - 实现动态模型列表获取

2. `src/pages/SettingsPage/components/SystemSettingsPage/SystemSettingsConfigTab.tsx`
   - 简化组件接口
   - 移除不必要的 props 传递

3. `src/pages/SettingsPage/components/SystemSettingsPage/index.tsx`
   - 清理未使用的 `useModels` hook

### 📚 新增文档
- `docs/refactoring/ANTHROPIC_MODEL_MAPPING_PROVIDER_SUPPORT.md` - 详细重构文档
- `docs/implementation/ANTHROPIC_MODEL_MAPPING_DYNAMIC_PROVIDER.md` - 技术实现细节

### 🔄 更新文档
- `docs/plans/2026-02-12-config-ui-redesign.md` - 更新 ModelMappingCard 说明
- `docs/plans/2026-02-12-config-cleanup-implementation.md` - 添加重构状态

### ✨ 影响
- **前端**: 3 个组件文件
- **后端**: 无变化
- **API**: 无变化
- **配置文件**: 无变化
- **破坏性变更**: 无

### 🧪 测试状态
- [ ] OpenAI provider 模型获取
- [ ] Anthropic provider 模型获取
- [ ] Gemini provider 模型获取
- [ ] Copilot provider 模型获取
- [ ] 模型映射保存/加载

### 📊 代码统计
```
Files changed: 3
Lines added: +75
Lines removed: -36
Net change: +39 lines
```

---

## 历史记录

### 2026-02-15 - Provider 动态模型选择
- 扩展 `LLMProvider` trait 支持 `model` 参数
- 实现 Gemini model mapping 服务
- 更新所有 provider 实现

### 2026-02-12 - 配置 UI 重构
- 分离 Network Settings
- 重构 Provider Settings
- 改进配置组件结构
