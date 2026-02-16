# Bamboo Web Service Docker 部署

## 概述

将 Bamboo 的 web_service 单独部署为 Docker 容器，提供 AI 聊天 API 服务。

## 端口和服务

- **8080**: 主服务端口
  - `/v1/*` - OpenAI 兼容 API
  - `/anthropic/v1/*` - Anthropic 兼容 API  
  - `/gemini/v1beta/*` - Gemini 兼容 API
  - `/api/v1/*` - Agent API

## 快速开始

### 1. 构建镜像

```bash
cd docker
docker build -t bamboo-web-service:latest .
```

### 2. 运行容器

```bash
# 使用默认配置
docker run -d \
  --name bamboo-web \
  -p 8080:8080 \
  -v bamboo-data:/data \
  bamboo-web-service:latest

# 使用自定义配置
docker run -d \
  --name bamboo-web \
  -p 8080:8080 \
  -v $(pwd)/config.json:/data/config.json:ro \
  -v bamboo-data:/data/sessions \
  bamboo-web-service:latest
```

### 3. 测试服务

```bash
curl http://localhost:8080/api/v1/health
```

## 配置

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `RUST_LOG` | 日志级别 | `info` |
| `BAMBOO_DATA_DIR` | 数据目录 | `/data` |
| `BAMBOO_PORT` | 服务端口 | `8080` |

### 配置文件

挂载 `config.json` 到 `/data/config.json`：

```json
{
  "provider": "openai",
  "api_key": "your-api-key",
  "model": "gpt-4",
  "http_proxy": "",
  "https_proxy": ""
}
```

## Docker Compose

```yaml
version: '3.8'

services:
  bamboo-web:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./config.json:/data/config.json:ro
      - bamboo-data:/data
    environment:
      - RUST_LOG=info
    restart: unless-stopped

volumes:
  bamboo-data:
```

## 生产部署

### 使用反向代理 (Nginx)

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # SSE 支持
        proxy_buffering off;
        proxy_read_timeout 86400;
    }
}
```

### 使用 Docker Swarm

```yaml
version: '3.8'

services:
  bamboo-web:
    image: bamboo-web-service:latest
    ports:
      - target: 8080
        published: 8080
        mode: host
    volumes:
      - bamboo-data:/data
    environment:
      - RUST_LOG=info
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  bamboo-data:
    driver: local
```

## API 使用示例

### OpenAI 兼容接口

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Agent 接口

```bash
# 创建会话
curl -X POST http://localhost:8080/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello",
    "session_id": "test-session"
  }'

# 获取事件流
curl http://localhost:8080/api/v1/events/test-session

# 停止会话
curl -X POST http://localhost:8080/api/v1/stop/test-session
```

## 监控

### 健康检查

```bash
curl http://localhost:8080/api/v1/health
```

### 指标

```bash
# 会话摘要
curl http://localhost:8080/api/v1/metrics/summary

# 模型统计
curl http://localhost:8080/api/v1/metrics/by-model

# 每日统计
curl http://localhost:8080/api/v1/metrics/daily
```

## 注意事项

1. **数据持久化**: 确保挂载数据卷，否则重启后数据丢失
2. **配置安全**: API key 等敏感信息通过环境变量或挂载配置文件注入
3. **网络**: 容器需要访问外部 AI API (OpenAI/Anthropic/Gemini)
4. **端口**: 默认绑定 127.0.0.1:8080，Docker 中需要改为 0.0.0.0:8080