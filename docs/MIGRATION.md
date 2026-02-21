# Bamboo Sidecar Architecture Migration Guide

This guide explains the sidecar architecture refactoring and how to work with the new system. Whether you're testing in browser mode, adding new features, or debugging issues, this guide provides practical examples and troubleshooting tips.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Testing in Browser Mode](#testing-in-browser-mode)
3. [Adding New Features](#adding-new-features)
4. [Debugging Sidecar Issues](#debugging-sidecar-issues)
5. [Feature Flags for Browser Mode](#feature-flags-for-browser-mode)
6. [Port Discovery and CORS Troubleshooting](#port-discovery-and-cors-troubleshooting)
7. [Development Workflow](#development-workflow)
8. [Security Considerations](#security-considerations)
9. [Performance](#performance)
10. [Testing](#testing)

## Architecture Overview

Bamboo now supports three deployment modes:

### 1. Desktop Mode (Tauri + Sidecar)
- **Use case**: End-user desktop application
- **How it works**: Tauri manages a sidecar process (web_service_standalone) that runs the backend HTTP server
- **Port**: 8080 (localhost only)
- **CORS**: Allows `tauri://localhost` and `http://localhost:1420`

### 2. Development Mode (Browser + Backend)
- **Use case**: Frontend development with hot reload
- **How it works**: Run backend and frontend as separate processes
- **Port**: Backend on 8080, Frontend on 1420
- **CORS**: Allows `http://localhost:1420`

### 3. Docker Mode (Integrated)
- **Use case**: Production deployment
- **How it works**: Single container serves both frontend (static files) and backend API
- **Port**: 8080 (localhost only)
- **CORS**: Allows `http://localhost:8080`

## Testing in Browser Mode

Browser mode is essential for frontend development with hot reload and for testing features that should work in both desktop and browser environments.

### Starting the Backend (web_service_standalone)

The backend runs as a standalone HTTP server independent of Tauri.

**Terminal 1 - Start backend:**
```bash
# Default configuration (port 8080, data in ~/.bamboo/)
cargo run -p web_service_standalone

# Or with explicit options
cargo run -p web_service_standalone -- serve --port 8080

# With custom data directory
cargo run -p web_service_standalone -- serve --port 8080 --data-dir /tmp/test-bamboo

# Using environment variables
APP_PORT=3000 cargo run -p web_service_standalone
```

**What happens when you start the backend:**
1. Initializes tracing/logging with DEBUG level
2. Creates data directory if it doesn't exist (default: `~/.bamboo/`)
3. Starts HTTP server on configured port (default: 8080)
4. Enables CORS for `http://localhost:1420` (Vite dev server)
5. Registers all API routes under `/api/v1/`

**Verify backend is running:**
```bash
# Check health endpoint
curl http://localhost:8080/api/v1/health

# Expected response: {"status":"ok"}
```

### Starting the Frontend (Vite Dev Server)

**Terminal 2 - Start frontend:**
```bash
# Install dependencies (first time only)
yarn install

# Start Vite dev server
yarn dev
```

The frontend will start on `http://localhost:1420` with hot module replacement (HMR) enabled.

**How frontend connects to backend:**
1. Frontend calls `getBackendBaseUrl()` from `src/shared/utils/backendBaseUrl.ts`
2. Checks `window.__BAMBOO_BACKEND_PORT__` (Tauri injection - not available in browser)
3. Attempts health check on default port `http://127.0.0.1:8080/v1/health`
4. If successful, uses `http://127.0.0.1:8080/v1` as base URL
5. All API calls use this base URL via `apiClient`

**Verify frontend is running:**
```bash
# Open in browser
open http://localhost:1420
```

### Verifying Backend Connectivity

Once both servers are running, verify the connection:

**1. Check browser console (F12):**
```javascript
// No CORS errors
// No "Failed to fetch" errors
// API calls return data successfully
```

**2. Test API call manually:**
```javascript
// In browser console
fetch('http://localhost:8080/api/v1/bamboo/config')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

**3. Check Network tab:**
- All requests to `http://localhost:8080` should return 200 OK
- CORS headers should be present: `Access-Control-Allow-Origin: http://localhost:1420`

### Common Issues and Solutions

#### Issue: CORS Error

**Symptom:**
```
Access to fetch at 'http://localhost:8080/api/v1/bamboo/config'
from origin 'http://localhost:1420' has been blocked by CORS policy
```

**Solution:**
1. Ensure backend is started with correct bind address (default: `127.0.0.1`)
2. Check CORS configuration in `crates/web_service/src/server.rs`:
   ```rust
   // Should allow http://localhost:1420
   cors = cors.allowed_origin("http://localhost:1420");
   ```
3. Restart backend after changing CORS configuration

#### Issue: Connection Refused

**Symptom:**
```
ERR_CONNECTION_REFUSED http://localhost:8080/api/v1/health
```

**Solution:**
1. Check backend is running: `curl http://localhost:8080/api/v1/health`
2. Check port is not in use: `lsof -i :8080`
3. Try a different port: `cargo run -p web_service_standalone -- serve --port 3000`
4. Update frontend to use custom port (see Port Discovery section)

#### Issue: Health Check Timeout

**Symptom:**
Frontend shows "Backend server not available" after 2 seconds

**Solution:**
1. Backend startup is slow - wait a few more seconds
2. Check backend logs for startup errors
3. Verify firewall is not blocking localhost connections
4. Try direct health check: `curl http://localhost:8080/api/v1/health`

#### Issue: Data Not Persisting

**Symptom:**
Changes made in browser mode are lost after restart

**Solution:**
1. Check data directory exists: `ls -la ~/.bamboo/`
2. Ensure backend has write permissions: `chmod 755 ~/.bamboo/`
3. Check backend logs for file I/O errors
4. Try custom data directory to isolate issues:
   ```bash
   cargo run -p web_service_standalone -- serve --data-dir /tmp/test-bamboo
   ```

### Browser Mode Feature Testing

Test that all HTTP-based features work in browser mode:

```bash
# Terminal 1: Backend
cargo run -p web_service_standalone

# Terminal 2: Frontend
yarn dev

# Open http://localhost:1420
```

**Test checklist:**
- [ ] Workflows can be created, saved, and deleted
- [ ] Keyword masking configuration saves correctly
- [ ] Setup status can be checked
- [ ] Configuration can be loaded and saved
- [ ] Chat functionality works (requires API key)
- [ ] No errors in browser console
- [ ] Desktop-only features show graceful fallback messages

## Development Workflow

### Desktop Development

```bash
# Start Tauri in development mode (builds and starts sidecar automatically)
yarn tauri:dev
```

This command:
1. Builds the web_service_standalone binary
2. Copies it to `src-tauri/binaries/` with target-specific naming
3. Starts Tauri dev server
4. Tauri automatically starts the sidecar process
5. Health checks ensure the backend is ready

### Browser Development

```bash
# Terminal 1: Start backend
cargo run -p web_service_standalone

# Terminal 2: Start frontend
yarn dev
```

The frontend will connect to the backend at `http://localhost:8080`.

### Production Build

```bash
# Build desktop app
yarn tauri:build

# Build Docker image
cd docker
docker build -t bamboo:latest .
docker run -p 8080:8080 bamboo:latest
```

## Key Concepts

### HTTP-First Architecture

All business logic now uses HTTP API instead of Tauri commands:

**Before (Tauri commands):**
```typescript
await invoke("save_workflow", { name, content });
```

**After (HTTP API):**
```typescript
const serviceFactory = ServiceFactory.getInstance();
await serviceFactory.saveWorkflow(name, content);
```

### Data Directory Contract

All data is stored relative to a configurable data directory:

- **Default**: `~/.bamboo/`
- **Custom**: Use `--data-dir` flag when starting backend

All controllers respect this contract:
```rust
// Instead of global paths
let config = bamboo_dir().join("config.json");

// Use app_state data directory
let config = app_state.app_data_dir.join("config.json");
```

### Environment Detection

The app detects whether it's running in Tauri or browser:

```typescript
import { isTauriEnvironment, requireDesktopFeature } from '@/utils/environment';

if (isTauriEnvironment()) {
  // Use native Tauri features
} else {
  // Use web APIs
}

// For desktop-only features
requireDesktopFeature('system-proxy-config');
```

### Port Discovery

The frontend automatically discovers the backend port:

1. Check `window.__BAMBOO_BACKEND_PORT__` (Tauri injection)
2. Health check default port (8080)
3. Fall back to environment configuration

```typescript
// Sync version (for backward compatibility)
const baseUrl = getBackendBaseUrlSync();

// Async version with health check
const baseUrl = await getBackendBaseUrl();
```

## Adding New Features

When adding new features to Bamboo, you need to decide whether to use HTTP API or Tauri commands, and follow the appropriate pattern.

### When to Use HTTP API vs Tauri Commands

**Use HTTP API for:**
- Configuration management (reading/writing config files)
- Data persistence (workflows, sessions, prompts)
- Business logic operations (keyword masking, model settings)
- Features that should work in **both desktop and browser mode**
- CRUD operations on user data
- API proxying and forwarding

**Use Tauri Commands for:**
- Native OS integration (file picker dialogs, system tray)
- System-level operations (system proxy configuration)
- Desktop-only features that have no web equivalent
- Native clipboard access (though web API is preferred as fallback)

**Rule of thumb:** If the feature needs to work in browser mode, use HTTP API. Only use Tauri commands for truly desktop-specific functionality.

### How to Add New HTTP Endpoints

Follow this step-by-step guide to add a new HTTP endpoint:

#### Step 1: Create Backend Endpoint

**File:** `crates/web_service/src/controllers/settings_controller.rs` (or appropriate controller)

```rust
use actix_web::{web, HttpResponse};
use crate::models::{AppState, AppError};

// Define request/response types
#[derive(Deserialize)]
pub struct MyFeatureRequest {
    pub name: String,
    pub value: String,
}

#[derive(Serialize)]
pub struct MyFeatureResponse {
    pub id: String,
    pub name: String,
    pub value: String,
    pub created_at: i64,
}

// Implement endpoint handler
#[post("/bamboo/my-feature")]
pub async fn create_my_feature(
    app_state: web::Data<AppState>,
    body: web::Json<MyFeatureRequest>,
) -> Result<HttpResponse, AppError> {
    // Use app_state.app_data_dir instead of bamboo_dir()
    let feature_path = app_state.app_data_dir.join("my-feature.json");

    // Read/write data
    let feature_data = MyFeatureResponse {
        id: uuid::Uuid::new_v4().to_string(),
        name: body.name.clone(),
        value: body.value.clone(),
        created_at: chrono::Utc::now().timestamp(),
    };

    // Save to file
    let json = serde_json::to_string_pretty(&feature_data)
        .map_err(|e| AppError::Internal(format!("Failed to serialize: {}", e)))?;
    std::fs::write(&feature_path, json)
        .map_err(|e| AppError::Internal(format!("Failed to write file: {}", e)))?;

    Ok(HttpResponse::Ok().json(feature_data))
}

#[get("/bamboo/my-feature")]
pub async fn get_my_feature(
    app_state: web::Data<AppState>,
) -> Result<HttpResponse, AppError> {
    let feature_path = app_state.app_data_dir.join("my-feature.json");

    if !feature_path.exists() {
        return Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "Feature not found"
        })));
    }

    let json = std::fs::read_to_string(&feature_path)
        .map_err(|e| AppError::Internal(format!("Failed to read file: {}", e)))?;
    let feature: MyFeatureResponse = serde_json::from_str(&json)
        .map_err(|e| AppError::Internal(format!("Failed to parse JSON: {}", e)))?;

    Ok(HttpResponse::Ok().json(feature))
}
```

#### Step 2: Register Route in Server Config

**File:** `crates/web_service/src/server.rs`

Find the `app_config()` function and add your routes:

```rust
pub fn app_config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/v1")
            .configure(agent_controller::config)
            .configure(command_controller::config)
            // Add your routes here
            .route("/bamboo/my-feature", web::post().to(create_my_feature))
            .route("/bamboo/my-feature", web::get().to(get_my_feature))
            // Existing routes...
            .route("/bamboo/config", web::get().to(settings_controller::get_bamboo_config))
            // ...
    );
}
```

#### Step 3: Add Frontend Service Method

**File:** `src/services/common/ServiceFactory.ts`

Add to the `UtilityService` interface:
```typescript
export interface UtilityService {
  // ... existing methods

  // My feature
  createMyFeature(name: string, value: string): Promise<MyFeatureResponse>;
  getMyFeature(): Promise<MyFeatureResponse>;
}

export interface MyFeatureResponse {
  id: string;
  name: string;
  value: string;
  created_at: number;
}
```

Implement in `HttpUtilityService` class:
```typescript
class HttpUtilityService implements Partial<UtilityService> {
  // ... existing methods

  async createMyFeature(name: string, value: string): Promise<MyFeatureResponse> {
    return apiClient.post<MyFeatureResponse>("bamboo/my-feature", { name, value });
  }

  async getMyFeature(): Promise<MyFeatureResponse> {
    return apiClient.get<MyFeatureResponse>("bamboo/my-feature");
  }
}
```

Add to `ServiceFactory.getUtilityService()`:
```typescript
getUtilityService(): UtilityService {
  return {
    // ... existing methods
    createMyFeature: (name: string, value: string) =>
      this.httpUtilityService.createMyFeature(name, value),
    getMyFeature: () =>
      this.httpUtilityService.getMyFeature(),
  };
}
```

#### Step 4: Use in Component

**File:** Your React component

```typescript
import { serviceFactory } from '@/services/common/ServiceFactory';

function MyComponent() {
  const [feature, setFeature] = useState<MyFeatureResponse | null>(null);

  const handleCreate = async () => {
    try {
      const response = await serviceFactory.createMyFeature("test", "value");
      setFeature(response);
      message.success('Feature created!');
    } catch (error) {
      message.error('Failed to create feature');
      console.error(error);
    }
  };

  useEffect(() => {
    const loadFeature = async () => {
      try {
        const response = await serviceFactory.getMyFeature();
        setFeature(response);
      } catch (error) {
        // Not found or other error
        console.error(error);
      }
    };
    loadFeature();
  }, []);

  return (
    <div>
      <Button onClick={handleCreate}>Create Feature</Button>
      {feature && <div>Feature: {feature.name}</div>}
    </div>
  );
}
```

### How to Implement Desktop-Only Features Gracefully

Some features only make sense in desktop mode. Here's how to implement them with graceful fallbacks:

#### Pattern 1: Feature Detection

```typescript
import { isTauriEnvironment, isFeatureAvailable } from '@/utils/environment';

function MyComponent() {
  if (!isTauriEnvironment()) {
    return (
      <Alert
        type="info"
        message="This feature is only available in the desktop application"
      />
    );
  }

  // Desktop-only UI
  return <DesktopFeature />;
}
```

#### Pattern 2: Try-Catch with Fallback

```typescript
import { ServiceFactory } from '@/services/common/ServiceFactory';

async function handleProxyConfig() {
  try {
    const config = await serviceFactory.getProxyConfig();
    // Use config
  } catch (error) {
    if (error.message?.includes('only available in desktop')) {
      message.info('Proxy configuration is only available in the desktop app');
      return;
    }
    throw error;
  }
}
```

#### Pattern 3: Conditional Rendering

```typescript
import { isFeatureAvailable, BROWSER_MODE_DISABLED_FEATURES } from '@/utils/environment';

function SettingsPage() {
  return (
    <div>
      {/* Always available */}
      <GeneralSettings />

      {/* Desktop-only */}
      {isFeatureAvailable('system-proxy-config') && (
        <ProxyConfigSettings />
      )}

      {/* Alternative for browser mode */}
      {!isFeatureAvailable('system-proxy-config') && (
        <Alert
          type="info"
          message="System proxy configuration is only available in the desktop app"
          description="You can still configure proxy settings via environment variables: HTTP_PROXY and HTTPS_PROXY"
        />
      )}
    </div>
  );
}
```

### ServiceFactory Pattern

The `ServiceFactory` is a singleton that provides a unified interface for all services. It automatically handles HTTP vs Tauri mode.

**Key principles:**
1. Always use `ServiceFactory.getInstance()` to get the singleton
2. Call methods through `serviceFactory.methodName()` or `serviceFactory.getUtilityService().methodName()`
3. HTTP methods work in both desktop and browser mode
4. Tauri methods only work in desktop mode (wrapped in try-catch)

**Example - Complete feature implementation:**
```typescript
// 1. Define types
export interface MyData {
  id: string;
  name: string;
}

// 2. Add to UtilityService interface
export interface UtilityService {
  getMyData(): Promise<MyData[]>;
  saveMyData(data: MyData): Promise<void>;
}

// 3. Implement in HttpUtilityService
class HttpUtilityService {
  async getMyData(): Promise<MyData[]> {
    try {
      return await apiClient.get<MyData[]>("bamboo/my-data");
    } catch (error) {
      console.error("Failed to fetch my data:", error);
      return [];
    }
  }

  async saveMyData(data: MyData): Promise<void> {
    await apiClient.post("bamboo/my-data", data);
  }
}

// 4. Add to ServiceFactory
class ServiceFactory {
  getUtilityService(): UtilityService {
    return {
      getMyData: () => this.httpUtilityService.getMyData(),
      saveMyData: (data) => this.httpUtilityService.saveMyData(data),
      // ... other methods
    };
  }

  // Convenience methods
  async getMyData(): Promise<MyData[]> {
    return this.getUtilityService().getMyData();
  }

  async saveMyData(data: MyData): Promise<void> {
    return this.getUtilityService().saveMyData(data);
  }
}

// 5. Use in component
function MyComponent() {
  const [data, setData] = useState<MyData[]>([]);

  useEffect(() => {
    serviceFactory.getMyData().then(setData);
  }, []);

  return (
    <List
      dataSource={data}
      renderItem={item => <List.Item>{item.name}</List.Item>}
    />
  );
}
```

## Debugging Sidecar Issues

### When to Use HTTP API vs Tauri Commands

**Use HTTP API for:**
- Configuration management
- Data persistence
- Business logic operations
- Features that should work in browser mode

**Use Tauri Commands for:**
- Native OS integration (file picker, clipboard)
- System-level operations (proxy configuration)
- Desktop-only features

### Example: Adding a New HTTP Endpoint

1. **Backend** (`crates/web_service/src/controllers/settings_controller.rs`):
```rust
#[get("/bamboo/my-feature")]
pub async fn get_my_feature(
    app_state: web::Data<AppState>,
) -> Result<HttpResponse, AppError> {
    let data = app_state.app_data_dir.join("my-feature.json");
    // ... implementation
    Ok(HttpResponse::Ok().json(response))
}
```

2. **Register route** in `pub fn config()`:
```rust
cfg.service(get_my_feature)
```

3. **Frontend** (`src/services/common/ServiceFactory.ts`):
```typescript
async getMyFeature(): Promise<MyFeatureResponse> {
  return apiClient.get<MyFeatureResponse>("bamboo/my-feature");
}
```

4. **Use in component**:
```typescript
const serviceFactory = ServiceFactory.getInstance();
const feature = await serviceFactory.getMyFeature();
```

## Debugging Sidecar Issues

When the Tauri desktop app starts, it automatically spawns the backend as a sidecar process. Here's how to debug issues.

### Checking if Sidecar is Running

**Method 1: Check logs in Tauri console**

When you start the Tauri app (`yarn tauri dev`), look for these log messages:
```
[INFO] Starting web service sidecar on port 8080
[INFO] Web service sidecar process spawned
[INFO] Waiting for web service health check at http://127.0.0.1:8080/api/v1/health
[INFO] Health check attempt 1 failed. Retrying in 500ms...
[INFO] Web service health check passed on attempt 2
[INFO] Web service sidecar is healthy and ready
[INFO] [sidecar stdout] Starting standalone web service...
[INFO] [sidecar stdout] Server running on http://127.0.0.1:8080
```

**Method 2: Health check via curl**
```bash
curl http://localhost:8080/api/v1/health
# Expected: {"status":"ok"}
```

**Method 3: Check running processes**
```bash
# macOS/Linux
ps aux | grep web_service_standalone

# Or using lsof to check port
lsof -i :8080

# Windows
netstat -ano | findstr :8080
tasklist | findstr web_service_standalone
```

### Viewing Sidecar Logs

Sidecar logs are captured and forwarded to the Tauri app console. Look for:

**Stdout logs (info level):**
```
[INFO] [sidecar stdout] Starting standalone web service...
[INFO] [sidecar stdout] Server running on http://127.0.0.1:8080
```

**Stderr logs (warning/error level):**
```
[WARN] [sidecar stderr] Warning: configuration file not found
[ERROR] [sidecar error] Failed to bind to port 8080: Address already in use
```

**Enable more verbose logging:**

For the sidecar binary, you can set environment variables before starting Tauri:
```bash
# Enable debug logging for web_service
export RUST_LOG=web_service=debug,actix_web=debug
yarn tauri dev
```

**View logs in real-time:**
```bash
# In a separate terminal, tail the logs
# Note: This requires modifying the sidecar to write to a log file
tail -f ~/.bamboo/sidecar.log
```

### Port Conflicts

**Symptom:**
```
[ERROR] [sidecar error] Failed to bind to port 8080: Address already in use
```

**Diagnosis:**
```bash
# Find process using port 8080
lsof -i :8080

# Output shows:
# COMMAND   PID   USER   FD   TYPE  DEVICE SIZE/OFF NODE NAME
# web_servi 12345 user   10u  IPv6  123456      0t0  TCP  *:8080 (LISTEN)
```

**Solutions:**

1. **Kill conflicting process:**
   ```bash
   kill -9 12345  # Use PID from lsof output
   ```

2. **Change sidecar port:**
   Edit `src-tauri/src/sidecar/web_service_manager.rs`:
   ```rust
   WebServiceSidecar::new(3000, data_dir)  // Change from 8080 to 3000
   ```

3. **Use environment variable:**
   Set `APP_PORT` environment variable before starting sidecar:
   ```bash
   export APP_PORT=3000
   yarn tauri dev
   ```

### Health Check Failures

**Symptom:**
```
[ERROR] Web service failed health check after 10 attempts
```

**Diagnosis:**

1. **Check if sidecar binary exists:**
   ```bash
   ls -la src-tauri/binaries/
   # Should see: web_service_standalone-x86_64-apple-darwin (macOS)
   ```

2. **Check binary permissions:**
   ```bash
   chmod +x src-tauri/binaries/web_service_standalone-*
   ```

3. **Test binary manually:**
   ```bash
   # Run sidecar binary directly
   ./src-tauri/binaries/web_service_standalone-x86_64-apple-darwin --port 8080

   # Check output for errors
   ```

4. **Check data directory:**
   ```bash
   ls -la ~/.bamboo/
   # Should be writable by current user
   ```

**Solutions:**

1. **Rebuild sidecar:**
   ```bash
   cargo clean
   cargo build --release -p web_service_standalone
   # Run the copy script
   node scripts/copy-sidecar.js
   ```

2. **Check firewall:**
   ```bash
   # macOS: Check if localhost is blocked
   # System Preferences > Security & Privacy > Firewall
   ```

3. **Increase health check timeout:**
   Edit `src-tauri/src/sidecar/web_service_manager.rs`:
   ```rust
   for attempt in 1..=20 {  // Increase from 10 to 20 attempts
       sleep(Duration::from_millis(1000)).await;  // Increase from 500ms to 1000ms
   }
   ```

### CORS Errors

**Symptom in browser console:**
```
Access to fetch at 'http://localhost:8080/api/v1/bamboo/config'
from origin 'tauri://localhost' has been blocked by CORS policy
```

**Diagnosis:**

1. **Check current CORS configuration:**
   ```bash
   # Test CORS preflight request
   curl -X OPTIONS http://localhost:8080/api/v1/health \
     -H "Origin: tauri://localhost" \
     -H "Access-Control-Request-Method: GET" \
     -v

   # Look for: Access-Control-Allow-Origin header
   ```

2. **Check CORS code in server.rs:**
   ```rust
   // crates/web_service/src/server.rs
   fn build_cors(bind_addr: &str, port: u16) -> Cors {
       if bind_addr == "127.0.0.1" {
           cors = cors
               .allowed_origin("tauri://localhost")  // Should include this
               .allowed_origin("https://tauri.localhost");
       }
   }
   ```

**Solutions:**

1. **Update CORS allowlist:**
   Edit `crates/web_service/src/server.rs`:
   ```rust
   fn build_cors(bind_addr: &str, port: u16) -> Cors {
       cors = cors
           .allowed_origin("http://localhost:1420")      // Vite dev
           .allowed_origin("http://127.0.0.1:1420")      // Vite dev (IP)
           .allowed_origin("tauri://localhost")          // Tauri desktop
           .allowed_origin("https://tauri.localhost");   // Tauri desktop
   }
   ```

2. **Restart backend after changes:**
   ```bash
   # Kill Tauri app, then rebuild
   cargo build -p web_service
   yarn tauri dev
   ```

3. **Verify in browser:**
   Open Tauri app dev tools (F12 or right-click > Inspect Element)
   Check Network tab for CORS headers in responses

### Common Sidecar Issues Checklist

- [ ] Sidecar binary exists in `src-tauri/binaries/`
- [ ] Binary has execute permissions (`chmod +x`)
- [ ] Port 8080 is not already in use
- [ ] Data directory (`~/.bamboo/`) is writable
- [ ] CORS configuration includes `tauri://localhost`
- [ ] Health endpoint returns 200 OK (`curl http://localhost:8080/api/v1/health`)
- [ ] No firewall blocking localhost connections
- [ ] Backend logs show "Server running" message
- [ ] Tauri app logs show "Web service sidecar is healthy and ready"

### Debugging Workflow

1. **Start with health check:**
   ```bash
   curl http://localhost:8080/api/v1/health
   ```

2. **Check sidecar process:**
   ```bash
   ps aux | grep web_service_standalone
   ```

3. **Review Tauri console logs:**
   - Look for [sidecar stdout] and [sidecar stderr] messages
   - Check for health check attempts and results

4. **Test binary manually:**
   ```bash
   ./src-tauri/binaries/web_service_standalone-* --port 8080 --data-dir /tmp/test
   ```

5. **Check network connectivity:**
   ```bash
   # Test from frontend
   curl -H "Origin: tauri://localhost" http://localhost:8080/api/v1/health
   ```

## Port Discovery and CORS Troubleshooting

Understanding how the frontend discovers the backend port and how CORS is configured is critical for debugging connectivity issues.

### How Frontend Discovers Backend Port

The frontend uses a multi-step discovery process to find the backend server:

**File:** `src/shared/utils/backendBaseUrl.ts`

```typescript
export const getBackendBaseUrl = async (): Promise<string> => {
  // Step 1: Check for Tauri-injected port (desktop mode)
  const configPort = (window as any).__BAMBOO_BACKEND_PORT__;
  if (configPort) {
    const configuredUrl = normalizeBackendBaseUrl(`http://127.0.0.1:${configPort}/v1`);
    if (await checkBackendHealth(configuredUrl)) {
      return configuredUrl;
    }
    console.warn(`Backend not available at configured port ${configPort}`);
  }

  // Step 2: Check localStorage for manual override
  const stored = localStorage.getItem('copilot_backend_base_url');
  if (stored) {
    const normalized = normalizeBackendBaseUrl(stored);
    if (await checkBackendHealth(normalized)) {
      return normalized;
    }
  }

  // Step 3: Try default port with health check
  const defaultUrl = normalizeBackendBaseUrl('http://127.0.0.1:8080/v1');
  if (await checkBackendHealth(defaultUrl)) {
    return defaultUrl;
  }

  // Step 4: Fall back to environment variable or default
  return getDefaultBackendBaseUrl();
};
```

**Health check function:**
```typescript
const checkBackendHealth = async (baseUrl: string): Promise<boolean> => {
  try {
    const healthUrl = `${baseUrl}/health`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (e) {
    return false;
  }
};
```

**Key points:**
1. **Tauri injection** (`window.__BAMBOO_BACKEND_PORT__`): Set by Tauri when starting sidecar
2. **Health check timeout**: 2 seconds per attempt
3. **Discovery order**: Tauri port → localStorage → default port → environment variable
4. **Sync version**: `getBackendBaseUrlSync()` skips health check (backward compatibility)

### CORS Configuration Modes

CORS is configured based on the bind address and mode:

**File:** `crates/web_service/src/server.rs`

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

    if bind_addr == "127.0.0.1" || bind_addr == "localhost" || bind_addr == "::1" {
        // Development/Desktop mode
        cors = cors
            .allowed_origin("http://localhost:1420")      // Vite dev server
            .allowed_origin("http://127.0.0.1:1420")      // Vite (IP)
            .allowed_origin("http://[::1]:1420")          // IPv6 localhost
            .allowed_origin("tauri://localhost")          // Tauri desktop
            .allowed_origin("https://tauri.localhost");   // Tauri desktop
    } else if bind_addr == "0.0.0.0" {
        // Docker production mode (localhost only)
        cors = cors.allowed_origin(&format!("http://localhost:{}", port));
    } else {
        // Custom bind address - be restrictive
        cors = cors.allowed_origin(&format!("http://{}", bind_addr));
    }

    cors
}
```

**Three CORS modes:**

1. **Development/Desktop Mode** (bind to `127.0.0.1`):
   - Allows: `http://localhost:1420`, `http://127.0.0.1:1420`, `tauri://localhost`, `https://tauri.localhost`
   - Use case: Browser development, Tauri desktop

2. **Docker Production Mode** (bind to `0.0.0.0`):
   - Allows: `http://localhost:8080` only
   - Use case: Docker container with reverse proxy
   - **Security**: Localhost only, no remote access

3. **Custom Mode** (bind to custom address):
   - Allows: `http://<bind_addr>` only
   - Use case: Custom deployment scenarios

### Common CORS Errors and Solutions

#### Error 1: "has been blocked by CORS policy"

**Symptom:**
```
Access to fetch at 'http://localhost:8080/api/v1/bamboo/config'
from origin 'http://localhost:1420' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present
```

**Diagnosis:**
```bash
# Test CORS preflight
curl -X OPTIONS http://localhost:8080/api/v1/health \
  -H "Origin: http://localhost:1420" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Look for these headers in response:
# < Access-Control-Allow-Origin: http://localhost:1420
# < Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

**Solutions:**
1. Check backend is started with correct bind address:
   ```bash
   # Correct for dev mode
   cargo run -p web_service_standalone -- serve --port 8080

   # Wrong - will use Docker mode CORS
   cargo run -p web_service_standalone -- serve --port 8080 --bind 0.0.0.0
   ```

2. Verify CORS configuration includes your origin:
   ```rust
   // In server.rs build_cors()
   .allowed_origin("http://localhost:1420")  // Add if missing
   ```

3. Restart backend after changing CORS config

#### Error 2: "CORS policy: Redirect is not allowed"

**Symptom:**
```
Redirect is not allowed for a preflight request
```

**Cause:** Backend redirects HTTP to HTTPS or adds trailing slash

**Solution:**
1. Ensure API routes don't redirect
2. Use exact paths (no trailing slashes)
3. Check for reverse proxy redirects

#### Error 3: Preflight request fails

**Symptom:**
```
Response to preflight request doesn't pass access control check
```

**Diagnosis:**
```bash
# Check OPTIONS response
curl -X OPTIONS http://localhost:8080/api/v1/bamboo/config \
  -H "Origin: http://localhost:1420" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -v

# Should return 200 OK with CORS headers
```

**Solutions:**
1. Ensure `allowed_headers` includes all custom headers you're sending:
   ```rust
   .allowed_headers(vec![
       header::AUTHORIZATION,
       header::ACCEPT,
       header::CONTENT_TYPE,
       // Add custom headers if needed
   ])
   ```

2. Check `allowed_methods` includes your HTTP method:
   ```rust
   .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
   ```

### Testing CORS Configuration

**Test 1: Basic CORS check**
```bash
# From terminal
curl -H "Origin: http://localhost:1420" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:8080/api/v1/health \
     -v

# Expected response headers:
# < HTTP/1.1 200 OK
# < Access-Control-Allow-Origin: http://localhost:1420
# < Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

**Test 2: Actual API call**
```bash
curl -H "Origin: http://localhost:1420" \
     -H "Content-Type: application/json" \
     http://localhost:8080/api/v1/bamboo/config \
     -v

# Expected: Response includes CORS headers
```

**Test 3: From browser console**
```javascript
// Open http://localhost:1420 in browser
// Open console (F12) and run:
fetch('http://localhost:8080/api/v1/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// Expected: {status: "ok"}
// No CORS errors in console
```

### Port Discovery Debugging

**Enable debug logging:**
```typescript
// In browser console
localStorage.setItem('debug', 'backend:*');

// Or add to your code
const baseUrl = await getBackendBaseUrl();
console.log('Backend URL:', baseUrl);
console.log('Health check URL:', `${baseUrl}/health`);
```

**Test each discovery step:**
```javascript
// Step 1: Check Tauri injection
console.log('Tauri port:', window.__BAMBOO_BACKEND_PORT__);

// Step 2: Check localStorage
console.log('Stored URL:', localStorage.getItem('copilot_backend_base_url'));

// Step 3: Test default port
fetch('http://127.0.0.1:8080/v1/health')
  .then(r => console.log('Default port works:', r.ok))
  .catch(e => console.error('Default port failed:', e));

// Step 4: Check environment variable
console.log('Env URL:', import.meta.env.VITE_BACKEND_BASE_URL);
```

**Manual port override:**
```javascript
// Override backend URL (useful for testing)
localStorage.setItem('copilot_backend_base_url', 'http://localhost:3000/v1');

// Reload page
location.reload();

// Clear override
localStorage.removeItem('copilot_backend_base_url');
```

### CORS Configuration Checklist

- [ ] Backend started with correct bind address (`127.0.0.1` for dev, `0.0.0.0` for Docker)
- [ ] CORS allowlist includes frontend origin (`http://localhost:1420`)
- [ ] CORS allowlist includes Tauri origins (`tauri://localhost`, `https://tauri.localhost`)
- [ ] Preflight requests return 200 OK with CORS headers
- [ ] No redirects on API routes
- [ ] All required headers in `allowed_headers`
- [ ] All required methods in `allowed_methods`
- [ ] Backend restarted after CORS changes

## Testing

### Manual Testing Checklist

**Desktop Mode:**
- [ ] Sidecar starts automatically
- [ ] Health check passes
- [ ] Workflows can be saved/deleted
- [ ] Keyword masking works
- [ ] Setup flow completes
- [ ] Proxy configuration saves (desktop-only)

**Browser Mode:**
- [ ] Backend connects from browser
- [ ] All HTTP features work
- [ ] Desktop-only features show graceful message
- [ ] No Tauri dependency errors

**Docker Mode:**
- [ ] Container builds successfully
- [ ] Static files served at root
- [ ] API endpoints accessible
- [ ] SPA fallback works (all routes serve index.html)

### Automated Testing

```bash
# Backend tests
cargo test

# Frontend tests
yarn test

# E2E tests (Phase 6 - TODO)
yarn test:e2e
```

## Security Considerations

### CORS Configuration

The CORS policy is strict and mode-specific:

- **Development**: `localhost:1420` + `tauri://localhost`
- **Docker**: `localhost:8080` only
- **Never**: `*` (permissive)

### Data Directory

- All data stored in single configurable directory
- Respects `--data-dir` flag everywhere
- No hardcoded paths

### Browser Mode

- Desktop-only features are disabled
- Graceful fallbacks shown to users
- No errors from missing Tauri APIs

## Performance

### Sidecar Startup

- Health check: 10 retries × 500ms = 5 seconds max
- Typical startup: 1-2 seconds
- Logs captured for debugging

### HTTP API

- All business logic over HTTP
- No IPC overhead for data operations
- Can be optimized independently

### Build Size

- Sidecar binary: ~20MB (release mode)
- Frontend bundle: ~3MB (gzipped)
- Docker image: ~200MB total

## Migration Notes

### From Previous Version

If migrating from the old architecture:

1. **No breaking changes**: Old Tauri commands still work
2. **HTTP preferred**: Use ServiceFactory for new features
3. **Gradual migration**: Components can be updated incrementally

### Data Compatibility

- All data formats unchanged
- Same directory structure (`~/.bamboo/`)
- No migration needed

## Future Enhancements

Phase 5 and 6 from the original plan:

- [ ] E2E testing with Playwright
- [ ] Performance benchmarks
- [ ] Comprehensive documentation
- [ ] API documentation (OpenAPI/Swagger)

## Support

For issues or questions:

1. Check this guide first
2. Review the commit messages for details
3. Check the CLAUDE.md file for project context
4. Create an issue with reproduction steps
