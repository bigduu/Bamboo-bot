# Sidecar Architecture Refactoring Plan

## Context

**Problem**: Current architecture tightly couples frontend with Tauri-specific commands (`invoke()`), making it impossible to:
- Access the application via browser during development
- Deploy the backend independently to Docker
- Run the frontend and backend as separate processes

**Goal**: Implement a sidecar architecture where:
1. Backend runs as an independent HTTP server (sidecar process in Tauri)
2. All business logic uses HTTP API instead of Tauri commands
3. Frontend works in both Tauri desktop and browser environments
4. Single Docker container can serve both frontend and backend

**Outcome**: Three deployment modes:
- **Desktop**: Tauri app with auto-managed sidecar backend
- **Development**: Browser + standalone backend server
- **Production**: Docker container with integrated frontend/backend (localhost only)

## Critical Security Decisions

**Based on code review, these issues must be addressed first:**

1. **CORS/CSRF Protection**: Backend currently uses `Cors::permissive()` - needs origin allowlist
2. **Port Strategy**: How chosen port propagates to frontend `getBackendBaseUrl()`
3. **Data Directory Contract**: All state must respect `--data-dir` parameter consistently
4. **Browser Mode Boundaries**: Which desktop-only features are disabled in browser

**Security Model**:
- Desktop: Sidecar on `127.0.0.1:8080`, CORS allows `tauri://localhost`
- Development: Backend on `127.0.0.1:8080`, CORS allows `http://localhost:1420`
- Docker: Backend on `127.0.0.0:8080`, CORS allows `http://localhost:8080` (localhost only, no remote access)

## Architecture Overview

```
┌─────────────────────────────────────────┐
│  Desktop Mode (Tauri + Sidecar)         │
├─────────────────────────────────────────┤
│  Tauri App                              │
│  ├── Frontend (React)                   │
│  │   └── HTTP API → localhost:8080      │
│  └── Sidecar Manager                    │
│      └── web_service_standalone         │
│          └── HTTP Server (port 8080)    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Development Mode (Browser + Backend)   │
├─────────────────────────────────────────┤
│  Browser                                │
│  └── Frontend (port 1420)               │
│      └── HTTP API → localhost:8080      │
│                                         │
│  Terminal                               │
│  └── web_service_standalone             │
│      └── HTTP Server (port 8080)        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Production Mode (Docker)               │
├─────────────────────────────────────────┤
│  Docker Container                       │
│  ├── Frontend (static files)            │
│  │   └── HTTP API → localhost:8080      │
│  └── web_service                        │
│      └── HTTP Server (port 8080)        │
│          └── Serves static files + API  │
└─────────────────────────────────────────┘
```

## Phase 0: Security & Infrastructure Foundation

**Objective**: Establish security model and infrastructure contracts before refactoring

### 0.1 CORS Configuration

**File**: `crates/web_service/src/server.rs`

**Current Issue**: Line 281 uses `Cors::permissive()` which allows any origin

**Solution**: Implement origin allowlist based on deployment mode:
```rust
fn build_cors(bind_addr: &str, port: u16) -> Cors {
    let mut cors = Cors::default()
        .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
        .allowed_headers(vec![
            header::AUTHORIZATION,
            header::ACCEPT,
            header::CONTENT_TYPE,
        ])
        .max_age(3600);

    // Allowlist origins based on mode
    if bind_addr == "127.0.0.1" || bind_addr == "localhost" {
        // Development/Desktop mode
        cors = cors
            .allowed_origin("http://localhost:1420")  // Vite dev server
            .allowed_origin("http://127.0.0.1:1420")
            .allowed_origin("tauri://localhost")       // Tauri desktop
            .allowed_origin("https://tauri.localhost");
    }

    if bind_addr == "0.0.0.0" {
        // Docker production mode (localhost only via reverse proxy)
        cors = cors.allowed_origin(&format!("http://localhost:{}", port));
    }

    cors
}
```

**Testing**: Verify CORS headers with different origins in each mode

### 0.2 Port Selection & Propagation

**File**: `src/shared/utils/backendBaseUrl.ts`

**Current Issue**: Frontend uses hardcoded logic that doesn't handle dynamic ports

