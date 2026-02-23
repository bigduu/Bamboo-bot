# E2E 测试修复总结

## 已完成的修复

### 1. ✅ playwright.config.ts
- **问题**: webServer.command 默认是 `echo "Server should be running"`，导致进程立即退出
- **修复**:
  - 将 webServer 配置改为条件性添加（仅在 E2E_START_SERVER 设置时启用）
  - 添加了 globalSetup 和 globalTeardown 配置
  - 增加了 actionTimeout 和 navigationTimeout 配置
  - 将项目名称从 "desktop" 改为 "chromium"

### 2. ✅ global-setup.ts (新建)
- 创建全局设置文件
- 检查后端健康状态
- 清理测试数据
- 提供清晰的错误信息和启动指导

### 3. ✅ global-teardown.ts (新建)
- 创建全局清理文件
- 测试完成后清理数据

### 4. ✅ utils/api-helpers.ts
- **问题**: API 路径使用了错误的 `/api/v1/bamboo/*` 前缀，健康检查期望 JSON 但实际返回纯文本 "OK"
- **修复**:
  - 更新为正确的 `/v1/bamboo/*` 路径（非 `/bamboo/*`）
  - 更新健康检查端点为 `/api/v1/health`（非 `/v1/health`）
  - 修复健康检查逻辑以支持纯文本 "OK" 响应
  - 移除了不存在的 API 端点（keywords、chat 等）
  - 添加了 setup 相关的辅助函数

### 5. ✅ tests/workflows.spec.ts
- **问题**: 使用了错误的 API 路径 `/api/v1/bamboo/workflows` 和 `/bamboo/workflows`
- **修复**: 更新为正确的 `/v1/bamboo/workflows`
- 为需要 API 调用的测试添加了 `request` 参数

### 6. ✅ tests/keyword-masking.spec.ts
- **问题**: 使用了错误的 API 路径 `/api/v1/bamboo/keywords` 和 `/bamboo/keyword-masking`
- **修复**:
  - 更新为正确的 `/v1/bamboo/keyword-masking` 端点
  - 更新了请求/响应格式（使用 entries 数组）
  - 为需要 API 调用的测试添加了 `request` 参数

### 7. ✅ package.json
- 添加了新的测试脚本：
  - `test:browser` - 浏览器模式测试
  - `test:docker` - Docker 模式测试
  - `test:with-server` - 自动启动后端

### 8. ✅ README.md
- 完全重写了 README，包含：
  - 快速开始指南
  - 所有测试脚本的说明
  - 环境变量配置
  - 故障排除指南

## 剩余的潜在问题

### 需要验证的选择器
以下测试使用了 `data-testid` 选择器，需要验证这些选择器是否存在于实际 UI 组件中：

#### Setup Flow
- `[data-testid="setup-wizard"]`
- `[data-testid="setup-next"]`
- `[data-testid="api-key-input"]`
- `[data-testid="validate-key"]`
- `[data-testid="validation-error"]`
- `[data-testid="setup-finish"]`
- `[data-testid="setup-complete"]`
- `[data-testid="reconfigure-button"]`

#### Chat
- `[data-testid="chat-input"]`
- `[data-testid="send-button"]`
- `[data-testid="assistant-message"]`
- `[data-testid="streaming-indicator"]`
- `[data-testid="error-message"]`
- `[data-testid="cancel-button"]`
- `[data-testid="cancelled-indicator"]`
- `[data-testid="copy-message"]`
- `[data-testid="regenerate-button"]`

#### Workflows
- `[data-testid="create-workflow"]`
- `[data-testid="workflow-name"]`
- `[data-testid="workflow-content"]`
- `[data-testid="save-workflow"]`
- `[data-testid="delete-workflow-{name}"]`
- `[data-testid="confirm-delete"]`
- `[data-testid="workflow-search"]`
- `[data-testid="export-{name}"]`
- `[data-testid="import-workflow"]`

#### Keyword Masking
- `[data-testid="keyword-input"]`
- `[data-testid="add-keyword"]`
- `[data-testid="remove-{keyword}"]`
- `[data-testid="bulk-import"]`
- `[data-testid="import-bulk"]`
- `[data-testid="export-keywords"]`

#### Settings
- `[data-testid="save-api-settings"]`
- `[data-testid="model-select"]`
- `[data-testid="save-general-settings"]`
- `[data-testid="temperature-input"]`
- `[data-testid="dark-mode-toggle"]`
- `[data-testid="save-appearance-settings"]`
- `[data-testid="reset-to-defaults"]`
- `[data-testid="confirm-reset"]`
- `[data-testid="export-settings"]`
- `[data-testid="import-settings"]`
- `[data-testid="api-status"]`
- `[data-testid="validate-api-key"]`
- `[data-testid="validation-result"]`
- `[data-testid="proxy-settings"]`
- `[data-testid="proxy-url"]`
- `[data-testid="save-proxy-settings"]`
- `[data-testid="app-version"]`

### 需要验证的 API 端点
以下端点已确认在后端实现：

- `GET /api/v1/health` ✅ (已确认存在，返回 "OK")
- `GET /v1/bamboo/setup/status` ✅ (已确认存在)
- `POST /v1/bamboo/setup/complete` ✅ (已确认存在)
- `GET /v1/bamboo/workflows` ✅ (已确认存在)
- `POST /v1/bamboo/workflows` ✅ (已确认存在)
- `DELETE /v1/bamboo/workflows/{name}` ✅ (已确认存在)
- `GET /v1/bamboo/keyword-masking` ✅ (已确认存在)
- `POST /v1/bamboo/keyword-masking` ✅ (已确认存在)
- `POST /v1/bamboo/keyword-masking/validate` ✅ (已确认存在)

### 可能不存在的选择器/功能
以下测试可能需要在实际 UI 实现后才能通过：

1. **Keyword masking 的 UI 组件** - 需要确认前端是否有这些组件
2. **Workflow 的导入/导出功能** - 需要确认是否实现
3. **Settings 中的某些选项** - 需要确认是否存在
4. **Chat 中的某些功能**（如 regenerate、cancel）- 需要确认是否实现

## 如何运行测试

### 1. 安装依赖
```bash
cd e2e
yarn install
npx playwright install
```

### 2. 启动后端
```bash
cargo run -p web_service_standalone -- --port 8080 --data-dir /tmp/test-data
```

### 3. 运行测试
```bash
# 基本测试（需要后端运行在 :8080）
yarn test

# 浏览器模式
yarn test:browser

# Docker 模式
yarn test:docker

# 自动启动后端
yarn test:with-server

# UI 模式
yarn test:ui
```

## 下一步建议

1. **验证 UI 选择器**: 检查 `src/` 目录下的组件，确保所有 `data-testid` 属性都存在
2. **运行测试**: 执行 `yarn test` 查看哪些测试失败
3. **修复失败的测试**: 根据失败原因修复选择器或测试逻辑
4. **添加缺失的 data-testid**: 如果前端组件缺少测试所需的属性，添加它们

## 文件变更清单

### 修改的文件
1. `e2e/playwright.config.ts`
2. `e2e/utils/api-helpers.ts`
3. `e2e/tests/workflows.spec.ts`
4. `e2e/tests/keyword-masking.spec.ts`
5. `e2e/package.json`
6. `e2e/README.md`

### 新建的文件
1. `e2e/global-setup.ts`
2. `e2e/global-teardown.ts`
3. `e2e/REPAIR_PLAN.md`
4. `e2e/REPAIR_SUMMARY.md` (本文件)
