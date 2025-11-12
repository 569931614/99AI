# 数据库表结构更新 - 完整说明

## 🔍 问题诊断

### 报错信息
```
Unknown column 'AppEntity.maxReplyCount' in 'field list'
```

### 问题原因
1. **app.entity.ts** 中定义了 `maxReplyCount`、`allowEmoji` 等字段
2. 但 **app 表**在数据库中缺少这些字段
3. 之前的迁移文件 `add-app-expression-settings.sql` 可能没有执行

## 📊 表结构说明

### app 表（角色默认设置）
这些字段作为**角色的默认配置**：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxReplyCount` | int | 1 | 最大连续回复次数（1-5） |
| `allowEmoji` | tinyint | 0 | 是否允许发送表情包（1/0） |
| `stickerIds` | text | NULL | 可用表情包ID列表（逗号分隔） |
| `stickerProbability` | int | 30 | 表情包自动发送概率（0-100） |

### chat_group 表（会话组个性化设置）
这些字段作为**会话级别的覆盖设置**：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `voiceReplyMode` | varchar(20) | 'text_only' | 语音回复模式 |
| `conversationMemoryCount` | int | 10 | 对话记忆条数（1-100） |
| `autoSummaryEnabled` | tinyint | 0 | 是否开启自动总结 |
| `allowEmoji` | tinyint | 0 | 是否允许发送表情包 |
| `allowTap` | tinyint | 0 | 是否允许拍一拍 |
| `maxReplyCount` | int | 5 | 最多回复条数（1-5） |
| ... | ... | ... | ... |

## 💡 设计理念

```
角色默认设置 (app表)
    ↓
    覆盖
    ↓
会话组设置 (chat_group表)
```

- **app表**: 角色创建时的默认设置（对所有使用该角色的会话生效）
- **chat_group表**: 单个会话组的个性化设置（优先级更高）

## 📥 SQL文件列表

### 方案1: 一键更新（推荐）⭐

```bash
F:\aiCodeProject\20250911roleChat\99AI\service\migrations\update_all_tables.sql
```

**特点**：
- ✅ 同时更新 `app` 和 `chat_group` 两张表
- ✅ 支持重复执行，不会报错
- ✅ 包含详细的执行日志和验证
- ✅ 适合生产环境

**执行方式**：
```bash
mysql -u root -p chatgpt < update_all_tables.sql
```

### 方案2: 分别更新

#### 2.1 更新 app 表
```bash
F:\aiCodeProject\20250911roleChat\99AI\service\migrations\add_app_expression_settings_safe.sql
```

#### 2.2 更新 chat_group 表
```bash
F:\aiCodeProject\20250911roleChat\99AI\service\migrations\add_chat_group_settings_safe.sql
```

## 🚀 快速修复步骤

### 步骤1: 执行SQL
```bash
cd F:\aiCodeProject\20250911roleChat\99AI\service\migrations
mysql -u root -p chatgpt < update_all_tables.sql
```

### 步骤2: 重启服务
```bash
cd F:\aiCodeProject\20250911roleChat\99AI\service
pnpm dev
```

### 步骤3: 验证
访问接口测试：
```bash
curl -X POST http://localhost:9520/api/open/group/query-single-chats \
  -H "Content-Type: application/json" \
  -d '{"userId": 1}'
```

应该返回成功，不再报 `Unknown column` 错误。

## ✅ 验证查询

执行SQL后，可以运行以下查询验证：

```sql
-- 验证 app 表
SELECT COLUMN_NAME, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'chatgpt'
  AND TABLE_NAME = 'app'
  AND COLUMN_NAME IN ('maxReplyCount', 'allowEmoji', 'stickerIds', 'stickerProbability');

-- 验证 chat_group 表
SELECT COLUMN_NAME, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'chatgpt'
  AND TABLE_NAME = 'chat_group'
  AND COLUMN_NAME IN ('voiceReplyMode', 'allowEmoji', 'maxReplyCount');
```

每个查询都应该返回相应数量的行。

## 🔧 代码修改总结

### 后端
- ✅ `app.entity.ts` - 保留字段定义（角色默认设置）
- ✅ `chatGroup.entity.ts` - 已有字段定义（会话组设置）
- ✅ `chat.service.ts` - 语音回复逻辑已实现
- ✅ `open-chatGroup.controller.ts` - API已更新

### 前端
- ✅ `cat_AI/pagesIndex/role/info.vue` - 界面已添加【全部发语音】选项

## ⚠️ 注意事项

1. **执行前备份数据库**
   ```bash
   mysqldump -u root -p chatgpt > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **权限检查**
   确保数据库用户有 ALTER TABLE 权限

3. **字段冲突**
   如果已经手动添加过某些字段，SQL会自动跳过

4. **服务重启**
   执行SQL后记得重启 NestJS 服务

## 📝 voiceReplyMode 使用说明

### 三种模式

| 模式值 | 界面显示 | 行为 | 概率 |
|--------|----------|------|------|
| `voice_only` | 🔊 全部发语音 | 每次都生成语音 | 100% |
| `mixed` | 🎤 偶尔发一次 | 按比例随机生成 | ~28.6% (5:2) |
| `text_only` | 📝 不要发语音 | 从不生成语音 | 0% |

### 生效规则

```javascript
// chat.service.ts 第2525-2556行
if (groupVoiceReplyMode === 'voice_only') {
  shouldGenerateVoice = true;  // 100%
} else if (groupVoiceReplyMode === 'mixed') {
  shouldGenerateVoice = Math.random() < 0.286;  // 28.6%
}
```

## 🎉 完成检查清单

- [ ] 执行 `update_all_tables.sql`
- [ ] 验证 app 表字段
- [ ] 验证 chat_group 表字段
- [ ] 重启 NestJS 服务
- [ ] 测试 querySingleChats 接口
- [ ] 测试语音回复功能
- [ ] 确认前端【全部发语音】选项正常显示

---

**最后更新**: 2025-01-12
**相关Issue**: Unknown column 'AppEntity.maxReplyCount'
