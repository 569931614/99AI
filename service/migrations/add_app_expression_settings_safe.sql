-- 添加角色表情包和回复设置到app表（安全版本）
-- 执行时间: 2025-01-12
-- 说明: 为app表添加表情包、最大回复次数等默认设置
-- 特点: 使用存储过程自动检查字段是否已存在，避免重复执行报错

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

-- 执行字段添加
CALL AddColumnIfNotExists('app', 'maxReplyCount',
    "int NOT NULL DEFAULT 1 COMMENT '最大连续回复次数（1-5）' AFTER `openingRemark`");

CALL AddColumnIfNotExists('app', 'allowEmoji',
    "tinyint NOT NULL DEFAULT 0 COMMENT '是否允许发送表情包（1/0）' AFTER `maxReplyCount`");

CALL AddColumnIfNotExists('app', 'stickerIds',
    "text NULL COMMENT '可用表情包ID列表（逗号分隔）' AFTER `allowEmoji`");

CALL AddColumnIfNotExists('app', 'stickerProbability',
    "int NOT NULL DEFAULT 30 COMMENT '表情包自动发送概率（0-100）' AFTER `stickerIds`");

-- 清理存储过程
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

-- 验证所有字段
SELECT
    COLUMN_NAME AS '字段名',
    DATA_TYPE AS '数据类型',
    COLUMN_DEFAULT AS '默认值',
    IS_NULLABLE AS '允许NULL',
    COLUMN_COMMENT AS '注释'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'chatgpt'
  AND TABLE_NAME = 'app'
  AND COLUMN_NAME IN (
    'maxReplyCount', 'allowEmoji', 'stickerIds', 'stickerProbability'
  )
ORDER BY ORDINAL_POSITION;

-- 显示完成信息
SELECT '✓ app 表字段更新完成！' AS '执行结果';
