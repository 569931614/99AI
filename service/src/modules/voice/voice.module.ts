import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppEntity } from '../app/app.entity';
import { AppEmotionVoiceEntity } from '../app/appEmotionVoice.entity';
import { AppVoiceEntity } from '../app/appVoice.entity';
import { GlobalConfigModule } from '../globalConfig/globalConfig.module';
import { UploadModule } from '../upload/upload.module';
import { OpenVoiceController } from './open-voice.controller';
import { MinimaxProvider } from './providers/minimax.provider';
import { VoiceController } from './voice.controller';
import { VoiceEntity } from './voice.entity';
import { VoiceService } from './voice.service';
import { VoiceCategoryController } from './voiceCategory.controller';
import { VoiceCategoryEntity } from './voiceCategory.entity';
import { VoiceCategoryService } from './voiceCategory.service';

@Module({
  imports: [
    GlobalConfigModule,
    UploadModule,
    TypeOrmModule.forFeature([
      VoiceEntity,
      VoiceCategoryEntity,
      AppVoiceEntity,
      AppEmotionVoiceEntity,
      AppEntity,
    ]),
  ],
  controllers: [VoiceController, VoiceCategoryController, OpenVoiceController],
  providers: [VoiceService, VoiceCategoryService, MinimaxProvider],
  exports: [VoiceService, VoiceCategoryService, TypeOrmModule],
})
export class VoiceModule {}
