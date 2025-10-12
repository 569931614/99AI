-- 添加星尘API扩展字段到app表
-- 执行时间: 2025-01-11
-- 说明: 添加真实时间、长期记忆、知识库搜索、知识库ID列表、对话示例、开场白等字段

USE chatgpt;

ALTER TABLE `app`
ADD COLUMN `enableRealTime` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否开启真实时间（星尘API）' AFTER `emotionVoices`,
ADD COLUMN `enableLongTermMemory` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否开启长期记忆（星尘API）' AFTER `enableRealTime`,
ADD COLUMN `enableKnowledgeBase` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否开启知识库搜索（星尘API）' AFTER `enableLongTermMemory`,
ADD COLUMN `knowledgeBaseIds` text NULL COMMENT '知识库ID列表（星尘API），JSON数组格式: ["kb_id_1","kb_id_2"]' AFTER `enableKnowledgeBase`,
ADD COLUMN `dialogueExamples` text NULL COMMENT '对话示例（星尘API），JSON格式: [{"role":"user","content":"..."},{"role":"assistant","content":"..."}]' AFTER `knowledgeBaseIds`,
ADD COLUMN `openingRemark` text NULL COMMENT '开场白（角色初始问候语）' AFTER `dialogueExamples`;

-- 验证字段是否添加成功
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    COLUMN_DEFAULT,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'chatgpt'
AND TABLE_NAME = 'app'
AND COLUMN_NAME IN (
    'enableRealTime',
    'enableLongTermMemory',
    'enableKnowledgeBase',
    'knowledgeBaseIds',
    'dialogueExamples',
    'openingRemark'
)
ORDER BY ORDINAL_POSITION;
