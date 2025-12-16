import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DeviceBackgroundEntity } from './deviceBackground.entity';

@Injectable()
export class DeviceBackgroundService {
  private readonly logger = new Logger(DeviceBackgroundService.name);

  constructor(
    @InjectRepository(DeviceBackgroundEntity)
    private readonly deviceBackgroundRepository: Repository<DeviceBackgroundEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 保存或更新设备背景（使用事务确保数据一致性）
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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 使用悲观锁查找是否已存在该设备的背景记录
      let existing = await queryRunner.manager.findOne(DeviceBackgroundEntity, {
        where: { braceletId },
        lock: { mode: 'pessimistic_write' },
      });

      let result: DeviceBackgroundEntity;

      if (existing) {
        // 更新现有记录
        existing.backgroundUrl = backgroundUrl;
        existing.backgroundType = backgroundType;
        if (originalName) {
          existing.originalName = originalName;
        }
        existing.updatedAt = new Date();
        result = await queryRunner.manager.save(existing);
        this.logger.log(`更新设备 ${braceletId} 的背景: ${backgroundUrl}`);
      } else {
        // 创建新记录
        const newBackground = queryRunner.manager.create(DeviceBackgroundEntity, {
          braceletId,
          backgroundUrl,
          backgroundType,
          originalName,
        });
        result = await queryRunner.manager.save(newBackground);
        this.logger.log(`创建设备 ${braceletId} 的背景: ${backgroundUrl}`);
      }

      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`保存设备 ${braceletId} 背景失败: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取设备背景
   * @param braceletId 设备/手环ID
   */
  async getBackground(braceletId: string): Promise<DeviceBackgroundEntity | null> {
    try {
      return await this.deviceBackgroundRepository.findOne({
        where: { braceletId },
      });
    } catch (error) {
      this.logger.error(`获取设备 ${braceletId} 背景失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 删除设备背景
   * @param braceletId 设备/手环ID
   */
  async deleteBackground(braceletId: string): Promise<boolean> {
    try {
      const result = await this.deviceBackgroundRepository.softDelete({ braceletId });
      return result.affected > 0;
    } catch (error) {
      this.logger.error(`删除设备 ${braceletId} 背景失败: ${error.message}`);
      throw error;
    }
  }
}
