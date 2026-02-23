# Quick Reference: Frontend Deployment Guide

## Overview

Bamboo now supports unified frontend deployment across all modes. The backend can serve static frontend files for production deployments while maintaining compatibility with development workflows.

## Deployment Modes Quick Reference

### 1. Tauri Desktop (No Changes Required)
```bash
npm run tauri dev
```
- Frontend: Served by Tauri webview
- Backend: Runs as sidecar on `127.0.0.1:8080`
- No static file serving needed

### 2. Browser Development (No Changes Required)
```bash
# Terminal 1: Start backend
cargo run -p web_service_standalone -- serve --port 8080

# Terminal 2: Start frontend
npm run dev
```
- Frontend: Served by Vite dev server on `http://localhost:1420`
- Backend: API only on `http://localhost:8080`
- Hot reload enabled

### 3. Docker Production (NEW - Fully Integrated)
```bash
cd docker
docker-compose up -d
```
- Frontend: Served by backend from `/app/static`
- Backend: API + static files on `http://localhost:8080`
- Single container, single port
- Production-ready

### 4. Standalone Production (NEW)
```bash
# Build frontend
npm run build

# Start server with static files
cargo run -p web_service_standalone -- \
  serve --static-dir ./dist --port 8080
```
- Frontend: Served by backend from `./dist`
- Backend: API + static files on `http://localhost:8080`
- No external dependencies

## CLI Parameters

```bash
web_service_standalone serve [OPTIONS]

Options:
  -p, --port <PORT>
          Port to listen on (default: 8080)

  -d, --data-dir <DATA_DIR>
          Application data directory

  -b, --bind <BIND>
          Bind address (default: 127.0.0.1)
          Use 0.0.0.0 for Docker

  -s, --static-dir <STATIC_DIR>
          Static files directory for frontend
          Required for: Docker, standalone production
          Not needed for: Tauri, browser dev
```

## When to Use --static-dir

| Scenario | --static-dir | Why |
|----------|--------------|-----|
| Tauri Desktop | ❌ No | Tauri webview serves frontend |
| Browser Dev | ❌ No | Vite dev server (port 1420) |
| Docker | ✅ Yes | Container needs to serve frontend |
| Standalone Prod | ✅ Yes | No Vite, backend serves everything |

## Docker Usage

### Build and Run
```bash
cd docker
docker-compose up -d
```

### Verify
```bash
# Frontend
curl http://localhost:8080/

# API
curl http://localhost:8080/api/v1/health

# Static assets
curl http://localhost:8080/assets/index.js
```

### Stop
```bash
docker-compose down
```

## Architecture Benefits

**Before (Docker)**:
- ❌ Frontend missing in container
- ❌ Required external file server or Vite
- ❌ Complex multi-container setup

**After (Docker)**:
- ✅ Single container with everything
- ✅ Backend serves frontend automatically
- ✅ Simplified deployment

**Before (Standalone)**:
- ❌ Required Vite dev server for frontend
- ❌ Not suitable for production

**After (Standalone)**:
- ✅ Self-contained production binary
- ✅ Serves frontend from built files
- ✅ Production-ready

## Verification Checklist

When deploying with Docker:

1. **Build Image**
   ```bash
   cd docker && docker-compose build
   ```
   Look for: "✓ built in X.XXs" (frontend build success)

2. **Start Container**
   ```bash
   docker-compose up -d
   ```
   Look for: "Container bamboo-web  Started"

3. **Check Logs**
   ```bash
   docker logs bamboo-web
   ```
   Look for: "Serving static files from: \"/app/static\""

4. **Test Frontend**
   ```bash
   curl http://localhost:8080/
   ```
   Expected: HTML with `<title>Tauri + React + Typescript</title>`

5. **Test API**
   ```bash
   curl http://localhost:8080/api/v1/health
   ```
   Expected: `OK`

## Common Issues

### Issue: "Connection refused" in Docker
**Solution**: Use IPv4 address explicitly
```bash
curl http://127.0.0.1:8080/  # Instead of localhost
```

### Issue: Frontend not loading in Docker
**Check**: Verify static files were copied
```bash
docker exec bamboo-web ls -la /app/static
```
Expected: `index.html` and `assets/` directory

### Issue: Build fails with "front-end not found"
**Solution**: Ensure frontend was built
```bash
npm run build  # Creates dist/ directory
```

## Development Workflow

### Local Development (Recommended)
```bash
# Option A: Tauri Desktop (full features)
npm run tauri dev

# Option B: Browser Mode (frontend + backend separate)
# Terminal 1
cargo run -p web_service_standalone -- serve

# Terminal 2
npm run dev
```

### Production Deployment
```bash
# Option A: Docker (recommended for servers)
cd docker && docker-compose up -d

# Option B: Standalone Binary
npm run build
cargo build --release -p web_service_standalone
./target/release/web_service_standalone serve --static-dir ./dist
```

## Environment Variables

The backend respects these environment variables:

```bash
# Port override
export APP_PORT=3000

# Data directory override
export BAMBOO_DATA_DIR=/custom/data

# Logging level
export RUST_LOG=debug

# Headless mode (no browser auto-open)
export COPILOT_CHAT_HEADLESS=1
```

## Security Considerations

### Docker Mode
- Binds to `0.0.0.0` (required for container networking)
- CORS configured for `http://localhost:8080`
- Rate limiting enabled
- Request size limits: 1MB JSON, 10MB payload

### Standalone Mode
- Binds to `127.0.0.1` by default (localhost only)
- Use `--bind 0.0.0.0` for network access (not recommended)
- Same security features as Docker mode

## Performance Notes

- **Frontend Build**: ~10-15 seconds (one-time)
- **Docker Build**: ~5-8 minutes (includes frontend + backend)
- **Container Size**: ~150MB (Alpine + backend + frontend)
- **Static File Serving**: Actix-files (high performance, async)
- **No Nginx Required**: Backend handles static files efficiently

## Migration Guide

### Existing Docker Users

If you have existing Docker deployment:

1. **Pull latest changes**
   ```bash
   git pull
   ```

2. **Rebuild image**
   ```bash
   cd docker
   docker-compose build
   ```

3. **Restart container**
   ```bash
   docker-compose up -d
   ```

4. **Verify frontend works**
   ```bash
   curl http://localhost:8080/
   ```

### Existing Standalone Users

No changes required if you're using Tauri or browser dev mode.

For production deployment, add `--static-dir`:
```bash
# Old (development only)
cargo run -p web_service_standalone

# New (production ready)
npm run build
cargo run -p web_service_standalone -- serve --static-dir ./dist
```

## Support

- **Documentation**: See `CLAUDE.md` for architecture details
- **Implementation**: See `IMPLEMENTATION_SUMMARY.md` for technical details
- **Issues**: Check container logs with `docker logs bamboo-web`
