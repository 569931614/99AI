import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'conversation_summary' })
@Index(['groupId'], { unique: true })
export class ConversationSummaryEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100, comment: '对话群组ID' })
  groupId: string;

  @Column({ type: 'int', comment: '用户ID' })
  userId: number;

  @Column({ type: 'int', nullable: true, comment: '应用ID（角色ID）', default: null })
  appId: number | null;

  @Column({ type: 'text', comment: '对话总结内容', default: '' })
  summary: string;

  @Column({ type: 'int', default: 0, comment: '已总结的消息数量' })
  messageCount: number;

  @Column({ type: 'int', default: 0, comment: '未总结的消息轮数（每轮包含用户+助手消息）' })
  unsummarizedCount: number;

  @Column({ type: 'timestamp', nullable: true, comment: '最后总结时间' })
  lastSummarizedAt: Date | null;
}
