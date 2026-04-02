# Env Var 是否明确注入到 Prompt / Skill 链路分析报告

## 结论摘要

**结论：有注入，但不是你们可能期待的那种“把 Env Var 的实际值直接注入到模型 prompt”。**

当前实现里存在两条不同的 Env Var 注入链路：

1. **Bash 进程环境注入**：配置里的 `env_vars` 会被注入到 Bash/tool 子进程环境中。
2. **Prompt-safe 元信息注入**：这些 `env_vars` 的**名称 + secret 标记 + 可选 description** 会被拼进 system prompt 的 `workspace context` 里，供模型“知道有哪些变量存在”。

所以从代码实现上说：

- **是有注入到 prompt 的**；
- 但**只注入变量名和描述，不注入实际值**；
- 而且这段注入**依赖 `workspace_path` 存在**，因为 env 信息是附着在 `workspace context` 中的；
- 此外，某些“查看 system prompt 的接口/展示方式”**不会把这段 env 元信息完整重建出来**，容易造成“AI 好像不知道这些 env prompt”的错觉。

---

## 最关键的根因判断

如果你们的观察是：

> 调用 skill 时，AI 似乎不知道我们定义了哪些 prompt / env vars

那么最可能的根因不是“完全没有注入”，而是下面这几个之一：

### 根因 1：当前设计只注入 `name + metadata`，不注入 `value`

也就是说模型最多知道：

- 有 `OPENAI_API_KEY`
- 有 `INTERNAL_API_BASE`
- 哪个是 secret
- 它们的描述是什么

但**模型并不知道变量值本身**。

如果 skill 需要知道：

- endpoint 的具体 URL
n- token/region/project id 的实际值
- 某个 prompt 模板的具体内容

那当前 prompt 注入是**不够的**。

### 根因 2：env 元信息挂在 `workspace context` 上，`workspace_path` 缺失时就不会进入 prompt

后端是通过 `build_workspace_prompt_context(workspace_path)` 来附带 env 提示的。
如果请求里没有 `workspace_path`，就不会生成这段 context。

### 根因 3：你们查看 prompt 的“快照/拆分字段”可能丢失了 env 提示

后端 `effective_system_prompt` 里确实可能包含 env 元信息；
但 `workspace_context` 这个拆分字段在某些接口里是重新构造的简化版，**没有把 env 元信息完整重建回去**。

因此如果你们 UI / 调试逻辑只看 `workspace_context` 字段，而不是 `effective_system_prompt`，就会误以为 env 没被注入。

---

## 代码证据

## 1. `env_vars` 的设计语义：首先是给 Bash 进程注入的

文件：`/Users/bigduu/Workspace/TauriProjects/zenith/bamboo/src/core/config.rs`

```rust
/// User-managed environment variables injected into Bash tool processes.
#[serde(default, skip_serializing_if = "Vec::is_empty")]
pub env_vars: Vec<EnvVarEntry>,
```

关键位置：`src/core/config.rs:163`

这说明这组配置最原始的设计语义是：
**给 Bash tool 的子进程环境使用**，不等于直接给模型 prompt。

---

## 2. `env_vars` 确实被注入到 Bash/tool 进程环境

文件：`/Users/bigduu/Workspace/TauriProjects/zenith/bamboo/src/agent/tools/tools/bash.rs`

```rust
async fn prepare_environment() -> PreparedCommandEnvironment {
    let overrides = crate::core::Config::current_env_vars();
    build_command_environment(&overrides).await
}
```

关键位置：`src/agent/tools/tools/bash.rs:187`

之后在真正执行命令前：

```rust
prepared_env.apply_to_tokio_command(&mut cmd);
```

关键位置：`src/agent/tools/tools/bash.rs:216`

后台 Bash 也是一样：

文件：`/Users/bigduu/Workspace/TauriProjects/zenith/bamboo/src/agent/tools/tools/bash_runtime.rs`

```rust
let overrides = crate::core::Config::current_env_vars();
let prepared_env = build_command_environment(&overrides).await;
prepared_env.apply_to_tokio_command(&mut cmd);
```

关键位置：
- `src/agent/tools/tools/bash_runtime.rs:135`
- `src/agent/tools/tools/bash_runtime.rs:142`

**结论：Env Var 对 Bash/tool 是明确注入的。**

---

## 3. Prompt 中只注入“安全元信息”，不注入 value

文件：`/Users/bigduu/Workspace/TauriProjects/zenith/bamboo/src/core/config.rs`

