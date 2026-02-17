# Agent-Tools Incomplete Features Design

**Date:** 2026-02-17

## Context

`TECHNICAL_DEBT.md` flags three pieces of "computed but unused" logic in `agent-tools`:

- `crates/agent-tools/src/output_manager.rs`
  - `truncated_token_count` computed in `cap_tool_result()` but unused
  - filesystem `metadata` fetched in `list_artifacts()` but unused
- `crates/agent-tools/src/tools/create_todo_list.rs`
  - `TodoList` serialized to JSON but never returned/consumed

These are not compiler warnings (they are prefixed with `_`), but they indicate either missing behavior or leftover scaffolding.

## Goals

- Preserve useful, coherent behavior (artifact storage, todo list formatting + persistence).
- Remove dead code that provides no value today.
- Avoid "half-finished" public API that implies guarantees we do not provide.
- Keep changes low-risk: focus on internal correctness and clear documentation.

## Decisions

### 1) Output Manager: token budget and `truncated_token_count`

**Problem:** `cap_tool_result()` truncates content to `max_inline_tokens` and then appends a truncation notice. The notice itself consumes tokens, which can push the returned inline output over the budget. The unused `truncated_token_count` computation likely originated from this gap.

**Decision:** Make `cap_tool_result()` account for truncation notice overhead so the final returned string stays within `max_inline_tokens`.

**About `ArtifactRef.truncated_token_count`:** there are no consumers in the codebase and the semantics are ambiguous (token count of the truncated prefix vs the full inline string including the notice vs the configured limit). Rather than keep an unused field with unclear meaning, remove it for now. If/when a consumer needs it, reintroduce it with precise semantics (and tests).

### 2) Output Manager: `list_artifacts()` metadata

**Problem:** `list_artifacts()` currently returns placeholder `ArtifactRef`s (empty `tool_call_id`, `full_token_count = 0`) and performs an unused `fs::metadata()` call.

**Decision:** Use metadata meaningfully (for example to avoid reading extremely large files), and populate `tool_call_id` (derived from the file stem) and `full_token_count` (computed from file contents for normal-sized artifacts, otherwise estimated).

### 3) create_todo_list: unused JSON + runner duplication

**Problem:** `create_todo_list` serializes `TodoList` but the returned `ToolResult` only includes a formatted string; the agent loop ignores the serialized JSON and rebuilds the list from tool arguments for persistence.

**Decision:** Remove the unused JSON serialization. To avoid logic drift, factor out a shared `TodoList` construction helper in `CreateTodoListTool` and reuse it in both the tool implementation and `agent-loop` runner.

## Testing Strategy

- Add unit tests to `output_manager.rs`:
  - inline capped output stays within the configured token budget
  - `list_artifacts()` populates `tool_call_id` and a non-zero `full_token_count`
- Add unit tests to `create_todo_list.rs` for the new helper (construction from args).

