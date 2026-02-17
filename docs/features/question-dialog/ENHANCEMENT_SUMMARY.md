# QuestionDialog Component Enhancement

## Summary

Enhanced QuestionDialog component to improve positioning, color contrast, and theme integration using Ant Design's theme system.

**Date**: 2026-02-17
**Status**: ✅ Complete
**Issues Addressed**:
1. Poor positioning - displayed at top of chat view instead of near input
2. Low contrast in dark theme - text difficult to read on dark background
3. Hardcoded colors - not integrated with theme system

## Component Overview

QuestionDialog is an interactive component that displays when the AI agent needs user input to proceed with a task. It presents:
- A question from the AI
- Predefined options (radio buttons)
- Optional custom input field
- Submit button

### Use Cases
- Agent requests clarification
- Multiple choice decisions
- Tool parameter input
- Workflow step selection

## Problem Analysis

### Before Fix

#### 1. Positioning Issue
```
Layout:
┌─────────────────────────────────┐
│ TodoList                        │
├─────────────────────────────────┤
│ QuestionDialog (HERE)           │ ← Too far from input
├─────────────────────────────────┤
│ TokenUsage Display              │
├─────────────────────────────────┤
│                                 │
│ Chat Messages                   │
│                                 │
├─────────────────────────────────┤
│ Input Area                      │
└─────────────────────────────────┘
```

#### 2. Color Issues

Hardcoded gradient backgrounds and colors:

**Light Theme**:
```css
background: linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%);
border: 1px solid #e8e8e8;
color: #262626;
```

**Dark Theme**:
```css
background: linear-gradient(135deg, #1f1f1f 0%, #141414 100%);
border-color: #333;
color: #e0e0e0;
```

