# Command Selector Enhancement - 显式命令选择提示

## 📝 增强说明

当用户通过 `/command-name` 显式选择命令时，系统现在会根据命令类型添加不同的提示信息，帮助 AI 更准确地理解用户意图。

---

## 🎯 行为对比

### Before (之前)

```
用户输入: /builtin-code-review 检查这段代码
发送内容: /builtin-code-review 检查这段代码
AI 理解: 需要从上下文中推断用户意图
```

### After (现在)

```
用户输入: /builtin-code-review 检查这段代码
发送内容: [User explicitly selected skill: Code Review (Category: development)]
         检查这段代码
AI 理解: 明确知道用户选择了 Code Review skill，应该使用它
```

---

## 📋 不同类型的处理

### 📁 Workflow
**行为**: 加载完整内容并替换

```
用户输入: /test-workflow 分析需求
发送内容: # Test Workflow

This is a test workflow for verifying the command selector functionality.

## Purpose
Test that workflows appear correctly in the unified command selector.

## Steps
1. Analyze the user's request
2. Provide helpful guidance
3. Suggest next steps

分析需求
```

**原因**: Workflow 不会预加载到 tool context，需要显式提供完整内容。

---

### ⚡ Skill
**行为**: 添加明确的选择提示

```
用户输入: /builtin-code-review 检查这段代码
发送内容: [User explicitly selected skill: Code Review (Category: development)]
         检查这段代码
```

**格式**:
```
[User explicitly selected skill: {displayName} (Category: {category})]
```

**原因**:
- Skills 已经通过 `build_skill_context()` 在 system prompt 中
- AI 可以自动匹配并读取 skill 文件
- 显式提示帮助 AI 快速定位到正确的 skill

---

### 🔌 MCP Tool
**行为**: 添加明确的选择提示

```
用户输入: /analyze-image 分析这张图片
发送内容: [User explicitly selected MCP tool: analyze-image]
         分析这张图片
```

**格式**:
```
[User explicitly selected MCP tool: {displayName}]
```

**原因**:
- MCP tools 已经注册在可用工具列表中
- AI 可以直接调用这些工具
- 显式提示告诉 AI 用户希望使用哪个工具

---

## 🔧 实现细节

### 1. 扩展 WorkflowDraft 类型

```typescript
export type WorkflowDraft = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  type?: 'workflow' | 'skill' | 'mcp';  // 命令类型
  displayName?: string;  // 显示名称（用于提示）
  category?: string;  // 分类（用于 skill 提示）
};
```

### 2. useInputContainerCommand 改动

```typescript
if (command.type !== 'workflow') {
  // Skills and MCP: store command info but no content preview
  const draft: WorkflowDraft = {
    id: `command-draft-${command.id}`,
    name: command.name,
    content: '',  // No content preview
    createdAt: new Date().toISOString(),
    type: command.type,
    displayName: command.displayName,
    category: command.category,
  };
  setSelectedCommand(draft);
  onWorkflowDraftChange?.(draft);
  return;
}
```

### 3. useInputContainerSubmit 改动

```typescript
// Workflow: replace with content
if (selectedWorkflow?.type === 'workflow') {
  composedInput = [selectedWorkflow.content, extraInput].join("\n\n");
}
// Skill: add selection hint
else if (selectedWorkflow?.type === 'skill') {
  const skillHint = `[User explicitly selected skill: ${selectedWorkflow.displayName}${category ? ` (Category: ${category})` : ''}]`;
  composedInput = [skillHint, extraInput].join("\n\n");
}
// MCP: add selection hint
else if (selectedWorkflow?.type === 'mcp') {
  const mcpHint = `[User explicitly selected MCP tool: ${selectedWorkflow.displayName}]`;
  composedInput = [mcpHint, extraInput].join("\n\n");
}
```

---

## 🎨 用户体验流程

### 示例 1: 使用 Skill