**Solution**: Implement port discovery mechanism:
```typescript
// Add port discovery for sidecar mode
export async function getBackendBaseUrl(): Promise<string> {
  // Check if port is provided via environment/config
  const configPort = window.__BAMBOO_BACKEND_PORT__;
  if (configPort) {
    return `http://127.0.0.1:${configPort}`;
  }

  // Try default port
  const defaultPort = 8080;
  const defaultUrl = `http://127.0.0.1:${defaultPort}`;

  // Health check
  try {
    const response = await fetch(`${defaultUrl}/api/v1/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    if (response.ok) {
      return defaultUrl;
    }
  } catch (e) {
    // Port not available
  }

  throw new Error('Backend server not available');
}

// Add global type
declare global {
  interface Window {
    __BAMBOO_BACKEND_PORT__?: number;
  }
}
```

**Tauri Integration**: Inject port via Tauri window label or config

### 0.3 Data Directory Contract

**Files**:
- `crates/web_service/src/controllers/settings_controller.rs`
- `crates/chat_core/src/paths.rs`

**Current Issue**: Controllers use `chat_core::paths::*` which ignores `--data-dir` parameter

**Solution**:
1. Pass `app_data_dir` through `AppState` to all controllers
2. Replace `bamboo_dir()` calls with `app_state.data_dir.clone()`
3. Add validation in controller initialization

**Implementation**:
```rust
// In settings_controller.rs
pub async fn get_bamboo_config(
    app_state: web::Data<AppState>,  // Use this instead of bamboo_dir()
) -> Result<HttpResponse, AppError> {
    let config_path = app_state.data_dir.join("config.json");
    // ...
}
```

**Testing**: Verify config/workflows/sessions respect `--data-dir` in all modes

### 0.4 Browser Mode Feature Boundaries

**File**: `src/utils/environment.ts` (create)

**Implementation**:
```typescript
export const isTauriEnvironment = (): boolean => {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
};

export const requireDesktopFeature = (featureName: string): void => {
  if (!isTauriEnvironment()) {
    throw new Error(`"${featureName}" is only available in the desktop application`);
  }
};

// Feature flags for browser mode
export const BROWSER_MODE_DISABLED_FEATURES = [
  'setup-wizard',      // Setup flow requires Tauri
  'native-file-picker', // Native dialogs
  'system-proxy-config' // Proxy configuration
] as const;
```

**Usage in components**: Check and gracefully disable desktop-only features

### Testing

```bash
# Test CORS
curl -H "Origin: http://localhost:1420" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS http://localhost:8080/api/v1/health

# Test data directory
cargo run -p web_service_standalone -- --data-dir /tmp/test-data
# Verify config is created in /tmp/test-data

# Test browser mode detection
# In browser console:
console.log(isTauriEnvironment());  // false in browser, true in Tauri
```

---

## Phase 1: Backend HTTP API Extensions

**Objective**: Add missing HTTP endpoints to replace Tauri commands

### 1.1 Workflow Management Endpoints

**File**: `crates/web_service/src/controllers/settings_controller.rs`

Add POST and DELETE endpoints for workflows:
- `POST /v1/bamboo/workflows` - Save/update workflow
- `DELETE /v1/bamboo/workflows/{name}` - Delete workflow

**Pattern**: Follow existing `list_workflows` and `get_workflow` patterns (lines 109-186)

**Implementation**: Move logic from `src-tauri/src/command/workflows.rs` to HTTP endpoint

### 1.2 Keyword Masking Endpoints

**File**: `crates/web_service/src/controllers/settings_controller.rs`

Add keyword masking endpoints:
- `GET /v1/bamboo/keyword-masking` - Get config
- `POST /v1/bamboo/keyword-masking` - Update config
- `POST /v1/bamboo/keyword-masking/validate` - Validate without saving

**Pattern**: Similar to `get_bamboo_config` / `set_bamboo_config` patterns

**Implementation**: Move logic from `src-tauri/src/command/keyword_masking.rs`

### 1.3 Slash Command Endpoints

**File**: `crates/web_service/src/controllers/command_controller.rs`

**Note**: Consider deferring slash command CRUD to a later milestone if not immediately needed. These endpoints add complexity with YAML parsing and path-based security concerns.

**If implementing now**, add slash command CRUD:
- `GET /v1/bamboo/slash-commands` - List all
- `GET /v1/bamboo/slash-commands/{id}` - Get specific
- `POST /v1/bamboo/slash-commands` - Save
- `DELETE /v1/bamboo/slash-commands/{id}` - Delete

**Implementation**: Move logic from `src-tauri/src/command/slash_commands.rs`

**Recommendation**: Start with read-only endpoints, add write operations later

### 1.4 Update Server Routes

**File**: `crates/web_service/src/server.rs`

Register new endpoints in `config()` function

### Testing

```bash
# Unit tests - add actix-web handler tests
cargo test -p web_service

# Integration tests - add to crates/web_service/tests/
# Follow pattern in settings_config_tests.rs

# Manual testing
curl -X POST http://localhost:8080/v1/bamboo/workflows \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:1420" \
  -d '{"name":"test","content":"# Test Workflow"}'

# Verify response includes correct CORS headers
```

---

## Phase 2: Sidecar Integration in Tauri

**Objective**: Run web_service_standalone as managed sidecar process

**Critical Change**: Use Tauri v2's native sidecar bundling mechanism instead of custom PATH discovery

### 2.1 Configure Sidecar in Tauri

**File**: `src-tauri/tauri.conf.json`

**Add sidecar configuration**:
```json
{
  "bundle": {
    "externalBin": [
      "binaries/web_service_standalone"
    ]
  }
}
```

**Create sidecar directory structure**:
```
src-tauri/
└── binaries/
    ├── web_service_standalone-x86_64-apple-darwin    (macOS Intel)
    ├── web_service_standalone-aarch64-apple-darwin   (macOS ARM)
    ├── web_service_standalone-x86_64-pc-windows-msvc (Windows)
    └── web_service_standalone-x86_64-unknown-linux-gnu (Linux)
```

**Update build process** to automatically build and place binaries:
```json
{
  "build": {
    "beforeBuildCommand": "yarn build && cargo build --release -p web_service_standalone && node scripts/copy-sidecar.js",
    "beforeDevCommand": "cargo build -p web_service_standalone && node scripts/copy-sidecar.js && yarn dev"
  }
}
```

**Create**: `scripts/copy-sidecar.js` to copy binary to correct location with target triple naming

### 2.2 Create Sidecar Manager

**File to create**: `src-tauri/src/sidecar/mod.rs`

**File to create**: `src-tauri/src/sidecar/web_service_manager.rs`

**Key features**:
- Use Tauri's `sidecar()` API to resolve bundled binary (no custom PATH discovery)
- Port availability check
- Process spawning with ProcessRegistry
- Health check with retry (10 attempts, 500ms intervals)
- Graceful shutdown via ProcessRegistry
- Capture stdout/stderr for observability

**Pattern**: Use existing `process/registry.rs` for process management

**Implementation**:
```rust
use tauri::api::process::Command;

pub async fn start(&self, app_handle: &AppHandle) -> Result<u32, String> {
    // 1. Resolve sidecar binary using Tauri API
    let sidecar_command = Command::new_sidecar("web_service_standalone")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?;

    // 2. Check port availability
    self.check_port_available().await?;

    // 3. Spawn process with logging
    let (mut rx, child) = sidecar_command
        .args([
            "--port", &self.port.to_string(),
            "--data-dir", &self.data_dir.to_string_lossy(),
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn web service: {}", e))?;

    let pid = child.pid();
    info!("Web service sidecar started with PID: {}", pid);

    // 4. Capture stdout/stderr in background
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                tauri::api::process::CommandEvent::Stdout(line) => {
                    info!("[sidecar stdout] {}", line);
                }
                tauri::api::process::CommandEvent::Stderr(line) => {
                    warn!("[sidecar stderr] {}", line);
                }
                _ => {}
            }
        }
    });

    // 5. Register with ProcessRegistry
    // ... (existing code)

    // 6. Health check with retry
    self.wait_for_health().await?;

    Ok(pid)
}

### 2.2 Integrate with Tauri Lifecycle

**File**: `src-tauri/src/lib.rs`

**Changes**:
1. Remove inline web_service spawn (lines with `start_server`)
2. Add sidecar startup in `setup()` function
3. Add shutdown handler in `run()` function
4. Manage SidecarState

**Implementation**:
```rust
// In setup()
let sidecar = Arc::new(WebServiceSidecar::new(8080, app_data_dir.clone(), process_registry.clone()));
tauri::async_runtime::spawn(async move {
    sidecar.start().await
});
app.manage(SidecarState(sidecar));

// In run() - add ExitRequested handler for graceful shutdown
```

### 2.3 Update Dependencies

**File**: `src-tauri/Cargo.toml`

**No additional dependencies needed** - Tauri v2 includes sidecar support

### 2.4 Removed (Use Tauri's native sidecar instead)

The previous section about custom build configuration has been replaced with Tauri v2's native sidecar bundling.

### Testing

```bash
# 1. Build sidecar binary
cargo build -p web_service_standalone

# 2. Copy to binaries directory
node scripts/copy-sidecar.js

# 3. Run Tauri
yarn tauri dev

# 4. Verify in logs:
# - "Web service sidecar started with PID: xxx"
# - "[sidecar stdout] Server running on http://127.0.0.1:8080"
# - "Web service health check passed"

# 5. Test graceful shutdown
# Close app, verify clean shutdown in logs
```

---

## Phase 3: Frontend HTTP Migration

**Objective**: Remove ALL invoke() calls from business logic, use ServiceFactory HTTP API

**Critical**: This phase now covers ALL Tauri invocations, not just workflows/keyword masking

### 3.1 Extend ServiceFactory

**File**: `src/services/common/ServiceFactory.ts`

Add HTTP methods to UtilityService interface:
- `saveWorkflow(name, content)`
- `deleteWorkflow(name)`
- `getKeywordMaskingConfig()`
- `updateKeywordMaskingConfig(entries)`
- `validateKeywordEntries(entries)`
- `listSlashCommands()` (optional, defer if not needed)
- `getSlashCommand(id)` (optional)
- `saveSlashCommand(command)` (optional)
- `deleteSlashCommand(id)` (optional)

Implement in `HttpUtilityService` class using existing `apiClient` pattern

### 3.2 Migrate Workflow Tab

**File**: `src/pages/SettingsPage/components/SystemSettingsPage/SystemSettingsWorkflowsTab.tsx`

**Changes**:
- Replace `invoke("save_workflow")` with `serviceFactory.saveWorkflow()`
- Replace `invoke("delete_workflow")` with `serviceFactory.deleteWorkflow()`
- Remove `isTauri` check (ServiceFactory handles mode)

### 3.3 Migrate Keyword Masking Tab

**File**: `src/pages/SettingsPage/components/SystemSettingsPage/SystemSettingsKeywordMaskingTab.tsx`

Replace all `invoke()` calls with ServiceFactory methods

### 3.4 Migrate Setup Flow (Critical for Browser Mode)

**Files**:
- `src/app/App.tsx` - Line 4: Replace `get_setup_status` invoke
- `src/services/config/ConfigService.ts` - Replace Tauri commands
- `src/pages/SetupPage/SetupPage.tsx` - Lines 2+: Replace all setup-related invokes

**Strategy**:
```typescript
// Add HTTP endpoints to backend first (Phase 1 extension)
// GET /v1/bamboo/setup/status
// POST /v1/bamboo/setup/complete
// POST /v1/bamboo/setup/incomplete

// In frontend:
export class HttpUtilityService {
  async getSetupStatus(): Promise<SetupStatus> {
    return await apiClient.get<SetupStatus>("bamboo/setup/status");
  }

  async markSetupComplete(): Promise<void> {
    await apiClient.post("bamboo/setup/complete");
  }
}

// Desktop-only features should check environment
export class TauriUtilityService {
  async getProxyConfig(): Promise<ProxyConfig> {
    requireDesktopFeature('system-proxy-config');
    return await invoke("get_proxy_config");
  }
}
```

**Browser Mode UX**: Add graceful fallback for desktop-only features:
```typescript
// In SetupPage.tsx
const handleProxyConfig = async () => {
  try {
    const serviceFactory = ServiceFactory.getInstance();
    await serviceFactory.getProxyConfig();
  } catch (error) {
    if (error.message.includes('only available in desktop')) {
      message.info('Proxy configuration is only available in the desktop app');
      // Skip proxy step in browser mode
    }
  }
};
```

### 3.4 Add Web Clipboard API (Moved from 3.5)

**File**: `src/services/common/ServiceFactory.ts`

In `TauriUtilityService.copyToClipboard()`:
1. Try Tauri invoke first
2. Fallback to `navigator.clipboard.writeText()`
3. Fallback to legacy `document.execCommand("copy")`

### 3.5 Environment Detection (Already done in Phase 0)

**File**: `src/utils/environment.ts` (created in Phase 0)

Use `isTauriEnvironment()` and `requireDesktopFeature()` for conditional logic

### 3.6 Keep Desktop-Only Features (Updated)

**Files**: Setup flow components

Keep Tauri commands for:
- `get/set_proxy_config` (desktop-only, with graceful fallback)
- `pick_folder` (native file dialog)

**Note**: Setup status endpoints now use HTTP API (added in Phase 1)

### 3.7 Update Backend for Setup Endpoints (Phase 1 Extension)

**File**: `crates/web_service/src/controllers/settings_controller.rs`

Add setup endpoints:
- `GET /v1/bamboo/setup/status` - Check setup completion
- `POST /v1/bamboo/setup/complete` - Mark setup complete
- `POST /v1/bamboo/setup/incomplete` - Reset setup

### Testing

```bash
# 1. Browser mode - Full integration test
cargo run -p web_service_standalone  # Terminal 1
yarn dev                             # Terminal 2

# Verify:
# - No Tauri dependency errors in browser console
# - All features work via HTTP (workflows, keyword masking, setup)
# - Clipboard uses Web API
# - Desktop-only features show graceful fallback

# 2. Tauri mode
yarn tauri dev

# Verify:
# - Sidecar starts
# - Features work via HTTP
# - Setup flow uses HTTP for status, Tauri for proxy config
# - Native features work (clipboard, dialogs)
```

---

## Phase 4: Docker Static File Serving

**Objective**: Single-container deployment with integrated frontend

### 4.1 Add actix-files Dependency

**File**: `crates/web_service/Cargo.toml`

```toml
[dependencies]
actix-files = "0.6"
```

### 4.2 Add Static File Serving

**File**: `crates/web_service/src/server.rs`

Add new function:
```rust
pub async fn run_with_bind_and_static(
    app_data_dir: PathBuf,
    port: u16,
    bind_addr: &str,
    static_dir: Option<&Path>,
) -> Result<(), String>
```

**Implementation**:
- If `static_dir` provided, serve static files at root
- Configure SPA fallback (serve index.html for unmatched routes)
- Keep existing API routes

**File**: `crates/web_service/src/main.rs`

Add `--static-dir` CLI argument and `BAMBOO_STATIC_DIR` env var support

### 4.3 Update Dockerfile

**File**: `docker/Dockerfile`

**Multi-stage build**:
1. **Stage 1**: Build frontend (Node.js 20 Alpine)
   - `npm ci`
   - `npm run build`
2. **Stage 2**: Build backend (existing Rust build)
3. **Stage 3**: Runtime (Debian Bookworm)
   - Copy backend binary
   - Copy frontend dist to `/app/static`
   - Run with `--static-dir /app/static`

### 4.4 Update docker-compose.yml

**File**: `docker/docker-compose.yml`

No changes needed - same configuration works

### 4.5 Update Documentation

**File**: `docker/README.md`

Add section about single-container deployment and environment variables

### Testing

```bash
# 1. Build
cd docker
docker build -t bamboo-full:latest .

# 2. Run
docker run -d -p 8080:8080 bamboo-full:latest

# 3. Test
curl http://localhost:8080              # HTML (frontend)
curl http://localhost:8080/api/v1/health  # JSON (API)
curl http://localhost:8080/settings     # HTML (SPA fallback)
```

---

## Phase 5: Testing & Documentation

### 5.1 Integration Testing

Test all three deployment modes:

**Desktop (Tauri + Sidecar)**:
```bash
npm run tauri dev
# - Sidecar starts automatically
# - Health check passes
# - All HTTP APIs work
# - Setup flow works
# - Native features work (clipboard, dialogs)
```

**Browser Development (HTTP only)**:
```bash
cargo run -p web_service_standalone  # Terminal 1
npm run dev                           # Terminal 2
# - Frontend connects to backend
# - All features work via HTTP
# - No Tauri errors
# - Web Clipboard API works
```

**Docker (Integrated)**:
```bash
cd docker && docker-compose up
# - Single container runs
# - Frontend at http://localhost:8080
# - API at http://localhost:8080/api/v1/*
# - All features work
```

### 5.2 Update CLAUDE.md

**File**: `CLAUDE.md`

Add sections:
- **Deployment Modes**: Describe three modes with use cases
- **Backend as Sidecar**: Explain sidecar architecture
- **HTTP API**: Document HTTP-first approach
- **Tauri Commands**: List desktop-only commands

### 5.3 Create Migration Guide

**File to create**: `docs/MIGRATION.md`

Content:
- Testing in browser mode
- Adding new features (when to use HTTP vs Tauri)
- Debugging sidecar issues

---

## Critical Files (Updated)

Most important files for implementation:

1. `crates/web_service/src/server.rs` - CORS configuration & static file serving
2. `crates/web_service/src/controllers/settings_controller.rs` - Add missing HTTP endpoints + setup endpoints
3. `src/shared/utils/backendBaseUrl.ts` - Port discovery mechanism
4. `src/services/common/ServiceFactory.ts` - Complete HTTP abstraction for all features
5. `src-tauri/src/sidecar/web_service_manager.rs` (CREATE) - Sidecar management with Tauri v2 API
6. `src-tauri/src/lib.rs` - Integrate sidecar with app lifecycle
7. `src/utils/environment.ts` (CREATE) - Environment detection & feature flags

## Success Criteria (Updated based on Codex Review)

1. ✅ Desktop app starts with auto-managed sidecar
2. ✅ Frontend works in browser without Tauri runtime (no console errors)
3. ✅ Docker container serves integrated frontend + backend (localhost only)
4. ✅ All business logic uses HTTP API (setup status, workflows, keyword masking)
5. ✅ Desktop-only features gracefully disabled in browser mode
6. ✅ CORS properly configured for each deployment mode
7. ✅ Data directory contract enforced (`--data-dir` respected everywhere)
8. ✅ Port discovery works across all modes
9. ✅ No breaking changes to existing functionality

## Risk Mitigation (Added from Codex Review)

1. **Security**:
   - CORS origin allowlist per mode (no `permissive()` in production)
   - Localhost-only binding for Docker
   - Desktop-only features require environment check

2. **Browser Mode**:
   - Test ALL invoke() calls are migrated (setup, workflows, keyword masking)
   - Add graceful fallbacks for desktop-only features
   - Verify no Tauri dependency errors in browser console

3. **Sidecar**:
   - Use Tauri v2's native sidecar bundling (not custom PATH discovery)
   - Capture stdout/stderr for debugging
   - Health check with retry before marking ready

4. **Data Directory**:
   - Pass `app_data_dir` through AppState to all controllers
   - Replace `bamboo_dir()` calls with `app_state.data_dir`
   - Test with custom `--data-dir` parameter

5. **Build Consistency**:
   - Use `yarn` consistently (not `npm`)
   - Add actix-web tests for new endpoints
   - Add cross-mode smoke test script

### Test Commands

```bash
# Phase 0: Security & Infrastructure
# Test CORS
curl -H "Origin: http://localhost:1420" -X OPTIONS http://localhost:8080/api/v1/health

# Test data directory
cargo run -p web_service_standalone -- --data-dir /tmp/test-data
ls /tmp/test-data  # Should see config.json

# Phase 1: Test HTTP endpoints
curl -X POST http://localhost:8080/v1/bamboo/workflows \
  -H "Content-Type: application/json" \
  -d '{"name":"test","content":"test"}'

curl -X GET http://localhost:8080/v1/bamboo/setup/status

# Phase 3: Test browser mode (before sidecar!)
cargo run -p web_service_standalone &
yarn dev
# Open http://localhost:1420
# Verify no Tauri errors in browser console

# Phase 2: Test sidecar
yarn tauri dev
# Check logs for: "[sidecar stdout] Server running"
# Check logs for: "Web service health check passed"

# Phase 4: Test Docker
cd docker && docker build -t bamboo-full:latest .
docker run -d -p 8080:8080 bamboo-full:latest
curl http://localhost:8080  # Should return HTML
curl http://localhost:8080/api/v1/health  # Should return JSON

# Phase 5: Full integration test
# Test all three modes with all features
# Run automated test script (to be created)
```

---

## Phase 6: Playwright E2E Testing

**Objective**: Comprehensive end-to-end testing for all three deployment modes

### 6.1 Setup Playwright

**Files to create**:
- `e2e/playwright.config.ts` - Playwright configuration
- `e2e/package.json` - E2E test dependencies
- `e2e/.env.test` - Test environment variables

**Dependencies**:
```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@types/node": "^20"
  }
}
```

**Playwright configuration**:
```typescript
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: process.env.E2E_START_SERVER || 'echo "Server should be running"',
    url: 'http://localhost:8080/api/v1/health',
    reuseExistingServer: !process.env.E2E_START_SERVER,
    timeout: 120000,
  },
});
```

### 6.2 Test Suites

**Directory structure**:
```
e2e/
├── tests/
│   ├── setup-flow.spec.ts        # Setup wizard tests
│   ├── chat-functionality.spec.ts # Chat operations
│   ├── workflows.spec.ts         # Workflow management
│   ├── keyword-masking.spec.ts   # Keyword masking
│   ├── settings.spec.ts          # Settings management
│   └── modes/
│       ├── browser-mode.spec.ts  # Browser-specific tests
│       ├── desktop-mode.spec.ts  # Desktop-only features
│       └── docker-mode.spec.ts   # Docker deployment tests
├── fixtures/
│   ├── test-workflow.md
│   └── test-config.json
├── utils/
│   ├── api-helpers.ts
│   └── test-helpers.ts
└── playwright.config.ts
```

### 6.3 Core Test Cases

**File to create**: `e2e/tests/setup-flow.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Setup Flow', () => {
  test('should complete setup in browser mode', async ({ page }) => {
    await page.goto('/');

    // Check setup page appears
    await expect(page.locator('[data-testid="setup-wizard"]')).toBeVisible();

    // Complete setup steps
    await page.click('[data-testid="setup-next"]');
    // ... more steps

    // Verify redirect to chat
    await expect(page).toHaveURL(/.*\/chat/);
  });

  test('should skip proxy configuration in browser mode', async ({ page }) => {
    await page.goto('/setup');

    // Proxy step should be skipped or show info message
    const proxySection = page.locator('[data-testid="proxy-config"]');
    const isVisible = await proxySection.isVisible();

    if (isVisible) {
      // Desktop mode - can configure proxy
      await expect(proxySection).toBeVisible();
    } else {
      // Browser mode - should show message
      await expect(page.locator('text=only available in desktop')).toBeVisible();
    }
  });
});
```

**File to create**: `e2e/tests/chat-functionality.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure setup is complete
    await page.goto('/');
    // ... setup completion logic
  });

  test('should send message and receive response', async ({ page }) => {
    await page.goto('/chat');

    // Type message
    await page.fill('[data-testid="chat-input"]', 'Hello, AI!');
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({
      timeout: 30000
    });
  });

  test('should stream response correctly', async ({ page }) => {
    await page.goto('/chat');

    await page.fill('[data-testid="chat-input"]', 'Tell me a story');
    await page.click('[data-testid="send-button"]');

    // Verify streaming indicators
    await expect(page.locator('[data-testid="streaming-indicator"]')).toBeVisible();

    // Wait for completion
    await expect(page.locator('[data-testid="streaming-indicator"]')).not.toBeVisible({
      timeout: 60000
    });
  });

  test('should handle errors gracefully', async ({ page, context }) => {
    // Simulate network error
    await context.route('**/api/v1/chat', route => route.abort());

    await page.goto('/chat');
    await page.fill('[data-testid="chat-input"]', 'Test error');
    await page.click('[data-testid="send-button"]');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });
});
```

**File to create**: `e2e/tests/workflows.spec.ts`
```typescript
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Workflow Management', () => {
  test('should create workflow via HTTP API', async ({ page }) => {
    await page.goto('/settings/workflows');

    // Click create button
    await page.click('[data-testid="create-workflow"]');

    // Fill workflow
    await page.fill('[data-testid="workflow-name"]', 'test-workflow');
    await page.fill('[data-testid="workflow-content"]', '# Test Workflow\n\nThis is a test.');

    // Save
    await page.click('[data-testid="save-workflow"]');

    // Verify in list
    await expect(page.locator('text=test-workflow')).toBeVisible();
  });

  test('should delete workflow', async ({ page }) => {
    // First create a workflow
    // ... API call to create

    await page.goto('/settings/workflows');

    // Delete workflow
    await page.click('[data-testid="delete-test-workflow"]');

    // Confirm deletion
    await page.click('[data-testid="confirm-delete"]');

    // Verify removed
    await expect(page.locator('text=test-workflow')).not.toBeVisible();
  });

  test('should edit existing workflow', async ({ page }) => {
    await page.goto('/settings/workflows');

    // Click on workflow
    await page.click('text=my-workflow');

    // Edit content
    await page.fill('[data-testid="workflow-content"]', 'Updated content');
    await page.click('[data-testid="save-workflow"]');

    // Verify saved
    await expect(page.locator('text=Saved successfully')).toBeVisible();
  });
});
```

**File to create**: `e2e/tests/modes/browser-mode.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Browser Mode Specific Tests', () => {
  test.use({ baseURL: 'http://localhost:1420' }); // Vite dev server

  test('should connect to backend on port 8080', async ({ page }) => {
    await page.goto('/');

    // Check backend health
    const healthResponse = await page.request.get('http://localhost:8080/api/v1/health');
    expect(healthResponse.ok()).toBeTruthy();
  });

  test('should use Web Clipboard API', async ({ page }) => {
    await page.goto('/chat');

    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Copy text
    await page.click('[data-testid="copy-message"]');

    // Verify clipboard
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBeTruthy();
  });

  test('should show graceful fallback for desktop-only features', async ({ page }) => {
    await page.goto('/settings');

    // Check for desktop-only feature notice
    const desktopOnlyFeatures = page.locator('[data-testid="desktop-only-notice"]');

    if (await desktopOnlyFeatures.count() > 0) {
      await expect(desktopOnlyFeatures.first()).toContainText('desktop application');
    }
  });
});
```

**File to create**: `e2e/tests/modes/desktop-mode.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Desktop Mode Specific Tests', () => {
  // Note: These tests require Tauri to be running
  test.skip(({ browserName }) => browserName !== 'chromium', 'Desktop tests only on Chromium');

  test('should use native clipboard via Tauri', async ({ page }) => {
    // Test Tauri clipboard integration
    await page.goto('/chat');

    await page.click('[data-testid="copy-message"]');

    // Verify Tauri command was called
    // (This would need custom test setup to mock Tauri)
  });

  test('should show native file picker', async ({ page }) => {
    await page.goto('/settings/workflows');

    // Test native file dialog
    // (Requires special test setup for Tauri dialogs)
  });
});
```

**File to create**: `e2e/tests/modes/docker-mode.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Docker Mode Tests', () => {
  test.use({ baseURL: 'http://localhost:8080' }); // Docker container

  test('should serve static frontend', async ({ page }) => {
    await page.goto('/');

    // Verify HTML is returned
    const title = await page.title();
    expect(title).toContain('Bamboo');
  });

  test('should serve SPA fallback for all routes', async ({ page }) => {
    const routes = ['/chat', '/settings', '/settings/workflows'];

    for (const route of routes) {
      await page.goto(route);
      // Should not get 404
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should handle CORS correctly', async ({ page, context }) => {
    // Test that API requests work from frontend origin
    const response = await page.request.get('/api/v1/health');
    expect(response.ok()).toBeTruthy();

    // Check CORS headers
    const corsHeader = response.headers()['access-control-allow-origin'];
    expect(corsHeader).toContain('localhost');
  });
});
```

### 6.4 Test Helpers

**File to create**: `e2e/utils/api-helpers.ts`
```typescript
import { APIRequestContext } from '@playwright/test';

