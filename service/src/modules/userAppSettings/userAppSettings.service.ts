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

  /**
   * 获取用户角色配置
   * @param userId 用户ID
   * @param appId 角色ID
   * @returns 用户角色配置
   */
  async getUserAppSettings(userId: number, appId: number): Promise<UserAppSettingsEntity | null> {
    if (!userId || !appId) return null;

    try {
      const setting = await this.userAppSettingsEntity.findOne({
        where: { userId, appId },
      });
      return setting;
    } catch (error) {
      this.logger.error(`获取用户角色配置失败: userId=${userId}, appId=${appId}`, error.stack);
      return null;
    }
  }

  /**
   * 更新用户角色配置
   * @param userId 用户ID
   * @param appId 角色ID
   * @param settings 要更新的设置
   */
  async updateUserAppSettings(
    userId: number,
    appId: number,
    settings: Partial<{
      characterRelationships: number;
      openingRemarks: string;
      proactivelySend: number;
      enablePsychologicalDesc: boolean;
      realTime: number;
      myName: string;
      myProfile: string;
    }>,
  ): Promise<UserAppSettingsEntity> {
    try {
      this.logger.debug(`更新用户角色配置: userId=${userId}, appId=${appId}`);

      let setting = await this.userAppSettingsEntity.findOne({
        where: { userId, appId },
      });

      if (setting) {
        // 更新已有记录
        Object.assign(setting, settings);
        await this.userAppSettingsEntity.save(setting);
      } else {
        // 创建新记录
        setting = this.userAppSettingsEntity.create({
          userId,
          appId,
          ...settings,
        });
        await this.userAppSettingsEntity.save(setting);
      }

      this.logger.debug('更新成功');
      return setting;
    } catch (error) {
      this.logger.error(`更新用户角色配置失败: userId=${userId}, appId=${appId}`, error.stack);
      throw error;
    }
  }
}
