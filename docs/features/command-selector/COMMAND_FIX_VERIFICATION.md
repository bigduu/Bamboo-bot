# Command Selection - 修复验证

## ✅ 已实施的修复

### 1. 智能插入命令（不清空已有内容）

**修复位置**: `useInputContainerCommand.ts` - `applyCommandDraft` 函数

**实现的场景**:

#### 场景1: 替换未完成的命令
```
输入: "/cod"
光标: "/cod|"
选择: builtin-code-review
结果: "/builtin-code-review |" ✅
```

#### 场景2: 光标位置插入
```
输入: "请帮我 检查代码"
光标: "请帮我 |检查代码"
选择: builtin-code-review
结果: "请帮我 /builtin-code-review |检查代码" ✅
```

#### 场景3: 空输入
```
输入: ""
选择: builtin-code-review
结果: "/builtin-code-review |" ✅
```

#### 场景4: 末尾插入
```
输入: "请帮我"
光标: "请帮我|"
选择: builtin-code-review
结果: "请帮我/builtin-code-review |" ✅
```

---

### 2. 光标位置同步

**修复位置**: `useInputContainerCommand.ts` - `applyCommandDraft` 函数

**实现**:
```typescript
// 在更新内容后，设置光标位置
setTimeout(() => {
  if (textArea) {
    textArea.selectionStart = newCursorPos;
    textArea.selectionEnd = newCursorPos;
    textArea.focus();
  }
}, 0);
```

**解决的问题**:
- ✅ 光标位置不再错位
- ✅ 自动聚焦到输入框
- ✅ 高亮层和文字层同步

---

## 🔧 修改的文件

### 1. InputContainer/index.tsx
- ✅ 添加 `textAreaRef` 引用
- ✅ 添加 `TextAreaRef` 类型导入
- ✅ 传递 `textAreaRef` 和 `content` 给 `useInputContainerCommand`
- ✅ 传递 `textAreaRef` 给 `MessageInput`

### 2. useInputContainerCommand.ts
- ✅ 接收 `textAreaRef` 和 `content` 参数
- ✅ 实现智能插入逻辑（3种场景）
- ✅ 计算新的光标位置
- ✅ 在 setTimeout 中设置光标位置

### 3. MessageInput/index.tsx
- ✅ 添加 `textAreaRef` prop
- ✅ 支持外部 ref 或使用内部 ref

---

## 🧪 测试步骤

### 测试1: 光标位置插入
1. 在输入框输入: "请帮我 检查代码"
2. 将光标移动到 "请帮我 |检查代码"（在空格处）
3. 按 `/` 触发命令选择器
4. 选择 `builtin-code-review`
5. **期望结果**:
   - 输入框内容: "请帮我 /builtin-code-review 检查代码"
   - 光标位置: 在 "请帮我 /builtin-code-review |检查代码"
   - 没有清空已有文字

### 测试2: 替换未完成命令
1. 在输入框输入: "/cod"
2. 按 `/` 触发命令选择器（或者直接选择）
3. 选择 `builtin-code-review`
4. **期望结果**:
   - 输入框内容: "/builtin-code-review "
   - 光标位置: 在末尾
   - 原来的 "/cod" 被替换

### 测试3: 空输入选择
1. 清空输入框
2. 按 `/` 触发命令选择器
3. 选择任意 skill
4. **期望结果**:
   - 输入框内容: "/skill-name "
   - 光标位置: 在末尾

### 测试4: 末尾插入
1. 在输入框输入: "请帮我"
2. 光标在末尾: "请帮我|"
3. 按 `/` 触发命令选择器
4. 选择任意 skill
5. **期望结果**:
   - 输入框内容: "请帮我/skill-name "
   - 光标位置: 在新末尾

### 测试5: 光标不错位
1. 选择任意 skill
2. 继续打字
3. **期望结果**:
   - 光标位置正确
   - 文字出现在光标位置
   - 高亮层同步显示

### 测试6: Workflow 预览
1. 选择 `test-workflow`
2. **期望结果**:
   - 输入框: "/test-workflow "
   - 预览区显示 workflow 内容
   - 光标在末尾

### 测试7: Skill 无预览
1. 选择任意 skill
2. **期望结果**:
   - 输入框: "/skill-name "
   - 没有预览
   - 光标在末尾

---

## 🐛 如果还有问题

### 问题A: 光标仍然错位
**检查**:
- 浏览器控制台是否有错误
- `textAreaRef.current` 是否为 null
- setTimeout 是否执行

**调试**:
```typescript
console.log('Text area:', textArea);
console.log('New cursor pos:', newCursorPos);
console.log('Selection start:', textArea.selectionStart);
```

### 问题B: 内容仍然被清空
**检查**:
- `content` 参数是否正确传递
- `cursorPosition` 是否正确计算
- `commandMatch` 正则是否匹配

**调试**:
```typescript
console.log('Current content:', content);
console.log('Cursor position:', cursorPosition);
console.log('Command match:', commandMatch);
console.log('New value:', newValue);
```

### 问题C: 高亮不同步
**可能原因**:
- Highlight overlay 渲染延迟
- CSS transform 没有正确应用

**解决**:
- 检查 `MessageInputField.tsx` 的 `showHighlightOverlay` 逻辑
- 检查 `syncOverlayScroll` 函数

---

## 📊 预期行为对比

| 场景 | 之前 ❌ | 现在 ✅ |
|------|--------|--------|
| 已有内容 + 选择命令 | 清空所有内容 | 保留内容，插入命令 |
| 光标位置 | 错位或不正确 | 精确在插入点后 |
| 替换未完成命令 | 保留旧命令 | 替换为新命令 |
| 高亮同步 | 延迟或错位 | 立即同步 |
| 继续打字 | 位置错乱 | 流畅正常 |

---

## ✅ 验证清单

- [ ] 场景1: 替换未完成命令 ✅
- [ ] 场景2: 光标位置插入 ✅
- [ ] 场景3: 空输入选择 ✅
- [ ] 场景4: 末尾插入 ✅
- [ ] 光标位置正确 ✅
- [ ] 高亮同步显示 ✅
- [ ] 无控制台错误 ✅
- [ ] Workflow 显示预览 ✅
- [ ] Skill 不显示预览 ✅
- [ ] 继续打字流畅 ✅

---

**修复日期**: 2026-02-17
**状态**: ✅ 已实施，待测试
**下一步**: 用户测试验证