```rust
fn prompt_safe_env_vars(&self) -> Vec<PromptSafeEnvVarEntry> {
    self.env_vars
        .iter()
        .filter(|entry| !entry.name.trim().is_empty() && !entry.value.trim().is_empty())
        .map(|entry| PromptSafeEnvVarEntry {
            name: entry.name.clone(),
            secret: entry.secret,
            description: entry
                .description
                .as_ref()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty()),
        })
        .collect()
}
```

关键位置：`src/core/config.rs:1235`

这里能看出：进入 prompt-safe 缓存的数据只有：

- `name`
- `secret`
- `description`

**没有 `value`**。

然后在配置加载/更新时发布到缓存：

```rust
pub fn publish_env_vars(&self) {
    let map = self.env_vars_as_map();
    if let Ok(mut guard) = ENV_VARS_CACHE.write() {
        *guard = map;
    }
    let prompt_safe = self.prompt_safe_env_vars();
    if let Ok(mut guard) = PROMPT_SAFE_ENV_VARS_CACHE.write() {
        *guard = prompt_safe;
    }
}
```

关键位置：`src/core/config.rs:1252`

并且在配置加载时会调用：

```rust
config.publish_env_vars();
```

关键位置：`src/core/config.rs:790`

**结论：Prompt 侧明确只拿到安全元信息，不拿值。**

---

## 4. Prompt-safe env vars 会被拼进 workspace context

文件：`/Users/bigduu/Workspace/TauriProjects/zenith/bamboo/src/server/app_state/mod.rs`

### 4.1 构造 env prompt guidance

```rust
fn build_env_prompt_guidance() -> Option<String> {
    let env_vars = crate::core::Config::current_prompt_safe_env_vars();
    if env_vars.is_empty() {
        return None;
    }

    let mut lines = Vec::new();
    lines.push("Configured environment variables already available to Bash processes and may be relevant for skills/tools:".to_string());
    ...
    for entry in env_vars {
        let visibility = if entry.secret { "secret" } else { "non-secret" };
        let mut line = format!("- {} ({})", entry.name, visibility);
        if let Some(description) = entry.description {
            line.push_str(" — ");
            line.push_str(&description);
        }
        lines.push(line);
    }

    Some(lines.join("\n"))
}
```

关键位置：`src/server/app_state/mod.rs:114`

### 4.2 附加到 workspace prompt context

```rust
pub fn build_workspace_prompt_context(workspace_path: &str) -> Option<String> {
    ...
    let mut body = format!(
        "{WORKSPACE_CONTEXT_PREFIX}{workspace_path}\n{}",
        workspace_prompt_guidance()
    );
    if let Some(env_guidance) = build_env_prompt_guidance() {
        body.push_str("\n\n");
        body.push_str(&env_guidance);
    }
    ...
}
```

关键位置：`src/server/app_state/mod.rs:146`

**结论：env 元信息不是独立 prompt section，而是附着在 workspace context 里。**

---

## 5. 前端 chat 请求会传 `workspace_path`

文件：`/Users/bigduu/Workspace/TauriProjects/zenith/lotus/src/pages/ChatPage/hooks/useChatManager/useMessageStreaming.ts`

```ts
const response = await agentClientRef.current.sendMessage({
  message: content,
  session_id: sessionId,
  enhance_prompt: enhancePrompt || undefined,
  copilot_conclusion_with_options_enhancement_enabled: copilotConclusionWithOptionsEnhancementEnabled,
  workspace_path: workspacePath || undefined,
  selected_skill_ids:
    selectedSkillIds && selectedSkillIds.length > 0 ? selectedSkillIds : undefined,
  ...
});
```

关键位置：`lotus/src/pages/ChatPage/hooks/useChatManager/useMessageStreaming.ts:293`

而后端 `ChatRequest` 也支持这个字段：

文件：`/Users/bigduu/Workspace/TauriProjects/zenith/bamboo/src/server/handlers/agent/chat/types.rs`

```rust
pub struct ChatRequest {
    ...
    pub workspace_path: Option<String>,
    ...
}
```

关键位置：`src/server/handlers/agent/chat/types.rs:26`

**结论：如果前端当前会话配置里有 workspacePath，那么后端是有机会把 env 元信息拼进 prompt 的。**

---

## 6. chat 创建阶段会把 workspace context 拼进 system prompt

文件：`/Users/bigduu/Workspace/TauriProjects/zenith/bamboo/src/server/handlers/agent/chat/prompt.rs`

```rust
let workspace_context = workspace_path
    .map(str::trim)
    .filter(|workspace_path| !workspace_path.is_empty())
    .and_then(crate::server::app_state::build_workspace_prompt_context);
if let Some(workspace_context) = workspace_context.as_ref() {
    merged_prompt.push_str("\n\n");
    merged_prompt.push_str(workspace_context.as_str());
}
```

