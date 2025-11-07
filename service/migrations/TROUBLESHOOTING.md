# 音色分类功能 500 错误排查指南

## 问题描述
访问 `http://localhost:9001/proxy/voice-category` 返回 500 Internal Server Error

## 排查步骤

### 1. 检查数据库表是否已创建

运行以下 SQL 检查：
```bash
mysql -u root -p chatgpt < service/migrations/check-voice-category.sql
```

或者直接在 MySQL 客户端中执行：
```sql
-- 检查表是否存在
SHOW TABLES LIKE 'voice_category';

-- 检查表结构
DESCRIBE voice_category;

-- 检查 voice 表是否有 categoryId 字段
DESCRIBE voice;
```

**如果表不存在**，运行迁移脚本：
```bash
mysql -u root -p chatgpt < service/migrations/add-voice-category.sql
```

### 2. 检查后端服务日志

重启服务并查看日志：
```bash
cd 99AI/service
pnpm dev
```

查看控制台输出，关注：
- 数据库连接是否成功
- 是否有 TypeORM 相关错误
- VoiceCategoryController 是否加载成功

### 3. 验证代码文件

确保以下文件已正确创建：
- ✅ `service/src/modules/voice/voiceCategory.entity.ts`
- ✅ `service/src/modules/voice/voiceCategory.controller.ts`
- ✅ `service/src/modules/voice/voiceCategory.service.ts`
- ✅ `service/src/modules/voice/voice.module.ts` (已更新)
- ✅ `service/src/modules/database/database.module.ts` (已添加 VoiceCategoryEntity)

### 4. 测试 API 端点

使用 curl 或 Postman 测试：

```bash
# 获取分类列表（需要认证）
curl -X GET http://localhost:9520/voice-category \
  -H "Authorization: Bearer YOUR_TOKEN"

# 创建分类（需要认证）
curl -X POST http://localhost:9520/voice-category \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"男声","description":"男性音色","sort":100}'
```

注意：直接访问后端服务端口 9520，而不是通过前端代理 9001

### 5. 常见问题

#### 问题 1: 表未创建
**症状**: QueryFailedError: Table 'chatgpt.voice_category' doesn't exist
**解决**: 运行迁移 SQL：`mysql -u root -p chatgpt < service/migrations/add-voice-category.sql`

#### 问题 2: 实体未注册
**症状**: Repository not found for entity VoiceCategoryEntity
**解决**: 确认 `database.module.ts` 中已添加 `VoiceCategoryEntity`

#### 问题 3: 模块未导入
**症状**: Cannot resolve dependency VoiceCategoryService
**解决**: 确认 `voice.module.ts` 中已正确导入和导出

#### 问题 4: JWT 认证失败
**症状**: 401 Unauthorized
**解决**: 确保请求头包含有效的 JWT token

### 6. 直接测试后端

绕过前端，直接访问后端：

```bash
# 测试分类列表 API（无需认证的测试）
curl -X GET http://localhost:9520/voice-category

# 查看 Swagger 文档
浏览器访问: http://localhost:9520/api-docs
```

### 7. 检查前端代理配置

如果后端直接访问正常，但通过 `/proxy/` 访问失败，检查前端代理配置：

文件位置：`admin/vite.config.ts` 或 `admin/vue.config.js`

```javascript
proxy: {
  '/proxy': {
    target: 'http://localhost:9520',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/proxy/, '')
  }
}
```

## 完整重启流程

如果以上步骤都检查无误，尝试完整重启：

```bash
# 1. 停止所有服务
# Ctrl+C 停止正在运行的服务

# 2. 运行数据库迁移
cd 99AI
mysql -u root -p chatgpt < service/migrations/add-voice-category.sql

# 3. 重新构建后端
cd service
pnpm build

# 4. 启动后端
pnpm dev

# 5. 在新终端启动前端
cd ../admin
pnpm dev
```

## 验证成功

当功能正常时，你应该能够：
1. ✅ 访问 `http://localhost:9001/proxy/voice-category` 返回 200
2. ✅ 在音色列表页面看到"分类管理"按钮
3. ✅ 点击"分类管理"能打开对话框
4. ✅ 能够添加、编辑、删除分类
5. ✅ 能够为音色设置分类
6. ✅ 能够按分类筛选音色列表

## 获取详细错误信息

如果仍然出现 500 错误，在浏览器开发者工具中：
1. 打开 Network 标签
2. 重新发送请求
3. 点击失败的请求
4. 查看 Response 标签中的详细错误信息
5. 将错误信息提供给开发者以便进一步排查
