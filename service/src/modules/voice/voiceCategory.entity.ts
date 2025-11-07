import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'voice_category' })
export class VoiceCategoryEntity extends BaseEntity {
  @Index()
  @Column({ comment: '分类名称（如 男声、女声、童声等）' })
  name: string;

  @Column({ comment: '分类描述', nullable: true })
  description?: string;

  @Column({ comment: '排序权重（数字越大越靠前）', type: 'int', default: 0 })
  sort: number;

  @Index()
  @Column({ comment: '是否启用', type: 'boolean', default: true })
  isEnabled: boolean;
}
