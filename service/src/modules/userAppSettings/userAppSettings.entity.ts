import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'user_app_settings' })
@Index(['userId', 'appId'], { unique: true })
export class UserAppSettingsEntity extends BaseEntity {
  @Column({ type: 'int', comment: '用户ID' })
  userId: number;

  @Column({ type: 'int', comment: '应用ID（角色ID）' })
  appId: number;

  @Column({ comment: '是否启用心理描述（AI回复时使用括号展示心理活动）', default: false })
  enablePsychologicalDesc: boolean;
}
