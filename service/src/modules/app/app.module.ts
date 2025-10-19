import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserBalanceService } from '../userBalance/userBalance.service';
import { UserAppSettingsEntity } from '../userAppSettings/userAppSettings.entity';
import { UserAppSettingsService } from '../userAppSettings/userAppSettings.service';
import { AppController } from './app.controller';
import { AppEntity } from './app.entity';
import { AppService } from './app.service';
import { AppCatsEntity } from './appCats.entity';
import { AppEmotionVoiceEntity } from './appEmotionVoice.entity';
import { AppVoiceEntity } from './appVoice.entity';
import { OpenAppController } from './open-app.controller';
import { RoleEmotionEntity } from './roleEmotion.entity';
import { UserAppsEntity } from './userApps.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppCatsEntity,
      AppEntity,
      UserAppsEntity,
      AppVoiceEntity,
      RoleEmotionEntity,
      AppEmotionVoiceEntity,
      UserAppSettingsEntity,
    ]),
  ],
  controllers: [AppController, OpenAppController],
  providers: [AppService, UserBalanceService, UserAppSettingsService],
  exports: [UserAppSettingsService],
})
export class AppModule {}
