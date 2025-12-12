import { BaseEntity } from 'src/common/entity/baseEntity';
import { Column, Entity, Index } from 'typeorm';

@Entity({ name: 'device_background' })
export class DeviceBackgroundEntity extends BaseEntity {
  @Index()
  @Column({ comment: '设备/手环ID', length: 100 })
  braceletId: string;

  @Column({ comment: '背景媒体URL', length: 1000 })
  backgroundUrl: string;

  @Column({ comment: '背景类型：image/video', length: 20, default: 'image' })
  backgroundType: string;

  @Column({ comment: '原始文件名', length: 255, nullable: true })
  originalName: string;
}
