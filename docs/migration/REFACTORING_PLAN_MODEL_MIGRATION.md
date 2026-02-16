# Model Configuration Refactoring Plan

## Overview
将全局模型配置（System Settings）迁移到 Provider 级别，实现每个 Provider 有独立的模型配置，消除当前的双重配置系统。

## Current Architecture Issues

### 1. Dual Configuration System
- **Global Model**: System Settings → `config.json.model` + localStorage
- **Provider Model**: Provider Settings → `config.json.providers.{provider}.model`
- **Problem**: 两套系统并存，前端使用全局，后端使用 provider-specific，造成混乱

### 2. Conflict Locations
- Frontend reads global `selectedModel` from Zustand/localStorage
- Backend provider factory reads `providers.{provider}.model`
- Different models may be used at different layers

### 3. User Confusion
- System Settings shows Copilot models regardless of current provider
- Provider Settings has per-provider model, but not used by frontend
- Switching providers doesn't update the model selection

---

## Target Architecture

### Single Source of Truth
```
config.json
├── provider: "openai"                    # Active provider
└── providers:
    ├── openai:
    │   ├── api_key: "sk-..."
    │   ├── base_url: "https://..."
    │   └── model: "gpt-4o"              # ✅ OpenAI's default model
    ├── anthropic:
    │   ├── api_key: "sk-ant-..."
    │   ├── base_url: "https://..."
    │   └── model: "claude-3-5-sonnet"   # ✅ Anthropic's default model
    ├── gemini:
    │   ├── api_key: "AIza..."
    │   ├── base_url: "https://..."
    │   └── model: "gemini-pro"          # ✅ Gemini's default model
    └── copilot:
        └── enabled: true                 # ✅ Copilot doesn't need model selection
```

### Frontend State Management
```typescript
// Zustand Store
{
  // ❌ Remove: selectedModel (no longer global)
  // ❌ Remove: configModel (no longer needed)

  // ✅ Add: Active provider tracking
  currentProvider: "openai",

  // ✅ Add: Get model from provider config
  getActiveModel: () => {
    const config = providerConfig[currentProvider];
    return config?.model;
  }
}
```

---

## Migration Steps

### Phase 1: Backend Preparation ✅
**Goal**: Ensure backend fully supports provider-specific models

#### 1.1 Verify Provider Factory
- [ ] File: `crates/agent-llm/src/provider_factory.rs`
- [ ] Status: ✅ Already reads `providers.{provider}.model`
- [ ] Action: No changes needed

#### 1.2 Add Model Validation
- [ ] File: `crates/web_service/src/controllers/settings_controller.rs`
- [ ] Action: Add validation to ensure model field exists for non-Copilot providers
- [ ] Endpoint: `update_provider_config()`
- [ ] Logic: Reject if `provider != "copilot"` and `model` is empty

---

### Phase 2: Frontend Data Layer 📝
**Goal**: Prepare frontend to read from provider config

#### 2.1 Update Type Definitions
- [ ] File: `src/pages/ChatPage/types/providerConfig.ts`
- [ ] Action: Ensure model is required for OpenAI/Anthropic/Gemini
```typescript
export interface OpenAIProviderConfig {
  api_key: string;
  base_url?: string;
  model: string;  // ✅ Make required
}

export interface AnthropicProviderConfig {
  api_key: string;
  base_url?: string;
  model: string;  // ✅ Make required
  max_tokens?: number;
}
```

#### 2.2 Add Provider Config to Zustand Store
- [ ] File: `src/pages/ChatPage/store/slices/providerSlice.ts` (NEW FILE)
- [ ] Action: Create new slice to manage provider config
```typescript
interface ProviderState {
  currentProvider: ProviderType;
  providerConfig: ProviderConfig;
  loadProviderConfig: () => Promise<void>;
  getActiveModel: () => string | undefined;
}
```

#### 2.3 Create Model Selector Hook
- [ ] File: `src/pages/ChatPage/hooks/useActiveModel.ts` (NEW FILE)
- [ ] Action: Centralized logic to get active model
```typescript
export function useActiveModel() {
  const { currentProvider, providerConfig } = useProviderStore();

  const activeModel = useMemo(() => {
    const config = providerConfig.providers[currentProvider];
    return config?.model;
  }, [currentProvider, providerConfig]);

  return activeModel;
}
```