export async function setupTestConfig(request: APIRequestContext) {
  // Create test configuration via API
  await request.post('/api/v1/bamboo/config', {
    data: {
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'test-key'
    }
  });
}

export async function cleanupTestData(request: APIRequestContext) {
  // Delete test workflows
  const workflows = await request.get('/api/v1/bamboo/workflows');
  const data = await workflows.json();

  for (const workflow of data.workflows || []) {
    if (workflow.name.startsWith('test-')) {
      await request.delete(`/api/v1/bamboo/workflows/${workflow.name}`);
    }
  }
}

export async function waitForBackendHealth(request: APIRequestContext, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await request.get('/api/v1/health');
      if (response.ok()) return true;
    } catch (e) {
      // Continue retrying
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Backend health check failed');
}
```

### 6.5 Test Scripts

**File to modify**: `package.json`

Add scripts:
```json
{
  "scripts": {
    "test:e2e": "playwright test --project=desktop",
    "test:e2e:browser": "E2E_BASE_URL=http://localhost:1420 playwright test --project=desktop",
    "test:e2e:docker": "E2E_BASE_URL=http://localhost:8080 playwright test --project=desktop",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report"
  }
}
```

### 6.6 CI Integration

**File to create**: `.github/workflows/e2e-tests.yml`
```yaml
name: E2E Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test-browser-mode:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: yarn install

      - name: Build frontend
        run: yarn build

      - name: Build backend
        run: cargo build --release -p web_service_standalone

      - name: Start backend
        run: |
          ./target/release/web_service_standalone --port 8080 --data-dir /tmp/test-data &
          sleep 5

      - name: Start frontend
        run: |
          yarn preview --port 1420 &
          sleep 5

      - name: Run E2E tests
        run: yarn test:e2e:browser

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report-browser
          path: e2e/playwright-report/

  test-docker-mode:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: |
          cd docker
          docker build -t bamboo-test:latest .

      - name: Run Docker container
        run: |
          docker run -d -p 8080:8080 --name bamboo-test bamboo-test:latest
          sleep 10

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install E2E dependencies
        run: |
          cd e2e
          yarn install

      - name: Run E2E tests
        run: yarn test:e2e:docker

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report-Docker
          path: e2e/playwright-report/

      - name: Cleanup
        run: |
          docker stop bamboo-test
          docker rm bamboo-test
