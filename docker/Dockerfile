# 构建阶段 - 使用 musl 进行静态链接，避免 GLIBC 依赖
FROM rust:latest AS builder

WORKDIR /app

# 安装 musl 目标
RUN rustup target add aarch64-unknown-linux-musl

# 安装依赖
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    musl-tools \
    && rm -rf /var/lib/apt/lists/*

# 复制 workspace 配置
COPY Cargo.toml Cargo.lock ./

# 创建修改后的 Cargo.toml，排除 src-tauri
RUN sed -i '/src-tauri/d' Cargo.toml && \
    sed -i 's/default-members = \["src-tauri"\]/default-members = []/' Cargo.toml

# 复制所有需要的 crates 的 Cargo.toml
COPY crates/chat_core/Cargo.toml crates/chat_core/
COPY crates/agent-core/Cargo.toml crates/agent-core/
COPY crates/agent-loop/Cargo.toml crates/agent-loop/
COPY crates/agent-server/Cargo.toml crates/agent-server/
COPY crates/agent-tools/Cargo.toml crates/agent-tools/
COPY crates/agent-skill/Cargo.toml crates/agent-skill/
COPY crates/agent-llm/Cargo.toml crates/agent-llm/
COPY crates/agent-metrics/Cargo.toml crates/agent-metrics/
COPY crates/agent-cli/Cargo.toml crates/agent-cli/
COPY crates/agent-mcp/Cargo.toml crates/agent-mcp/
COPY crates/web_service/Cargo.toml crates/web_service/
COPY crates/web_service_standalone/Cargo.toml crates/web_service_standalone/
COPY crates/workflow_system/Cargo.toml crates/workflow_system/

# 创建虚拟 main.rs 以缓存依赖
RUN mkdir -p crates/web_service_standalone/src && \
    echo "fn main() {}" > crates/web_service_standalone/src/main.rs

# 构建依赖（缓存层）- 使用 musl 目标
RUN cargo build --release -p web_service_standalone --target aarch64-unknown-linux-musl 2>/dev/null || true

# 复制实际源代码
COPY crates/ ./crates/

# 构建 release 版本 - 使用 musl 静态链接
RUN cargo build --release -p web_service_standalone --target aarch64-unknown-linux-musl

# 运行阶段 - 使用更小的基础镜像
FROM alpine:latest

WORKDIR /app

# 安装运行时依赖（最小化）
RUN apk add --no-cache ca-certificates curl

# 创建数据目录
RUN mkdir -p /data/sessions

# 复制构建产物 - 使用 musl 静态链接的二进制
COPY --from=builder /app/target/aarch64-unknown-linux-musl/release/web_service_standalone /app/web_service_standalone

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
ENTRYPOINT ["/app/web_service_standalone"]
CMD ["serve", "--port", "8080", "--data-dir", "/data", "--bind", "0.0.0.0"]