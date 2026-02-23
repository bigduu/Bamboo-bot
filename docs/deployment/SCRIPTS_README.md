# 开发工具脚本

这个目录包含了一些实用的开发工具脚本，帮助简化开发和测试流程。

## 可用脚本

### 📦 部署相关

#### `test-static-serving.sh` - 静态文件服务测试
自动化测试脚本，验证前端静态文件服务功能。

**特点**：
- ✅ 自动启动/停止服务器
- ✅ 完整测试套件（API、前端、静态资源）
- ✅ 退出时自动清理进程
- ✅ 使用固定端口 9080（不会冲突）

**使用**：
```bash
./test-static-serving.sh
```

**详细文档**：参见 [TESTING_GUIDE.md](./TESTING_GUIDE.md)

---

#### `cleanup-server.sh` - 进程清理工具
查找并清理所有残留的 `web_service_standalone` 进程。

**特点**：
- ✅ 交互式确认
- ✅ 安全清理（先优雅关闭，再强制终止）
- ✅ 清理所有相关进程

**使用**：
```bash
./cleanup-server.sh
```

**详细文档**：参见 [TESTING_GUIDE.md](./TESTING_GUIDE.md)

---

## 快速开始

### 1. 测试静态文件服务
```bash
# 确保已构建前端
npm run build

# 运行测试
./test-static-serving.sh
```

### 2. 清理残留进程
```bash
# 检查并清理
./cleanup-server.sh
```

## 文档

- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - 详细的测试和进程管理指南
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - 前端部署完整指南
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - 实现技术细节

## 常见问题

### Q: 为什么测试脚本使用端口 9080？
**A**: 为了避免与开发时常用的 8080 端口冲突。9080 是固定端口，测试时不会冲突。

### Q: 进程没有被清理怎么办？
**A**: 运行清理脚本：`./cleanup-server.sh`

### Q: 测试脚本卡住不动？
**A**: 可能是端口被占用，运行：
```bash
./cleanup-server.sh
```
然后重新运行测试。

### Q: 如何手动测试？
**A**: 参见 [TESTING_GUIDE.md](./TESTING_GUIDE.md) 中的"常见使用场景"部分。

## 最佳实践

1. ✅ **使用自动化脚本**：`./test-static-serving.sh` 而不是手动启动
2. ✅ **定期清理**：每天下班前运行 `./cleanup-server.sh`
3. ✅ **遇到端口占用先清理**：不要换端口，先清理残留进程
4. ✅ **阅读文档**：详细说明都在 [TESTING_GUIDE.md](./TESTING_GUIDE.md)

## 问题反馈

如果遇到问题：
1. 查看 [TESTING_GUIDE.md](./TESTING_GUIDE.md) 的故障排查部分
2. 检查日志：`/tmp/web_service_test.log`
3. 运行清理脚本：`./cleanup-server.sh`
