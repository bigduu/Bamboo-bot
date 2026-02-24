# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Bamboo**, a GitHub Copilot Chat Desktop application built with Tauri (Rust backend) and React/TypeScript (frontend). The application provides a native desktop interface for interacting with GitHub Copilot's chat API, featuring conversation management, agent-driven tool execution, and workflows.

## Architecture

### High-Level Structure
- **Frontend**: React 18 + TypeScript + Ant Design 5, built with Vite
- **Backend**: Rust with Tauri framework + bamboo-agent crate (embedded)
- **State Management**: Zustand for global UI state, custom hooks for chat state
- **Build System**: Vite (frontend), Cargo (Rust backend)
- **Testing**: Vitest for frontend, `cargo test` for backend

### Embedded Architecture

Bamboo uses an **embedded architecture** where the bamboo-agent HTTP server runs directly within the Tauri application process, rather than as a separate sidecar process:

```
┌─────────────────────────────────────────┐
│  Tauri Desktop App (Bodhi)              │
│  ├── Frontend (React/TypeScript)        │
│  │   └── HTTP API → localhost:8080      │
│  ├── Embedded Web Service Manager       │
│  │   └── tokio::spawn(HTTP server)      │
│  └── bamboo-agent (v0.2.2)              │
│      └── HTTP Server (port 8080)        │
└─────────────────────────────────────────┘
```

**Key Components**:
- **bamboo-agent crate** (v0.2.2 from crates.io) - Provides all agent functionality
- **EmbeddedWebService** - Manages HTTP server lifecycle within the app process
- **Health check monitoring** - Ensures server is ready before accepting requests

**Benefits over Sidecar**:
- ✅ Single process (simpler architecture)
- ✅ Faster startup (no process spawning)
- ✅ Lower memory usage (shared resources)
- ✅ Easier debugging (one process to trace)
- ✅ No binary bundling (smaller app size)

### bamboo-agent Crate

