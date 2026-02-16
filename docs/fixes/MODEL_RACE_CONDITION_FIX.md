# Fix for Model Configuration Race Condition

## Problem

On application startup, the first message sent would use the hardcoded default model `gpt-4o-mini` instead of the configured provider model (e.g., `glm-5`). Subsequent messages would use the correct model.

## Root Cause Analysis

### 1. Agent Server Initialization
The agent server is initialized with a hardcoded default model in `crates/web_service/src/server.rs:234`:

```rust
async fn build_agent_state(app_data_dir: PathBuf, port: u16) -> AgentAppState {
    let base_url = format!("http://127.0.0.1:{}/v1", port);
    AgentAppState::new_with_config(
        "openai",
        base_url,
        "gpt-4o-mini".to_string(),  // ← HARDCODED DEFAULT
        "tauri".to_string(),
        Some(app_data_dir),
        true,
    )
    .await
}
```

### 2. Execute Handler Fallback
When the agent executes, it uses the model from the session or falls back to the state default:

```rust
// crates/agent-server/src/handlers/execute.rs:149-152
let model_name = session
    .model
    .clone()
    .unwrap_or_else(|| state_clone.model_name.clone());
```

### 3. Frontend Race Condition
The frontend sends `model: activeModel || undefined` to the backend. On first message:
- `providerConfig` hasn't loaded from backend yet
- `useActiveModel()` returns `undefined`
- Backend receives `model: None`
- Backend uses fallback `gpt-4o-mini`

On second message:
- `providerConfig` has loaded
- `useActiveModel()` returns `"glm-5"`
- Backend receives correct model

## Solution

### 1. Prevent Sending Without Model (Primary Fix)
Updated `useMessageStreaming.ts` to check if `activeModel` is loaded before allowing message sending:

```typescript
// src/pages/ChatPage/hooks/useChatManager/useMessageStreaming.ts
if (!activeModel) {
  appMessage.error("Model configuration not loaded. Please wait or reload the page.");
  return;
}
```

### 2. Visual Feedback (UX Improvement)
Updated `InputContainer/index.tsx` to:
- Show "Loading Model..." status when model is not loaded
- Disable the message input field until model is loaded

```typescript
// Import useActiveModel hook
import { useActiveModel } from "../../hooks/useActiveModel";

// Get active model
const activeModel = useActiveModel();

// Update status indicator
const agentStatusConfig = useMemo(() => {
  if (!activeModel) {
    return { color: "warning", icon: <RobotOutlined />, text: "Loading Model..." };
  }
  // ... rest of logic
}, [activeModel, agentAvailable]);

// Disable input when model not loaded
<MessageInput
  disabled={!activeModel}
  // ... other props
/>
```

## Files Modified

1. **src/pages/ChatPage/hooks/useChatManager/useMessageStreaming.ts**
   - Added validation to prevent sending messages when `activeModel` is undefined

2. **src/pages/ChatPage/components/InputContainer/index.tsx**
   - Imported `useActiveModel` hook
   - Updated status indicator to show "Loading Model..." state
   - Added `disabled` prop to `MessageInput` component

## Testing

1. Clear localStorage and restart the application
2. Observe "Loading Model..." status in the UI
3. Input field is disabled until model loads
4. Once model loads, status changes to "Agent Mode"
5. Send message - verify correct model is used in backend logs
6. No more `gpt-4o-mini` fallback on first message

## Future Improvements

1. **Backend Enhancement**: Consider loading the default model from config instead of hardcoding
2. **Loading State**: Add a loading spinner or skeleton UI while provider config is loading
3. **Error Boundary**: Add better error handling if provider config fails to load
