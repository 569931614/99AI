-- 将现有会话组的maxReplyCount从5更新为1（仅更新值为5的记录，保留用户自定义的其他值）
UPDATE chat_group
SET maxReplyCount = 1
WHERE maxReplyCount = 5;

-- 修改列的默认值为1
ALTER TABLE chat_group
MODIFY COLUMN maxReplyCount int NOT NULL DEFAULT 1 COMMENT '最多回复条数（1-5）';
