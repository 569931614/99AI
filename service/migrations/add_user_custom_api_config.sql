-- 创建用户自定义大模型API配置表
-- 日期: 2025-11-29
-- 说明: 允许用户配置自己的大模型API URL和Key

-- 创建user_api_config表
CREATE TABLE IF NOT EXISTS `user_api_config` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `userId` INT NOT NULL COMMENT '用户ID',
  `apiUrl` VARCHAR(500) NULL COMMENT '自定义大模型API URL',
  `apiKey` VARCHAR(500) NULL COMMENT '自定义大模型API Key（加密存储）',
  `modelName` VARCHAR(100) NULL COMMENT '自定义API使用的模型名称',
  `enabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否启用自定义API配置：0-否，1-是',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deletedAt` DATETIME NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_api_config_userId` (`userId`),
  KEY `idx_user_api_config_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户自定义大模型API配置表';

-- 验证表是否创建成功
SHOW CREATE TABLE `user_api_config`;

-- 查看表结构
DESCRIBE `user_api_config`;

