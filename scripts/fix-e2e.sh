#!/bin/bash
# Claude Code E2E 修复脚本

cd ~/workspace/bodhi

echo "========================================"
echo "Bodhi E2E 测试修复任务"
echo "========================================"
echo ""
echo "任务说明："
echo "1. 修复 playwright.config.ts 的 webServer 配置"
echo "2. 创建 global-setup.ts 和 global-teardown.ts"
echo "3. 验证并修复所有测试文件中的选择器"
echo "4. 确保 API 端点正确"
echo "5. 运行测试验证修复"
echo ""
echo "重要提示："
echo "- 使用 Team Agent 模式进行协作"
echo "- 先检查 src/ 目录下的组件，确保 data-testid 存在"
echo "- 检查后端 API 路由是否正确"
echo ""
echo "按回车键开始..."
read

# 启动 Claude Code
claude --dangerously-skip-permissions "
修复 bodhi 项目的 E2E 测试。

请按以下步骤执行：

## Step 1: 诊断问题
1. 阅读 e2e/REPAIR_PLAN.md 了解修复计划
2. 检查当前 playwright.config.ts 的问题
3. 检查 src/ 目录下的组件，列出所有 data-testid
4. 检查后端 API 路由（crates/web_service/src/server.rs 和 controllers/）

## Step 2: 修复配置
1. 修复 playwright.config.ts：
   - 移除有问题的 webServer 配置或修复它
   - 添加全局 setup 配置
   - 添加不同模式的项目配置

2. 创建 e2e/global-setup.ts：
   - 启动测试服务器或检查服务器是否运行
   - 清理测试数据

3. 创建 e2e/global-teardown.ts：
   - 清理测试数据

## Step 3: 验证选择器
1. 检查 src/pages/ 下的组件
2. 确保测试使用的 data-testid 存在于实际组件中
3. 如果缺少，添加必要的 data-testid

## Step 4: 修复 API 端点
1. 检查 crates/web_service/src/controllers/ 中的路由
2. 确保测试中的 API 路径正确
3. 修复任何不匹配的路径

## Step 5: 运行测试
1. 先启动后端：cargo run -p web_service_standalone -- --port 8080 --data-dir /tmp/test-data
2. 运行 yarn test:e2e 验证修复
3. 修复任何失败的测试

## 报告
完成后请报告：
1. 修复了哪些问题
2. 还剩余哪些问题
3. 如何运行测试

使用 Team Agent 模式，如果需要可以创建子任务。"
