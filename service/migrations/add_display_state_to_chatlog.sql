-- 添加 display_state 字段到 chatlog 表
-- Migration: add_display_state_to_chatlog
-- Date: 2025-11-11

ALTER TABLE `chatlog`
    ADD COLUMN `display_state` TINYINT NULL DEFAULT 0 COMMENT '消息显示状态: 0或空=默认, 1=强制显示文字'
    AFTER `ttsDuration`;

