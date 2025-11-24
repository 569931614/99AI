import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppEntity } from '../app/app.entity';
import { AppEmotionVoiceEntity } from '../app/appEmotionVoice.entity';
import { AppVoiceEntity } from '../app/appVoice.entity';
import { RoleEmotionEntity } from '../app/roleEmotion.entity';
import { ChatModule } from '../chat/chat.module';
import { PluginEntity } from '../plugin/plugin.entity';
import { RedisCacheService } from '../redisCache/redisCache.service';
import { UserEntity } from '../user/user.entity';
import { VoiceModule } from '../voice/voice.module';
import { ChatQueueController } from './chatQueue.controller';
import { ChatQueueProcessor } from './chatQueue.processor';
import { ChatQueueService } from './chatQueue.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'chat-queue',
    }),
    TypeOrmModule.forFeature([
      AppEntity,
      AppVoiceEntity,
      PluginEntity,
      UserEntity,
      AppEmotionVoiceEntity,
      RoleEmotionEntity,
    ]),
    ChatModule,
    VoiceModule,
  ],
  controllers: [ChatQueueController],
  providers: [ChatQueueService, ChatQueueProcessor, RedisCacheService],
  exports: [ChatQueueService],
})
export class ChatQueueModule {}
