import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'sticker' })
export class StickerEntity extends BaseEntity {
  @Index()
  @Column({ length: 120, comment: 'Sticker name' })
  name: string;

  @Column({ length: 500, comment: 'Sticker image url' })
  imageUrl: string;

  @Column({
    type: 'simple-array',
    nullable: true,
    comment: 'Tags stored as comma separated values',
  })
  tags?: string[] | null;

  @Index()
  @Column({ length: 30, nullable: true, comment: 'Emotion category' })
  emotion?: string | null;

  @Column({ type: 'text', nullable: true, comment: 'Usage scenario description' })
  scenario?: string | null;

  @Column({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    comment: 'Uploaded datetime',
  })
  uploadDate: Date;

  @Index()
  @Column({ type: 'int', nullable: true, comment: 'Admin user id of uploader' })
  uploadedBy?: number | null;
}
