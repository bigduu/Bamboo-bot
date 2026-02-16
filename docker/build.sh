#!/bin/bash
set -e

echo "🐳 Building Bamboo Web Service Docker image..."

# 进入 docker 目录
cd "$(dirname "$0")"

# 构建镜像
docker build -t bamboo-web-service:latest -f Dockerfile ..

echo "✅ Build complete!"
echo ""
echo "To run the container:"
echo "  1. Copy config.example.json to config.json and add your API key"
echo "  2. docker-compose up -d"
echo ""
echo "Or run directly:"
echo "  docker run -d -p 8080:8080 -v \$(pwd)/config.json:/data/config.json:ro bamboo-web-service:latest"