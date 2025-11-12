-- 快速修复版本 - 仅添加必需字段
-- 这是最小化的修复方案，只添加当前报错缺失的字段

USE chatgpt;

-- 检查并添加 app 表的字段
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='app' AND COLUMN_NAME='maxReplyCount') > 0,
    "SELECT '字段 maxReplyCount 已存在' AS msg",
    "ALTER TABLE app ADD COLUMN maxReplyCount int NOT NULL DEFAULT 1 COMMENT '最大连续回复次数（1-5）' AFTER openingRemark"
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='app' AND COLUMN_NAME='allowEmoji') > 0,
    "SELECT '字段 allowEmoji 已存在' AS msg",
    "ALTER TABLE app ADD COLUMN allowEmoji tinyint NOT NULL DEFAULT 0 COMMENT '是否允许发送表情包（1/0）' AFTER maxReplyCount"
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='app' AND COLUMN_NAME='stickerIds') > 0,
    "SELECT '字段 stickerIds 已存在' AS msg",
    "ALTER TABLE app ADD COLUMN stickerIds text NULL COMMENT '可用表情包ID列表（逗号分隔）' AFTER allowEmoji"
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='app' AND COLUMN_NAME='stickerProbability') > 0,
    "SELECT '字段 stickerProbability 已存在' AS msg",
    "ALTER TABLE app ADD COLUMN stickerProbability int NOT NULL DEFAULT 30 COMMENT '表情包自动发送概率（0-100）' AFTER stickerIds"
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 验证
SELECT '✓ app 表字段更新完成' AS 结果;
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='app'
AND COLUMN_NAME IN ('maxReplyCount', 'allowEmoji', 'stickerIds', 'stickerProbability');