The backend functionality is provided by the [bamboo-agent](https://crates.io/crates/bamboo-agent) crate:

**Features**:
- Multi-LLM provider support (GitHub Copilot, OpenAI, Anthropic Claude, Google Gemini)
- 24 built-in tools (file operations, command execution, etc.)
- Agent loop orchestration with budget management
- Session persistence and management
- Workflow system with YAML support
- MCP (Model Context Protocol) support
- Metrics collection and storage

**Integration**:
```rust
// src-tauri/src/embedded/mod.rs
pub struct EmbeddedWebService {
    port: u16,
    data_dir: PathBuf,
    server_handle: Arc<tokio::sync::Mutex<Option<JoinHandle<...>>>>,
}

// Server runs in background tokio task
let handle = tokio::spawn(async move {
    bamboo_agent::web_service::server::run(data_dir, port).await
});
```

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
cargo build              # Build Tauri application
cargo test               # Run all Rust tests
cargo check              # Quick type check
cargo fmt                # Format Rust code
cargo clippy             # Lint Rust code
```

### Docker
```bash
cd docker                # Navigate to docker directory
docker-compose up        # Build and run container
docker build -t bamboo . # Build image manually
```

## Key Technical Details

### Embedded HTTP Server

The bamboo-agent HTTP server runs embedded within the Tauri application process:

**Server Lifecycle**:
1. Tauri app starts and creates `EmbeddedWebService` instance
2. Server spawned in background tokio task using `tokio::spawn`
3. Binds to `127.0.0.1:8080` by default
4. Health check ensures server is ready before app fully loads
5. Server stops automatically when app shuts down

**Implementation**:
```rust
// src-tauri/src/embedded/mod.rs
pub struct EmbeddedWebService {
    port: u16,
    data_dir: PathBuf,
    server_handle: Arc<tokio::sync::Mutex<Option<JoinHandle<...>>>>,
}

impl EmbeddedWebService {
    pub async fn start(&self) -> Result<(), String> {
        let handle = tokio::spawn(async move {
            bamboo_agent::web_service::server::run(data_dir, port).await
        });
        // Store handle for lifecycle management
        self.wait_for_health().await?;
    }
}
```

**Benefits over Sidecar**:
- No separate process to manage
- No binary to bundle
- Faster startup
- Shared process memory
- Simpler deployment

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

### Context Preservation Strategy with Sub-Agents

**CRITICAL**: Maximize the use of team agents (Task tool with subagent_type) to preserve main session context.

#### Core Principle

The main session should act as an **orchestrator** that delegates work to specialized sub-agents. Sub-agents have:
- ✅ Unlimited token budget
- ✅ Full tool access for their specialty
- ✅ Clean, isolated context

The main session has:
- ⚠️ Limited context window
- 🎯 Focus on coordination and decision-making
- 📋 Receives only conclusions/results from sub-agents

#### When to Use Sub-Agents

**ALWAYS use sub-agents for:**

1. **Code Exploration & Research** 🔍
   - Understanding complex codebases
   - Finding relevant files and patterns
   - Tracing execution flows
   - Example: "Find all files related to authentication"

2. **Implementation Tasks** 💻
   - Writing new features
   - Refactoring code
   - Bug fixes
   - Example: "Implement user authentication"

3. **Code Review & Analysis** 📊
   - Security analysis
   - Performance review
   - Code quality assessment
   - Example: "Review this component for best practices"

4. **Testing & Validation** ✅
   - Writing tests
   - Running test suites
   - Validation tasks
   - Example: "Add unit tests for this module"

5. **Documentation** 📚
   - Writing documentation
   - Generating code comments
   - Creating API docs
   - Example: "Document this API endpoint"

#### Sub-Agent Types

**Use the right sub-agent for the task:**

- **`Explore`**: Fast exploration of codebase, finding files, understanding structure
- **`general-purpose`**: Complex multi-step tasks, research, implementation
- **`Bash`**: Command execution, git operations, npm/cargo commands
- **`Plan`**: Architecture planning, implementation strategy design

#### Best Practices

**DO**:
- ✅ **Always delegate to sub-agents** - even for "simple" tasks
- ✅ **Ask sub-agents for conclusions only** - not full reasoning
- ✅ **Run multiple sub-agents in parallel** - maximize efficiency
- ✅ **Specify clear objectives** - help sub-agents succeed
- ✅ **Use sub-agents early and often** - preserve main context

**DON'T**:
- ❌ Do exploration yourself in the main session
- ❌ Ask sub-agents to explain their reasoning process
- ❌ Waste main session context on implementation details
- ❌ Skip using sub-agents for "quick" tasks

#### Example Workflow

**Bad Approach** (wastes main context):
```
Main Session:
1. Read 10 files to understand authentication
2. Search codebase for patterns
3. Implement authentication feature
4. Write tests
→ Main context is now full of implementation details
```

**Good Approach** (preserves main context):
```
Main Session:
1. Spawn Explore agent: "Understand authentication flow, give me summary"
2. Spawn general-purpose agent: "Implement OAuth2 authentication"
3. Spawn general-purpose agent: "Add tests for auth module"
4. Review sub-agent reports and make decisions
→ Main context contains only conclusions and decisions
```

#### Parallel Sub-Agent Execution

Run independent tasks in parallel to maximize efficiency:

```typescript
// ✅ Good: Parallel execution
const [authAnalysis, testResults, docDraft] = await Promise.all([
  Task({ subagent_type: "Explore", prompt: "Analyze auth system" }),
  Task({ subagent_type: "general-purpose", prompt: "Run auth tests" }),
  Task({ subagent_type: "general-purpose", prompt: "Draft auth docs" })
]);

// ❌ Bad: Sequential execution wastes time
const authAnalysis = await Task({ subagent_type: "Explore", prompt: "..." });
const testResults = await Task({ subagent_type: "general-purpose", prompt: "..." });
const docDraft = await Task({ subagent_type: "general-purpose", prompt: "..." });
```

#### Integration with Codex MCP

Both strategies can work together:
1. Use **sub-agents** for most tasks (unlimited token budget)
2. Use **Codex MCP** for specialized complex analysis (has daily quota)
3. Main session orchestrates both and receives only conclusions

#### Summary

**Remember**: The goal is to **preserve main session context**, not to save tokens. Sub-agents have unlimited token budgets, so use them liberally. The main session should only contain:
- User requests and requirements
- High-level decisions and conclusions
- Final results and summaries
- **NOT**: Implementation details, code exploration, intermediate reasoning

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