1. **用户输入**: `/` 打开命令选择器
2. **选择**: 点击 `builtin-code-review` (⚡ Skill)
3. **输入框显示**: `/builtin-code-review `
4. **输入内容**: `请检查这个函数的性能`
5. **发送后的实际内容**:
   ```
   [User explicitly selected skill: Code Review (Category: development)]
   请检查这个函数的性能
   ```

### 示例 2: 使用 Workflow

1. **用户输入**: `/` 打开命令选择器
2. **选择**: 点击 `test-workflow` (📁 Workflow)
3. **输入框显示**: `/test-workflow `
4. **预览区显示**: 完整的 workflow markdown 内容
5. **输入内容**: `用户认证系统`
6. **发送后的实际内容**:
   ```
   # Test Workflow

   ## Purpose
   Test that workflows...

   ## Steps
   1. Analyze the user's request
   ...

   用户认证系统
   ```

### 示例 3: 使用 MCP Tool

1. **用户输入**: `/` 打开命令选择器
2. **选择**: 点击 `analyze-image` (🔌 MCP)
3. **输入框显示**: `/analyze-image `
4. **输入内容**: `这张图显示了什么？`
5. **发送后的实际内容**:
   ```
   [User explicitly selected MCP tool: analyze-image]
   这张图显示了什么？
   ```

---

## ✅ 优势

### 1. 明确的意图表达
- AI 不需要猜测用户选择的是哪个 skill/tool
- 减少误判和错误的命令匹配

### 2. 更好的上下文理解
- Category 信息帮助 AI 理解 skill 的应用场景
- Display name 提供更友好的提示

### 3. 保持系统一致性
- Workflow: 完整内容替换（原有行为）
- Skill/MCP: 添加提示（新增强）
- 三种类型有清晰的不同处理逻辑

### 4. 向后兼容
- 不影响现有的 workflow 功能
- 不影响 AI 自动匹配 skill 的能力
- 用户仍然可以不使用 `/` 直接提问

---

## 🧪 测试场景

### 测试 1: Skill 选择
```bash
# 输入
/builtin-code-review 检查这个函数

# 期望发送内容
[User explicitly selected skill: Code Review (Category: development)]
检查这个函数
```

### 测试 2: Workflow 选择
```bash
# 输入
/test-workflow 实现用户登录

# 期望发送内容
# Test Workflow
... workflow 完整内容 ...

实现用户登录
```

### 测试 3: MCP Tool 选择
```bash
# 输入
/analyze-image 描述这张图

# 期望发送内容
[User explicitly selected MCP tool: analyze-image]
描述这张图
```

### 测试 4: 不选择命令（对照组）
```bash
# 输入
检查这个函数的代码质量

# 期望发送内容
检查这个函数的代码质量

# AI 会自动从 system context 匹配相关 skill
```

---

## 📊 对比分析

| 特性 | Workflow | Skill | MCP Tool |
|------|----------|-------|----------|
| 内容预览 | ✅ 显示完整内容 | ❌ 不显示 | ❌ 不显示 |
| 发送时处理 | 内容替换 | 添加提示 | 添加提示 |
| System Context | ❌ 不预加载 | ✅ 元数据已加载 | ✅ Tools 已注册 |
| AI 可见性 | 仅发送时 | 始终可见 | 始终可见 |
| 主要用途 | 流程指导 | 领域专家 | 工具调用 |

---

## 🚀 下一步优化方向

### 1. 多命令组合
```
/builtin-code-review /analyze-image 检查代码和截图
```

### 2. 命令参数
```
/builtin-code-review --focus=performance 检查这段代码
```

### 3. 历史记录
记录用户常用的命令，提供智能推荐

### 4. 命令别名
```
/cr → builtin-code-review
/review → builtin-code-review
```

---

## 📝 总结

这个增强显著改善了用户体验：

✅ **明确性**: 用户意图清晰传达给 AI
✅ **一致性**: 三种命令类型有统一的处理框架
✅ **智能性**: AI 可以更好地理解和使用用户选择的命令
✅ **可扩展性**: 为未来的命令增强奠定基础

**实现日期**: 2026-02-17
**版本**: v1.0.0
**状态**: ✅ 已实现并测试
