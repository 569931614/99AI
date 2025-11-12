-- Add expression-related settings to app table
ALTER TABLE `app`
  ADD COLUMN `maxReplyCount` int NOT NULL DEFAULT 1 COMMENT '最大连续回复条数' AFTER `openingRemark`,
  ADD COLUMN `allowEmoji` tinyint NOT NULL DEFAULT 0 COMMENT '允许发送表情包' AFTER `maxReplyCount`,
  ADD COLUMN `stickerIds` text NULL COMMENT '可用表情包ID列表' AFTER `allowEmoji`,
  ADD COLUMN `stickerProbability` int NOT NULL DEFAULT 30 COMMENT '表情包发送概率(0-100)' AFTER `stickerIds`;
