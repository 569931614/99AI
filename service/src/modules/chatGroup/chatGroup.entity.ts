import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity } from 'typeorm';

@Entity({ name: 'chat_group' })
export class ChatGroupEntity extends BaseEntity {
  @Column({ comment: '用户ID' })
  userId: number;

  @Column({ comment: '是否置顶聊天', type: 'boolean', default: false })
  isSticky: boolean;

  @Column({ comment: '分组名称', nullable: true })
  title: string;

  @Column({ comment: '应用ID', nullable: true })
  appId: number;

  // @Column({ comment: '模型', nullable: true })
  // model: string;

  // @Column({ comment: '模型名称', nullable: true })
  // modelName: string;

  // @Column({ comment: '扣费类型', nullable: true })
  // mdeductType: string;

  // @Column({ comment: '是否支持文件上传', nullable: true })
  // isFileUpload: boolean;

  // @Column({ comment: '是否固定模型', default: 0 })
  // isFixedModel: boolean;

  // @Column({ comment: '模型类型', nullable: true })
  // keyType: number;

  @Column({ comment: '是否删除了', default: false })
  isDelete: boolean;

  @Column({ comment: '配置', nullable: true, default: null, type: 'text' })
  config: string;

  @Column({ comment: '附加参数', nullable: true, type: 'text' })
  params: string;

  @Column({ comment: '文件链接', nullable: true, default: null, type: 'text' })
  fileUrl: string;

  @Column({ comment: 'PDF中的文字内容', nullable: true, type: 'mediumtext' })
  pdfTextContent: string;

  @Column({ comment: '群组成员与任务(JSON)', nullable: true, type: 'longtext' })
  members: string;

  @Column({ comment: '是否为群聊', default: false })
  isGroupChat: boolean;

  @Column({ comment: '开场白（角色初始问候语）', type: 'text', nullable: true })
  openingRemark: string;

  @Column({ comment: '群聊描述信息', type: 'text', nullable: true })
  description: string;

  @Column({ comment: '群主在群内的昵称', nullable: true })
  ownerNickname: string;

  @Column({ comment: '人物关系配置(JSON)', type: 'longtext', nullable: true })
  memberRelationships: string;

  @Column({ comment: '是否主动发消息：0-否，1-是', type: 'tinyint', default: 0 })
  proactivelySend: number;

  @Column({ comment: '是否启用心理描述：0-否，1-是', type: 'tinyint', default: 0 })
  describingMental: number;

  @Column({ comment: '是否开启真实时间：0-否，1-是', type: 'tinyint', default: 0 })
  realTime: number;

  @Column({ comment: '对我的称呼', type: 'varchar', length: 100, nullable: true })
  myName: string;

  @Column({ comment: '我的简介', type: 'text', nullable: true })
  myProfile: string;

  @Column({ comment: '对话记忆条数（1-100）', type: 'int', default: 10 })
  conversationMemoryCount: number;

  @Column({ comment: '是否开启自动总结：0-否，1-是', type: 'tinyint', default: 0 })
  autoSummaryEnabled: number;

  @Column({ comment: '自动总结提示词', type: 'text', nullable: true })
  summaryPrompt: string;

  @Column({ comment: '当前对话总结内容', type: 'text', nullable: true })
  chatSummary: string;

  @Column({
    comment: '语音回复模式：voice_only-全部发语音，mixed-偶尔发一次，text_only-不要发语音',
    type: 'varchar',
    length: 20,
    default: 'text_only',
  })
  voiceReplyMode: string;

  @Column({ comment: '是否允许发送表情包：0-否，1-是', type: 'tinyint', default: 0 })
  allowEmoji: number;

  @Column({ comment: '是否允许拍一拍：0-否，1-是', type: 'tinyint', default: 0 })
  allowTap: number;

  @Column({ comment: '最多回复条数（1-5）', type: 'int', default: 5 })
  maxReplyCount: number;

  @Column({ comment: '群组头像URL', nullable: true })
  groupAvatar: string;

  @Column({ comment: '群聊背景图片URL', nullable: true })
  backgroundImage: string;
}
