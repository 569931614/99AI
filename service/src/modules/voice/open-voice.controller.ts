import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VoiceService } from './voice.service';

@ApiTags('open-voice')
@Controller('open/voice')
export class OpenVoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  // 查询（读）
  @Get('list')
  @ApiOperation({ summary: '【开放】查询音色列表（无鉴权）' })
  list(@Query() query: { prefix?: string; page_index?: number; page_size?: number }) {
    return this.voiceService.list(query);
  }

  @Get('detail/:voiceId')
  @ApiOperation({ summary: '【开放】查询音色详情/状态（无鉴权）' })
  detail(@Param('voiceId') voiceId: string) {
    return this.voiceService.query(voiceId);
  }

  @Get('params/:voiceId')
  @ApiOperation({ summary: '【开放】获取音色默认合成参数（无鉴权）' })
  getParams(@Param('voiceId') voiceId: string) {
    return this.voiceService.getVoiceParams(voiceId);
  }

  @Get('meta/:voiceId')
  @ApiOperation({ summary: '【开放】获取音色元信息（如名称）（无鉴权）' })
  getMeta(@Param('voiceId') voiceId: string) {
    return this.voiceService.getVoiceMeta(voiceId);
  }

  // 写操作
  @Post('enroll')
  @ApiOperation({ summary: '【开放】声音复刻：创建音色（无鉴权）' })
  @ApiBody({
    schema: { type: 'object', properties: { prefix: { type: 'string' }, url: { type: 'string' }, targetModel: { type: 'string' }, name: { type: 'string' } }, required: ['prefix','url'] },
    examples: { demo: { value: { prefix: 'cosyvoice-v2', url: 'https://.../sample.wav', name: '示例音色' } } },
  })
  enroll(@Body() body: { prefix: string; url: string; targetModel?: string; name?: string }) {
    return this.voiceService.enroll(body);
  }

  @Post('update')
  @ApiOperation({ summary: '【开放】更新音色（训练）（无鉴权）' })
  @ApiBody({
    schema: { type: 'object', properties: { voice_id: { type: 'string' }, url: { type: 'string' } }, required: ['voice_id','url'] },
    examples: { demo: { value: { voice_id: 'cosyvoice-v2-ls3-xxxx', url: 'https://.../more.wav' } } },
  })
  update(@Body() body: { voice_id: string; url: string }) {
    return this.voiceService.update(body);
  }

  @Post('delete')
  @ApiOperation({ summary: '【开放】删除音色（无鉴权）' })
  @ApiBody({
    schema: { type: 'object', properties: { voice_id: { type: 'string' } }, required: ['voice_id'] },
    examples: { demo: { value: { voice_id: 'cosyvoice-v2-ls3-xxxx' } } },
  })
  remove(@Body() body: { voice_id: string }) {
    return this.voiceService.remove(body);
  }

  @Post('params')
  @ApiOperation({ summary: '【开放】设置音色默认合成参数（无鉴权）' })
  @ApiBody({
    schema: { type: 'object', properties: { voice_id: { type: 'string' }, params: { type: 'object' } }, required: ['voice_id','params'] },
    examples: { demo: { value: { voice_id: 'cosyvoice-v2-ls3-xxxx', params: { rate: 1, pitch: 1 } } } },
  })
  setParams(@Body() body: { voice_id: string; params: any }) {
    return this.voiceService.setVoiceParams(body);
  }

  @Post('meta')
  @ApiOperation({ summary: '【开放】设置音色元信息（如名称）（无鉴权）' })
  @ApiBody({
    schema: { type: 'object', properties: { voice_id: { type: 'string' }, meta: { type: 'object' } }, required: ['voice_id','meta'] },
    examples: { demo: { value: { voice_id: 'cosyvoice-v2-ls3-xxxx', meta: { name: '小甜' } } } },
  })
  setMeta(@Body() body: { voice_id: string; meta: any }) {
    return this.voiceService.setVoiceMeta(body);
  }

  @Post('asr')
  @ApiOperation({ summary: '【开放】语音识别（无鉴权）' })
  @ApiBody({
    schema: { type: 'object', properties: { audioBase64: { type: 'string' }, format: { type: 'string' }, sample_rate: { type: 'number' } }, required: ['audioBase64'] },
    examples: { demo: { value: { audioBase64: '<base64>', format: 'wav', sample_rate: 16000 } } },
  })
  asr(@Body() body: { audioBase64: string; format?: 'wav'|'pcm'|'mp3'|'opus'|'speex'|'aac'|'amr'; sample_rate?: number; model?: string; language_hints?: string[]; disfluency_removal_enabled?: boolean; }) {
    return this.voiceService.asr(body as any);
  }

  // 试听（读）
  @Post('preview')
  @ApiOperation({ summary: '【开放】试听：根据音色合成音频并返回URL（无鉴权）' })
  @ApiBody({
    schema: { type: 'object', properties: { voice_id: { type: 'string' }, text: { type: 'string' }, format: { type: 'string' } }, required: ['voice_id','text'] },
    examples: { demo: { value: { voice_id: 'cosyvoice-v2-ls3-xxxx', text: '你好，欢迎使用。', format: 'mp3' } } },
  })
  preview(
    @Body()
    body: {
      voice_id: string;
      text: string;
      model?: string;
      format?: 'mp3' | 'wav' | 'pcm';
      sample_rate?: number;
      volume?: number;
      rate?: number;
      pitch?: number;
    },
  ) {
    return this.voiceService.preview(body);
  }
}

