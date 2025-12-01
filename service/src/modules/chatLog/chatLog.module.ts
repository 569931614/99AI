import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGroupEntity } from '../chatGroup/chatGroup.entity';
import { UserEntity } from '../user/user.entity';
import { ChatLogController } from './chatLog.controller';
import { ChatLogEntity } from './chatLog.entity';
import { ChatLogService } from './chatLog.service';
import { OpenChatLogController } from './open-chatLog.controller';
import { UploadModule } from '../upload/upload.module';
import { VoiceModule } from '../voice/voice.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ChatLogEntity, UserEntity, ChatGroupEntity]),
    UploadModule,
    VoiceModule,
  ],
  controllers: [ChatLogController, OpenChatLogController],
  providers: [ChatLogService],
  exports: [ChatLogService],
})
export class ChatLogModule {}
