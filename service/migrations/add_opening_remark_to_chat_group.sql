-- 添加开场白字段到chat_group表
-- 执行时间: 2025-01-24
-- 说明: 为群聊和单聊添加开场白支持，刷新时不会丢失

USE chatgpt;

ALTER TABLE `chat_group`
ADD COLUMN `openingRemark` text NULL COMMENT '开场白（角色初始问候语）' AFTER `isGroupChat`;

-- 验证字段是否添加成功
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    COLUMN_DEFAULT,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'chatgpt'
AND TABLE_NAME = 'chat_group'
AND COLUMN_NAME = 'openingRemark';
