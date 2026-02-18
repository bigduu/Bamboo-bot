# LLM Provider Model-Required Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `model` mandatory end-to-end: `LLMProvider::chat_stream` requires `&str`, providers have no default model, and `Session.model` is required.

**Architecture:** Push model selection to the caller layer (session/request). Providers become stateless w.r.t. model and simply execute requests for the provided model. Server/API validates `model` presence and persists it on the session.

**Tech Stack:** Rust (workspace crates), async/await, Actix-web, serde.

---

### Task 1: Lock in Provider Trait Signature (Model Required)

**Files:**
- Verify: `crates/agent-llm/src/provider.rs`

**Step 1: Add/adjust trait signature**
- Ensure `LLMProvider::chat_stream(..., model: &str)` (no `Option`).

**Step 2: Red verification (should fail before fixes)**
- Run: `cargo test -p agent-llm`
- Expected: compile errors in providers/decorators that still use `Option<&str>`.

---

### Task 2: Remove Provider-Level Default Models (OpenAI/Gemini)

**Files:**
- Modify: `crates/agent-llm/src/providers/openai/mod.rs`
- Modify: `crates/agent-llm/src/providers/gemini/mod.rs`

**Step 1: Update provider structs**
- Remove `model: String` fields.
- Remove `.with_model(...)` builder methods.

**Step 2: Update `chat_stream` implementations**
- Change signature to `model: &str`.
- Use `model` directly (no fallback/override logic).

**Step 3: Update unit tests**
- Remove assertions/tests that reference provider default model or `.with_model()`.
- Keep tests for base URL builder and request body/url construction, but pass an explicit model string where needed.

---

### Task 3: Adapt Other Providers + Decorators to Required Model

**Files:**
- Modify: `crates/agent-llm/src/providers/copilot/mod.rs`
- Modify: `crates/agent-llm/src/providers/common/masking_decorator.rs`
- Modify: `crates/agent-llm/src/providers/anthropic/mod.rs` (tests cleanup)

**Step 1: Copilot**
- Change signature to `model: &str` and ignore it (optionally log a warning if non-empty and not expected).

**Step 2: Masking decorator**
- Change signature to `model: &str`.
- Forward `model` through unchanged.
- Update decorator tests to pass a placeholder model, e.g. `"test-model"`.

**Step 3: Anthropic tests**
- Remove/adjust tests that reference `provider.model` or `with_model`.

---

### Task 4: Remove Factory/State `.with_model()` Wiring

**Files:**
- Modify: `crates/agent-llm/src/provider_factory.rs`
- Modify: `crates/agent-server/src/state.rs`

**Step 1: Provider factory**
- Remove all `.with_model(...)` calls for OpenAI/Anthropic/Gemini.
- Keep base_url/max_tokens configuration.

**Step 2: Agent server state**
- Remove `.with_model(model.clone())` from OpenAI provider construction.
- Keep `model_name` field as configuration/metrics default if still needed by callers.

---

### Task 5: Make `Session.model` Required

**Files:**
- Modify: `crates/agent-core/src/agent/types.rs`
- Modify call sites: `crates/agent-core/src/**/*.rs`, `crates/agent-loop/src/**/*.rs`, `crates/agent-server/src/**/*.rs`

**Step 1: Change field type**
- In `Session`, change:
  - `pub model: Option<String>` → `pub model: String`
- Update serde attributes to always serialize it.

**Step 2: Update constructor**
- Change `Session::new(id)` → `Session::new(id, model)` and require callers to supply a model.

**Step 3: Update tests/helpers**
- Update all `Session::new(...)` call sites to pass `"test-model"` (or a relevant model string).
- Update tests that previously asserted `session.model == None` to assert the chosen default test value.

---

### Task 6: Ensure All `chat_stream` Call Sites Pass a Model

**Files:**
- Modify: `crates/agent-loop/src/runner.rs`
- Modify: `crates/agent-loop/src/todo_evaluation.rs`
- Modify: `crates/agent-server/src/handlers/execute.rs`
- Modify: `crates/web_service/src/controllers/openai_controller.rs`
- Modify: `crates/web_service/src/controllers/anthropic/mod.rs`
- Modify: `crates/web_service/src/controllers/gemini_controller.rs`
- Modify tests/mocks implementing `LLMProvider` under `crates/web_service/tests/*`

**Step 1: Agent loop**
- Pass `&session.model` to `llm.chat_stream(...)` in `runner.rs` and `todo_evaluation.rs`.

**Step 2: Agent server execute**
- Use `session.model.clone()` as `model_name` for loop config (no fallback to state default).

**Step 3: Web service controllers**
- Replace `model_override: Option<&str>` usage with a concrete model string.
- If request uses `"default"` or mapping returns empty, resolve to configured default model (e.g. via `get_default_model_from_config(&config)`), then pass that `&str` into `chat_stream`.

**Step 4: Update mock providers**
- Update `LLMProvider` mocks to accept `model: &str`.

---

### Task 7: Green Verification (Workspace)

**Step 1: Format**
- Run: `cargo fmt`
- Expected: exit 0

**Step 2: Tests**
- Run: `cargo test --workspace`
- Expected: exit 0

**Step 3: (Optional) Clippy**
- Run: `cargo clippy --workspace --all-targets --all-features -- -D warnings`
- Expected: exit 0

