import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index } from 'typeorm';

// 全局统一情绪表（不再使用 config 表存储）
@Entity({ name: 'role_emotions' })
export class RoleEmotionEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ comment: '情绪标识（唯一）' })
  emotion: string;

  @Column({ comment: '对应的音色ID（可为空）', default: '' })
  voiceId: string;

  @Column({ comment: '状态：1 启用，0 禁用', default: 1 })
  status: number;
}
