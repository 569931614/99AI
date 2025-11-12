import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity } from 'typeorm';

@Entity({ name: 'app' })
export class AppEntity extends BaseEntity {
  @Column({ comment: 'App 应用名称' })
  name: string;

  @Column({ comment: 'App 分类 ID 列表，多个 ID 用逗号分隔', type: 'text' })
  catId: string;

  @Column({ comment: 'App 描述信息', nullable: true, type: 'text' })
  des: string;

  @Column({ comment: '预设场景（prompt 模板）', nullable: true, type: 'text' })
  preset: string;

  @Column({ comment: '封面图片地址', nullable: true, type: 'text' })
  coverImg: string;

  @Column({ comment: '排序，数字越大越靠前', default: 100 })
  order: number;

  @Column({ comment: '状态：0 禁用 / 1 启用', default: 1 })
  status: number;

  @Column({ comment: '示例数据', nullable: true, type: 'text' })
  demoData: string;

  @Column({ comment: '角色归属：system/user', default: 'system' })
  role: string;

  @Column({ comment: '是否为 GPTs 应用', default: 0 })
  isGPTs: number;

  @Column({ comment: '是否固定使用某模型', default: 0 })
  isFixedModel: number;

  @Column({ comment: '使用的模型配置', nullable: true, type: 'text' })
  appModel: string;

  @Column({ comment: 'GPTs 调用 ID', default: '' })
  gizmoID: string;

  @Column({ comment: '是否公开到应用广场', default: false })
  public: boolean;

  @Column({ comment: '创建者用户 ID', nullable: true })
  userId: number;

  @Column({ comment: '是否使用 Flowith 模型', default: 0 })
  isFlowith: number;

  @Column({ comment: 'Flowith 模型 ID', nullable: true })
  flowithId: string;

  @Column({ comment: 'Flowith 模型名称', nullable: true })
  flowithName: string;

  @Column({ comment: 'Flowith 模型 Key', nullable: true })
  flowithKey: string;

  @Column({ comment: '背景图', nullable: true, type: 'text' })
  backgroundImg: string;

  @Column({ comment: '提示词模版', nullable: true, type: 'text' })
  prompt: string;

  @Column({ comment: '默认音色 ID（DashScope/CosyVoice voice_id）', nullable: true })
  voiceId: string;

  @Column({
    comment: '情绪-音色映射 JSON：{"items":[{emotion,voiceId}]}',
    type: 'text',
    nullable: true,
  })
  emotionVoices: string;

  // --- 星尘大模型 API 扩展字段 ---

  @Column({ comment: '是否开启实时模式', default: false })
  enableRealTime: boolean;

  @Column({ comment: '是否开启长期记忆', default: false })
  enableLongTermMemory: boolean;

  @Column({ comment: '是否开启知识库搜索', default: false })
  enableKnowledgeBase: boolean;

  @Column({
    comment: '知识库 ID 列表（JSON 数组）',
    type: 'text',
    nullable: true,
  })
  knowledgeBaseIds: string;

  @Column({
    comment: '对话示例（JSON）',
    type: 'text',
    nullable: true,
  })
  dialogueExamples: string;

  @Column({ comment: '开场白', type: 'text', nullable: true })
  openingRemark: string;
}
