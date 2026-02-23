#!/bin/bash

# 清理所有 web_service_standalone 测试进程

echo "查找 web_service_standalone 进程..."
PROCESSES=$(ps aux | grep '[w]eb_service_standalone' | awk '{print $2, $11, $12, $13, $14, $15}')

if [ -z "$PROCESSES" ]; then
    echo "没有找到运行中的 web_service_standalone 进程"
    exit 0
fi

echo ""
echo "找到以下进程:"
echo "$PROCESSES"
echo ""

# 询问用户确认
read -p "是否停止这些进程? [y/N] " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "停止进程中..."

    # 获取所有 PID
    PIDS=$(ps aux | grep '[w]eb_service_standalone' | awk '{print $2}')

    for PID in $PIDS; do
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "  停止 PID $PID..."
            kill "$PID" 2>/dev/null || true
        fi
    done

    # 等待 5 秒
    sleep 2

    # 检查是否还有残留进程
    for PID in $PIDS; do
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "  强制终止 PID $PID..."
            kill -9 "$PID" 2>/dev/null || true
        fi
    done

    # 清理 PID 文件
    rm -f /tmp/web_service_test_*.pid 2>/dev/null || true

    echo "清理完成"
else
    echo "取消操作"
fi
