import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffectionModule } from '../affection/affection.module';
import { AppEntity } from '../app/app.entity';
import { AppModule } from '../app/app.module';
import { ChatModule } from '../chat/chat.module';
import { VoiceCallService } from './voiceCall.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppEntity]), ChatModule, AffectionModule, AppModule],
  providers: [VoiceCallService],
  exports: [VoiceCallService],
})
export class VoiceCallModule {}
