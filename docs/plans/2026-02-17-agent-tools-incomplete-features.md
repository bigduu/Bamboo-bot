# Agent-Tools Incomplete Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove dead computations in `agent-tools` by either completing the intended behavior or deleting unused scaffolding, with tests and documentation.

**Architecture:** Tighten `ToolOutputManager` so capped output respects the inline token budget and `list_artifacts()` returns meaningful data. Remove redundant JSON serialization from `create_todo_list` and centralize TodoList construction to avoid duplication with `agent-loop`.

**Tech Stack:** Rust (tokio, serde/serde_json, chrono), Cargo workspace.

---

### Task 1: Add failing tests for output_manager budget + listing

**Files:**
- Modify: `crates/agent-tools/src/output_manager.rs`

**Step 1: Write failing tests**
- Add a test asserting `cap_tool_result()` output token count is `<= max_inline_tokens`.
- Add a test asserting `list_artifacts()` returns `tool_call_id` + `full_token_count > 0` for a stored artifact.

**Step 2: Run tests to verify failure**
Run: `cargo test -p agent-tools --offline`
Expected: failures in new tests (budget not enforced; listing returns placeholders).

### Task 2: Fix cap_tool_result() to account for truncation notice overhead

**Files:**
- Modify: `crates/agent-tools/src/output_manager.rs`

**Step 1: Implement minimal fix**
- Build the truncation notice first and reserve budget for it.
- Truncate the original output to the remaining budget.

**Step 2: Run tests**
Run: `cargo test -p agent-tools --offline`
Expected: budget test passes; listing test may still fail.

### Task 3: Improve list_artifacts() and remove unused metadata

**Files:**
- Modify: `crates/agent-tools/src/output_manager.rs`

**Step 1: Implement meaningful listing**
- Use `fs::metadata()` for file size.
- Populate `tool_call_id` by parsing the artifact id format.
- Populate `full_token_count` from file contents (with a size guard or estimation).

**Step 2: Run tests**
Run: `cargo test -p agent-tools --offline`
Expected: listing test passes.

### Task 4: Remove create_todo_list dead JSON + share TodoList parsing with runner

**Files:**
- Modify: `crates/agent-tools/src/tools/create_todo_list.rs`
- Modify: `crates/agent-loop/src/runner.rs`

**Step 1: Add failing test for new helper**
- Add a test that calls `CreateTodoListTool::todo_list_from_args(...)` (will fail to compile until implemented).

**Step 2: Implement helper + refactor call sites**
- Implement the helper in `CreateTodoListTool`.
- Use it in `CreateTodoListTool::execute(...)`.
- Use it in `agent-loop` runner `create_todo_list` handling.
- Delete unused JSON serialization.

**Step 3: Run tests**
Run: `cargo test --workspace --offline`
Expected: all tests pass.

### Task 5: Update technical debt documentation

**Files:**
- Modify: `TECHNICAL_DEBT.md`

**Step 1: Document resolution**
- Mark the `agent-tools` incomplete-feature entry as resolved and point to the design doc.

