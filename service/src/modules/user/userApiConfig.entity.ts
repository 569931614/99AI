import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'user_api_config' })
@Index(['userId'], { unique: true })
export class UserApiConfigEntity extends BaseEntity {
  @Column({ type: 'int', comment: '用户ID' })
  userId: number;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '自定义大模型API URL',
  })
  apiUrl: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '自定义大模型API Key（加密存储）',
  })
  apiKey: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '自定义API使用的模型名称',
  })
  modelName: string;

  @Column({
    type: 'tinyint',
    default: 0,
    comment: '是否启用自定义API配置：0-否，1-是',
  })
  enabled: number;
}
