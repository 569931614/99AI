-- Sticker library table
CREATE TABLE IF NOT EXISTS `sticker` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
  `name` varchar(120) NOT NULL COMMENT 'Sticker name',
  `imageUrl` varchar(500) NOT NULL COMMENT 'Sticker image url',
  `tags` text DEFAULT NULL COMMENT 'Comma separated tags',
  `emotion` varchar(30) DEFAULT NULL COMMENT 'Emotion category',
  `scenario` text COMMENT 'Usage scenario description',
  `uploadDate` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT 'Uploaded time',
  `uploadedBy` int DEFAULT NULL COMMENT 'Admin user id',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT 'Created time',
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT 'Updated time',
  `deletedAt` datetime(6) DEFAULT NULL COMMENT 'Deleted time',
  PRIMARY KEY (`id`),
  KEY `IDX_sticker_name` (`name`),
  KEY `IDX_sticker_emotion` (`emotion`),
  KEY `IDX_sticker_uploadedBy` (`uploadedBy`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Emoji sticker library';
