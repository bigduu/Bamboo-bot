# 光标错位问题 - 根本原因和修复

## 🐛 问题根本原因

**症状**：在高亮的命令文字后面，光标位置错位

**根本原因**：高亮层和 TextArea 的字体设置不一致

### 具体问题

在 `MessageInputField.tsx` 中：

**高亮层（第78行）**：
```typescript
style = {
  fontWeight: 500,  // ❌ 粗体，字符更宽
  ...
}
```

**TextArea（默认）**：
```typescript
fontWeight: 400  // ✅ 正常粗细
```

**结果**：
- 高亮文字：`/skill-name` → 字符变宽（粗体）
- TextArea：字符正常宽度
- 光标位置：基于 TextArea 的字符宽度计算
- 视觉效果：光标错位 ❌

```
视觉显示（高亮层）: /skill-name|检查代码  (字符宽)
实际光标位置（TextArea）: /skill-name|检查代码  (字符窄)
结果: 光标看起来在 "检查" 中间
```

---

## ✅ 修复方案

### 1. 统一字体设置

**修改位置**：`MessageInputField.tsx`

#### 高亮层容器（第54-72行）
```typescript
style={{
  // ... existing styles
  fontFamily: "inherit",      // ✅ 继承 TextArea 字体
  fontWeight: 400,            // ✅ 明确设置为正常粗细
  letterSpacing: "normal",    // ✅ 统一字符间距
  // ...
}}
```

#### Workflow 高亮样式（第74-79行）
```typescript
if (segment.type === "workflow") {
  style = {
    backgroundColor: token.colorPrimaryBg,
    color: token.colorPrimary,
    fontWeight: 400,                    // ✅ 改为 400（之前是 500）
    textDecoration: "underline",        // ✅ 添加虚线下划线保持区分
    textDecorationStyle: "dotted",
  };
}
```

### 2. 视觉区分方案

**之前**（导致错位）：
- Workflow: 粗体（fontWeight: 500）❌

**现在**（不错位）：
- Workflow: 虚线下划线 + 颜色背景 ✅
- 字体粗细保持一致（400）✅

---

## 🎯 修复原理

### 双层结构
```
┌─────────────────────────────────┐
│  Highlight Overlay (顶层)        │  ← 显示高亮文字
│  color: transparent 文字透明     │
│  fontWeight: 400 ← 统一          │
└─────────────────────────────────┘
         ▼ 叠加
┌─────────────────────────────────┐
│  TextArea (底层)                 │  ← 实际输入 + 光标
│  文字透明，光标可见               │
│  fontWeight: 400 (默认)          │
└─────────────────────────────────┘
```

### 关键点
1. **字符宽度必须完全一致**
   - fontSize ✅ 一致
   - fontWeight ✅ 一致（修复后）
   - fontFamily ✅ 一致
   - letterSpacing ✅ 一致

2. **视觉效果通过其他方式实现**
   - ❌ 不使用：粗体、斜体（会改变字符宽度）
   - ✅ 使用：背景色、下划线、边框

---

## 📊 对比

### 修复前 ❌

```
高亮层: /skill-name|检查代码
        ^^^^^^^^^^^ 粗体（宽）
                   ^光标位置

TextArea: /skill-name|检查代码
          ^^^^^^^^^^^ 正常（窄）
                     ^实际光标位置

结果: 光标错位约 5-10px
```

### 修复后 ✅

```
高亮层: /skill-name|检查代码
        ^^^^^^^^^^^ 正常粗细 + 下划线
                   ^光标位置

TextArea: /skill-name|检查代码
          ^^^^^^^^^^^ 正常粗细
                     ^实际光标位置

结果: 光标完美对齐
```

---

## 🧪 测试验证

### 测试1: 选择命令后打字
```
1. 输入: "/test"
2. 选择: builtin-code-review
3. 继续打字: " 检查代码"
4. 期望: 光标位置准确，不错位 ✅
```

### 测试2: 长命令
```
1. 选择: builtin-project-setup
2. 继续打字: " 创建项目"
3. 期望: 光标在整个命令后都准确 ✅
```

### 测试3: 多个高亮
```
1. 输入: "/skill1 /skill2 文字"
2. 期望: 两个高亮后的光标都准确 ✅
```

### 测试4: File reference
```
1. 输入: "@file.txt 文字"
2. 期望: 高亮后的光标准确 ✅
```

---

## 📝 技术总结

### 导致光标错位的 CSS 属性
❌ **不要在高亮层使用**：
- `font-weight: bold/500+`（字符变宽）
- `font-style: italic`（字符变宽）
- `letter-spacing: 2px`（字符间距改变）
- `transform: scaleX(1.1)`（字符拉伸）

✅ **安全使用**：
- `color`（颜色）
- `background-color`（背景）
- `text-decoration`（下划线、删除线）
- `border`（边框）
- `box-shadow`（阴影）

### 最佳实践
1. **确保字体设置完全一致**
   ```css
   font-family: inherit;
   font-size: inherit;
   font-weight: inherit;
   line-height: inherit;
   letter-spacing: inherit;
   ```

2. **使用视觉装饰代替字体变化**
   - 下划线 ✅
   - 背景色 ✅
   - 边框 ✅
   - 阴影 ✅

3. **测试光标对齐**
   - 在高亮文字后打字
   - 检查光标是否准确
   - 测试不同长度的命令

---

## ✅ 修复完成

**修改文件**：
- `src/pages/ChatPage/components/MessageInput/MessageInputField.tsx`

**修改内容**：
1. 高亮层添加 `fontFamily: "inherit"`
2. 高亮层添加 `fontWeight: 400`
3. 高亮层添加 `letterSpacing: "normal"`
4. Workflow 高亮改为虚线下划线（移除粗体）

**预期效果**：
- ✅ 光标位置完美准确
- ✅ 视觉区分仍然清晰（下划线 + 颜色）
- ✅ 打字流畅，无错位感

---

**修复日期**: 2026-02-17
**状态**: ✅ 已修复
**下一步**: 用户测试验证