关键位置：`src/server/handlers/agent/chat/prompt.rs:84`

并且有单测明确验证 prompt-safe env metadata 会进入 prompt：

文件：`/Users/bigduu/Workspace/TauriProjects/zenith/bamboo/src/server/handlers/agent/chat/tests.rs`

```rust
assert!(prompt.contains("OPENAI_API_KEY"));
assert!(prompt.contains("INTERNAL_API_BASE"));
assert!(prompt.contains("OpenAI credential"));
assert!(prompt.contains("Internal API endpoint"));
assert!(prompt.contains("secret"));
assert!(!prompt.contains("super-secret-value"));
assert!(!prompt.contains("https://internal.example"));
```

关键位置：`src/server/handlers/agent/chat/tests.rs:62`

这条单测非常重要，证明当前行为是**有意设计**：

- 变量名进入 prompt
- 描述进入 prompt
- secret/non-secret 标记进入 prompt
- 实际值不进入 prompt

---

## 7. 执行阶段 skill context 会再次拼入 system prompt，但 workspace context 会保留

文件：`/Users/bigduu/Workspace/TauriProjects/zenith/bamboo/src/agent/loop_module/runner/session_setup.rs`

```rust
let skill_result = skill_context::load_skill_context(config, session_id, initial_message).await;
...
prompt_setup::apply_system_prompt_contexts(
    session,
    config,
    &skill_context,
    &tool_guide_context,
);
```

关键位置：`src/agent/loop_module/runner/session_setup.rs:32`

然后看 `prompt_setup.rs`：

```rust
let workspace_context = extract_workspace_context(&raw_base_prompt);
let base_prompt = normalize_base_prompt(&raw_base_prompt);
let merged_prompt = merge_with_optional_workspace_context(
    &base_prompt,
    workspace_context.as_deref(),
    skill_context,
    tool_guide_context,
);
```

关键位置：`src/agent/loop_module/runner/session_setup/prompt_setup.rs:223`

这说明执行前会：

1. 从已有 system prompt 中提取 workspace context；
2. 去掉旧 skill/tool section；
3. 再重新拼 skill/tool guide；
4. 最后把 workspace context 再加回去。

**结论：执行阶段 skill context 不会天然吃掉 workspace/env context。**

---

## 8. Skill 本身拿到的是“系统 prompt + skill metadata”，并不会自动拿到 env 的真实值

文件：`/Users/bigduu/Workspace/TauriProjects/zenith/bamboo/src/agent/skill/context.rs`

这里构建的是 skill metadata section，例如：

- Mandatory Skill Check
- load_skill 规则
- Available Skills 列表
- “Treat Bamboo-injected workspace and environment context as already available...”

关键位置：`src/agent/skill/context.rs:23`

这段 skill context 只是**告诉模型去利用已注入的环境上下文**，并不会把 env value 本身带进去。

所以如果 skill 需要的是：

- “有哪些 env 变量可以依赖” → 当前设计大致能满足；
- “这些 env 的具体值是什么” → 当前设计不能满足。

---

## 9. 你们可能会误判“没注入”的一个 UI / 接口原因

文件：`/Users/bigduu/Workspace/TauriProjects/zenith/bamboo/src/server/handlers/agent/sessions/handlers/crud/system_prompt.rs`

构造 snapshot 时：

```rust
let workspace_context = metadata_value(session, "workspace_path")
    .map(|workspace_path| {
        format!(
            "{}{}\n{}",
            WORKSPACE_CONTEXT_PREFIX,
            workspace_path,
            workspace_prompt_guidance()
        )
    })
    .or(workspace_from_prompt);
```

关键位置：`src/server/handlers/agent/sessions/handlers/crud/system_prompt.rs:112`

这里有个 subtle issue：
如果 session metadata 里有 `workspace_path`，接口优先返回一个**重建版 workspace_context**，这个重建版只包含：

- `Workspace path: ...`
- `workspace_prompt_guidance()`

**它没有重新调用 `build_env_prompt_guidance()`**，因此不会把 env 元信息重建回来。

也就是说：

- `effective_system_prompt` 可能是完整的；
- 但 snapshot 里的 `workspace_context` 字段可能是“缩水版”。

如果你们某个页面/调试逻辑只看 `workspace_context` 字段，不看 `effective_system_prompt`，就会以为 env 没进 prompt。

---

## 对你问题的直接回答

### Q1: Env Var 是否有明确注入到 prompt 里面？

**有，但仅限 prompt-safe 元信息。**

具体是：

- 变量名
- 是否 secret
- description

不会把 value 注入给模型。

### Q2: 调用 skill 时 AI 为什么像不知道我们定义了哪些 prompt？

更准确地说，可能有以下几种情况：

