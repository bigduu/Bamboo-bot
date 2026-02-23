# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Bamboo**, a GitHub Copilot Chat Desktop application built with Tauri (Rust backend) and React/TypeScript (frontend). The application provides a native desktop interface for interacting with GitHub Copilot's chat API, featuring conversation management, agent-driven tool execution, and workflows.

## Architecture

### High-Level Structure
- **Frontend**: React 18 + TypeScript + Ant Design 5, built with Vite
- **Backend**: Rust with Tauri framework, organized into modular crates
- **State Management**: Zustand for global UI state, custom hooks for chat state
- **Build System**: Vite (frontend), Cargo (Rust backend)
- **Testing**: Vitest for frontend, `cargo test` for backend

### Rust Crates Architecture

**Core Infrastructure:**
- `chat_core` - Foundational types shared across crates (messages, config, encryption)
- `copilot_client` - GitHub Copilot API client with authentication, streaming, retry logic

**Server Layer:**
- `web_service` - Actix-web HTTP server library for integration
- `web_service_standalone` - Standalone HTTP server (runs as sidecar or independent process)
  - Binds to configurable port (default 8080)
  - Provides health check endpoint at `/api/v1/health`
  - Can serve static frontend files in Docker mode

**Agent System:**
- `copilot-agent/` - Workspace containing agent loop and tool execution
  - `copilot-agent-core` - Agent loop orchestration
  - `copilot-agent-server` - Server-side agent handling
  - `builtin_tools` - Built-in tool implementations

**Application Entry:**
- `src-tauri/` - Main Tauri application integrating all crates, with:
  - Sidecar management for `web_service_standalone` process
  - Desktop-only commands: file picker, system proxy configuration, native clipboard
  - Claude Code integration (checkpoints, sessions, projects)
  - Proxy authentication dialog
  - Process lifecycle management via ProcessRegistry

### Frontend Architecture

**Page Structure:**
- `src/app/` - Root App component and MainLayout
- `src/pages/ChatPage/` - Main chat interface with:
  - `hooks/useChatManager/` - Chat state machine and operations
  - `components/` - ChatView, MessageCard, InputContainer, etc.
  - `services/` - API clients, storage, workflow management
  - `store/slices/` - Zustand slices (appSettings, favorites, prompt)
  - `types/` - TypeScript type definitions
- `src/pages/SettingsPage/` - Application settings (includes Claude Installer)
- `src/shared/` - Cross-page utilities and components
- `src/services/` - Shared services (common utilities, agent services)

**Key Patterns:**
- Chat state managed through `useChatManager` hook with state machine pattern
- Services in `ChatPage/services/` handle API communication and business logic
- Zustand store in `ChatPage/store/` for persistent UI state
- ServiceFactory provides HTTP API abstraction (no direct invoke() in business logic)
- Environment detection via `isTauriEnvironment()` for desktop-only features

## Development Commands

### Frontend
```bash
npm install              # Install dependencies
npm run dev              # Start Vite dev server (port 1420)
npm run build            # Type-check and build for production
npm run test             # Run Vitest in watch mode
npm run test:run         # Run tests once
npm run test:coverage    # Run tests with coverage
npm run format           # Format with Prettier
npm run format:check     # Check formatting without writing
```

### Tauri
```bash
npm run tauri dev        # Start Tauri in development mode
npm run tauri build      # Build desktop application
```

### Rust Backend
```bash
# From project root
cargo build              # Build all crates
cargo test               # Run all Rust tests
cargo check              # Quick type check
cargo fmt                # Format Rust code
cargo clippy             # Lint Rust code

# Single crate
cargo test -p copilot_client
cargo test -p web_service

# Run standalone backend (for browser development)
cargo run -p web_service_standalone
cargo run -p web_service_standalone -- --port 8080 --data-dir /custom/path
```

### Docker
```bash
cd docker                # Navigate to docker directory
docker-compose up        # Build and run container
docker build -t bamboo . # Build image manually
```

## Key Technical Details

### Sidecar Architecture

The desktop application uses a sidecar architecture where the backend runs as a separate process:

**Process Lifecycle**:
1. Tauri app starts and spawns `web_service_standalone` as sidecar process
2. Sidecar binds to `127.0.0.1:8080` (or next available port)
3. Health check ensures backend is ready before frontend loads
4. Process managed via ProcessRegistry for graceful shutdown
5. Stdout/stderr captured for observability

**Port Discovery**:
- Frontend uses health check mechanism to find backend
- Default port 8080, with fallback to config injection
- Window global `__BAMBOO_BACKEND_PORT__` can override

**Benefits**:
- Clean separation between frontend and backend
- Backend can run independently for browser development
- Same HTTP API works across all deployment modes
- Easier debugging and testing

### HTTP API First Approach

All business logic uses HTTP API through ServiceFactory abstraction:

