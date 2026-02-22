# Docker E2E Tests

This directory contains end-to-end tests specifically for Docker deployment.

## Prerequisites

- Docker and Docker Compose installed
- Built Docker image (or will build during test setup)

## Running Tests

### Quick Start

```bash
# From the e2e directory
npm run test:docker
```

### Manual Execution

```bash
# 1. Build and start Docker container
cd ../docker
docker-compose up -d --build

# 2. Wait for container to be healthy
docker-compose ps
docker logs bamboo-web

# 3. Run tests
cd ../e2e
E2E_BASE_URL=http://localhost:8080 npm test -- tests/modes/docker-mode.spec.ts

# 4. Cleanup
cd ../docker
docker-compose down -v
```

## Test Coverage

### 1. Container Health Tests
- Container starts successfully
- Health check passes
- All services are running

### 2. Static File Serving
- Frontend HTML is served
- JavaScript bundles load correctly
- CSS files are served with correct MIME types
- Static assets have proper caching headers

### 3. API Functionality
- Health endpoint responds
- Chat API works through Docker networking
- Streaming responses work correctly
- Error handling works in containerized environment

### 4. CORS and Security
- CORS headers are correct for production
- Security headers are present
- Rate limiting works (if configured)

### 5. Data Persistence
- Data directory is mounted correctly
- Configuration persists across restarts
- Session data is preserved

### 6. Resource Management
- Container handles concurrent requests
- Memory usage is reasonable
- Graceful shutdown works

### 7. Integration Tests
- Full chat workflow works in Docker
- WebSocket connections (if used)
- File uploads (if supported)

## Environment Variables

Tests can be configured with:

- `E2E_BASE_URL`: Base URL for tests (default: http://localhost:8080)
- `E2E_DOCKER_TIMEOUT`: Timeout for container startup (default: 60000ms)
- `E2E_SKIP_BUILD`: Skip Docker image build (default: false)

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up -d
```

### Health check fails

```bash
# Check if port is already in use
lsof -i :8080

# Check container status
docker ps -a
docker inspect bamboo-web
```

### Tests fail with connection errors

```bash
# Verify container is running
docker ps

# Check if port is exposed
docker port bamboo-web

# Test manually
curl http://localhost:8080/api/v1/health
```

## CI/CD Integration

For CI/CD pipelines, use:

```yaml
- name: Start Docker container
  run: |
    cd docker
    docker-compose up -d --build
    sleep 10

- name: Wait for container
  run: |
    timeout 60 bash -c 'until curl -f http://localhost:8080/api/v1/health; do sleep 2; done'

- name: Run E2E tests
  run: |
    cd e2e
    E2E_BASE_URL=http://localhost:8080 npm test -- tests/modes/docker-mode.spec.ts

- name: Cleanup
  run: |
    cd docker
    docker-compose down -v
```

## Performance Benchmarks

Tests also validate:

- Container startup time < 10 seconds
- API response time < 100ms for health checks
- Concurrent request handling (100 requests)
- Memory usage < 200MB baseline
