import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffectionModule } from '../affection/affection.module';
import { OpenAIChatService } from '../aiTool/chat/chat.service';
import { DeviceBackgroundModule } from '../deviceBackground/deviceBackground.module';
import { NetSearchService } from '../aiTool/search/netSearch.service';
import { AppEntity } from '../app/app.entity';
import { AppModule } from '../app/app.module';
import { AppService } from '../app/app.service';
import { AppCatsEntity } from '../app/appCats.entity';
import { AppEmotionVoiceEntity } from '../app/appEmotionVoice.entity';
import { AppVoiceEntity } from '../app/appVoice.entity';
import { RoleEmotionEntity } from '../app/roleEmotion.entity';
import { UserAppsEntity } from '../app/userApps.entity';
import { UserAppSettingsEntity } from '../userAppSettings/userAppSettings.entity';
import { AutoReplyEntity } from '../autoReply/autoReply.entity';
import { AutoReplyService } from '../autoReply/autoReply.service';
import { BadWordsEntity } from '../badWords/badWords.entity';
import { BadWordsService } from '../badWords/badWords.service';
import { ViolationLogEntity } from '../badWords/violationLog.entity';
import { ChatGroupEntity } from '../chatGroup/chatGroup.entity';
import { ChatGroupService } from '../chatGroup/chatGroup.service';
import { ChatLogEntity } from '../chatLog/chatLog.entity';
import { ChatLogService } from '../chatLog/chatLog.service';
import { CramiPackageEntity } from '../crami/cramiPackage.entity';
import { ConfigEntity } from '../globalConfig/config.entity';
import { GlobalConfigService } from '../globalConfig/globalConfig.service';
import { MailerService } from '../mailer/mailer.service';
import { ModelsEntity } from '../models/models.entity';
import { ModelsService } from '../models/models.service';
import { PluginEntity } from '../plugin/plugin.entity';
import { RedisCacheService } from '../redisCache/redisCache.service';
import { UploadService } from '../upload/upload.service';
import { UserEntity } from '../user/user.entity';
import { UserApiConfigEntity } from '../user/userApiConfig.entity';
import { UserService } from '../user/user.service';
import { AccountLogEntity } from '../userBalance/accountLog.entity';
import { BalanceEntity } from '../userBalance/balance.entity';
import { FingerprintLogEntity } from '../userBalance/fingerprint.entity';
import { UserBalanceEntity } from '../userBalance/userBalance.entity';
import { UserBalanceService } from '../userBalance/userBalance.service';
import { VerificationEntity } from '../verification/verification.entity';
import { VerificationService } from '../verification/verification.service';
import { VoiceModule } from '../voice/voice.module';
import { ConversationSummaryModule } from '../conversationSummary/conversationSummary.module';
import { StickerModule } from '../sticker/sticker.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { OpenChatController } from './open-chat.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      BalanceEntity,
      UserEntity,
      UserApiConfigEntity,
      PluginEntity,
      VerificationEntity,
      ChatLogEntity,
      AccountLogEntity,
      ConfigEntity,
      UserEntity,
      CramiPackageEntity,
      ChatGroupEntity,
      AppEntity,
      UserBalanceEntity,
      FingerprintLogEntity,
      AppCatsEntity,
      UserAppsEntity,
      AutoReplyEntity,
      BadWordsEntity,
      ViolationLogEntity,
      ModelsEntity,
      AppVoiceEntity,
      AppEmotionVoiceEntity,
      RoleEmotionEntity,
      UserAppSettingsEntity,
    ]),
    VoiceModule,
    AffectionModule,
    AppModule,
    ConversationSummaryModule,
    StickerModule,
    DeviceBackgroundModule,
  ],
  controllers: [ChatController, OpenChatController],
  providers: [
    ChatService,
    UserBalanceService,
    UserService,
    VerificationService,
    ChatLogService,
    RedisCacheService,
    MailerService,
    GlobalConfigService,
    UploadService,
    AutoReplyService,
    BadWordsService,
    ChatGroupService,
    ModelsService,
    OpenAIChatService,
    NetSearchService,
    AppService,
  ],
  exports: [ChatService, OpenAIChatService],
})
export class ChatModule {}
