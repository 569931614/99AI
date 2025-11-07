-- 创建音色分类表
CREATE TABLE IF NOT EXISTS `voice_category` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `name` varchar(255) NOT NULL COMMENT '分类名称（如 男声、女声、童声等）',
  `description` text COMMENT '分类描述',
  `sort` int NOT NULL DEFAULT '0' COMMENT '排序权重（数字越大越靠前）',
  `isEnabled` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deletedAt` datetime(6) DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`),
  KEY `IDX_voice_category_isEnabled` (`isEnabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='音色分类表';

-- 为 voice 表添加 categoryId 字段
ALTER TABLE `voice`
ADD COLUMN `categoryId` int DEFAULT NULL COMMENT '分类ID（关联 voice_category 表）' AFTER `format`,
ADD INDEX `IDX_voice_categoryId` (`categoryId`);

-- 插入一些默认分类（可选）
INSERT INTO `voice_category` (`name`, `description`, `sort`, `isEnabled`) VALUES
('男声', '男性音色', 100, 1),
('女声', '女性音色', 90, 1),
('童声', '儿童音色', 80, 1),
('老年', '老年音色', 70, 1);
