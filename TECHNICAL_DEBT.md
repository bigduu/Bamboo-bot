# Technical Debt - Architectural Concerns & Design Decisions

This document tracks architectural issues and design decisions that require team discussion before implementation.

**Last Updated:** 2026-02-17
**Total Issues:** 15 (down from 94)
**Status:** 43 warnings remaining (mostly dead code in agent-server/web_service)

---

## 🏗️ HIGH PRIORITY - Affects Public API

### 1. Duplicate Type Definitions in agent-mcp

**Location:** `crates/agent-mcp/src/types.rs` vs `crates/agent-mcp/src/protocol/models.rs`

**Issue:**
Two identical enums exist:
- `types::McpContentItem` - exposed to users of the crate
- `protocol::models::McpContentItem` - used for protocol serialization

Same issue with `McpResource` vs `McpResourceInfo`.

**Current State:**
```rust
// lib.rs:20
pub use protocol::*;  // Exports protocol::models::McpContentItem
// lib.rs:23
pub use types::*;     // Also exports types::McpContentItem
```
Causes compiler warning: "ambiguous glob re-exports"

**Impact:**
- Maintenance burden (double the code to update)
- Runtime overhead (unnecessary conversions)
- Potential for type mismatches
- API confusion for users

**Options:**

**Option A: Single Source of Truth (Recommended)**
1. Keep `types::McpContentItem` as authoritative definition
2. Make `protocol::models` use these types via re-export
3. Remove duplicate definitions
4. Update serde attributes as needed

**Option B: Explicit Re-exports**
1. Remove one glob re-export in `lib.rs`
2. Explicitly re-export only needed types from each module
3. Keep both type definitions but add `From` traits for conversion

**Option C: Separate Concerns Clearly**
1. Protocol types in `protocol::models` with serde for wire format
2. Public types in `types` as higher-level abstractions
3. Implement `From`/`Into` for automatic conversion
4. Document the distinction

**Recommendation:** Option A is cleanest. Protocol models should use canonical types.

**Effort:** 2-4 hours (design + implementation + testing)

**Decision Needed:** Which approach?

---

### 2. Private Type in Public API

**Location:** `crates/agent-llm/src/providers/copilot/auth/handler.rs:32`

**Issue:**
```rust
pub struct CopilotConfig {
    pub endpoints: Endpoints,  // Endpoints is pub(crate)!
}

pub(crate) struct Endpoints { ... }
```

**Impact:**
- Type mismatch warning
- Could be intentional design or accidental exposure
- External code cannot access endpoint configuration

**Options:**
- **Option A:** Make `Endpoints` public - intentional API design
- **Option B:** Make `endpoints` field `pub(crate)` - hide implementation detail

**Decision Needed:** Should external code access endpoint configuration?

**Effort:** 30 minutes

---

### 3. TokenUsage Missing Copy Trait ✅ FIXED

**Status:** COMPLETED in commit 84df026

---

## ⚠️ MEDIUM PRIORITY - Missing Features

### 4. Gemini Tool Calls Not Implemented

**Location:** `crates/web_service/src/controllers/gemini_controller.rs:82, 208`

**Issue:**
```rust
// TODO: Handle tool calls
```

**Impact:**
- Gemini provider incomplete
- Cannot use tool/function calling with Gemini
- Feature parity gap with other providers

**Recommendation:**
1. Review OpenAI and Anthropic tool call implementations
2. Design Gemini-specific tool call format conversion
3. Implement tool call support following same patterns
4. Add comprehensive tests

**Effort:** 1-2 days

**Decision Needed:** Priority? Timeline?

---

### 5. Reconnection Logic Not Implemented

**Location:** `crates/agent-mcp/src/config.rs:124-148`

**Issue:**
- `ReconnectConfig` is defined and parsed
- Health check runs (manager.rs:365-403)
- Automatic reconnection logic doesn't exist

**Impact:**
- Users configure reconnection but it doesn't work
- False expectations from config file
- MCP servers that disconnect stay disconnected

**Options:**
- **Option A:** Implement automatic reconnection using `ReconnectConfig`
- **Option B:** Add TODO comment explaining it's planned
- **Option C:** Remove `ReconnectConfig` if not needed

**Recommendation:** Implement or remove, don't leave half-finished feature

**Effort:** 4-8 hours if implemented

**Decision Needed:** Should we implement reconnection? Priority?

---

### 6. Incomplete Features in agent-tools

**Locations:**
- `crates/agent-tools/src/output_manager.rs:77, 166`
  - `truncated_token_count` calculated but never used
  - `metadata` retrieved but never used
- `crates/agent-tools/src/tools/create_todo_list.rs:149`
  - JSON serialized but not used (comment: "Return the todo list as JSON so it can be stored in session")

**Impact:**
- Dead code that may indicate missing functionality
- Wasted computation
- Unclear requirements

**Options:**
- **Option A:** Complete the features (use the calculated values)
- **Option B:** Remove dead code if features cancelled
- **Option C:** Add TODO comments explaining what's missing

**Decision Needed:** Are these features still needed?

---

## 📋 LOW PRIORITY - Code Quality

### 7. Deprecated proc-macro-hack Dependency

**Location:** `src-tauri/Cargo.lock:3779`

**Issue:**
- Dependency version "0.5.20+deprecated"
- Package is deprecated

**Impact:**
- Using deprecated dependency
- Should investigate and remove

**Action:**
1. Run `cargo tree -i proc-macro-hack` to find which crate depends on it
2. Update that crate to newer version
3. Remove proc-macro-hack from dependency tree

