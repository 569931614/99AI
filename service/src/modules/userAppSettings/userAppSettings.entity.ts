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

  @Column({ type: 'tinyint', comment: '人物关系：0-其他，1-恋人，2-朋友', default: 0 })
  characterRelationships: number;

  @Column({ type: 'text', comment: '聊天开场白', nullable: true })
  openingRemarks: string;

  @Column({ type: 'tinyint', comment: '是否主动发消息：0-否，1-是', default: 0 })
  proactivelySend: number;

  @Column({ type: 'tinyint', comment: '是否开启真实时间：0-否，1-是', default: 0 })
  realTime: number;

  @Column({ type: 'varchar', length: 100, comment: '对我的称呼', nullable: true })
  myName: string;

  @Column({ type: 'text', comment: '我的简介', nullable: true })
  myProfile: string;

  @Column({
    type: 'varchar',
    length: 200,
    comment: 'NFC消息内容偏好，逗号分隔（calendar_reminder,chat_memory,check_in,report）',
    nullable: true,
    default: '',
  })
  nfcContentPreference: string;
}
