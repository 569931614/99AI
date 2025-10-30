import { Module } from '@nestjs/common';
import { VoiceModule } from '../voice/voice.module';
import { TestController } from './test.controller';

@Module({
  imports: [VoiceModule],
  controllers: [TestController],
})
export class TestModule {}