---

### Phase 3: Migrate Components 🔄
**Goal**: Replace all global model references with provider model

#### 3.1 Chat Operations
- [ ] File: `src/pages/ChatPage/hooks/useChatManager/useMessageStreaming.ts`
- [ ] Line: 45, 92
- [ ] Action: Replace `selectedModel` with `useActiveModel()`
```typescript
// Before:
const selectedModel = useAppStore((state) => state.selectedModel);

// After:
const activeModel = useActiveModel();
```

#### 3.2 Title Generation
- [ ] File: `src/pages/ChatPage/hooks/useChatManager/useChatTitleGeneration.ts`
- [ ] Line: 35, 105
- [ ] Action: Replace `selectedModel` with `useActiveModel()`

#### 3.3 Mermaid Fix
- [ ] File: `src/pages/ChatPage/components/MessageCard/useMessageCardMermaidFix.ts`
- [ ] Line: N/A (already uses passed model parameter)
- [ ] Action: Update caller to pass active model

#### 3.4 MessageCard Component
- [ ] File: `src/pages/ChatPage/components/MessageCard/index.tsx`
- [ ] Line: 128-133
- [ ] Action: Replace `selectedModel` prop with `useActiveModel()`

---

### Phase 4: Settings UI Refactor 🎨
**Goal**: Remove System Settings model selection, enhance Provider Settings

#### 4.1 Remove System Settings Model Selection
- [ ] File: `src/pages/SettingsPage/components/SystemSettingsPage/SystemSettingsModelSelection.tsx`
- [ ] Action: **DELETE ENTIRE FILE** ❌

#### 4.2 Update System Settings Page
- [ ] File: `src/pages/SettingsPage/components/SystemSettingsPage/index.tsx`
- [ ] Action: Remove `<SystemSettingsModelSelection />` component
- [ ] Add: Note directing users to Provider Settings

#### 4.3 Enhance Provider Settings
- [ ] File: `src/pages/SettingsPage/components/ProviderSettings/index.tsx`
- [ ] Action: Ensure all providers have model selection UI
- [ ] Already done: ✅ OpenAI, Anthropic, Gemini have model fields
- [ ] Add: Validation to require model before save

#### 4.4 Add Model to Provider Config Form
- [ ] File: `src/pages/SettingsPage/components/ProviderSettings/index.tsx`
- [ ] Action: Add validation rule
```typescript
<Form.Item
  name={['providers', 'openai', 'model']}
  label="Default Model"
  rules={[{ required: true, message: 'Please select a model' }]}  // ✅ Add
>
```

---

### Phase 5: Remove Legacy Code 🧹
**Goal**: Clean up old global model system

#### 5.1 Remove Global Model Slice
- [ ] File: `src/pages/ChatPage/store/slices/modelSlice.ts`
- [ ] Action: **DELETE ENTIRE FILE** ❌
- [ ] Or: Keep only for model list fetching, remove selectedModel/configModel

#### 5.2 Remove LocalStorage Keys
- [ ] Location: Multiple files
- [ ] Key: `"bamboo_selected_model_id"`
- [ ] Action: Remove all reads/writes to this key

#### 5.3 Remove Config Model Loading
- [ ] File: `src/services/config/ConfigService.ts`
- [ ] Action: Remove `getModel()` and `setModel()` methods
- [ ] These methods read/write root-level `model` field

#### 5.4 Update useModels Hook
- [ ] File: `src/pages/SettingsPage/hooks/useModels.ts`
- [ ] Action: Remove references to `selectedModel` and `setSelectedModel`
- [ ] Keep: Model fetching logic (for Provider Settings dropdowns)

---

### Phase 6: Config Migration 🔧
**Goal**: Migrate existing user configs

