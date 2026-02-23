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
# Build stage using musl for static linking to avoid GLIBC dependency
FROM rust:latest AS builder

WORKDIR /app

# Install musl target
RUN rustup target add aarch64-unknown-linux-musl

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    musl-tools \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace configuration
COPY Cargo.toml Cargo.lock ./

# Copy src-tauri Cargo files
COPY src-tauri/Cargo.toml src-tauri/
COPY src-tauri/build.rs src-tauri/

# Create dummy source files to cache dependencies
RUN mkdir -p src-tauri/src src-tauri/bin && \
    echo "fn main() {}" > src-tauri/src/lib.rs && \
    echo "fn main() {}" > src-tauri/bin/web_service_standalone.rs

# Build dependencies (cache layer) - using musl target
RUN cargo build --release --manifest-path src-tauri/Cargo.toml --bin web_service_standalone --target aarch64-unknown-linux-musl 2>/dev/null || true

# Copy actual source code
COPY src-tauri/ ./src-tauri/

# Build release version - using musl static linking
RUN cargo build --release --manifest-path src-tauri/Cargo.toml --bin web_service_standalone --target aarch64-unknown-linux-musl

# ========== Runtime Stage ==========
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies (minimal)
RUN apk add --no-cache ca-certificates curl

# Create data directory
RUN mkdir -p /data/sessions

# Copy backend binary - using musl statically linked binary
COPY --from=builder /app/src-tauri/target/aarch64-unknown-linux-musl/release/web_service_standalone /app/web_service_standalone

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
CMD ["--port", "8080", "--data-dir", "/data"]
