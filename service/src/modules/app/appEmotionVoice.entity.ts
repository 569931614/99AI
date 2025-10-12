import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index } from 'typeorm';

// 每个App的情绪-音色映射表
@Entity({ name: 'app_emotion_voices' })
@Index(['appId', 'emotion'], { unique: true })
export class AppEmotionVoiceEntity extends BaseEntity {
  @Column({ type: 'int', comment: 'App ID' })
  appId: number;

  @Column({ comment: '情绪标识' })
  emotion: string;

  @Column({ comment: '音色ID', default: '' })
  voiceId: string;

  @Column({ comment: '状态：1 启用，0 禁用', default: 1 })
  status: number;
}
