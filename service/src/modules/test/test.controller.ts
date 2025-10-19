import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { VoiceService } from '../voice/voice.service';

@Controller('api/test')
export class TestController {
  private readonly logger = new Logger(TestController.name);
  constructor(private readonly voiceService: VoiceService) {}

  @Get('simple')
  @HttpCode(HttpStatus.OK)
  simpleTest() {
    this.logger.debug('收到简单测试请求');
    return {
      success: true,
      message: '简单测试接口工作正常',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('voice-call')
  @HttpCode(HttpStatus.OK)
  async voiceCallTest(@Body() body: any) {
    this.logger.debug('收到语音通话测试请求');
    try {
      const {
        audioBase64,
        format = 'wav',
        sampleRate = 16000,
        voice_id = '',
        appId,
        config,
      } = body;

      if (!audioBase64) {
        return { error: 'audioBase64 必填' };
      }

      this.logger.debug('开始外部语音测试');

      // 1) 模拟ASR识别
      const mockAsrText = '你好，这是一个测试语音识别结果';
      this.logger.debug(`模拟ASR识别结果: "${mockAsrText}"`);

      // 2) 模拟LLM处理
      this.logger.debug('开始LLM处理');
      const mockLlmResponse = `你好！我收到了你的语音消息："${mockAsrText}"。这是一个测试响应，说明语音通话功能正常工作。`;
      this.logger.debug(`模拟LLM响应: "${mockLlmResponse}"`);

      // 3) 模拟TTS语音合成
      if (voice_id && mockLlmResponse.trim()) {
        this.logger.debug(`模拟TTS合成，音色: ${voice_id}`);

        // 创建一个简单的测试音频数据（1秒的静音）
        const sampleRate = 24000;
        const duration = 1; // 1秒
        const numSamples = sampleRate * duration;
        const audioBuffer = Buffer.alloc(numSamples * 2); // 16-bit PCM

        // 填充静音数据
        for (let i = 0; i < numSamples; i++) {
          audioBuffer.writeInt16LE(0, i * 2);
        }

        this.logger.debug(`模拟TTS合成完成，音频大小: ${audioBuffer.length} bytes`);

        return {
          success: true,
          asr: mockAsrText,
          llm: mockLlmResponse,
          tts: {
            voice_id,
            audio_size: audioBuffer.length,
            audio_base64: `data:audio/wav;base64,${audioBuffer.toString('base64')}`,
          },
          timestamp: new Date().toISOString(),
        };
      } else {
        this.logger.debug('跳过TTS合成（无音色ID或无LLM响应）');
        return {
          success: true,
          asr: mockAsrText,
          llm: mockLlmResponse,
          tts: null,
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error: any) {
      this.logger.error(`外部语音测试失败: ${error?.message || error}`);
      return {
        error: '语音测试失败',
        message: error?.message || '未知错误',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('asr-self')
  @HttpCode(HttpStatus.OK)
  async asrSelf(@Body() body: any) {
    try {
      const model = body?.model || 'paraformer-realtime-8k-v2';
      const sampleRate = Number(body?.sampleRate || 8000);
      const filePath = body?.filePath || path.join(process.cwd(), 'upload', '祁煜test.wav');
      if (!fs.existsSync(filePath)) {
        return { success: false, message: `file not found: ${filePath}` };
      }
      const buf = fs.readFileSync(filePath);
      const audioBase64 = `data:audio/wav;base64,${buf.toString('base64')}`;
      const res = await this.voiceService.asr({
        audioBase64,
        format: 'wav',
        sample_rate: sampleRate,
        model,
        language_hints: ['zh-CN'],
      });
      return { success: true, text: res?.text || '', sentences: res?.sentences || [] };
    } catch (e: any) {
      this.logger.error(e?.message || e);
      return { success: false, message: e?.message || 'failed' };
    }
  }
}