```

### 6.7 Test Data Fixtures

**File to create**: `e2e/fixtures/test-workflow.md`
```markdown
# Test Workflow

This is a test workflow for E2E testing.

## Steps

1. First step
2. Second step
3. Third step

## Notes

- Test note 1
- Test note 2
```

**File to create**: `e2e/fixtures/test-config.json`
```json
{
  "provider": "openai",
  "model": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 1000
}
```

### 6.8 Testing Strategy

**Test execution order**:

1. **Unit tests** (Rust + TypeScript) - Run first, fast feedback
2. **API tests** (actix-web tests) - Test HTTP endpoints directly
3. **E2E browser mode** - Test with `web_service_standalone` + Vite dev server
4. **E2E Docker mode** - Test integrated container
5. **E2E desktop mode** - Test Tauri app (manual or special CI setup)

**Coverage goals**:
- Setup flow: 100%
- Chat functionality: 80%
- Workflows: 90%
- Keyword masking: 90%
- Settings: 70%
- Mode-specific features: 80%

### 6.9 Documentation

**File to create**: `e2e/README.md`
```markdown
# E2E Testing

## Setup

1. Install dependencies:
   ```bash
   cd e2e
   yarn install
   npx playwright install
   ```

2. Run tests:
   ```bash
   # Browser mode (requires backend + frontend running)
   cargo run -p web_service_standalone &
   yarn dev &
   yarn test:e2e:browser

   # Docker mode
   cd docker && docker-compose up -d
   yarn test:e2e:docker

   # Desktop mode (requires Tauri running)
   yarn tauri dev &
   yarn test:e2e
   ```

