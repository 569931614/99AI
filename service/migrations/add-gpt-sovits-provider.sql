ALTER TABLE `voice`
  ADD COLUMN `provider` varchar(64) NOT NULL DEFAULT 'dashscope' COMMENT 'voice provider (dashscope/gpt-sovits)' AFTER `model`,
  ADD COLUMN `config` text NULL COMMENT 'provider config JSON' AFTER `status`,
  ADD INDEX `IDX_voice_provider` (`provider`);
