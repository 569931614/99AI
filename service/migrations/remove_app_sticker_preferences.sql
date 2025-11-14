-- 移除 app/chat_group 表中过时的 sticker 配置字段，统一使用公共表情库
-- 执行方式：mysql -u root -p chatgpt < remove_app_sticker_preferences.sql

USE chatgpt;

DELIMITER $$

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
        SELECT CONCAT('✗ 已移除列: ', tableName, '.', columnName) AS Result;
    ELSE
        SELECT CONCAT('○ 未找到列: ', tableName, '.', columnName, '（已是最新状态）') AS Result;
    END IF;
END$$

DELIMITER ;

SELECT '========== 开始移除 app 表字段 ==========' AS '执行状态';
CALL DropColumnIfExists('app', 'stickerIds');
CALL DropColumnIfExists('app', 'stickerProbability');

SELECT '========== 开始移除 chat_group 表字段 ==========' AS '执行状态';
CALL DropColumnIfExists('chat_group', 'stickerIds');
CALL DropColumnIfExists('chat_group', 'stickerProbability');

DROP PROCEDURE IF EXISTS DropColumnIfExists;

SELECT '========== 验证：如无结果表示字段已不存在 ==========' AS '验证说明';
SELECT COLUMN_NAME, TABLE_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'chatgpt'
  AND TABLE_NAME IN ('app', 'chat_group')
  AND COLUMN_NAME IN ('stickerIds', 'stickerProbability');

SELECT '
╔══════════════════════════════════════╗
║    ✓ sticker 配置字段已清理完成     ║
║    现在统一从公共表情库获取资源      ║
╚══════════════════════════════════════╝
' AS '执行结果';
