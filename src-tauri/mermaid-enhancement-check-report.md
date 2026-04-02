# Mermaid Enhancement 检查报告

## 结论

当前 **Mermaid Enhancement 仍然在生效路径中**，并且从已检查到的本机持久化配置来看，**没有证据表明它当前被真正关闭**。

因此这次检查的判断是：

- **不是“已关闭但仍然绘制 Mermaid，配置失效”**
- 更接近于：**当前默认仍为开启，且你本机前端存储里没有看到 `mermaid_enhancement_enabled=false` 这个关闭标记**

---

## 关键证据

### 1. 前端设置页确实存在 Mermaid Enhancement 开关

文件：`lotus/src/pages/SettingsPage/components/SystemSettingsPage/SystemSettingsPromptsTab.tsx`

可见 UI 中存在：
- `Mermaid Enhancement`
- 对应 `Switch checked={mermaidEnhancementEnabled} onChange={onMermaidToggle}`

说明：
- 功能没有被移除
- UI 层仍支持开/关 Mermaid Enhancement

### 2. Mermaid Enhancement 默认是开启的

文件：`lotus/src/shared/utils/mermaidUtils.ts`

关键逻辑：
- localStorage key: `mermaid_enhancement_enabled`
- `isMermaidEnhancementEnabled()` 返回：
  - `localStorage.getItem(MERMAID_ENHANCEMENT_KEY) !== "false"`

这意味着：
- 只要本地没有明确写入字符串 `false`
- 就会被当作 **开启**

所以它的默认行为不是“关”，而是“开”。

### 3. Mermaid Enhancement 会被真正拼进发送给模型的增强 prompt

文件：`lotus/src/shared/utils/systemPromptEnhancement.ts`

关键逻辑：
- `getSystemPromptEnhancementText()` 中：
  - 如果 `isMermaidEnhancementEnabled()` 为真
  - 则 `pipeline.push(getMermaidEnhancementPrompt().trim())`

说明：
- Mermaid Enhancement 不是只在 UI 上显示
- 它确实会进入系统增强 prompt 管线

### 4. 聊天发送链路会把这个增强 prompt 发给后端

文件：`lotus/src/pages/ChatPage/hooks/useChatManager/useMessageStreaming.ts`

关键逻辑：
- `const enhancePrompt = getSystemPromptEnhancementText(currentProvider).trim();`
- 发送消息时：
  - `enhance_prompt: enhancePrompt || undefined`

说明：
- 当前前端在发消息时，确实会把 Mermaid Enhancement 拼进 `enhance_prompt`
- 所以如果它是开启状态，就会影响模型输出 Mermaid diagram

### 5. 设置页切换 Mermaid 开关时，确实会写 localStorage

文件：`lotus/src/pages/SettingsPage/components/SystemSettingsPage/index.tsx`

关键逻辑：
- `handleMermaidToggle(checked)`
- 内部调用：`setMermaidEnhancementEnabled(checked)`

说明：
- 理论上只要你在 UI 中关闭了开关
- 应该会把 `mermaid_enhancement_enabled=false` 写入本地存储

### 6. 这台 macOS 机器上实际有 Bodhi/Tauri WebKit localStorage 数据

检查到的有效数据库：
- `/Users/bigduu/Library/WebKit/bodhi/WebsiteData/Default/Yv1mgedppbWly9CzSxEmC2NRw55FBbo821suyGkRQ4g/Yv1mgedppbWly9CzSxEmC2NRw55FBbo821suyGkRQ4g/LocalStorage/localstorage.sqlite3`

该库中确实有大量 Bodhi 前端数据，例如：
- `bodhi-ui-config`
- `app_config_ui`
- `app_config_storage`
- `chat_sessions`
- `bamboo_system_prompt_enhancement`
- `copilot_last_selected_prompt_id`

这说明：
- 查到的是 **正确的 Bodhi 前端 localStorage 库**
- 不是空库，也不是误查到的 WebInspector 测试库

### 7. 在已确认的 Bodhi localStorage 库里，没有查到 `mermaid_enhancement_enabled`

精确查询结果显示：
- 查到了 `bamboo_system_prompt_enhancement`
- 查到了 `copilot_ask_user_enhancement_enabled`
- **没有查到** `mermaid_enhancement_enabled`
- **没有查到** `task_enhancement_enabled`

这非常关键，代表：
- 当前本机前端存储里，**没有记录 Mermaid 被显式关闭**
- 由于默认逻辑是“只要不是 false 就当开启”
- 所以当前状态会被解释成：**Mermaid Enhancement 开启**

---

## 对“是否失效”的判断

### 当前更合理的判断

**Mermaid Enhancement 没有失效。**

更准确地说：
- 代码链路正常
- UI 开关存在
- 发消息时确实会带上增强 prompt
- 本地存储里没有 `mermaid_enhancement_enabled=false`
- 所以当前仍会鼓励模型输出 Mermaid diagram

### 什么时候才算“配置失效”

如果出现以下情况，才更像“失效”：
1. 你在 UI 里明确把 Mermaid Enhancement 关掉了
2. 但 localStorage 已经存在 `mermaid_enhancement_enabled=false`
3. 同时发消息时仍然继续拼接 Mermaid enhancement prompt

本次检查 **没有发现这种证据**。

---

## 最终结论（一句话）

**当前 Mermaid Enhancement 不是关闭状态；它仍在生效，而且从现有证据看，不是配置失效，而是本机并没有真正保存成关闭。**

---

## 如果你要继续验证

建议做一次最小复现：

1. 打开 Settings → Prompts
2. 关闭 `Mermaid Enhancement`
3. 完全退出并重开应用
4. 再检查 WebKit localStorage 是否出现：
   - `mermaid_enhancement_enabled = false`
5. 再发一条让 AI 解释流程/架构的消息，看是否还会主动生成 Mermaid

如果你需要，我下一步可以继续帮你做两件事之一：

1. **直接定位为什么 UI 关闭后没有把 `mermaid_enhancement_enabled=false` 落盘**
2. **帮你写一个自动化脚本/测试，验证 Mermaid Enhancement 开关是否真正生效**
