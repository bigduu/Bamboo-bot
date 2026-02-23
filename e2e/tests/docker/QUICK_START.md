# Docker E2E Test Guide

Quick guide for running Docker deployment E2E tests.

## Quick Start

```bash
# Run complete Docker test lifecycle
./e2e/scripts/test-docker.sh all

# Or step by step
./e2e/scripts/test-docker.sh build
./e2e/scripts/test-docker.sh start
./e2e/scripts/test-docker.sh test
./e2e/scripts/test-docker.sh stop
```

## Manual Testing

### 1. Build and Start Container

```bash
cd docker

# Build Docker image
docker-compose build

# Start container
docker-compose up -d

# Check logs
docker-compose logs -f

# Check health
docker inspect --format='{{.State.Health.Status}}' bamboo-web
```

### 2. Run Tests

```bash
cd e2e

# Run Docker tests
npm run test:docker:full

# Or with custom base URL
E2E_BASE_URL=http://localhost:8080 npm test -- tests/docker/
```

### 3. Cleanup

```bash
cd docker

# Stop and remove container
docker-compose down

# Remove volumes too
docker-compose down -v
```

## Test Coverage

### Container Tests
- ✅ Container starts successfully
- ✅ Health check passes
- ✅ Correct port exposed (8080)
- ✅ Data volume mounted
- ✅ Environment variables set

### Frontend Tests
- ✅ Frontend HTML served
- ✅ JavaScript bundles load
- ✅ CSS files load with correct MIME types
- ✅ SPA routing works

### API Tests
- ✅ Health endpoint responds
- ✅ Chat API works through Docker
- ✅ CORS configuration correct
- ✅ Security headers present

### Performance Tests
- ✅ Concurrent request handling
- ✅ Response time < 1s
- ✅ Large payload handling
- ✅ Sustained load testing

### Integration Tests
- ✅ Full chat workflow
- ✅ Data persistence
- ✅ Container logging

## Debugging

### Container won't start

```bash
# Check Docker logs
docker logs bamboo-web

# Check if port is in use
lsof -i :8080

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up -d
```

### Tests failing

```bash
# Manual health check
curl http://localhost:8080/api/v1/health

# Check container status
docker ps -a

# View container details
docker inspect bamboo-web
```

### Clean slate

```bash
# Remove everything
docker-compose down -v --rmi all

# Start fresh
docker-compose build --no-cache
docker-compose up -d
```

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests affecting Docker files

See `.github/workflows/e2e-docker.yml` for configuration.

## Environment Variables

- `E2E_BASE_URL`: Base URL for tests (default: http://localhost:8080)
- `E2E_SKIP_BUILD`: Skip Docker image build (default: false)
- `KEEP_CONTAINER`: Keep container after tests (default: false)
- `E2E_DOCKER_TIMEOUT`: Container startup timeout (default: 60000ms)

## Test Scripts

```bash
# Full lifecycle
npm run test:docker:full

# Setup only
npm run test:docker:setup

# Teardown only
npm run test:docker:teardown

# Using shell script
./e2e/scripts/test-docker.sh all
./e2e/scripts/test-docker.sh test
./e2e/scripts/test-docker.sh logs
```

## Expected Results

- **Build time**: ~2-5 minutes (first time), ~30s (cached)
- **Container startup**: < 10 seconds
- **Test duration**: ~2-3 minutes
- **Container size**: < 1GB
- **Memory usage**: < 200MB baseline

## Troubleshooting Common Issues

### Issue: Port already in use

```bash
# Find process using port 8080
lsof -i :8080

# Kill process
kill -9 <PID>
```

### Issue: Permission denied

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login again
```

### Issue: Out of disk space

```bash
# Clean Docker resources
docker system prune -a --volumes
```

### Issue: Container unhealthy

```bash
# Check logs
docker logs bamboo-web

# Check health check output
docker inspect bamboo-web | grep -A 10 Health
```

## Performance Benchmarks

Run performance tests:

```bash
cd e2e
E2E_BASE_URL=http://localhost:8080 npm test -- tests/docker/docker-deployment.spec.ts --grep "Performance"
```

Expected metrics:
- Container startup: < 10s
- Health check: < 100ms
- Average API response: < 100ms
- 95th percentile: < 500ms
- Image size: < 1GB
