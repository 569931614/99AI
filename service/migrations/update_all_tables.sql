-- 一键更新 app 和 chat_group 表的所有新字段
-- 执行时间: 2025-01-12
-- 说明: 合并执行所有表结构更新，支持重复执行

USE chatgpt;

DELIMITER $$

-- 创建添加字段的存储过程
DROP PROCEDURE IF EXISTS AddColumnIfNotExists$$
CREATE PROCEDURE AddColumnIfNotExists(
    IN tableName VARCHAR(128),
    IN columnName VARCHAR(128),
    IN columnDefinition TEXT
)
BEGIN
    DECLARE columnExists INT;

    SELECT COUNT(*) INTO columnExists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = tableName
      AND COLUMN_NAME = columnName;

    IF columnExists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE `', tableName, '` ADD COLUMN `', columnName, '` ', columnDefinition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('✓ [', tableName, '.', columnName, '] 已添加') AS Result;
    ELSE
        SELECT CONCAT('○ [', tableName, '.', columnName, '] 已存在，跳过') AS Result;
    END IF;
END$$

DROP PROCEDURE IF EXISTS DropColumnIfExists$$
CREATE PROCEDURE DropColumnIfExists(
    IN tableName VARCHAR(128),
    IN columnName VARCHAR(128)
)
BEGIN
    DECLARE columnExists INT;

    SELECT COUNT(*) INTO columnExists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = tableName
      AND COLUMN_NAME = columnName;

    IF columnExists > 0 THEN
        SET @sql = CONCAT('ALTER TABLE `', tableName, '` DROP COLUMN `', columnName, '`');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('✗ [', tableName, '.', columnName, '] 已移除（统一使用公共表情库）') AS Result;
    ELSE
        SELECT CONCAT('○ [', tableName, '.', columnName, '] 不存在，跳过') AS Result;
    END IF;
END$$

DELIMITER ;

-- ========================================
-- 第一部分：更新 app 表（角色默认设置）
-- ========================================
SELECT '========== 开始更新 app 表 ==========' AS '执行状态';

CALL AddColumnIfNotExists('app', 'maxReplyCount',
    "int NOT NULL DEFAULT 1 COMMENT '最大连续回复次数（1-5）' AFTER `openingRemark`");

CALL AddColumnIfNotExists('app', 'allowEmoji',
    "tinyint NOT NULL DEFAULT 0 COMMENT '是否允许发送表情包（1/0）' AFTER `maxReplyCount`");

CALL DropColumnIfExists('app', 'stickerIds');
CALL DropColumnIfExists('app', 'stickerProbability');

SELECT '========== app 表更新完成 ==========' AS '执行状态';

-- ========================================
-- 第二部分：更新 chat_group 表（会话组个性化设置）
-- ========================================
SELECT '========== 开始更新 chat_group 表 ==========' AS '执行状态';

CALL AddColumnIfNotExists('chat_group', 'description',
    "text NULL COMMENT '群聊描述信息' AFTER `openingRemark`");

CALL AddColumnIfNotExists('chat_group', 'ownerNickname',
    "varchar(100) NULL COMMENT '群主在群内的昵称' AFTER `description`");

CALL AddColumnIfNotExists('chat_group', 'memberRelationships',
    "longtext NULL COMMENT '人物关系配置(JSON)' AFTER `ownerNickname`");

CALL AddColumnIfNotExists('chat_group', 'proactivelySend',
    "tinyint NOT NULL DEFAULT 0 COMMENT '是否主动发消息：0-否，1-是' AFTER `memberRelationships`");

CALL AddColumnIfNotExists('chat_group', 'describingMental',
    "tinyint NOT NULL DEFAULT 0 COMMENT '是否启用心理描述：0-否，1-是' AFTER `proactivelySend`");

CALL AddColumnIfNotExists('chat_group', 'realTime',
    "tinyint NOT NULL DEFAULT 0 COMMENT '是否开启真实时间：0-否，1-是' AFTER `describingMental`");

CALL AddColumnIfNotExists('chat_group', 'myName',
    "varchar(100) NULL COMMENT '对我的称呼' AFTER `realTime`");

