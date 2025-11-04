-- 为 chat_group 表添加群组头像字段
-- 用于存储自动生成的群组拼图头像URL
-- 创建时间: 2025-11-02

ALTER TABLE chat_group ADD COLUMN group_avatar VARCHAR(500) NULL COMMENT '群组头像URL';

-- 回滚SQL (如需回滚，执行以下语句):
-- ALTER TABLE chat_group DROP COLUMN group_avatar;