**ServiceFactory Pattern**:
```typescript
// Frontend code NEVER calls invoke() directly for business logic
const serviceFactory = ServiceFactory.getInstance();
await serviceFactory.saveWorkflow(name, content);
await serviceFactory.getKeywordMaskingConfig();
```

**HTTP Service Implementation**:
- `HttpUtilityService` implements all business operations via HTTP
- `TauriUtilityService` wraps HTTP service + desktop-only features
- Mode detection handled automatically by ServiceFactory

**Desktop-Only Features** (require Tauri invoke):
- Native file picker dialogs (`pick_folder`)
- System proxy configuration (`get/set_proxy_config`)
- Native clipboard with fallback to Web API
- Setup wizard native integrations

**Browser Mode** gracefully disables desktop-only features with user-friendly messages.

### State Management
- **Chat State**: `useChatManager` hook (`src/pages/ChatPage/hooks/useChatManager/`) manages chat lifecycle
  - `useChatStateMachine.ts` - Simplified state machine (IDLE | THINKING | AWAITING_APPROVAL)
  - `useChatOperations.ts` - Message sending, streaming, cancellation
  - `openAiStreamingRunner.ts` - OpenAI-compatible streaming implementation
- **Global UI State**: Zustand store in `src/pages/ChatPage/store/slices/`

### Security Model

Each deployment mode has specific security configurations:

**Desktop Mode**:
- Sidecar bound to `127.0.0.1` only
- CORS allowlist: `tauri://localhost`, `https://tauri.localhost`
- No external network exposure
- Native OS security applies

**Browser Development Mode**:
- Backend bound to `127.0.0.1` only
- CORS allowlist: `http://localhost:1420`, `http://127.0.0.1:1420`
- Development-only, not for production

**Docker Production Mode**:
- Backend bound to `127.0.0.1` (localhost only)
- CORS allowlist: `http://localhost:8080`
- No remote access (enforced by bind address)
- Recommended: Use reverse proxy for external access with proper auth

**Data Directory Contract**:
- All state respects `--data-dir` parameter
- Config, workflows, sessions stored in specified directory
- Passed through AppState to all controllers
- Never uses global paths or hardcoded locations

### Deployment Modes

The application supports three deployment modes with different runtime characteristics:

**Desktop Mode (Tauri + Sidecar)**:
- Tauri application with auto-managed sidecar backend process
- Frontend runs in Tauri webview, backend runs as separate process
- Sidecar (`web_service_standalone`) bound to `127.0.0.1:8080`
- CORS allows `tauri://localhost` and `https://tauri.localhost`
- Native features available: file dialogs, system proxy, native clipboard
- Use: `npm run tauri dev` or `npm run tauri build`

**Browser Development Mode (HTTP only)**:
- Frontend served by Vite dev server (port 1420)
- Backend runs as standalone process (`web_service_standalone`)
- Backend bound to `127.0.0.1:8080`
- CORS allows `http://localhost:1420` and `http://127.0.0.1:1420`
- Desktop-only features gracefully disabled with fallback
- Use: `cargo run -p web_service_standalone` (Terminal 1) + `npm run dev` (Terminal 2)

**Docker Production Mode (Integrated)**:
- Single container serving both frontend and backend
- Backend serves static frontend files + API on same port
- Bound to `127.0.0.1:8080` (localhost only, no remote access)
- CORS allows `http://localhost:8080`
- No desktop-only features (browser environment)
- Use: `cd docker && docker-compose up`

### Backend Communication
- **HTTP API First**: All business logic uses HTTP API via ServiceFactory abstraction
- **Sidecar Architecture**: Backend runs as independent HTTP server process
- **Tauri Commands**: Only for desktop-specific native features (file picker, system proxy)
- **Streaming**: Server-sent events (SSE) for real-time chat responses
- **Port Discovery**: Frontend uses health checks and config injection to find backend

### Build Configuration
- **Vite**: Port 1420 with HMR, manual chunking for vendor libraries (React, Ant Design, Mermaid, PDF)
- **Tauri**: macOS private API enabled

### Testing
- **Frontend**: Vitest with jsdom, tests in `src/**/__tests__/` directories
- **Backend**: Standard Rust tests, wiremock for HTTP mocking in `copilot_client`
- **E2E**: Playwright tests in `e2e/` directory (browser and Docker modes)
- **Integration**: Actix-web tests in `crates/web_service/tests/`

### Environment Detection
- `src/utils/environment.ts` - Environment detection utilities
- `isTauriEnvironment()` - Detects Tauri runtime vs browser
- `requireDesktopFeature()` - Throws error for desktop-only features in browser
- Feature flags disable desktop features gracefully in browser mode

## Important Dependencies

### Crate Relationships
- `web_service` → depends on `copilot_client`, `copilot-agent-server`, `skill_manager`
- `web_service_standalone` → depends on `web_service` (standalone binary wrapper)
- `src-tauri` → integrates `copilot_client`, manages `web_service_standalone` as sidecar
- `copilot_client` → uses `chat_core` for types

