# Bamboo Sidecar Architecture Migration Guide

This guide explains the sidecar architecture refactoring and how to work with the new system.

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

## Troubleshooting

### Sidecar won't start

**Check logs:**
```
[sidecar stdout] Server running on http://127.0.0.1:8080
[sidecar stderr] ...
```

**Common issues:**
1. Port 8080 already in use: Kill the process or change port
2. Binary not found: Run `yarn build:sidecar`
3. Permission denied: Check binary has execute permissions

### CORS errors

**Symptoms:** Browser console shows CORS errors

**Solutions:**
1. Check you're using the correct mode
2. Verify CORS configuration in `crates/web_service/src/server.rs`
3. Ensure backend is running before frontend

### Data not persisting

**Check data directory:**
```bash
# Default location
ls ~/.bamboo/

# Custom location
cargo run -p web_service_standalone -- --data-dir /custom/path
```

### Health check failures

**Check backend health:**
```bash
curl http://localhost:8080/api/v1/health
```

If failing:
1. Check backend logs for errors
2. Verify port is available
3. Check firewall settings

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
