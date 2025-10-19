import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalConfigModule } from '../globalConfig/globalConfig.module';
import { ConversationSummaryEntity } from './conversationSummary.entity';
import { ConversationSummaryService } from './conversationSummary.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConversationSummaryEntity]), GlobalConfigModule],
  providers: [ConversationSummaryService],
  exports: [ConversationSummaryService],
})
export class ConversationSummaryModule {}
