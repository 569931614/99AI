import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffectionModule } from '../affection/affection.module';
import { AppEntity } from '../app/app.entity';
import { ChatGroupController } from './chatGroup.controller';
import { ChatGroupEntity } from './chatGroup.entity';
import { ChatGroupService } from './chatGroup.service';
import { OpenChatGroupController } from './open-chatGroup.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ChatGroupEntity, AppEntity]), AffectionModule],
  controllers: [ChatGroupController, OpenChatGroupController],
  providers: [ChatGroupService],
  exports: [ChatGroupService],
})
export class ChatGroupModule {}
