# 构建阶段
FROM rust:1.75-slim-bookworm AS builder

WORKDIR /app

# 安装依赖
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制 workspace 配置
COPY Cargo.toml Cargo.lock ./
COPY crates/chat_core/Cargo.toml crates/chat_core/
COPY crates/agent-core/Cargo.toml crates/agent-core/
COPY crates/agent-loop/Cargo.toml crates/agent-loop/
COPY crates/agent-server/Cargo.toml crates/agent-server/
COPY crates/agent-tools/Cargo.toml crates/agent-tools/
COPY crates/agent-skill/Cargo.toml crates/agent-skill/
COPY crates/agent-llm/Cargo.toml crates/agent-llm/
COPY crates/agent-metrics/Cargo.toml crates/agent-metrics/
COPY crates/web_service/Cargo.toml crates/web_service/
COPY crates/workflow_system/Cargo.toml crates/workflow_system/

# 创建虚拟 main.rs 以缓存依赖
RUN mkdir -p crates/web_service/src && \
    echo "fn main() {}" > crates/web_service/src/main.rs

# 构建依赖（缓存层）
RUN cargo build --release -p web_service 2>/dev/null || true

# 复制实际源代码
COPY crates/ ./crates/

# 构建 release 版本
RUN cargo build --release -p web_service

# 运行阶段
FROM debian:bookworm-slim

WORKDIR /app

# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 创建数据目录
RUN mkdir -p /data/sessions

# 复制构建产物
COPY --from=builder /app/target/release/web_service /app/web_service

# 设置环境变量
ENV RUST_LOG=info
ENV BAMBOO_DATA_DIR=/data
ENV BAMBOO_PORT=8080

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/v1/health || exit 1

# 运行服务
ENTRYPOINT ["/app/web_service"]
CMD ["--port", "8080", "--data-dir", "/data"]