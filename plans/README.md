# Project Plans

This directory contains planning documents for major features and refactoring efforts.

## Documents

### [sidecar-architecture-plan.md](./sidecar-architecture-plan.md)
**Status**: ✅ Complete

Comprehensive plan for refactoring Bamboo to use a sidecar architecture with HTTP API instead of direct Tauri commands.

**Key Features**:
- Three deployment modes (Desktop/Browser/Docker)
- HTTP API first approach
- Sidecar process management
- Security configurations (CORS, CSRF)
- E2E testing infrastructure

**Implementation**:
- Phases 0-6 completed (Feb 2026)
- All unit tests passing (165/165)
- E2E framework established
- Documentation complete

## Purpose

These plans serve as:
1. Historical reference for architectural decisions
2. Implementation guides for complex features
3. Documentation of the development process

## Usage

When starting a complex feature or refactoring:
1. Create a plan document following the existing pattern
2. Break down work into phases
3. Document decisions and trade-offs
4. Track progress with checkboxes
5. Archive completed plans here

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Project instructions for Claude Code
- [docs/MIGRATION.md](../docs/MIGRATION.md) - Migration guide for sidecar architecture
