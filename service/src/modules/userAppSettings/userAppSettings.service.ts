import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAppSettingsEntity } from './userAppSettings.entity';

@Injectable()
export class UserAppSettingsService {
  private readonly logger = new Logger(UserAppSettingsService.name);

  constructor(
    @InjectRepository(UserAppSettingsEntity)
    private readonly userAppSettingsEntity: Repository<UserAppSettingsEntity>,
  ) {}

  async getEnablePsychologicalDesc(userId: number, appId: number): Promise<boolean> {
    if (!userId || !appId) return false;

    try {
      const setting = await this.userAppSettingsEntity.findOne({
        where: { userId, appId },
      });
      return setting?.enablePsychologicalDesc ?? false;
    } catch (error) {
      return false;
    }
  }

  async setEnablePsychologicalDesc(userId: number, appId: number, enable: boolean): Promise<void> {
    try {
      this.logger.debug(`设置心理描述: userId=${userId}, appId=${appId}, enable=${enable}`);

      const existing = await this.userAppSettingsEntity.findOne({
        where: { userId, appId },
      });

      if (existing) {
        this.logger.debug(`更新已有记录: id=${existing.id}`);
        existing.enablePsychologicalDesc = enable;
        await this.userAppSettingsEntity.save(existing);
      } else {
        this.logger.debug('创建新记录');
        const newSetting = this.userAppSettingsEntity.create({
          userId,
          appId,
          enablePsychologicalDesc: enable,
        });
        await this.userAppSettingsEntity.save(newSetting);
      }

      this.logger.debug('设置成功');
    } catch (error) {
      this.logger.error(
        `设置心理描述失败: userId=${userId}, appId=${appId}, error=${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