**Effort:** 1-2 hours

---

### 8. Unimplemented Trait Method

**Location:** `crates/agent-llm/src/protocol/anthropic.rs:287`

**Issue:**
```rust
fn to_anthropic(&self) -> ProtocolResult<AnthropicMessage> {
    unimplemented!("Use clone for now")
}
```

**Impact:**
- Will panic if called
- Currently unused in production
- Incomplete API

**Options:**
- **Option A:** Implement properly
- **Option B:** Remove method from trait
- **Option C:** Mark as test-only ✅ DONE (commit 84df026)

**Status:** Marked as test-only, issue resolved

---

### 9. Error Handling Semantics

**Locations:**
- `crates/agent-core/src/composition/condition.rs:41`
  - Parse error handling
- `crates/agent-metrics/src/storage.rs:1272`
  - NULL handling in database

**Issue:**
Different approaches to error handling that may be inconsistent.

**Action:**
1. Review error handling strategy for consistency
2. Decide on approach for each case
3. Document patterns

**Effort:** 2-4 hours

---

## 🔷 TYPE SAFETY IMPROVEMENTS (TypeScript)

### 10. Excessive `any` Type Usage

**Locations:** 30+ instances across frontend

**High Priority Files:**
- `src/services/common/ServiceFactory.ts` (8 instances)
- `src/pages/ChatPage/hooks/useChatManager/useMessageStreaming.ts`
- `src/pages/ChatPage/hooks/useChatManager/openAiStreamingRunner.ts`

**Impact:**
- Reduced type safety
- Increased runtime error risk
- Harder refactoring

**Recommendation:**
1. Start with ServiceFactory.ts (affects entire app)
2. Define proper TypeScript interfaces for all `any` usages
3. Use `unknown` + type guards for truly dynamic data

**Effort:** 1-2 days for high-priority files

---

### 11. Deprecated TypeScript Services

**Files:**
- `src/pages/ChatPage/services/workspaceApiTypes.ts`
- `src/pages/ChatPage/services/WorkspaceApiService.ts`
- `src/pages/ChatPage/services/recentWorkspacesTypes.ts`
- `src/pages/ChatPage/services/RecentWorkspacesManager.ts`

**Issue:**
- Deprecated but still in use
- Should use `WorkspaceService` instead

**Action:**
1. Audit all usages of deprecated services
2. Create migration guide
3. Set deprecation timeline
4. Remove in next major version

**Effort:** 1 day

---

### 12. TypeScript Path Aliases

**Issue:**
20+ files with deep imports (`../../../../`)

**Impact:**
- Harder refactoring
- Brittle imports
- Less readable code

**Fix:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@services/*": ["src/services/*"],
      "@shared/*": ["src/shared/*"],
      "@pages/*": ["src/pages/*"]
    }
  }
}
```

**Effort:** 4 hours (config + gradual migration)

---

## 🧪 TEST COVERAGE

### 13. Missing Tests in agent-mcp

**Issue:**
Only `tool_index.rs` has unit tests

**Missing:**
- Executor behavior
- Manager lifecycle
- Transport connections (may require mocking)

**Effort:** 8-16 hours for comprehensive coverage

---

### 14. Test Type Safety Issues

**Issue:**
Test files use `as any` to bypass type checking

**Impact:**
- Tests don't catch type errors
- False confidence in test coverage

**Action:**
1. Create typed mock utilities
2. Remove `as any` from test files
3. Add pre-commit hooks for type checking

**Effort:** 4-8 hours

---

## 📊 METRICS & MONITORING

### 15. Console Logging Strategy

**Issue:**
72 files with `console.log/warn/error/debug` statements

**High Priority:** Production-facing code

**Action:**
1. Implement structured logging (winston/pino)
2. Add environment-based log levels
3. Remove debug logs in production builds

**Effort:** 1-2 days

---

## Summary by Priority

| Priority | Count | Effort Range |
|----------|-------|--------------|
| **HIGH** | 3 | 3-6 hours |
| **MEDIUM** | 3 | 2-4 days |
| **LOW** | 9 | 2-3 weeks |
| **Total** | 15 | 3-4 weeks |

---

## Next Steps

### Immediate (This Week)
1. ✅ Fix TokenUsage Copy trait (DONE)
2. ✅ Remove dead code (DONE)
3. 🔲 Decide on duplicate type strategy (agent-mcp)
4. 🔲 Decide on private type in public API (CopilotConfig)

### Short-term (Next Sprint)
5. 🔲 Implement Gemini tool calls or defer
6. 🔲 Implement or remove reconnection logic
7. 🔲 Review incomplete features in agent-tools

### Long-term (Next Quarter)
8. 🔲 Improve TypeScript type safety
9. 🔲 Migrate deprecated services
10. 🔲 Add comprehensive test coverage
11. 🔲 Implement structured logging

---

## Questions for Team Discussion

1. **agent-mcp types:** Which consolidation approach? (A, B, or C)
2. **CopilotConfig.endpoints:** Public API or implementation detail?
3. **Gemini tool calls:** Priority and timeline?
4. **MCP reconnection:** Implement or remove?
5. **Incomplete features:** Keep, complete, or remove?
6. **TypeScript strict mode:** Timeline for eliminating `any`?

---

**Generated by:** Claude Sonnet 4.5
**Commit:** 84df026
**Analysis method:** 5 parallel agents (agent-mcp, agent-tools, core crates, src-tauri/web_service, TypeScript)
