# Command Selector Documentation

Unified command selection interface for workflows, skills, and MCP tools.

## Overview

The Command Selector provides a unified interface for accessing three types of commands through the "/" trigger in the chat input:
- **Workflows**: Markdown-based workflow templates
- **Skills**: Domain expertise and specialized capabilities
- **MCP Tools**: Model Context Protocol tools

## Documentation Index

### 📚 Feature Documentation

- **[COMMAND_ENHANCEMENT.md](./COMMAND_ENHANCEMENT.md)**
  - Explicit command selection hints for AI
  - Different handling for workflow/skill/MCP
  - User experience enhancements

### 🧪 Testing & Verification

- **[COMMAND_SELECTOR_TEST.md](./COMMAND_SELECTOR_TEST.md)**
  - Complete testing guide
  - Test scenarios and expected results
  - Debugging instructions

- **[VERIFICATION_REPORT.md](./VERIFICATION_REPORT.md)**
  - API verification results
  - Backend and frontend validation
  - Success criteria checklist

### 🔧 Implementation Details

- **[COMMAND_SELECTION_FIX_PLAN.md](./COMMAND_SELECTION_FIX_PLAN.md)**
  - Issue analysis (cursor position, content clearing)
  - Detailed fix solutions
  - Edge case handling

- **[COMMAND_FIX_VERIFICATION.md](./COMMAND_FIX_VERIFICATION.md)**
  - Fix implementation details
  - Test scenarios
  - Verification checklist

- **[CURSOR_ALIGNMENT_FIX.md](./CURSOR_ALIGNMENT_FIX.md)**
  - Cursor misalignment root cause
  - Font consistency fixes
  - Technical implementation details

## Quick Start

1. **Open chat input**
2. **Type "/"** to trigger command selector
3. **Search or browse** commands by name, description, category, or tags
4. **Select** with Enter, Tab, or click
5. **Continue typing** your message

## Keyboard Shortcuts

- `↑/↓` or `Ctrl+P/N`: Navigate commands
- `Enter`: Select command
- `Tab/Space`: Auto-complete
- `Esc`: Cancel selection

## Visual Indicators

| Type | Color | Icon | Example |
|------|-------|------|---------|
| Workflow | Blue | 📁 | `/test-workflow` |
| Skill | Green | ⚡ | `/builtin-code-review` |
| MCP | Purple | 🔌 | `/analyze-image` |

## Architecture

### Backend
- **API**: `GET /v1/commands` - Aggregate all commands
- **API**: `GET /v1/commands/{type}/{id}` - Get command details
- **Controller**: `command_controller.rs`

### Frontend
- **Service**: `CommandService` with 30s cache
- **Component**: `CommandSelector` with type badges
- **Hook**: `useInputContainerCommand` for state management

## Related Files

- Backend Controller: `crates/web_service/src/controllers/command_controller.rs`
- Frontend Service: `src/pages/ChatPage/services/CommandService.ts`
- Selector Component: `src/pages/ChatPage/components/CommandSelector/`
- Types: `src/pages/ChatPage/types/command.ts`

---

**Created**: 2026-02-17
**Status**: ✅ Production Ready
