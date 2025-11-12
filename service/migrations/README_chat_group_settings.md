# chat_group 表字段更新说明

## 概述
为 `chat_group` 表添加会话组个性化设置相关字段，包括对话记忆、语音回复、表情包等功能。

## 新增字段列表

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `description` | text | NULL | 群聊描述信息 |
| `ownerNickname` | varchar(100) | NULL | 群主在群内的昵称 |
| `memberRelationships` | longtext | NULL | 人物关系配置(JSON) |
| `proactivelySend` | tinyint | 0 | 是否主动发消息：0-否，1-是 |
| `describingMental` | tinyint | 0 | 是否启用心理描述：0-否，1-是 |
| `realTime` | tinyint | 0 | 是否开启真实时间：0-否，1-是 |
| `myName` | varchar(100) | NULL | 对我的称呼 |
| `myProfile` | text | NULL | 我的简介 |
| `conversationMemoryCount` | int | 10 | 对话记忆条数（1-100） |
| `autoSummaryEnabled` | tinyint | 0 | 是否开启自动总结：0-否，1-是 |
| `summaryPrompt` | text | NULL | 自动总结提示词 |
| `chatSummary` | text | NULL | 当前对话总结内容 |
| **`voiceReplyMode`** | varchar(20) | 'text_only' | **语音回复模式：voice_only-全部发语音，mixed-偶尔发一次，text_only-不要发语音** |
| `allowEmoji` | tinyint | 0 | 是否允许发送表情包：0-否，1-是 |
| `allowTap` | tinyint | 0 | 是否允许拍一拍：0-否，1-是 |
| `maxReplyCount` | int | 5 | 最多回复条数（1-5） |
| `groupAvatar` | varchar(500) | NULL | 群组头像URL |
| `backgroundImage` | varchar(500) | NULL | 群聊背景图片URL |

## SQL 文件说明

提供了三个版本的迁移文件，选择其中一个执行即可：

### 1. `add_chat_group_settings_safe.sql` ⭐ 推荐
- **特点**: 使用存储过程自动检查字段是否存在
- **优势**: 可重复执行，不会因字段已存在而报错
- **适用**: 生产环境、不确定字段是否已存在的情况

### 2. `add_chat_group_settings_mysql.sql`
- **特点**: 标准MySQL ALTER TABLE语句
- **优势**: 简单直接，易于理解
- **适用**: 全新安装、确定字段不存在的情况
- **注意**: 如果字段已存在会报错

### 3. `add_chat_group_settings.sql`
- **特点**: 使用 IF NOT EXISTS 语法（需要MySQL 8.0.13+）
- **优势**: 语法简洁
- **适用**: MySQL 8.0.13+ 版本

## 执行步骤

### 方式一：使用推荐的安全版本（推荐）
```bash
mysql -u root -p chatgpt < add_chat_group_settings_safe.sql
```

### 方式二：使用MySQL客户端
```bash
# 1. 连接数据库
mysql -u root -p

# 2. 选择数据库
USE chatgpt;

# 3. 执行SQL文件
SOURCE /path/to/add_chat_group_settings_safe.sql;
```

### 方式三：使用Navicat等图形化工具
1. 打开SQL文件
2. 选择数据库 `chatgpt`
3. 点击运行

## 执行后验证

执行以下SQL查询验证字段是否添加成功：

```sql
SELECT
    COLUMN_NAME AS '字段名',
    DATA_TYPE AS '数据类型',
    COLUMN_DEFAULT AS '默认值',
    IS_NULLABLE AS '允许NULL',
    COLUMN_COMMENT AS '注释'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'chatgpt'
  AND TABLE_NAME = 'chat_group'
  AND COLUMN_NAME IN (
    'voiceReplyMode', 'conversationMemoryCount', 'autoSummaryEnabled',
    'allowEmoji', 'allowTap', 'maxReplyCount'
  );
```

应该返回6行记录，包含上述所有字段。

## 注意事项

1. **备份数据**: 执行前建议备份数据库
2. **权限检查**: 确保数据库用户有 ALTER TABLE 权限
3. **版本兼容**: MySQL 5.7+ 均可使用安全版本
4. **字段顺序**: 字段按照 entity 文件中的顺序添加

## 相关代码修改

- ✅ `chatGroup.entity.ts` - 实体定义已更新
- ✅ `chat.service.ts` - 语音回复逻辑已实现
- ✅ `open-chatGroup.controller.ts` - API文档已更新
- ✅ 前端界面已添加【全部发语音】选项

## 功能说明

### voiceReplyMode（语音回复模式）
- **voice_only**: 全部发语音，每次AI回复都生成语音（100%概率）
- **mixed**: 偶尔发一次，按5:2比例随机生成语音（约28.6%概率）
- **text_only**: 不要发语音，所有回复都是纯文字（0%概率）

## 问题排查

### 字段已存在错误
使用 `add_chat_group_settings_safe.sql` 可避免此问题

### 权限不足
```sql
GRANT ALTER ON chatgpt.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

### 表不存在
确认数据库名称和表名是否正确：
```sql
SHOW TABLES LIKE 'chat_group';
```
