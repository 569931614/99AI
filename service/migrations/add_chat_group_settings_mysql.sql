-- 添加会话组个性化设置字段到chat_group表
-- 执行时间: 2025-01-12
-- 说明: 为会话组添加对话记忆、语音回复、表情包等个性化设置
-- 注意: 如果字段已存在，请跳过对应的ALTER语句

USE chatgpt;

-- 添加群聊描述信息
ALTER TABLE `chat_group`
ADD COLUMN `description` text NULL COMMENT '群聊描述信息' AFTER `openingRemark`;

-- 添加群主昵称
ALTER TABLE `chat_group`
ADD COLUMN `ownerNickname` varchar(100) NULL COMMENT '群主在群内的昵称' AFTER `description`;

-- 添加人物关系配置
ALTER TABLE `chat_group`
ADD COLUMN `memberRelationships` longtext NULL COMMENT '人物关系配置(JSON)' AFTER `ownerNickname`;

-- 添加主动发消息开关
ALTER TABLE `chat_group`
ADD COLUMN `proactivelySend` tinyint NOT NULL DEFAULT 0 COMMENT '是否主动发消息：0-否，1-是' AFTER `memberRelationships`;

-- 添加心理描述开关
ALTER TABLE `chat_group`
ADD COLUMN `describingMental` tinyint NOT NULL DEFAULT 0 COMMENT '是否启用心理描述：0-否，1-是' AFTER `proactivelySend`;

-- 添加真实时间开关
ALTER TABLE `chat_group`
ADD COLUMN `realTime` tinyint NOT NULL DEFAULT 0 COMMENT '是否开启真实时间：0-否，1-是' AFTER `describingMental`;

-- 添加对我的称呼
ALTER TABLE `chat_group`
ADD COLUMN `myName` varchar(100) NULL COMMENT '对我的称呼' AFTER `realTime`;

-- 添加我的简介
ALTER TABLE `chat_group`
ADD COLUMN `myProfile` text NULL COMMENT '我的简介' AFTER `myName`;

-- 添加对话记忆条数
ALTER TABLE `chat_group`
ADD COLUMN `conversationMemoryCount` int NOT NULL DEFAULT 10 COMMENT '对话记忆条数（1-100）' AFTER `myProfile`;

-- 添加自动总结开关
ALTER TABLE `chat_group`
ADD COLUMN `autoSummaryEnabled` tinyint NOT NULL DEFAULT 0 COMMENT '是否开启自动总结：0-否，1-是' AFTER `conversationMemoryCount`;

-- 添加自动总结提示词
ALTER TABLE `chat_group`
ADD COLUMN `summaryPrompt` text NULL COMMENT '自动总结提示词' AFTER `autoSummaryEnabled`;

-- 添加当前对话总结内容
ALTER TABLE `chat_group`
ADD COLUMN `chatSummary` text NULL COMMENT '当前对话总结内容' AFTER `summaryPrompt`;

-- 添加语音回复模式
ALTER TABLE `chat_group`
ADD COLUMN `voiceReplyMode` varchar(20) NOT NULL DEFAULT 'text_only' COMMENT '语音回复模式：voice_only-全部发语音，mixed-偶尔发一次，text_only-不要发语音' AFTER `chatSummary`;

-- 添加允许发送表情包开关
ALTER TABLE `chat_group`
ADD COLUMN `allowEmoji` tinyint NOT NULL DEFAULT 0 COMMENT '是否允许发送表情包：0-否，1-是' AFTER `voiceReplyMode`;

-- 添加允许拍一拍开关
ALTER TABLE `chat_group`
ADD COLUMN `allowTap` tinyint NOT NULL DEFAULT 0 COMMENT '是否允许拍一拍：0-否，1-是' AFTER `allowEmoji`;

-- 添加最多回复条数
ALTER TABLE `chat_group`
ADD COLUMN `maxReplyCount` int NOT NULL DEFAULT 5 COMMENT '最多回复条数（1-5）' AFTER `allowTap`;

-- 添加群组头像
ALTER TABLE `chat_group`
ADD COLUMN `groupAvatar` varchar(500) NULL COMMENT '群组头像URL' AFTER `maxReplyCount`;

-- 添加群聊背景图片
ALTER TABLE `chat_group`
ADD COLUMN `backgroundImage` varchar(500) NULL COMMENT '群聊背景图片URL' AFTER `groupAvatar`;

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
