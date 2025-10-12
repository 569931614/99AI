import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppEntity } from '../app/app.entity';
import { AppEmotionVoiceEntity } from '../app/appEmotionVoice.entity';
import { AppVoiceEntity } from '../app/appVoice.entity';
import { GlobalConfigModule } from '../globalConfig/globalConfig.module';
import { UploadModule } from '../upload/upload.module';
import { OpenVoiceController } from './open-voice.controller';
import { VoiceController } from './voice.controller';
import { VoiceEntity } from './voice.entity';
import { VoiceService } from './voice.service';

@Module({
  imports: [
    GlobalConfigModule,
    UploadModule,
    TypeOrmModule.forFeature([VoiceEntity, AppVoiceEntity, AppEmotionVoiceEntity, AppEntity]),
  ],
  controllers: [VoiceController, OpenVoiceController],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
