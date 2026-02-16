# Session Files Migration to Subdirectory

## Overview
Moved session files storage from `~/.bamboo/` to `~/.bamboo/sessions/` for better organization.

## Changes Made

### 1. Storage Path Update
- **File**: `crates/agent-server/src/state.rs`
- **Change**: Modified `AppState::new_with_config()` to use `data_dir.join("sessions")` instead of `data_dir` directly
- **Impact**: All new session files (*.json and *.jsonl) will now be stored in the sessions subdirectory

### 2. Migration Support
- **File**: `crates/chat_core/src/paths.rs`
- **New Functions**:
  - `sessions_dir()`: Returns the sessions directory path (`~/.bamboo/sessions/`)
  - `migrate_session_files()`: Automatically migrates existing session files from root to subdirectory
- **Migration Logic**:
  - Runs automatically during AppState initialization
  - Moves `*.json` and `*.jsonl` files from `~/.bamboo/` to `~/.bamboo/sessions/`
  - Skips config files (config.json, keyword_masking.json, model-mapping files, mcp.json)
  - Only migrates if destination doesn't exist (non-destructive)
  - Logs warnings on errors but doesn't fail startup

## Backwards Compatibility
- ✅ Old session files are automatically migrated on first run
- ✅ No user action required
- ✅ Migration is safe and non-destructive
- ✅ Application continues to work even if migration fails

## Directory Structure

### Before
```
~/.bamboo/
├── config.json
├── session-1.json
├── session-1.jsonl
├── session-2.json
└── session-2.jsonl
```

### After
```
~/.bamboo/
├── config.json
├── sessions/
│   ├── session-1.json
│   ├── session-1.jsonl
│   ├── session-2.json
│   └── session-2.jsonl
├── skills/
├── workflows/
└── ...
```

## Testing
- ✅ Compilation successful across all crates
- ✅ No breaking changes to API or frontend
- ✅ Migration logic handles edge cases (missing directory, permission errors)
