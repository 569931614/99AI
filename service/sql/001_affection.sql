-- affection module tables (MySQL 8)
-- Creates missing tables used by AffectionRuleEntity and UserAppAffectionEntity
-- Charset/collation matches project defaults

CREATE TABLE IF NOT EXISTS `affection_rule` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `appId` INT NULL,
  `stageName` VARCHAR(50) NOT NULL,
  `minScore` INT NOT NULL,
  `maxScore` INT NULL,
  `behaviors` TEXT NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IDX_affection_rule_appId` (`appId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_app_affection` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `appId` INT NOT NULL,
  `score` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_user_app` (`userId`, `appId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

