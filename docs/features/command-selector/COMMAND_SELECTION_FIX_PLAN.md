# Command Selection Issues - 修复方案

## 问题总结

### 问题1：选择命令时清空已有输入
**现状**：
```
输入: "帮我检查代码"
选择: builtin-code-review
结果: "/builtin-code-review "  ❌ 丢失了"帮我检查代码"
```

**期望**：
```
输入: "帮我检查代码"
选择: builtin-code-review
结果: "/builtin-code-review 帮我检查代码"  ✅
```

### 问题2：选择命令后光标错位
**现状**：
- 选择命令后，光标位置不正确
- 输入高亮层和实际文字层不同步
- 打字时位置错乱

**期望**：
- 选择命令后，光标应该在新内容的末尾
- 高亮层应该立即同步
- 打字流畅，无错位

---

## 修复方案

### 方案1：智能插入命令（不清空已有内容）

#### 1.1 检测当前输入状态

```typescript
const applyCommandDraft = useCallback(
  async (command: CommandItem) => {
    setShowCommandSelector(false);

    // 获取当前输入框的光标位置
    const textArea = textAreaRef.current?.resizableTextArea?.textArea;
    const currentValue = content;  // 当前输入框的值
    const cursorPosition = textArea?.selectionStart || currentValue.length;

    // 智能插入策略
    let newValue: string;
    let newCursorPos: number;

    if (currentValue.trim() === '') {
      // 情况1：输入框为空，直接设置
      newValue = `/${command.name} `;
      newCursorPos = newValue.length;
    } else if (currentValue.match(/^\/[a-zA-Z0-9_-]*$/)) {
      // 情况2：已经有一个未完成的命令（如 "/code"），替换它
      newValue = `/${command.name} `;
      newCursorPos = newValue.length;
    } else if (cursorPosition === 0) {
      // 情况3：光标在开头，插入到前面
      newValue = `/${command.name} ${currentValue}`;
      newCursorPos = `/${command.name} `.length;
    } else {
      // 情况4：光标在中间或末尾，插入到光标位置
      const before = currentValue.substring(0, cursorPosition);
      const after = currentValue.substring(cursorPosition);
      newValue = `${before}/${command.name} ${after}`;
      newCursorPos = `${before}/${command.name} `.length;
    }

    // 更新内容
    setContent(newValue);

    // 更新光标位置（需要在下一个事件循环）
    setTimeout(() => {
      if (textArea) {
        textArea.selectionStart = newCursorPos;
        textArea.selectionEnd = newCursorPos;
        textArea.focus();
      }
    }, 0);

    // ... 后续处理 skill/workflow/mcp
  },
  [content, setContent, textAreaRef]
);
```

#### 1.2 不同场景的处理

| 场景 | 当前内容 | 光标位置 | 选择命令后 | 新光标位置 |
|------|---------|---------|-----------|-----------|
| 空输入 | `""` | 0 | `"/skill "` | 7 |
| 替换未完成命令 | `"/cod"` | 4 | `"/builtin-code-review "` | 22 |
| 开头插入 | `"帮我检查"` | 0 | `"/skill 帮我检查"` | 7 |
| 中间插入 | `"帮我 检查"` | 3 | `"帮我/skill 检查"` | 10 |
| 末尾插入 | `"帮我检查"` | 4 | `"帮我检查/skill "` | 11 |

---

### 方案2：修复光标位置同步

#### 2.1 在 MessageInputField 中添加光标同步

```typescript
// MessageInputField.tsx

interface MessageInputFieldProps {
  // ... existing props
  cursorPosition?: number;  // 新增：光标位置
  onCursorPositionChange?: (pos: number) => void;  // 新增：光标变化回调
}

const MessageInputField: React.FC<MessageInputFieldProps> = ({
  value,
  cursorPosition,
  // ...
}) => {
  const textAreaRef = React.useRef<TextAreaRef>(null);

  // 监听外部光标位置变化
  React.useEffect(() => {
    if (cursorPosition !== undefined && textAreaRef.current) {
      const textArea = textAreaRef.current.resizableTextArea?.textArea;
      if (textArea) {
        textArea.selectionStart = cursorPosition;
        textArea.selectionEnd = cursorPosition;
        textArea.focus();
      }
    }
  }, [cursorPosition]);

  // 监听内部光标变化
  const handleSelect = () => {
    if (textAreaRef.current && onCursorPositionChange) {
      const textArea = textAreaRef.current.resizableTextArea?.textArea;
      if (textArea) {
        onCursorPositionChange(textArea.selectionStart);
      }
    }
  };

  return (
    <TextArea
      ref={textAreaRef}
      value={value}
      onSelect={handleSelect}
      // ...
    />
  );
};
```