1. **AI 只知道变量名，不知道值**，所以对某些技能来说仍然“不够用”；
2. **当前请求/会话没有 `workspace_path`**，导致 env 元信息根本没有进入 prompt；
3. **你们看的不是 `effective_system_prompt`，而是被简化过的 `workspace_context` 字段**；
4. 你们说的“我们定义了哪些 prompt”如果指的是**env 里存放的 prompt 模板内容**，那当前实现压根不会把模板内容注入模型，只会让模型知道“存在某个 env var”。

---

## 建议修复方向

## 方案 A：如果你们只想让 AI“知道有哪些 env 可用”

### 建议 A1：把 env 元信息从 workspace context 提升为独立 section

当前 env 提示挂在 workspace section 下，语义不够清晰，也依赖 `workspace_path`。

建议新增类似：

- `<!-- BAMBOO_ENV_CONTEXT_START -->`
- `<!-- BAMBOO_ENV_CONTEXT_END -->`

这样可以：

- 不依赖 workspace_path；
- 更容易在 prompt snapshot / UI 中单独展示；
- 不会被误解为“只是 workspace 提示的一部分”。

### 建议 A2：在 session snapshot 接口中单独返回 `env_context`

避免前端只看 `workspace_context` 时丢掉 env 指引。

---

## 方案 B：如果你们希望 skill 能使用 env 里的“具体 prompt 文本 / 配置值”

### 建议 B1：增加“允许注入非敏感值”的白名单机制

例如给 env var 增加策略字段：

- `prompt_visibility: hidden | metadata_only | reveal_value`

默认仍然安全：

- secret → `metadata_only` / `hidden`
- 非 secret → 可选 `reveal_value`

这样模型就能真正看到：

- `API_BASE=https://...`
- `PROJECT_ID=...`
- `DEFAULT_SKILL_PROMPT=...`

否则当前模型永远只知道名字，不知道内容。

### 建议 B2：不要把“prompt 模板”只存在 env var 里

如果这些所谓“我们定义了哪些 prompt”本质上是业务 prompt 模板、system fragments、skill presets，建议不要只存在 env var。

更合理的是：

- 放到配置文件 / prompt registry / database
- 在 prompt 组装阶段显式拼入需要的片段
- 或通过专门的 runtime metadata section 注入

因为 env var 更适合：

- credentials
- endpoint
- runtime flags
- path/config overrides

不太适合承载需要被模型“理解和消费”的长 prompt 文本。

---

## 我认为最值得优先修的两个点

### 优先级 1：修 snapshot 接口的 `workspace_context` 丢失 env guidance 问题

这是最容易造成“明明注入了，调试看不到”的地方。

建议修改 `build_system_prompt_response()`，当 metadata 中有 `workspace_path` 时，直接调用：

```rust
crate::server::app_state::build_workspace_prompt_context(&workspace_path)
```

而不是手工拼：

```rust
format!("{}{}\n{}", WORKSPACE_CONTEXT_PREFIX, workspace_path, workspace_prompt_guidance())
```

这样 snapshot 字段就能和真实 prompt 一致。

### 优先级 2：把 env context 从 workspace context 解耦出来

否则 skill 对 env 的可见性取决于 workspace_path，语义上也不够直观。

---

## 可以直接验证的检查方法

### 方法 1：看 `effective_system_prompt`

调用会话 system prompt snapshot 接口，重点看：

- `effective_system_prompt`

不要只看：

- `workspace_context`

因为当前 `workspace_context` 字段可能被简化。

### 方法 2：检查当前会话是否有 `workspace_path`

如果会话没有 workspace path，那么 env metadata 就不会被拼进 prompt。

### 方法 3：检查你们期待模型知道的是“变量名”还是“变量值”

如果你们期待模型知道 prompt 模板正文、URL、token、具体配置内容，那当前设计本来就做不到。

---

## 最终结论

**一句话总结：**

> 你们的 Env Var 目前“有明确注入到 prompt”，但注入的是安全元信息（name/secret/description），不是实际值；并且这段信息依附于 workspace context。Skill 调用时 AI 如果像“不知道你们定义了哪些 prompt”，更可能是因为它看不到变量值、会话没有 workspace_path、或者你们查看的是被简化过的 snapshot 字段，而不是完整的 effective system prompt。

---

## 建议下一步

如果你愿意，我下一步可以直接帮你做两件事之一：

1. **修代码**：把 `workspace_context` snapshot 改成完整返回 env guidance；
2. **继续排查实际运行现场**：我可以帮你找出当前 UI/请求里到底哪些会话没有带 `workspace_path`，或者直接定位为什么你观察到的 skill 场景里没看到这段 env 提示。
