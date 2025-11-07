-- 检查 voice_category 表是否存在
SHOW TABLES LIKE 'voice_category';

-- 检查 voice_category 表结构
DESCRIBE voice_category;

-- 检查 voice 表是否有 categoryId 字段
DESCRIBE voice;

-- 查看现有分类
SELECT * FROM voice_category;
