<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# AGENTS.md - Copilot Chat AI Assistant Guide

## Build, Test, and Lint Commands

### Frontend (TypeScript/React)

```bash
npm run dev              # Start development server with hot reload
npm run build            # Build for production (runs tsc then vite build)
npm run preview          # Preview production build locally
npm run test             # Run Vitest tests in watch mode
npm run test:run         # Run tests once
npm run test:ui          # Run Vitest with UI interface
npm run test:coverage    # Run tests with coverage report
npm run format           # Format code with Prettier
npm run format:check     # Check formatting without modifying
```

### Backend (Rust/Tauri)

```bash
cargo build              # Build the entire workspace
cargo build --release    # Build optimized release binary
cargo test               # Run all tests in workspace
cargo test --package <crate_name>     # Run tests for specific crate
cargo test --test <test_name>         # Run specific test
cargo run                # Run the application
cargo check              # Quick compile check (faster than build)
cargo clippy             # Run Clippy linter
cargo fmt                # Format Rust code
cargo fmt --check        # Check formatting without modifying
```

### Running Single Test

**TypeScript:**

```bash
npm run test -- <test_file_pattern>
npm run test -- MessageCard
```

**Rust:**

```bash
cargo test -- --exact <test_name>           # Run exact test name match
cargo test <test_name>                      # Run test matching pattern
cargo test --package web_service <test_name>  # Run specific test in package
```

## Code Style Guidelines

### TypeScript/React

**Imports:** React hooks → external libraries → internal modules → types, grouped with blank lines.

```typescript
import { useState, useEffect, useCallback } from "react";
import { Card, Space, Typography } from "antd";
import { useBackendContext } from "../hooks/useBackendContext";
import type { Message, MessageCardProps } from "../types/chat";
```

**Component Structure:** Functional components with React.FC, use React.memo for performance, custom hooks for reusable logic.

```typescript
const Component: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  const [state, setState] = useState<Type>(initialValue);
  const memoizedValue = useMemo(() => compute(), [deps]);

  return <div>...</div>;
};
```

**Types:** Export interfaces for component props, use `type` aliases for unions, define types in `types/` directory.

**Naming:** Components: PascalCase, Functions/variables: camelCase, Constants: UPPER_SNAKE_CASE, Files: PascalCase for components/camelCase for utilities, Hooks: prefix with `use`.

**Error Handling:** Use try/catch for async operations, console.error with descriptive messages, return error objects or use error boundaries.

**Formatting:** 2-space indentation, single quotes, no semicolons, trailing commas in multi-line, max 100 characters.

### Rust

**Imports:** std → external crates → internal crates → local modules, grouped with blank lines, use `use crate::` for internal paths.

```rust
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Serialize, Deserialize};

use crate::error::AppError;
use crate::models::Message;
```

**Structure:** Module-level `//!` docs for files, public functions have `///` docs, use builder pattern, implement traits with clear separation.

**Naming:** Types/Structs: PascalCase, Functions/Methods: snake_case, Constants: SCREAMING_SNAKE_CASE, Modules: snake_case.

**Error Handling:** Custom error enum using `thiserror::Error`, use `anyhow::Error` for generic errors, return `Result<T, AppError>`, implement `ResponseError` trait.

```rust
#[derive(Debug, Error)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Internal error: {0}")]
    InternalError(#[from] anyhow::Error),
}

pub type Result<T> = std::result::Result<T, AppError>;
```

**Types:** Derive `Debug`, `Clone`, `Serialize`, `Deserialize` as needed, use `pub(crate)` for workspace visibility, prefer composition.

**Formatting:** Use `cargo fmt`, max 100 characters, align struct fields where logical.

## Architecture Patterns

### Frontend

- **State:** Zustand with devtools, slice-based organization
- **Styling:** Ant Design with theme tokens (light/dark mode)
- **Routing:** Context-based navigation
- **Contexts:** BackendContextProvider, ChatControllerContext
- **Components:** Organized in `components/` with index.tsx exports

### Backend (Rust Workspace)

- **Structure:** Modular crates (chat_core, web_service, etc.)
- **Services:** Handler pattern in web_service (MessageHandler, ToolHandler, etc.)
- **Storage:** Generic `StorageProvider` trait
- **Async:** Tokio with `async/await`
- **Errors:** Centralized `AppError` enum in each crate

### Tauri Integration

- IPC commands in `src-tauri/src/lib.rs`
- Frontend calls via `@tauri-apps/api` package
- Real-time updates via Tauri events (SSE for streaming)

## Important Notes

- **No comments** in code unless absolutely necessary - code should be self-documenting
- **Prefer existing patterns** over introducing new libraries/frameworks
- **Write tests** for new functionality
- **Performance matters** - use React.memo, useMemo, useCallback appropriately
- **Type safety** is priority - leverage TypeScript and Rust's type systems
- **Simplicity first** - avoid over-engineering solutions

## Git Workflow

This repository requires changes to be submitted through Pull Requests. Direct pushes to main branch are blocked by repository rules.

### Standard Workflow

1. **Create feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make commits with descriptive messages:**
   - Follow conventional commit format: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
   - Include "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>" in commit message

3. **Push feature branch:**
   ```bash
   git push -u origin feature/your-feature-name
   ```

4. **Create Pull Request:**
   ```bash
   gh pr create --title "feat: your feature description" --body "Description of changes..."
   ```

5. **Merge the PR:**
   - Claude should merge PRs directly when requested: `gh pr merge <number> --merge --delete-branch`
   - This automatically deletes the remote feature branch

6. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

### User Instructions

When the user says "合并" or "merge" or "push到远程", they want:
1. Create a feature branch if not already on one
2. Push the branch to remote
3. Create a Pull Request
4. Merge the PR immediately
5. Pull latest main branch changes

Do NOT ask for confirmation at each step - execute the full workflow.

## OpenSpec Integration

For larger changes (features, architecture shifts, breaking changes):

1. Check `openspec list` for active proposals
2. Check `openspec list --specs` for existing specifications
3. Create change proposals in `openspec/changes/<change-id>/`
4. Validate with `openspec validate <change-id> --strict`
5. Get approval before implementing
