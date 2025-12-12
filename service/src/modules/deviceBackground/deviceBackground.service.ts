import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceBackgroundEntity } from './deviceBackground.entity';

@Injectable()
export class DeviceBackgroundService {
  private readonly logger = new Logger(DeviceBackgroundService.name);

  constructor(
    @InjectRepository(DeviceBackgroundEntity)
    private readonly deviceBackgroundRepository: Repository<DeviceBackgroundEntity>,
  ) {}

  /**
   * 保存或更新设备背景
   * @param braceletId 设备/手环ID
   * @param backgroundUrl 背景媒体URL
   * @param backgroundType 背景类型 (image/video)
   * @param originalName 原始文件名（可选）
   */
  async saveBackground(
    braceletId: string,
    backgroundUrl: string,
    backgroundType: string = 'image',
    originalName?: string,
  ): Promise<DeviceBackgroundEntity> {
    // 查找是否已存在该设备的背景记录
    let existing = await this.deviceBackgroundRepository.findOne({
      where: { braceletId },
    });

    if (existing) {
      // 更新现有记录
      existing.backgroundUrl = backgroundUrl;
      existing.backgroundType = backgroundType;
      if (originalName) {
        existing.originalName = originalName;
      }
      this.logger.log(`更新设备 ${braceletId} 的背景: ${backgroundUrl}`);
      return this.deviceBackgroundRepository.save(existing);
    } else {
      // 创建新记录
      const newBackground = this.deviceBackgroundRepository.create({
        braceletId,
        backgroundUrl,
        backgroundType,
        originalName,
      });
      this.logger.log(`创建设备 ${braceletId} 的背景: ${backgroundUrl}`);
      return this.deviceBackgroundRepository.save(newBackground);
    }
  }

  /**
   * 获取设备背景
   * @param braceletId 设备/手环ID
   */
  async getBackground(braceletId: string): Promise<DeviceBackgroundEntity | null> {
    return this.deviceBackgroundRepository.findOne({
      where: { braceletId },
    });
  }

  /**
   * 删除设备背景
   * @param braceletId 设备/手环ID
   */
  async deleteBackground(braceletId: string): Promise<boolean> {
    const result = await this.deviceBackgroundRepository.softDelete({ braceletId });
    return result.affected > 0;
  }
}