#### 6.1 Backend Migration Script
- [ ] File: `crates/web_service/src/controllers/settings_controller.rs`
- [ ] Function: Add migration in `get_provider_config()`
- [ ] Logic:
```rust
// If config has root-level "model" field, migrate to provider
if let Some(old_model) = config.get("model").and_then(|m| m.as_str()) {
    let provider = config.get("provider").and_then(|p| p.as_str()).unwrap_or("copilot");

    if provider != "copilot" {
        if let Some(providers) = config.get_mut("providers") {
            if let Some(provider_config) = providers.get_mut(provider) {
                if provider_config.get("model").is_none() {
                    provider_config["model"] = Value::String(old_model.to_string());
                    // Remove root-level model
                    config.remove("model");
                }
            }
        }
    }
}
```

#### 6.2 Frontend Migration
- [ ] File: `src/pages/ChatPage/store/slices/providerSlice.ts`
- [ ] Action: One-time migration from localStorage to backend
```typescript
const legacyModel = localStorage.getItem("bamboo_selected_model_id");
if (legacyModel) {
  // Update current provider's model
  await updateProviderModel(currentProvider, legacyModel);
  localStorage.removeItem("bamboo_selected_model_id");
}
```

---

### Phase 7: Testing 🧪
**Goal**: Ensure all scenarios work

#### 7.1 Test Scenarios
- [ ] **Fresh Install**: No config, should prompt to configure provider
- [ ] **Legacy Config**: Has root-level model, should migrate to provider
- [ ] **New Config**: Has provider-specific model, should work directly
- [ ] **Provider Switch**: Changing provider should use that provider's model
- [ ] **Chat Operations**: All chat features use correct model
- [ ] **Title Generation**: Uses current provider's model
- [ ] **Mermaid Fix**: Uses current provider's model
- [ ] **Settings Save**: Model persists per-provider

#### 7.2 Test Providers
- [ ] OpenAI with custom base URL
- [ ] Anthropic
- [ ] Gemini
- [ ] Copilot (no model selection needed)

---

## Migration Order

### Step 1: Non-Breaking Preparation (Safe)
1. Create `useActiveModel` hook
2. Add provider config to Zustand
3. Enhance Provider Settings UI validation

### Step 2: Parallel Operation (Transition)
1. Update chat hooks to use `useActiveModel`
2. Keep old `selectedModel` working temporarily
3. Add config migration logic

### Step 3: Cleanup (Remove Old)
1. Remove System Settings model selection UI
2. Remove `modelSlice.ts`
3. Remove localStorage keys
4. Remove ConfigService model methods

---

## Rollback Plan

If issues arise:
1. **Frontend**: Revert to using `selectedModel` from localStorage
2. **Backend**: Keep root-level `model` field as fallback
3. **Config**: Add backward compatibility to read both locations

---

## Files to Modify

### Create New Files
- `src/pages/ChatPage/store/slices/providerSlice.ts`
- `src/pages/ChatPage/hooks/useActiveModel.ts`

### Modify Files
- `src/pages/ChatPage/hooks/useChatManager/useMessageStreaming.ts`
- `src/pages/ChatPage/hooks/useChatManager/useChatTitleGeneration.ts`
- `src/pages/ChatPage/components/MessageCard/index.tsx`
- `src/pages/SettingsPage/components/ProviderSettings/index.tsx`
- `src/pages/SettingsPage/components/SystemSettingsPage/index.tsx`
- `src/pages/ChatPage/types/providerConfig.ts`
- `crates/web_service/src/controllers/settings_controller.rs`

### Delete Files
- `src/pages/SettingsPage/components/SystemSettingsPage/SystemSettingsModelSelection.tsx`
- `src/pages/ChatPage/store/slices/modelSlice.ts` (or partially remove)

---

## Estimated Effort

- **Phase 1-2**: 2-3 hours (Backend + Data layer)
- **Phase 3**: 2-3 hours (Migrate components)
- **Phase 4**: 1-2 hours (UI refactor)
- **Phase 5**: 1 hour (Cleanup)
- **Phase 6**: 1-2 hours (Migration logic)
- **Phase 7**: 2-3 hours (Testing)

**Total**: ~10-14 hours

---

## Success Criteria

✅ Single source of truth: `config.json.providers.{provider}.model`
✅ No global model configuration
✅ All chat operations use provider-specific model
✅ Settings UI clear and intuitive
✅ Smooth migration for existing users
✅ No regression in chat functionality
