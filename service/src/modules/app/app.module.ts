import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserBalanceService } from '../userBalance/userBalance.service';
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
    ]),
  ],
  controllers: [AppController, OpenAppController],
  providers: [AppService, UserBalanceService],
})
export class AppModule {}
