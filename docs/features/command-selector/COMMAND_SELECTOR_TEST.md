# Command Selector Implementation - Test Plan

## 📋 Implementation Summary

### Backend (Rust)
✅ Created `command_controller.rs` with unified API
✅ Registered routes in `mod.rs` and `server.rs`
✅ Compilation successful

### Frontend (TypeScript/React)
✅ Created type definitions (`command.ts`)
✅ Created `CommandService` with caching
✅ Created `CommandSelector` component with type badges
✅ Created `useInputContainerCommand` hook
✅ Updated `InputContainer` to use new selector

## 🎯 Features Implemented

### 1. Unified Command API
- **GET /v1/commands** - Returns aggregated list of:
  - Workflows (from `~/.bamboo/workflows/*.md`)
  - Skills (from skill manager)
  - MCP Tools (from MCP manager)
- **GET /v1/commands/{type}/{id}** - Returns command details

### 2. Visual Type Indicators
- 🔵 **Workflow**: Blue tag + 📁 icon
- 🟢 **Skill**: Green tag + ⚡ icon
- 🟣 **MCP**: Purple tag + 🔌 icon

### 3. Enhanced Search
Searches across multiple fields:
- Command name
- Description
- Category
- Tags

### 4. Keyboard Navigation
- `↑/↓` or `Ctrl+P/N`: Navigate
- `Enter`: Select
- `Space/Tab`: Auto-complete
- `Esc`: Cancel

## 🧪 Testing Steps

### Step 1: Start the Application

```bash
# Terminal 1: Start Tauri dev server
npm run tauri dev
```

The app should start at `http://localhost:1420`

### Step 2: Verify Backend API

Open a new terminal and test the API:

```bash
# List all commands
curl http://localhost:8080/v1/commands

# Expected response:
{
  "total": 5,
  "commands": [
    {
      "id": "workflow-my-workflow",
      "name": "my-workflow",
      "display_name": "my-workflow",
      "description": "Workflow: my-workflow",
      "type": "workflow",
      "metadata": { ... }
    },
    {
      "id": "skill-react-vite-best",
      "name": "react-vite-best",
      "display_name": "React Vite Best Practices",
      "description": "...",
      "type": "skill",
      "category": "Development",
      "tags": ["react", "vite", "performance"],
      "metadata": { ... }
    },
    {
      "id": "mcp-analyze-image",
      "name": "analyze-image",
      "display_name": "analyze-image",
      "description": "Analyze image using AI vision",
      "type": "mcp",
      "category": "MCP Tools",
      "metadata": { ... }
    }
  ]
}
```

```bash
# Get workflow details
curl http://localhost:8080/v1/commands/workflow/my-workflow

# Get skill details
curl http://localhost:8080/v1/commands/skill/react-vite-best
```

### Step 3: Test UI Functionality

1. **Open the chat page**

2. **Type `/` in the input box**
   - The command selector should appear
   - You should see all workflows, skills, and MCP tools
   - Each command should have a colored type badge

3. **Test search functionality**
   - Type `/react` - should filter to show react-related commands
   - Type `/vite` - should show commands with "vite" in name/description/tags
   - Type `/performance` - should show commands with "performance" in tags/description

4. **Test keyboard navigation**
   - Use `↑/↓` arrows to navigate
   - Press `Enter` to select a command
   - Press `Tab` or `Space` to auto-complete
   - Press `Esc` to cancel

5. **Test command selection**
   - Select a **Workflow** - should insert the workflow name
   - Select a **Skill** - should insert the skill name
   - Select an **MCP tool** - should insert the tool name

### Step 4: Verify Type Badges

Check that each command shows:
- [ ] Workflow commands have blue "📁 Workflow" badge
- [ ] Skill commands have green "⚡ Skill" badge
- [ ] MCP commands have purple "🔌 MCP" badge
- [ ] Categories are displayed (for skills)
- [ ] Tags are displayed (first 3 tags)

### Step 5: Test Error Handling

1. **Test with no workflows/skills/MCP**
   - Remove all workflows temporarily
   - Verify the selector shows appropriate empty state

2. **Test with MCP server down**
   - Stop an MCP server
   - Verify other commands still load correctly

3. **Test with invalid command**
   - Try to fetch a non-existent command
   - Verify error is handled gracefully

## 🐛 Known Issues

1. **TypeScript errors in unrelated files** (pre-existing):
   - `useMessageStreaming.test.tsx` - Test file issue
   - `ModelMappingCard.tsx` - Unused import
   - `SystemSettingsModelTab.tsx` - Missing module

   These don't affect the command selector functionality.

## 📊 Expected Behavior

### Successful Scenario
1. User types `/` → Selector appears within 100ms
2. Commands load from cache (if < 30s old) or from API
3. All three types (Workflow/Skill/MCP) are shown
4. Search filters work across all fields
5. Selection inserts command name with `/` prefix

### Error Scenarios
1. **API unavailable**: Show error message in selector
2. **Partial failure**: Show available commands (e.g., if MCP fails, still show workflows and skills)
3. **Empty state**: Show helpful message to create workflows/skills or add MCP servers

## 🎨 UI Checklist

- [ ] Command selector positioned correctly above input
- [ ] Scrollable list with max-height
- [ ] Selected item highlighted
- [ ] Hover states work correctly
- [ ] Type badges are color-coded
- [ ] Icons display correctly
- [ ] Dark mode support
- [ ] Responsive layout

## 🔍 Debugging

### Check Browser Console
```javascript
// Look for these log messages:
[CommandService] Loaded commands: 5
[CommandSelector] Fetched commands: [...]
```

### Check Backend Logs
```bash
# Look for API requests:
GET /v1/commands → 200 OK
GET /v1/commands/workflow/my-workflow → 200 OK
```

### Common Issues

1. **Commands not loading**
   - Check backend is running on port 8080
   - Check API returns data: `curl http://localhost:8080/v1/commands`
   - Check browser console for errors

2. **Type badges not showing**
   - Check `CommandSelector/index.css` is loaded
   - Check Ant Design `Tag` component works

3. **Search not working**
   - Check `useCommandSelectorState.ts` filter logic
   - Verify search text is being passed correctly

## 📝 Next Steps (Phase 3 - Execution Logic)

After UI testing is complete:

1. **Skill execution**
   - Inject skill prompt into system message
   - Filter available tools based on `toolRefs`
   - Apply workflow templates from `workflowRefs`

2. **MCP tool execution**
   - Mark message for MCP tool call
   - Agent automatically executes the tool

3. **Usage tracking**
   - Track which commands are used most frequently
   - Implement smart sorting (most used first)

4. **Additional features**
   - Command favorites
   - Command history
   - Command combinations

## ✅ Success Criteria

- [ ] All three command types (Workflow/Skill/MCP) appear in selector
- [ ] Type badges display correctly with colors and icons
- [ ] Search works across name/description/category/tags
- [ ] Keyboard navigation works smoothly
- [ ] Command selection inserts correct text
- [ ] API responds within 500ms for command list
- [ ] Cache reduces API calls (check Network tab)
- [ ] Error handling is graceful
- [ ] Dark mode works correctly
- [ ] No console errors in browser

---

**Implementation Date**: 2026-02-17
**Status**: ✅ Phase 1 & 2 Complete (Backend + Frontend UI)
**Next**: Phase 3 - Command Execution Logic
