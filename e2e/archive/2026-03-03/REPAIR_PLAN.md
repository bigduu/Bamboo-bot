# E2E 测试修复计划

## 当前问题诊断

### 1. playwright.config.ts 问题
- `webServer.command` 默认是 `echo "Server should be running"`，这会导致进程立即退出
- 需要为不同模式配置正确的启动命令

### 2. 测试文件问题
- 测试使用了大量 `data-testid` 选择器，需要验证这些选择器是否存在于实际 UI 中
- API 端点路径可能需要调整（如 `/api/v1/bamboo/*`）
- 缺少全局 setup/teardown 来处理测试数据

### 3. 缺少的文件
- 全局 setup 文件
- 更好的测试 fixtures
- 环境配置

## 修复步骤

### Step 1: 修复 playwright.config.ts
- 移除或修复 webServer 配置
- 添加全局 setup 配置
- 为不同模式添加项目配置

### Step 2: 创建全局 setup 文件
- 添加 global-setup.ts
- 处理测试数据清理

### Step 3: 验证并修复测试选择器
- 检查 src/ 目录下的组件
- 确保 data-testid 属性存在

### Step 4: 修复 API 端点
- 验证后端 API 路由
- 调整测试中的 API 调用

### Step 5: 添加环境配置
- 创建 .env.test 配置
- 添加测试脚本

## 关键文件清单

1. e2e/playwright.config.ts - 需要修复
2. e2e/global-setup.ts - 需要创建
3. e2e/global-teardown.ts - 需要创建
4. e2e/tests/*.spec.ts - 需要验证选择器
5. src/ 下的组件 - 需要添加 data-testid

## 测试运行方式

```bash
# 浏览器模式（需要手动启动后端）
cargo run -p web_service_standalone -- --port 8080 --data-dir /tmp/test-data
yarn dev
E2E_BASE_URL=http://localhost:1420 yarn test:e2e

# Docker 模式
cd docker && docker-compose up -d
E2E_BASE_URL=http://localhost:8080 yarn test:e2e
```
