-- 为 chat_group 表添加表情包相关字段（安全版本）
-- 执行时间: 2025-01-12
-- 说明: 只更新 chat_group 表，添加 stickerIds 和 stickerProbability 字段

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
        SELECT CONCAT('✓ 字段 ', columnName, ' 已添加') AS Result;
    ELSE
        SELECT CONCAT('○ 字段 ', columnName, ' 已存在，跳过') AS Result;
    END IF;
END$$

DELIMITER ;

-- 添加表情包ID列表字段
CALL AddColumnIfNotExists('chat_group', 'stickerIds',
    "text NULL COMMENT '可用表情包ID列表（逗号分隔）' AFTER `allowEmoji`");

-- 添加表情包发送概率字段
CALL AddColumnIfNotExists('chat_group', 'stickerProbability',
    "int NOT NULL DEFAULT 30 COMMENT '表情包自动发送概率（0-100）' AFTER `stickerIds`");

-- 清理存储过程
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

-- 验证字段
SELECT
    COLUMN_NAME AS '字段名',
    DATA_TYPE AS '数据类型',
    COLUMN_DEFAULT AS '默认值',
    IS_NULLABLE AS '允许NULL',
    COLUMN_COMMENT AS '注释'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'chatgpt'
  AND TABLE_NAME = 'chat_group'
  AND COLUMN_NAME IN ('allowEmoji', 'stickerIds', 'stickerProbability', 'allowTap', 'maxReplyCount')
ORDER BY ORDINAL_POSITION;

-- 显示完成信息
SELECT '✓ chat_group 表表情包字段更新完成！' AS '执行结果';
