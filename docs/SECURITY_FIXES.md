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

## Remaining Work

The code review identified 8 Important issues and 12 Suggestions that should be addressed in future iterations:

**Important (Next Sprint)**:
- Input validation limits in keyword masking (DoS prevention)
- API key masking improvements
- Rate limiting on authentication endpoints
- Request size limits
- Port availability race condition
- Missing request timeouts
- Retry logic for transient failures

**Suggestions (Backlog)**:
- OpenAPI documentation
- Structured logging
- Metrics collection
- Integration tests
- Zero-downtime deployment support

## References

- Code Review: Performed by Claude Code agent on 2026-02-21
- Review Scope: All phases (0-4) of sidecar architecture refactoring
- Total Issues Found: 3 Critical, 8 Important, 12 Suggestions
