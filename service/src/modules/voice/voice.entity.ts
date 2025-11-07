import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { VoiceCategoryEntity } from './voiceCategory.entity';

@Entity({ name: 'voice' })
export class VoiceEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ comment: '音色ID（DashScope/CosyVoice voice_id）', unique: true })
  voiceId: string;

  @Index()
  @Column({ comment: '用户ID（自定义音色时记录创建者，NULL表示系统音色）', nullable: true })
  userId?: number;

  @Index()
  @Column({ comment: '前缀（如 cosyvoice-v2 等）', nullable: true })
  prefix?: string;

  @Column({ comment: '模型（如 cosyvoice-v2 / v3 / v3-plus）', nullable: true })
  model?: string;

  @Column({ comment: '自定义名称', nullable: true })
  name?: string;

  @Index()
  @Column({ comment: '状态（PENDING/SUCCEEDED/FAILED 等）', nullable: true })
  status?: string;

  @Column({ comment: '语速（0.5-2.0，默认1.0）', type: 'float', nullable: true, default: 1.0 })
  rate?: number;

  @Column({ comment: '语调（0.5-2.0，默认1.0）', type: 'float', nullable: true, default: 1.0 })
  pitch?: number;

  @Column({ comment: '音量（0-100，默认50）', type: 'int', nullable: true, default: 50 })
  volume?: number;

  @Column({ comment: '采样率（默认22050）', type: 'int', nullable: true, default: 22050 })
  sampleRate?: number;

  @Column({ comment: '输出格式（mp3/wav/pcm，默认mp3）', nullable: true, default: 'mp3' })
  format?: string;

  @Index()
  @Column({ comment: '分类ID（关联 voice_category 表）', nullable: true })
  categoryId?: number;

  @ManyToOne(() => VoiceCategoryEntity, { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category?: VoiceCategoryEntity;
}
