#!/bin/bash

# 测试脚本：验证静态文件服务功能
# 功能：启动服务器 -> 测试 -> 自动清理

set -e  # 任何命令失败时退出

PORT=9080
PID_FILE="/tmp/web_service_test_${PORT}.pid"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TEST_DIR="./dist"

echo "========================================="
echo "静态文件服务测试"
echo "========================================="
echo "端口: $PORT"
echo "PID文件: $PID_FILE"
echo ""

# 清理函数：在脚本退出时自动调用
cleanup() {
    echo ""
    echo "清理中..."

    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "停止服务器进程 (PID: $PID)..."
            kill "$PID" 2>/dev/null || true
            # 等待进程真正退出
            for i in {1..10}; do
                if ! ps -p "$PID" > /dev/null 2>&1; then
                    break
                fi
                sleep 0.5
            done
            # 如果进程还在，强制杀死
            if ps -p "$PID" > /dev/null 2>&1; then
                echo "进程未响应，强制终止..."
                kill -9 "$PID" 2>/dev/null || true
            fi
        fi
        rm -f "$PID_FILE"
    fi

    # 清理任何可能残留的进程
    pkill -f "web_service_standalone.*--port.*$PORT" 2>/dev/null || true

    echo "清理完成"
}

# 设置退出时自动清理
trap cleanup EXIT

# 检查 dist 目录是否存在
if [ ! -d "$TEST_DIR" ]; then
    echo "错误: 前端构建目录不存在: $TEST_DIR"
    echo "请先运行: npm run build"
    exit 1
fi

echo "1. 启动服务器..."
cargo run -p web_service_standalone -- \
    serve --port "$PORT" --static-dir "$TEST_DIR" > /tmp/web_service_test.log 2>&1 &

SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"
echo "服务器 PID: $SERVER_PID"

# 等待服务器启动
echo "2. 等待服务器启动..."
MAX_WAIT=15
WAIT_COUNT=0
while ! curl -s "http://127.0.0.1:$PORT/api/v1/health" > /dev/null 2>&1; do
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        echo "错误: 服务器启动超时"
        echo "日志输出:"
        cat /tmp/web_service_test.log
        exit 1
    fi
    sleep 1
done

echo "服务器已启动 (等待 ${WAIT_COUNT} 秒)"
echo ""

# 测试 1: 健康检查
echo "3. 测试 API 健康检查..."
HEALTH=$(curl -s "http://127.0.0.1:$PORT/api/v1/health")
if [ "$HEALTH" = "OK" ]; then
    echo "✅ API 健康检查通过: $HEALTH"
else
    echo "❌ API 健康检查失败: $HEALTH"
    exit 1
fi
echo ""

# 测试 2: 前端首页
echo "4. 测试前端首页..."
FRONTEND=$(curl -s "http://127.0.0.1:$PORT/")
if echo "$FRONTEND" | grep -q "Tauri + React + Typescript"; then
    echo "✅ 前端首页正常"
else
    echo "❌ 前端首页异常"
    echo "返回内容:"
    echo "$FRONTEND" | head -5
    exit 1
fi
echo ""

# 测试 3: 静态资源
echo "5. 测试静态资源..."
# 获取一个 JS 文件路径
JS_FILE=$(echo "$FRONTEND" | grep -o 'assets/[^"]*\.js' | head -1)
if [ -n "$JS_FILE" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/$JS_FILE")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ 静态资源正常: /$JS_FILE (HTTP $HTTP_CODE)"
    else
        echo "❌ 静态资源异常: /$JS_FILE (HTTP $HTTP_CODE)"
        exit 1
    fi
else
    echo "⚠️  未找到 JS 文件引用"
fi
echo ""

# 测试 4: 日志检查
echo "6. 检查服务器日志..."
if grep -q "Serving static files from:" /tmp/web_service_test.log; then
    STATIC_DIR=$(grep "Serving static files from:" /tmp/web_service_test.log | head -1)
    echo "✅ $STATIC_DIR"
else
    echo "⚠️  日志中未找到静态文件服务信息"
fi
echo ""

echo "========================================="
echo "所有测试通过！ ✅"
echo "========================================="
echo ""
echo "服务器将继续运行，你可以手动测试："
echo "  前端: http://127.0.0.1:$PORT/"
echo "  API:  http://127.0.0.1:$PORT/api/v1/health"
echo ""
echo "按 Ctrl+C 停止服务器并退出..."
echo ""

# 保持脚本运行，让用户可以手动测试
wait $SERVER_PID
