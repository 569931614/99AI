import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffectionModule } from '../affection/affection.module';
import { AppEntity } from '../app/app.entity';
import { ChatLogEntity } from '../chatLog/chatLog.entity';
import { UserEntity } from '../user/user.entity';
import { ChatGroupController } from './chatGroup.controller';
import { ChatGroupEntity } from './chatGroup.entity';
import { ChatGroupService } from './chatGroup.service';
import { OpenChatGroupController } from './open-chatGroup.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ChatGroupEntity, AppEntity, ChatLogEntity, UserEntity]),
    AffectionModule,
  ],
  controllers: [ChatGroupController, OpenChatGroupController],
  providers: [ChatGroupService],
  exports: [ChatGroupService],
})
export class ChatGroupModule {}