**Issues**:
- Dark gradient (#1f1f1f to #141414) had poor contrast
- Text color #e0e0e0 barely visible on dark background
- Hardcoded colors don't adapt to theme
- Gradient backgrounds add complexity

## Solution

### 1. Reposition Component

Moved QuestionDialog from above chat messages to directly above input area:

```diff
Layout:
┌─────────────────────────────────┐
│ TodoList                        │
├─────────────────────────────────┤
│ TokenUsage Display              │
├─────────────────────────────────┤
│                                 │
│ Chat Messages                   │
│                                 │
├─────────────────────────────────┤
+│ QuestionDialog (NEW POSITION)  │ ← Close to input
+├─────────────────────────────────┤
│ Input Area                      │
└─────────────────────────────────┘
```

### 2. Remove Hardcoded Colors

Removed all hardcoded background gradients and colors from CSS:

```css
/* REMOVED */
.questionCard {
  background: linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%);
  border: 1px solid #e8e8e8;
}

.questionTitle {
  color: #1890ff !important;
}

.questionText {
  color: #262626;
}

.optionItem {
  background: #fff;
  border: 1px solid #f0f0f0;
}

/* Dark mode overrides removed */
@media (prefers-color-scheme: dark) {
  .questionCard {
    background: linear-gradient(135deg, #1f1f1f 0%, #141414 100%);
    border-color: #333;
  }
  /* ... */
}
```

### 3. Apply Theme Tokens

Used Ant Design theme tokens in JSX:

```tsx
<Card
  className={styles.questionCard}
  bordered={true}
  style={{
    background: token.colorBgContainer,
    borderColor: token.colorBorderSecondary,
  }}
>
  <Title
    level={5}
    style={{
      color: token.colorPrimary,
    }}
  >
    🤔 AI Needs Your Decision
  </Title>

  <Text
    style={{
      color: token.colorText,
    }}
  >
    {question}
  </Text>

  <Radio
    style={{
      background: token.colorBgContainer,
      borderColor: token.colorBorderSecondary,
    }}
  >
    <Text style={{ color: token.colorText }}>{option}</Text>
  </Radio>
</Card>
```

### Theme Token Mapping

| Element | Token | Purpose |
|---------|-------|---------|
| Card Background | `token.colorBgContainer` | Container background |
| Card Border | `token.colorBorderSecondary` | Subtle border |
| Title Text | `token.colorPrimary` | Brand color for emphasis |
| Question Text | `token.colorText` | Primary text color |
| Option Background | `token.colorBgContainer` | Consistent background |
| Option Border | `token.colorBorderSecondary` | Subtle border |
| Option Text | `token.colorText` | Primary text color |
| Dividers | `token.colorBorderSecondary` | Section separators |

## Implementation Details

### Files Modified

1. **`src/components/QuestionDialog/QuestionDialog.module.css`**
   - Removed gradient backgrounds
   - Removed all hardcoded colors
   - Removed dark mode media query overrides
   - Kept layout and spacing styles

2. **`src/components/QuestionDialog/QuestionDialog.tsx`**
   - Added `const { token } = useToken()` hook
   - Applied theme tokens to all colored elements
   - Used inline styles for theme-aware colors

3. **`src/pages/ChatPage/components/ChatView/index.tsx`**
   - Moved QuestionDialog from above messages to above input area
   - Ensured consistent padding with input area

### Code Structure

```tsx
export const QuestionDialog: React.FC<QuestionDialogProps> = ({
  sessionId,
  onResponseSubmitted,
}) => {
  const { token } = useToken();  // ← Theme token access

  // ... state management

  return (
    <Card
      style={{
        background: token.colorBgContainer,  // ← Theme-aware
        borderColor: token.colorBorderSecondary,
      }}
    >
      {/* Content with theme-aware colors */}
    </Card>
  );
};
```

## Benefits

### ✅ Better Positioning
- Appears directly above input area
- Users notice it immediately when they need to respond
- Natural flow: read question → look down → see input area

### ✅ Improved Contrast
- **Light theme**: Clean backgrounds with proper text contrast
- **Dark theme**: Light text on dark background, clearly visible
- **Selected/hover states**: Consistent visibility across states

### ✅ Theme Integration
- Automatic theme switching
- Consistent with application design
- Single source of truth for colors

### ✅ Simplified Codebase
- No duplicate dark mode styles
- Removed complex gradient logic
- Cleaner, more maintainable CSS

## Visual Comparison

### Before
```
┌─────────────────────────────────────┐
│ Gradient background (complex)       │
│ Hardcoded colors                    │
│ Poor contrast in dark mode          │
│ Positioned far from input           │
└─────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────┐
│ Solid theme background (simple)     │
│ Theme-aware colors                  │
│ Excellent contrast all modes        │
│ Positioned near input               │
└─────────────────────────────────────┘
```

## Testing Checklist

### Functionality
- [ ] Dialog appears when agent needs input
- [ ] Options display correctly
- [ ] Custom input field works when enabled
- [ ] Submit button works correctly
- [ ] Polling continues appropriately

### Visual - Light Theme
- [ ] Background is light and clean
- [ ] Text is dark and clearly readable
- [ ] Options have good contrast
- [ ] Borders are subtle but visible
- [ ] Selected state is clear

### Visual - Dark Theme
- [ ] Background is dark
- [ ] Text is light and clearly readable
- [ ] Options maintain visibility
- [ ] No low-contrast issues
- [ ] Selected state visible

### Positioning
- [ ] Dialog appears above input area
- [ ] Not blocked by other UI elements
- [ ] Responsive on different screen sizes
- [ ] Proper spacing from input

### Theme Switching
- [ ] Colors update immediately
- [ ] No visual glitches
- [ ] All states remain functional

## Usage Example

```tsx
// In ChatView component
{agentSessionId && (
  <div
    style={{
      padding: `0 ${getContainerPadding()}px`,
      maxWidth: showMessagesView ? getContainerMaxWidth() : "100%",
      margin: "0 auto",
      width: "100%",
    }}
  >
    <QuestionDialog sessionId={agentSessionId} />
  </div>
)}
```

## Related Documentation

- [Command Selector Theme Enhancement](../command-selector/THEME_SYSTEM_ENHANCEMENT.md)
- [Ant Design Theme System](https://ant.design/docs/react/customize-theme)
- [Agent Loop Architecture](../../architecture/AGENT_LOOP_ARCHITECTURE.md)

## Future Enhancements

Potential improvements:
1. Animation when dialog appears/disappears
2. Sound notification for new questions
3. Keyboard shortcuts for quick option selection
4. Markdown rendering in question text
5. Collapsible question history

---

**Created**: 2026-02-17
**Author**: Claude Code
**Review Status**: Ready for review
**Component Location**: `src/components/QuestionDialog/`
