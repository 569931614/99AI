-- 添加语音时长字段到 chatlog 表
-- Migration: add_tts_duration_to_chatlog
-- Date: 2025-10-24

-- 添加 ttsDuration 字段（单位：秒，整数类型）
ALTER TABLE `chatlog` ADD COLUMN `ttsDuration` INT NULL COMMENT '语音时长（秒）' AFTER `ttsUrl`;

-- 添加索引以优化查询（可选）
-- CREATE INDEX idx_chatlog_tts_duration ON chatlog(ttsDuration);
