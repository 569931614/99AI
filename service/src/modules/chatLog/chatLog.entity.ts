import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'chatlog' })
@Index('idx_chatlog_user_group_delete', ['userId', 'groupId', 'isDelete']) // 用户对话列表查询
@Index('idx_chatlog_group_delete_created', ['groupId', 'isDelete', 'createdAt']) // 群组历史记录查询
@Index('idx_chatlog_user_app', ['userId', 'appId']) // 应用使用记录查询
@Index('idx_chatlog_user_type', ['userId', 'type']) // 用户绘图记录查询
@Index('idx_chatlog_group_role', ['groupId', 'role']) // 群组角色消息统计
@Index('idx_chatlog_group_app_opening', ['groupId', 'appId', 'isOpeningRemark']) // 开场白查询
export class ChatLogEntity extends BaseEntity {
  @Column({ comment: '用户ID' })
  userId: number;

  @Column({ comment: '使用的模型', nullable: true })
  model: string;

  @Column({ comment: 'role system user assistant', nullable: true })
  role: string;

  @Column({ comment: '模型内容', nullable: true, type: 'mediumtext' })
  content: string;

  @Column({ comment: '模型推理内容', nullable: true, type: 'text' })
  reasoning_content: string;

  @Column({ comment: '模型工具调用', nullable: true, type: 'text' })
  tool_calls: string;

  @Column({ comment: '图片Url', nullable: true, type: 'text' })
  imageUrl: string;

  @Column({ comment: '视频Url', nullable: true, type: 'text' })
  videoUrl: string;

  @Column({ comment: '音频Url', nullable: true, type: 'mediumtext' })
  audioUrl: string;

  @Column({ comment: '文件Url', nullable: true, type: 'text' })
  fileUrl: string;

  @Column({
    comment: '使用类型1: 普通对话 2: 绘图 3: 拓展性对话',
    nullable: true,
    default: 1,
  })
  type: number;

  @Column({ comment: '自定义的模型名称', nullable: true, default: 'AI' })
  modelName: string;

  @Column({ comment: '自定义的模型头像', nullable: false, default: '' })
  modelAvatar: string;

  @Column({ comment: 'Ip地址', nullable: true })
  curIp: string;

  //废弃字段

  @Column({ comment: '询问的问题', type: 'text', nullable: true })
  prompt: string;

  @Column({ comment: '附加参数', nullable: true })
  extraParam: string;

  @Column({ comment: '插件参数', nullable: true })
  pluginParam: string;

  @Column({ comment: '回答的答案', type: 'text', nullable: true })
  answer: string;

  @Column({ comment: '提问的token', nullable: true })
  promptTokens: number;

  @Column({ comment: '回答的token', nullable: true })
  completionTokens: number;

  @Column({ comment: '总花费的token', nullable: true })
  totalTokens: number;

  @Column({ comment: '任务进度', nullable: true })
  progress: string;

  @Column({ comment: '任务状态', nullable: true, default: 3 })
  status: number;

  @Column({ comment: '任务类型', nullable: true })
  action: string;

  @Column({ comment: '对图片操作的按钮ID', type: 'text', nullable: true })
  customId: string;

  @Column({ comment: '绘画的ID每条不一样', nullable: true })
  drawId: string;

  @Column({ comment: '对话转语音的链接', nullable: true, type: 'text' })
  ttsUrl: string;

  @Column({ comment: '语音时长（秒）', nullable: true, type: 'int' })
  ttsDuration: number;

  @Column({
    comment: '消息显示状态: 0或空=默认, 1=强制显示文字',
    nullable: true,
    default: 0,
    type: 'tinyint',
  })
  display_state: number;

  @Column({ comment: '是否推荐0: 默认 1: 推荐', nullable: true, default: 0 })
  rec: number;

  @Column({ comment: '分组ID', nullable: true })
  groupId: number;

  @Column({ comment: '使用的应用id', nullable: true })
  appId: number;

  @Column({ comment: '是否删除', default: false })
  isDelete: boolean;

  @Column({ comment: '任务ID', nullable: true })
  taskId: string;

  @Column({ comment: '任务数据', nullable: true, type: 'text' })
  taskData: string;

  @Column({ comment: '文件信息', nullable: true, type: 'text' })
  fileInfo: string;

  @Column({ comment: '提问参考', nullable: true })
  promptReference: string;

  @Column({ comment: '联网搜索结果', nullable: true, type: 'text' })
  networkSearchResult: string;

  @Column({ comment: '文件向量搜索结果', nullable: true, type: 'mediumtext' })
  fileVectorResult: string;

  @Column({ comment: '是否为开场白', nullable: true, default: false })
  isOpeningRemark: boolean;

  @Column({ comment: '翻译后的内容', nullable: true, type: 'text' })
  translatedContent: string;

  @Column({ comment: '转账金额', nullable: true, type: 'varchar', length: 50 })
  transferAmount: string;

  @Column({ comment: '转账说明', nullable: true, type: 'varchar', length: 200 })
  transferDesc: string;

  @Column({
    comment: '转账状态: pending=待领取, received=已领取, returned=已被退还, refunded=已退回',
    nullable: true,
    type: 'varchar',
    length: 20,
  })
  transferStatus: string;

  @Column({ comment: '转账操作时间', nullable: true, type: 'datetime' })
  transferActionTime: Date;
}
