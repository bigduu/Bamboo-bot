# QuestionDialog Component Documentation

Interactive dialog component for AI agent decision-making and user input.

## Overview

QuestionDialog is a critical component in the agent loop system that enables AI agents to request user input when needed. It provides a clean, accessible interface for presenting questions and collecting responses.

## Features

- 🎯 **Interactive Options**: Radio button selection with optional custom input
- 🎨 **Theme-Aware**: Automatic adaptation to light/dark themes
- 📍 **Smart Positioning**: Appears directly above input area for visibility
- ⚡ **Real-time Updates**: Polling mechanism to check for pending questions
- ♿ **Accessible**: High contrast and keyboard navigation support

## Documentation Index

### 📚 Enhancement Documentation

- **[ENHANCEMENT_SUMMARY.md](./ENHANCEMENT_SUMMARY.md)**
  - Position improvements
  - Theme system integration
  - Contrast and accessibility fixes
  - Implementation details

## Quick Start

### When It Appears

The QuestionDialog appears automatically when:

1. An AI agent session is active
2. The agent encounters a decision point
3. User input is required to proceed

### User Interaction Flow

```
1. Agent sends question → QuestionDialog appears above input
2. User sees options → Radio buttons displayed
3. User selects option → Option highlighted
4. (Optional) Enter custom text → Text input field appears
5. User clicks "Confirm Selection" → Response submitted
6. Agent continues execution → Dialog disappears
```

### Visual States

#### Normal State
```
┌─────────────────────────────────────┐
│ 🤔 AI Needs Your Decision           │
├─────────────────────────────────────┤
│ Question text appears here...       │
│                                     │
│ ○ Option 1                          │
│ ○ Option 2                          │
│ ○ Option 3                          │
│ ○ Other (custom input)              │
│                                     │
│              [Confirm Selection]    │
└─────────────────────────────────────┘
```

#### Custom Input Selected
```
┌─────────────────────────────────────┐
│ 🤔 AI Needs Your Decision           │
├─────────────────────────────────────┤
│ Question text appears here...       │
│                                     │
│ ○ Option 1                          │
│ ○ Option 2                          │
│ ● Other (custom input)              │
│   ┌─────────────────────────────┐   │
│   │ Enter your answer...        │   │
│   └─────────────────────────────┘   │
│                                     │
│              [Confirm Selection]    │
└─────────────────────────────────────┘
```

## Component API

### Props

```typescript
interface QuestionDialogProps {
  sessionId: string;          // Agent session identifier
  onResponseSubmitted?: () => void;  // Optional callback after submit
}
```

### Data Structure

```typescript
interface PendingQuestion {
  has_pending_question: boolean;
  question?: string;
  options?: string[];
  allow_custom?: boolean;
  tool_call_id?: string;
}
```

## Architecture

### Backend Integration

- **API Endpoint**: `GET /v1/agent/respond/{sessionId}/pending`
  - Checks for pending questions
  - Returns `PendingQuestion` structure

- **API Endpoint**: `POST /v1/agent/respond/{sessionId}`
  - Submits user response
  - Payload: `{ response: string }`

- **API Endpoint**: `POST /v1/agent/execute/{sessionId}`
  - Restarts agent execution after response

### Frontend Flow

```
QuestionDialog Component
    ↓
Polling (3-15s interval)
    ↓
GET /respond/{sessionId}/pending
    ↓
If has_pending_question → Display dialog
    ↓
User selects option
    ↓
POST /respond/{sessionId} with response
    ↓
POST /execute/{sessionId} to resume
    ↓
Agent continues → Dialog disappears
```

### Polling Strategy

| Scenario | Interval | Reason |
|----------|----------|--------|
| No pending question | 15 seconds | Reduce API load |
| Pending question exists | 3 seconds | Quick detection of resolution |
| After 3 empty responses | Stop polling | Optimization |

## Theme Integration

### Theme Tokens Used

| Element | Token | Description |
|---------|-------|-------------|
| Background | `colorBgContainer` | Container background |
| Border | `colorBorderSecondary` | Subtle borders |
| Title | `colorPrimary` | Brand color |
| Text | `colorText` | Primary text |
| Dividers | `colorBorderSecondary` | Section separators |

### Theme Behavior

```tsx
// Automatic theme adaptation
const { token } = useToken();

<Card style={{
  background: token.colorBgContainer,  // Light: #fff, Dark: #1f1f1f
  borderColor: token.colorBorderSecondary,
}}>
  <Title style={{ color: token.colorPrimary }}>
    {/* Light: #1677ff, Dark: #3c89ff */}
  </Title>
</Card>
```

## Best Practices

### For Developers

1. **Don't manually trigger**: Let the polling mechanism handle display
2. **Maintain session ID**: Ensure correct session context
3. **Test both themes**: Verify contrast in light and dark modes
4. **Check positioning**: Should appear above input, not in message list

### For Users

1. **Respond promptly**: Agent execution pauses until response
2. **Use custom input sparingly**: Predefined options are often sufficient
3. **Check before confirm**: Selected option is highlighted

## Accessibility

### Keyboard Navigation
- `Tab`: Navigate between options
- `↑/↓`: Arrow keys for radio selection
- `Enter`: Submit selection
- `Esc`: Not applicable (dialog must be answered)

### Screen Reader Support
- Semantic HTML with radio groups
- Clear labels and descriptions
- ARIA attributes for state changes

### Contrast Ratios
- **Light theme**: All text meets WCAG AA standards (4.5:1+)
- **Dark theme**: Optimized for readability
- **Selected state**: Maintains visibility

## Troubleshooting

### Dialog Not Appearing

1. Check if agent session is active
2. Verify polling is running (check console)
3. Check network requests to `/pending` endpoint
4. Verify backend has pending question

### Poor Contrast

1. Ensure using latest version with theme tokens
2. Check theme configuration
3. Verify no custom CSS overrides
4. Test in both light and dark modes

### Submit Not Working

1. Verify option is selected
2. Check for custom input validation
3. Inspect network requests
4. Check backend logs for errors

## Related Components

- **TodoList**: Shows agent progress alongside questions
- **InputContainer**: Positioned below QuestionDialog
- **ChatMessagesList**: Shows conversation history
- **AgentEventSubscription**: Handles real-time updates

## Future Roadmap

Planned enhancements:

1. **Rich Text Questions**: Markdown rendering in question text
2. **Multi-select**: Support for selecting multiple options
3. **File Upload**: Allow file attachments in responses
4. **Voice Input**: Speech-to-text for custom responses
5. **Question History**: View previous questions and answers
6. **Animation**: Smooth transitions for appear/disappear
7. **Sound Alerts**: Audio notification for new questions

## Related Documentation

- [Agent Loop Architecture](../../architecture/AGENT_LOOP_ARCHITECTURE.md)
- [Command Selector Enhancement](../command-selector/THEME_SYSTEM_ENHANCEMENT.md)
- [TodoList Component](../todolist/)

---

**Created**: 2026-02-17
**Status**: ✅ Production Ready
**Location**: `src/components/QuestionDialog/`