#### 2.2 在 InputContainer 中管理光标状态

```typescript
// InputContainer/index.tsx

const [cursorPosition, setCursorPosition] = useState<number | undefined>();

// 在 useInputContainerCommand 中使用
const applyCommandDraft = useCallback(
  async (command: CommandItem) => {
    // ... 智能插入逻辑

    // 设置新的光标位置
    setCursorPosition(newCursorPos);

    // ...
  },
  [setCursorPosition]
);

// 传递给 MessageInput
<MessageInput
  value={content}
  cursorPosition={cursorPosition}
  onCursorPositionChange={setCursorPosition}
  // ...
/>
```

---

### 方案3：高亮层同步优化

#### 3.1 使用 requestAnimationFrame 确保同步

```typescript
// MessageInputField.tsx

React.useEffect(() => {
  if (showHighlightOverlay) {
    // 确保 highlight overlay 在下一帧渲染
    requestAnimationFrame(() => {
      syncOverlayScroll();
    });
  }
}, [value, showHighlightOverlay, syncOverlayScroll]);
```

#### 3.2 使用 CSS transform 代替 top/left

当前实现（行69）：
```typescript
transform: "translate(0, 0)"  // ✅ 已经使用了 transform
```

这已经是最佳实践，无需修改。

---

## 推荐实施顺序

### Phase 1: 修复清空问题（优先级：高）
1. ✅ 实现智能插入逻辑
2. ✅ 处理不同场景（空、开头、中间、末尾）
3. ✅ 替换未完成的命令

### Phase 2: 修复光标错位（优先级：中）
1. ✅ 添加光标位置状态管理
2. ✅ 在选择命令后正确设置光标
3. ✅ 确保 focus 在输入框上

### Phase 3: 优化高亮同步（优先级：低）
1. ✅ 使用 requestAnimationFrame
2. ✅ 测试各种边界情况

---

## 边界情况测试

### 测试1：空输入选择命令
```
输入: ""
操作: 选择 skill
期望: "/skill-name " 光标在末尾
```

### 测试2：已有内容开头选择
```
输入: "检查代码"
光标: |检查代码 (开头)
操作: 选择 skill
期望: "/skill-name 检查代码" 光标在中间
```

### 测试3：已有内容末尾选择
```
输入: "帮我"
光标: 帮我| (末尾)
操作: 选择 skill
期望: "帮我/skill-name " 光标在新末尾
```

### 测试4：替换未完成命令
```
输入: "/cod"
操作: 选择 "builtin-code-review"
期望: "/builtin-code-review " 替换了 /cod
```

### 测试5：中间插入
```
输入: "帮我 检查代码"
光标: 帮我| 检查代码 (中间空格处)
操作: 选择 skill
期望: "帮我/skill-name 检查代码"
```

---

## 实施建议

### 最小修复（推荐先做）
只修复问题1（清空问题）：
- 在 `applyCommandDraft` 中实现智能插入
- 保留光标在末尾的简单逻辑
- 测试验证

### 完整修复（推荐后做）
修复问题1 + 问题2（光标错位）：
- 添加光标位置管理
- 实现精确的光标控制
- 完善高亮同步

---

## 相关文件

需要修改的文件：
1. `src/pages/ChatPage/components/InputContainer/useInputContainerCommand.ts`
2. `src/pages/ChatPage/components/InputContainer/index.tsx`
3. `src/pages/ChatPage/components/MessageInput/index.tsx`
4. `src/pages/ChatPage/components/MessageInput/MessageInputField.tsx`

---

**创建日期**: 2026-02-17
**优先级**: 高
**状态**: 待实施
