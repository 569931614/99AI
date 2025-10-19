import { Global, Module } from '@nestjs/common';
import { ChatGroupController } from './chatGroup.controller';
import { ChatGroupService } from './chatGroup.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGroupEntity } from './chatGroup.entity';
import { AppEntity } from '../app/app.entity';
import { AffectionModule } from '../affection/affection.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ChatGroupEntity, AppEntity]), AffectionModule],
  controllers: [ChatGroupController],
  providers: [ChatGroupService],
  exports: [ChatGroupService],
})
export class ChatGroupModule {}
