-- 添加会话组个性化设置字段到chat_group表
-- 执行时间: 2025-01-12
-- 说明: 为会话组添加对话记忆、语音回复、表情包等个性化设置

USE chatgpt;

-- 检查并添加字段
ALTER TABLE `chat_group`
  ADD COLUMN IF NOT EXISTS `description` text NULL COMMENT '群聊描述信息' AFTER `openingRemark`,
  ADD COLUMN IF NOT EXISTS `ownerNickname` varchar(100) NULL COMMENT '群主在群内的昵称' AFTER `description`,
  ADD COLUMN IF NOT EXISTS `memberRelationships` longtext NULL COMMENT '人物关系配置(JSON)' AFTER `ownerNickname`,
  ADD COLUMN IF NOT EXISTS `proactivelySend` tinyint NOT NULL DEFAULT 0 COMMENT '是否主动发消息：0-否，1-是' AFTER `memberRelationships`,
  ADD COLUMN IF NOT EXISTS `describingMental` tinyint NOT NULL DEFAULT 0 COMMENT '是否启用心理描述：0-否，1-是' AFTER `proactivelySend`,
  ADD COLUMN IF NOT EXISTS `realTime` tinyint NOT NULL DEFAULT 0 COMMENT '是否开启真实时间：0-否，1-是' AFTER `describingMental`,
  ADD COLUMN IF NOT EXISTS `myName` varchar(100) NULL COMMENT '对我的称呼' AFTER `realTime`,
  ADD COLUMN IF NOT EXISTS `myProfile` text NULL COMMENT '我的简介' AFTER `myName`,
  ADD COLUMN IF NOT EXISTS `conversationMemoryCount` int NOT NULL DEFAULT 10 COMMENT '对话记忆条数（1-100）' AFTER `myProfile`,
  ADD COLUMN IF NOT EXISTS `autoSummaryEnabled` tinyint NOT NULL DEFAULT 0 COMMENT '是否开启自动总结：0-否，1-是' AFTER `conversationMemoryCount`,
  ADD COLUMN IF NOT EXISTS `summaryPrompt` text NULL COMMENT '自动总结提示词' AFTER `autoSummaryEnabled`,
  ADD COLUMN IF NOT EXISTS `chatSummary` text NULL COMMENT '当前对话总结内容' AFTER `summaryPrompt`,
  ADD COLUMN IF NOT EXISTS `voiceReplyMode` varchar(20) NOT NULL DEFAULT 'text_only' COMMENT '语音回复模式：voice_only-全部发语音，mixed-偶尔发一次，text_only-不要发语音' AFTER `chatSummary`,
  ADD COLUMN IF NOT EXISTS `allowEmoji` tinyint NOT NULL DEFAULT 0 COMMENT '是否允许发送表情包：0-否，1-是' AFTER `voiceReplyMode`,
  ADD COLUMN IF NOT EXISTS `allowTap` tinyint NOT NULL DEFAULT 0 COMMENT '是否允许拍一拍：0-否，1-是' AFTER `allowEmoji`,
  ADD COLUMN IF NOT EXISTS `maxReplyCount` int NOT NULL DEFAULT 5 COMMENT '最多回复条数（1-5）' AFTER `allowTap`,
  ADD COLUMN IF NOT EXISTS `groupAvatar` varchar(500) NULL COMMENT '群组头像URL' AFTER `maxReplyCount`,
  ADD COLUMN IF NOT EXISTS `backgroundImage` varchar(500) NULL COMMENT '群聊背景图片URL' AFTER `groupAvatar`;

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
  AND COLUMN_NAME IN (
    'description', 'ownerNickname', 'memberRelationships',
    'proactivelySend', 'describingMental', 'realTime',
    'myName', 'myProfile', 'conversationMemoryCount',
    'autoSummaryEnabled', 'summaryPrompt', 'chatSummary',
    'voiceReplyMode', 'allowEmoji', 'allowTap',
    'maxReplyCount', 'groupAvatar', 'backgroundImage'
  )
ORDER BY ORDINAL_POSITION;
