# Technical Debt - Remaining Issues

**Last Updated:** 2026-02-17
**Status:** After architecture fixes and dependency cleanup

---

## ✅ RECENTLY RESOLVED

### Architecture Fixes (2026-02-17)
1. ✅ **MutexGuard across await** - Fixed in commit 31ab04c
   - Converted to tokio::sync::Mutex
   - All 15+ methods now async-safe

2. ✅ **Duplicate Type Definitions** - Fixed in commit 31ab04c
   - Removed 41 lines of duplicate code
   - Established single source of truth

3. ✅ **Endpoints Visibility** - Fixed in commit 31ab04c
   - Made Endpoints public
   - API consistency achieved

4. ✅ **Too Many Parameters** - Fixed in commit 31ab04c
   - Created ProcessRegistrationConfig struct
   - Reduced from 8-9 to 1-2 parameters

### Dependency Cleanup (2026-02-17)
5. ✅ **XState Dependencies** - Removed in commit 5f58e6d
   - Uninstalled @xstate/react and xstate
   - Reduced bundle by ~2.5MB
   - Removed 16 packages

---

## 🔴 HIGH PRIORITY - Missing Features

### 1. Gemini Tool Calls Not Implemented

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

### 2. Reconnection Logic Not Implemented

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

### 3. ✅ Incomplete Features in agent-tools (Resolved 2026-02-17)

**Resolution:**
- `ToolOutputManager::cap_tool_result()` now reserves inline token budget for the truncation notice,
  so the final returned inline output stays within `max_inline_tokens`.
- `ToolOutputManager::list_artifacts()` now uses filesystem metadata and returns best-effort
  `tool_call_id` + `full_token_count` instead of placeholders.
- Removed redundant JSON serialization in `create_todo_list` and centralized TodoList construction
  in a shared helper used by both the tool and `agent-loop` runner.

**Notes:**
- `ArtifactRef.truncated_token_count` was removed because it had no consumers and ambiguous
  semantics (count vs limit vs prefix vs full inline output). It can be reintroduced later with
  precise meaning if a caller needs it.

**Docs:** `docs/plans/2026-02-17-agent-tools-incomplete-features-design.md`

---

## 🟡 MEDIUM PRIORITY - Code Quality

### 4. Deprecated proc-macro-hack Dependency

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

### 5. Error Handling Semantics

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

## 🔵 TYPE SAFETY IMPROVEMENTS (TypeScript)

### 6. Excessive `any` Type Usage

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

### 7. Deprecated TypeScript Services

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

### 8. TypeScript Path Aliases

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

### 9. Missing Tests in agent-mcp

**Issue:**
Only `tool_index.rs` has unit tests

**Missing:**
- Executor behavior
- Manager lifecycle
- Transport connections (may require mocking)

**Effort:** 8-16 hours for comprehensive coverage

---

### 10. Test Type Safety Issues

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

## 📊 MONITORING & LOGGING

### 11. Console Logging Strategy

**Issue:**
72 files with `console.log/warn/error/debug` statements

**High Priority:** Production-facing code

**Action:**
1. Implement structured logging (winston/pino)
2. Add environment-based log levels
3. Remove debug logs in production builds

**Effort:** 1-2 days

---

## 🔍 SECURITY AUDIT

### 12. npm audit vulnerabilities

**Current Status:**
```
8 vulnerabilities (7 moderate, 1 critical)
```

**Action:**
1. Run `npm audit fix` to auto-fix safe issues
2. Review critical vulnerabilities manually
3. Update affected packages
4. Test for breaking changes

**Effort:** 2-4 hours

---

## Summary by Priority

| Priority | Count | Effort Range | Status |
|----------|-------|--------------|--------|
| **HIGH (Features)** | 3 | 2-4 days | 🔴 Need decision |
| **MEDIUM (Quality)** | 2 | 3-6 hours | 🟡 Lower priority |
| **TYPE SAFETY** | 3 | 2-3 days | 🔵 Improve gradually |
| **TESTS** | 2 | 12-24 hours | 🟢 Ongoing effort |
| **MONITORING** | 1 | 1-2 days | 🟡 When needed |
| **SECURITY** | 1 | 2-4 hours | 🔴 Do soon |
| **Total** | 12 | 5-8 days | |

---

## Next Steps

### Immediate (This Week)
1. 🔴 Run `npm audit fix` for security
2. 🔴 Decide on Gemini tool calls priority
3. 🔴 Decide on MCP reconnection: implement or remove

### Short-term (Next Sprint)
4. 🟡 Remove deprecated proc-macro-hack dependency
5. 🟡 Start TypeScript `any` elimination (ServiceFactory.ts)
6. 🟡 Audit deprecated TypeScript services usage

### Long-term (Next Quarter)
7. 🔵 Implement TypeScript path aliases
8. 🔵 Add comprehensive test coverage (agent-mcp)
9. 🔵 Improve test type safety
10. 🟡 Implement structured logging

---

## Questions for Team Discussion

1. **Gemini tool calls:** Priority and timeline?
2. **MCP reconnection:** Implement or remove?
3. **Incomplete agent-tools features:** Keep, complete, or remove?
4. **TypeScript strict mode:** Timeline for eliminating `any`?
5. **Security vulnerabilities:** Can we run `npm audit fix` now?

---

**Generated by:** Claude Sonnet 4.5
**Last Commit:** 5f58e6d (XState removal)
**Previous Analysis:** See `ARCHITECTURE_FIXES_REPORT.md` for completed work
