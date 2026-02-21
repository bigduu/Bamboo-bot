# Security Fixes - Critical Vulnerabilities

This document describes the critical security vulnerabilities that were fixed following the code review of the sidecar architecture refactoring.

## Date
2026-02-21

## Vulnerabilities Fixed

### 1. Path Traversal in Workflow Names (CRITICAL)
**File**: `crates/web_service/src/controllers/settings_controller.rs:100-108`

**Issue**: Insufficient validation of workflow names allowed path traversal attacks via:
- Null bytes (`\0`)
- Control characters
- Unicode homoglyphs
- Windows reserved names (CON, PRN, AUX, etc.)

**Fix**: Comprehensive validation function that:
- Limits name length to 255 characters
- Blocks null bytes and control characters
- Blocks path separators and traversal patterns
- Blocks Windows reserved names
- Only allows alphanumeric, dash, underscore, dot, and space characters

**Attack Vector Prevented**:
```
POST /v1/bamboo/workflows
{"name": "test\0.md", "content": "malicious"}
```

### 2. Unrestricted Filesystem Access in Workspace Controller (CRITICAL)
**File**: `crates/web_service/src/controllers/workspace_controller.rs:392`

**Issue**: Direct filesystem access with user-provided paths without:
- Path canonicalization to resolve symlinks
- Validation of path boundaries
- Prevention of `..` sequences

**Fix**: Added `validate_workspace_path()` function that:
- Trims whitespace
- Checks for path traversal patterns
- Canonicalizes paths to resolve symlinks and normalize
- Returns proper errors for invalid/missing paths

Applied to:
- `/workspace/files` endpoint
- `/workspace/browse` endpoint
- `/workspace/validate` endpoint

### 3. Unrestricted Static File Serving (CRITICAL)
**File**: `crates/web_service/src/server.rs:566-569`

**Issue**: Docker static file serving had no security headers or restrictions, potentially exposing:
- Sensitive files (`.env`, `config.json`, credentials)
- Directory listings
- Path traversal via URL encoding

**Fix**:
1. Added `build_security_headers()` function with:
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `X-XSS-Protection: 1; mode=block`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Content-Security-Policy` with strict defaults

2. Applied security headers to static file serving
3. Disabled content disposition to prevent downloads
4. actix-files automatically handles path canonicalization

## Testing

All existing tests were updated to reflect the data directory contract:
- `test_bamboo_config_strips_proxy_auth` - Updated to check config in `app_data_dir` instead of `$HOME/.bamboo`
- `test_proxy_auth_endpoint_updates_config` - Updated to check config in `app_data_dir`

**Test Results**: ✅ All tests passing

## Impact

These fixes prevent:
- Arbitrary file read/write via workflow names
- Directory traversal attacks in workspace browsing
- Information disclosure via static file serving
- XSS, clickjacking, and MIME sniffing attacks in Docker deployments

## Important Security Improvements (Completed 2026-02-21)

Following the critical fixes, 6 additional important security improvements were implemented:

### 4. Request Size Limits (IMPORTANT)
**File**: `crates/web_service/src/server.rs`

**Issue**: No limits on request body sizes, vulnerable to DoS via large payloads

**Fix**: Added request size limits:
- JSON payloads: 1MB maximum
- General payloads: 10MB maximum
- Applied to both `run_with_bind` and `run_with_bind_and_static`

### 5. Input Validation in Keyword Masking (IMPORTANT)
**File**: `crates/web_service/src/controllers/settings_controller.rs:654-687`

**Issue**: No limits on number of entries or pattern lengths, vulnerable to DoS via:
- Memory exhaustion from unlimited entries
- Catastrophic backtracking from long regex patterns

**Fix**: Added validation limits:
- Maximum 100 entries
- Maximum 500 characters per pattern
- Clear error messages on limit violations

### 6. API Key Masking (IMPORTANT)
**File**: `crates/web_service/src/controllers/settings_controller.rs:863-881`

**Issue**: Previous masking revealed key length (short keys showed `***`, longer keys showed partial content)

**Fix**: Consistent fixed-length mask `****...****` for all keys to prevent information disclosure

### 7. Request Timeouts (IMPORTANT)
**File**: `src/services/api/client.ts`

**Issue**: No timeout on fetch requests, could hang indefinitely

**Fix**: Added 30-second timeout to all HTTP methods:
- GET, POST, PUT, DELETE all use AbortController
- Properly cleaned up timeouts in finally block
- Prevents indefinite hangs

### 8. IPv6 CORS Support (IMPORTANT)
**File**: `crates/web_service/src/server.rs:130`

**Issue**: Development CORS only allowed IPv4 localhost, not IPv6 (`::1`)

**Fix**: Added IPv6 localhost support:
- `http://[::1]:1420` added to development allowlist
- Consistent with modern networking practices

### 9. Port Availability Race Condition Fixed (IMPORTANT)
**File**: `src-tauri/src/sidecar/web_service_manager.rs`

**Issue**: TOCTOU (Time-of-check to time-of-use) vulnerability - port checked before bind, race condition

**Fix**: Removed preemptive port check, handle bind failures gracefully:
- Check if service already running via health endpoint
- Better error messages for port conflicts
- Removed PID tracking (using health checks instead)

## Remaining Work

The code review identified 2 remaining Important issues and 12 Suggestions:

**Important (Not Yet Implemented)**:
- Rate limiting on authentication endpoints
- Retry logic for transient failures (exponential backoff)

**Suggestions (Backlog)**:
- OpenAPI documentation
- Structured logging
- Metrics collection
- Integration tests
- Zero-downtime deployment support

## References

- Code Review: Performed by Claude Code agent on 2026-02-21
- Review Scope: All phases (0-4) of sidecar architecture refactoring
- **Total Issues Found**: 3 Critical, 8 Important, 12 Suggestions
- **Issues Fixed**: 3 Critical + 6 Important = 9 total
- **Issues Remaining**: 2 Important, 12 Suggestions