## Test Structure

- `tests/setup-flow.spec.ts` - Setup wizard tests
- `tests/chat-functionality.spec.ts` - Chat operations
- `tests/workflows.spec.ts` - Workflow management
- `tests/modes/` - Mode-specific tests

## Debugging

Run tests in UI mode:
```bash
yarn test:e2e:ui
```

Debug mode:
```bash
yarn test:e2e:debug
```
```

---

## Updated Implementation Sequence

1. **Phase 0** (Security & Infrastructure): 1-2 days
2. **Phase 1** (Backend HTTP API): 2-3 days
3. **Phase 3** (Frontend HTTP Migration): 2-3 days
4. **Phase 2** (Sidecar Integration): 2-3 days
5. **Phase 4** (Docker): 1 day
6. **Phase 6** (Playwright E2E): 2-3 days **← NEW**
7. **Phase 5** (Testing & Docs): 1-2 days

**Total**: 11-17 days

- **Security First**: Phase 0 establishes CORS, data directory contract, and port strategy
- **De-risk**: Phase 3 before Phase 2 - validate HTTP API in browser mode before sidecar complexity
- **Reuse existing infrastructure**: ProcessRegistry, ServiceFactory, web_service
- **Use Tauri v2 sidecar**: Native bundling instead of custom PATH discovery
- **Gradual migration**: Frontend can work in both Tauri and browser modes
- **Graceful degradation**: Desktop-only features show friendly messages in browser
- **HTTP-first**: All business logic via HTTP API
- **Docker localhost-only**: Security decision based on deployment requirements
- **Consistent tooling**: Use `yarn` throughout (not `npm`)
- **Test automation**: Add actix tests + cross-mode smoke tests

## Key Decisions from Codex Review

1. **Added Phase 0**: Security & infrastructure foundation before any refactoring
2. **Reordered phases**: Phase 3 (Frontend) before Phase 2 (Sidecar) to de-risk
3. **Setup flow migration**: Now uses HTTP API, not Tauri commands
4. **Tauri v2 sidecar**: Use native bundling instead of custom discovery
5. **Slash commands**: Optional, can defer if not immediately needed
6. **CORS strategy**: Explicit allowlist per mode, no permissive in production
7. **Data directory**: Enforce contract through AppState, not global paths
8. **Port strategy**: Health check + discovery mechanism for frontend

---

**Plan Version**: 2.0 (Updated based on Codex security review)
**Estimated Effort**: 10-14 days
**Risk Level**: Medium (mitigated by phased approach and security-first strategy)
