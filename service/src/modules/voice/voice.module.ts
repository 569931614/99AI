import { Module } from '@nestjs/common';
import { GlobalConfigModule } from '../globalConfig/globalConfig.module';
import { UploadModule } from '../upload/upload.module';
import { OpenVoiceController } from './open-voice.controller';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

@Module({
  imports: [GlobalConfigModule, UploadModule],
  controllers: [VoiceController, OpenVoiceController],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}

