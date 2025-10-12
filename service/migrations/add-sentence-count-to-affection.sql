-- 好感度系统添加句数统计功能
-- 日期: 2025-01-XX
-- 描述: 为好感度规则和用户好感度记录添加句数字段

-- 1. 为 affection_rule 表添加 sentenceCount 字段
ALTER TABLE `affection_rule` 
ADD COLUMN `sentenceCount` INT NOT NULL DEFAULT 0 COMMENT '需要聊满多少句才能达到该阶段' 
AFTER `maxScore`;

-- 2. 为 user_app_affection 表添加 sentenceCount 字段
ALTER TABLE `user_app_affection` 
ADD COLUMN `sentenceCount` INT NOT NULL DEFAULT 0 COMMENT '用户已经聊了多少句' 
AFTER `score`;

-- 3. 更新现有数据（可选）
-- 如果需要为现有规则设置默认句数要求，可以执行以下语句
-- UPDATE `affection_rule` SET `sentenceCount` = 10 WHERE `stageName` = '初见';
-- UPDATE `affection_rule` SET `sentenceCount` = 50 WHERE `stageName` = '暧昧';
-- UPDATE `affection_rule` SET `sentenceCount` = 100 WHERE `stageName` = '恋人';

