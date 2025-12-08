-- 为 voice 表添加 isEnabled 字段
-- 用于标识音色是否已启用（用户付费确认后设为 true）

ALTER TABLE `voice`
ADD COLUMN `isEnabled` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否已启用（用户付费确认后设为true）' AFTER `status`,
ADD INDEX `IDX_voice_isEnabled` (`isEnabled`);

-- 将现有的系统音色（userId 为 NULL）设为已启用
UPDATE `voice` SET `isEnabled` = 1 WHERE `userId` IS NULL;

-- 将现有的已成功克隆的用户音色（status = SUCCEEDED）设为已启用（兼容旧数据）
UPDATE `voice` SET `isEnabled` = 1 WHERE `userId` IS NOT NULL AND `status` = 'SUCCEEDED';