### Frontend Service Layer
- `ServiceFactory` - Singleton factory for service abstraction
  - `HttpUtilityService` - HTTP API implementation (works in all modes)
  - `TauriUtilityService` - HTTP + desktop-only features (Tauri mode only)
- `src/shared/utils/backendBaseUrl.ts` - Backend URL resolution with health check
- All business logic uses ServiceFactory, never calls invoke() directly

### Key Frontend Libraries
- `@tanstack/react-virtual` - Virtual scrolling for message lists
- `@xstate/react` - State machines (legacy, being phased out)
- `zustand` - Global state management
- `html2canvas` + `jspdf` - PDF export functionality
- `mermaid` - Diagram rendering in messages

## Desktop-Only Features

Features that require Tauri and are disabled in browser mode:

**Native File Operations**:
- `pick_folder` - Native folder picker dialog
- Used in setup wizard for workspace selection
- Browser mode: Shows message that feature requires desktop app

**System Proxy Configuration**:
- `get_proxy_config` / `set_proxy_config` - Read/write system proxy settings
- Used in setup wizard for proxy configuration
- Browser mode: Step skipped with info message

**Native Clipboard Integration**:
- Primary: Tauri clipboard command
- Fallback: Web Clipboard API (`navigator.clipboard`)
- Fallback: Legacy `document.execCommand("copy")`

**Setup Wizard Integration**:
- Native dialogs for workspace selection
- System proxy detection and configuration
- Browser mode: Graceful fallback with manual input options

## Adding New Features

When adding new functionality, follow these guidelines:

**Use HTTP API When**:
- CRUD operations on data (workflows, configs, sessions)
- Business logic that doesn't require native OS access
- Features that should work in browser mode
- Operations that need to work in Docker deployment

**Use Tauri Commands When**:
- Need native file dialogs or system UI
- Accessing system settings (proxy, etc.)
- Desktop-specific integrations
- Performance-critical native operations

**Pattern**:
```typescript
// Add to ServiceFactory interface
interface UtilityService {
  myNewFeature(): Promise<Result>;
}

// Implement in HttpUtilityService
class HttpUtilityService implements UtilityService {
  async myNewFeature(): Promise<Result> {
    return await apiClient.post("my-endpoint", data);
  }
}

// Add desktop-only wrapper if needed
class TauriUtilityService implements UtilityService {
  async myNewFeature(): Promise<Result> {
    // Use HTTP by default, invoke() only for native features
    return await this.httpService.myNewFeature();
  }
}
```

---

## AI-Assisted Development Guidelines

### Using Codex MCP for Complex Tasks

**IMPORTANT**: This project has access to Codex MCP (via `mcp__codex__codex` tool), which provides specialized AI assistance for complex development tasks.

#### Daily Quota Policy ⚠️

- **Codex has a daily quota that resets every day**
- **Must use the quota before daily reset** - unused quota does not roll over
- **Always consider using Codex for complex tasks early in the day**

#### When to Use Codex MCP

Codex excels at:

1. **Code Review & Bug Detection** 🔍
   - Identifying security vulnerabilities
   - Finding logic errors and edge cases
   - Performance bottleneck analysis
   - Code quality assessment

2. **Complex Planning & Architecture** 📋
   - Multi-phase refactoring plans
   - Architecture decision analysis
   - Breaking down large tasks into steps
   - Risk assessment and mitigation strategies

3. **Deep Code Analysis** 🔬
   - Understanding complex codebases
   - Tracing execution flows
   - Dependency analysis
   - Impact assessment of changes

#### Best Practices

**DO**:
- ✅ Use Codex for complex, multi-step tasks
- ✅ Be patient - allow Codex time to complete thorough analysis
- ✅ Provide clear context and objectives
- ✅ Review Codex output before applying changes
- ✅ Use Codex early in the day to maximize quota usage

**DON'T**:
- ❌ Use Codex for simple, single-file edits (use direct Edit tool)
- ❌ Interrupt Codex sessions prematurely
- ❌ Skip reviewing Codex suggestions
- ❌ Waste daily quota by not using it

#### Example Usage

```
Complex Task: "Review the sidecar architecture for security issues"

Instead of doing it yourself:
1. Invoke Codex MCP with comprehensive context
2. Wait for thorough analysis (may take several minutes)
3. Review detailed findings and recommendations
4. Apply fixes systematically
```

#### Integration with Development Workflow

For complex tasks, follow this pattern:
1. **Analysis Phase**: Use Codex to analyze the problem
2. **Planning Phase**: Use Codex to create detailed plan
3. **Implementation Phase**: Use regular tools with Codex guidance
4. **Review Phase**: Use Codex to review implementation

This approach maximizes the value of Codex's daily quota and ensures high-quality outcomes for complex tasks.