CALL AddColumnIfNotExists('chat_group', 'myProfile',
    "text NULL COMMENT '我的简介' AFTER `myName`");

CALL AddColumnIfNotExists('chat_group', 'conversationMemoryCount',
    "int NOT NULL DEFAULT 10 COMMENT '对话记忆条数（1-100）' AFTER `myProfile`");

CALL AddColumnIfNotExists('chat_group', 'autoSummaryEnabled',
    "tinyint NOT NULL DEFAULT 0 COMMENT '是否开启自动总结：0-否，1-是' AFTER `conversationMemoryCount`");

CALL AddColumnIfNotExists('chat_group', 'summaryPrompt',
    "text NULL COMMENT '自动总结提示词' AFTER `autoSummaryEnabled`");

CALL AddColumnIfNotExists('chat_group', 'chatSummary',
    "text NULL COMMENT '当前对话总结内容' AFTER `summaryPrompt`");

CALL AddColumnIfNotExists('chat_group', 'voiceReplyMode',
    "varchar(20) NOT NULL DEFAULT 'text_only' COMMENT '语音回复模式：voice_only-全部发语音，mixed-偶尔发一次，text_only-不要发语音' AFTER `chatSummary`");

CALL AddColumnIfNotExists('chat_group', 'allowEmoji',
    "tinyint NOT NULL DEFAULT 0 COMMENT '是否允许发送表情包：0-否，1-是' AFTER `voiceReplyMode`");

CALL AddColumnIfNotExists('chat_group', 'allowTap',
    "tinyint NOT NULL DEFAULT 0 COMMENT '是否允许拍一拍：0-否，1-是' AFTER `allowEmoji`");

CALL AddColumnIfNotExists('chat_group', 'maxReplyCount',
    "int NOT NULL DEFAULT 5 COMMENT '最多回复条数（1-5）' AFTER `allowTap`");

CALL DropColumnIfExists('chat_group', 'stickerIds');
CALL DropColumnIfExists('chat_group', 'stickerProbability');

CALL AddColumnIfNotExists('chat_group', 'groupAvatar',
    "varchar(500) NULL COMMENT '群组头像URL' AFTER `maxReplyCount`");

CALL AddColumnIfNotExists('chat_group', 'backgroundImage',
    "varchar(500) NULL COMMENT '群聊背景图片URL' AFTER `groupAvatar`");

SELECT '========== chat_group 表更新完成 ==========' AS '执行状态';

-- 清理存储过程
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;
DROP PROCEDURE IF EXISTS DropColumnIfExists;

-- ========================================
-- 验证结果
-- ========================================
SELECT '========== 验证 app 表字段 ==========' AS '验证结果';
SELECT
    COLUMN_NAME AS '字段名',
    COLUMN_COMMENT AS '注释'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'chatgpt'
  AND TABLE_NAME = 'app'
  AND COLUMN_NAME IN ('maxReplyCount', 'allowEmoji')
ORDER BY ORDINAL_POSITION;

SELECT '========== 验证 chat_group 表字段 ==========' AS '验证结果';
SELECT
    COLUMN_NAME AS '字段名',
    COLUMN_COMMENT AS '注释'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'chatgpt'
  AND TABLE_NAME = 'chat_group'
  AND COLUMN_NAME IN (
    'voiceReplyMode', 'conversationMemoryCount', 'autoSummaryEnabled',
    'allowEmoji', 'allowTap', 'maxReplyCount'
  )
ORDER BY ORDINAL_POSITION;

-- 显示完成信息
SELECT '
╔════════════════════════════════════════════╗
║     ✓ 数据库表结构更新完成！              ║
║                                            ║
║  已更新表:                                 ║
║    • app (角色默认设置)                   ║
║    • chat_group (会话组个性化设置)        ║
║                                            ║
║  新增功能:                                 ║
║    • 语音回复模式 (voice_only 支持)       ║
║    • 对话记忆管理                         ║
║    • 表情包配置字段统一移除               ║
║    • 自动总结                             ║
║                                            ║
╚════════════════════════════════════════════╝
' AS '执行结果';
