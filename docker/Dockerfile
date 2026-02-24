# ========== Frontend Build Stage ==========
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend
RUN yarn build

# Output: /app/dist directory contains built frontend
# ================================================

# ========== Backend Build Stage ==========
FROM rust:latest AS builder

WORKDIR /app

# Copy only e2e-backend crate (not the full workspace)
COPY e2e-backend/Cargo.toml e2e-backend/Cargo.lock* ./e2e-backend/

WORKDIR /app/e2e-backend

# Create dummy source file to cache dependencies
RUN mkdir -p src && \
    echo "fn main() {}" > src/main.rs

# Build dependencies (cache layer)
RUN cargo build --release 2>/dev/null || true

# Copy actual source code
COPY e2e-backend/src ./src

# Build release version
RUN cargo build --release

# ========== Runtime Stage ==========
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies (minimal)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create data directory
RUN mkdir -p /data/sessions

# Copy backend binary
COPY --from=builder /app/e2e-backend/target/release/web_service_standalone /app/web_service_standalone

# Copy frontend build artifacts
COPY --from=frontend-builder /app/dist /app/static

# Environment variables
ENV RUST_LOG=info
ENV BAMBOO_DATA_DIR=/data
ENV BAMBOO_PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/v1/health || exit 1

# Run service - serve both API and static frontend files
ENTRYPOINT ["/app/web_service_standalone"]
CMD ["--port", "8080", "--bind", "0.0.0.0", "--data-dir", "/data", "--static-dir", "/app/static"]
