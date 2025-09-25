import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'app_voice' })
export class AppVoiceEntity extends BaseEntity {
  @Index()
  @Column({ comment: '应用ID' })
  appId: number;

  @Index()
  @Column({ comment: '音色ID（DashScope/CosyVoice voice_id）' })
  voiceId: string;

  @Column({ comment: '是否默认音色 0/1', type: 'int', default: 1 })
  isDefault: number;
}

