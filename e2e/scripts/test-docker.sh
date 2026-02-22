#!/bin/bash

# Docker E2E Test Runner
# This script handles the complete Docker test lifecycle

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DOCKER_DIR="${PROJECT_ROOT}/docker"
E2E_DIR="${PROJECT_ROOT}/e2e"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi

    # Check if config exists
    if [ ! -f "${DOCKER_DIR}/config.json" ]; then
        log_warning "config.json not found, copying example config..."
        cp "${DOCKER_DIR}/config.example.json" "${DOCKER_DIR}/config.json"
    fi

    log_success "All prerequisites met"
}

# Build Docker image
build_image() {
    log_info "Building Docker image..."

    cd "${DOCKER_DIR}"
    docker-compose build

    log_success "Docker image built successfully"
}

# Start Docker container
start_container() {
    log_info "Starting Docker container..."

    cd "${DOCKER_DIR}"
    docker-compose up -d

    log_info "Waiting for container to be healthy..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        local status=$(docker inspect --format='{{.State.Health.Status}}' bamboo-web 2>/dev/null || echo "not_found")

        if [ "$status" = "healthy" ]; then
            log_success "Container is healthy!"
            return 0
        fi

        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo ""
    log_error "Container failed to become healthy"

    # Show logs for debugging
    log_info "Container logs:"
    docker logs bamboo-web

    return 1
}

# Run E2E tests
run_tests() {
    log_info "Running E2E tests..."

    cd "${E2E_DIR}"
    E2E_BASE_URL=http://localhost:8080 npm test -- tests/docker/docker-deployment.spec.ts

    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        log_success "All tests passed!"
    else
        log_error "Some tests failed"
    fi

    return $exit_code
}

# Cleanup Docker container
cleanup() {
    log_info "Cleaning up Docker container..."

    cd "${DOCKER_DIR}"
    docker-compose down -v

    log_success "Cleanup complete"
}

# Show container logs
show_logs() {
    log_info "Container logs:"
    docker logs bamboo-web
}

# Main function
main() {
    local command="${1:-all}"

    case $command in
        check)
            check_prerequisites
            ;;
        build)
            check_prerequisites
            build_image
            ;;
        start)
            check_prerequisites
            start_container
            ;;
        test)
            run_tests
            ;;
        stop)
            cleanup
            ;;
        logs)
            show_logs
            ;;
        all)
            check_prerequisites
            build_image
            start_container
            run_tests
            local test_exit_code=$?

            if [ "${KEEP_CONTAINER}" != "true" ]; then
                cleanup
            fi

            exit $test_exit_code
            ;;
        *)
            echo "Usage: $0 {check|build|start|test|stop|logs|all}"
            echo ""
            echo "Commands:"
            echo "  check  - Check prerequisites"
            echo "  build  - Build Docker image"
            echo "  start  - Start Docker container"
            echo "  test   - Run E2E tests"
            echo "  stop   - Stop and cleanup container"
            echo "  logs   - Show container logs"
            echo "  all    - Run complete test lifecycle (default)"
            echo ""
            echo "Environment variables:"
            echo "  KEEP_CONTAINER=true - Keep container running after tests"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
