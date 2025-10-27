import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { VoiceService } from './voice.service';

@ApiTags('open-voice')
@Controller('open/voice')
export class OpenVoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  // 查询（读）
  @Get('list')
  @ApiOperation({ summary: '【开放】查询音色列表（无鉴权，先同步PENDING状态后再返回）' })
  @ApiQuery({
    name: 'prefix',
    type: String,
    required: false,
    description: '按前缀过滤，例如 cosyvoice-v2',
  })
  @ApiQuery({
    name: 'page_index',
    type: Number,
    required: false,
    description: '页码（从1开始），默认 1',
  })
  @ApiQuery({ name: 'page_size', type: Number, required: false, description: '每页数量，默认 10' })
  async list(@Query() query: { prefix?: string; page_index?: number; page_size?: number }) {
    // 先尝试同步一次PENDING状态，保证列表尽可能新
    try {
      await this.voiceService.syncPendingVoicesStatus();
    } catch (_) {}
    const pageIndexOneBased = Math.max(1, Number(query?.page_index ?? 1));
    const pageSize = Math.max(1, Number(query?.page_size ?? 10));
    const dbQuery = {
      prefix: query?.prefix,
      page_index: pageIndexOneBased - 1, // 转为0基
      page_size: pageSize,
    } as any;
    return await this.voiceService.listFromDB(dbQuery);
  }

  @Get('detail/:voiceId')
  @ApiOperation({ summary: '【开放】查询音色详情/状态（无鉴权）' })
  @ApiParam({ name: 'voiceId', type: String, description: '音色ID' })
  detail(@Param('voiceId') voiceId: string) {
    return this.voiceService.query(voiceId);
  }

  @Get('params/:voiceId')
  @ApiOperation({ summary: '【开放】获取音色默认合成参数（无鉴权）' })
  @ApiParam({ name: 'voiceId', type: String, description: '音色ID' })
  getParams(@Param('voiceId') voiceId: string) {
    return this.voiceService.getVoiceParams(voiceId);
  }

  @Get('meta/:voiceId')
  @ApiOperation({ summary: '【开放】获取音色元信息（如名称）（无鉴权）' })
  @ApiParam({ name: 'voiceId', type: String, description: '音色ID' })
  getMeta(@Param('voiceId') voiceId: string) {
    return this.voiceService.getVoiceMeta(voiceId);
  }

  // 写操作
  @Post('enroll')
  @ApiOperation({
    summary: '【开放】声音复刻：创建音色（无鉴权）',
    description: '说明：enablePreprocess 已废弃，后端始终忽略并直接使用原始音频URL。',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        prefix: {
          type: 'string',
          description: '目标模型前缀（最多10个字符），如 test01、qya3 等',
          maxLength: 10,
        },
        url: {
          type: 'string',
          description:
            '训练音频URL（支持 http/https，建议 WAV 格式，16kHz 采样率，3-10秒清晰人声）',
        },
        targetModel: { type: 'string', description: '具体目标模型（可选，默认 cosyvoice-v2）' },
        name: { type: 'string', description: '音色名称（可选）' },
        enablePreprocess: {
          type: 'boolean',
          description: '已废弃：后端忽略此参数，始终直接使用原始音频URL',
        },
      },
      required: ['prefix', 'url'],
    },
    examples: {
      demo: {
        value: {
          prefix: 'test01',
          url: 'https://example.com/sample.wav',
          targetModel: 'cosyvoice-v2',
          name: '示例音色',
          enablePreprocess: true,
        },
      },
      withoutPreprocess: {
        value: { prefix: 'test02', url: 'https://example.com/sample.wav', enablePreprocess: false },
      },
    },
  })
  enroll(
    @Body()
    body: {
      prefix: string;
      url: string;
      targetModel?: string;
      name?: string;
      enablePreprocess?: boolean;
    },
  ) {
    return this.voiceService.enroll(body);
  }

  @Post('update')
  @ApiOperation({ summary: '【开放】更新音色（训练）（无鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        voice_id: { type: 'string', description: '音色ID' },
        url: { type: 'string', description: '追加训练音频URL' },
      },
      required: ['voice_id', 'url'],
    },
    examples: {
      demo: { value: { voice_id: 'cosyvoice-v2-ls3-xxxx', url: 'https://.../more.wav' } },
    },
  })
  update(@Body() body: { voice_id: string; url: string }) {
    return this.voiceService.update(body);
  }

  @Post('update-status')
  @ApiOperation({ summary: '【开放】更新音色状态（无鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        voiceId: { type: 'string', description: '音色ID' },
        status: { type: 'string', description: '状态（PENDING/SUCCEEDED/FAILED等）' },
      },
      required: ['voiceId', 'status'],
    },
    examples: { demo: { value: { voiceId: 'cosyvoice-v2-ls3-xxxx', status: 'SUCCEEDED' } } },
  })
  updateStatus(@Body() body: { voiceId: string; status: string }) {
    return this.voiceService.updateStatus(body.voiceId, body.status);
  }

  @Post('sync-pending-status')
  @ApiOperation({ summary: '【开放】自动同步PENDING状态的音色（无鉴权）' })
  syncPendingStatus() {
    return this.voiceService.syncPendingVoicesStatus();
  }

  @Post('delete')
  @ApiOperation({ summary: '【开放】删除音色（无鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { voice_id: { type: 'string', description: '音色ID' } },
      required: ['voice_id'],
    },
    examples: { demo: { value: { voice_id: 'cosyvoice-v2-ls3-xxxx' } } },
  })
  remove(@Body() body: { voice_id: string }) {
    return this.voiceService.remove(body);
  }

  @Post('params')
  @ApiOperation({ summary: '【开放】设置音色默认合成参数（无鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        voice_id: { type: 'string', description: '音色ID' },
        params: {
          type: 'object',
          description: '合成参数，如 { rate, pitch, volume, sample_rate, format }',
        },
      },
      required: ['voice_id', 'params'],
    },
    examples: {
      demo: {
        value: {
          voice_id: 'cosyvoice-v2-ls3-xxxx',
          params: { rate: 1.2, pitch: 1.1, volume: 60, sample_rate: 22050, format: 'mp3' },
        },
      },
    },
  })
  setParams(@Body() body: { voice_id: string; params: any }) {
    return this.voiceService.setVoiceParams(body);
  }

  @Post('meta')
  @ApiOperation({ summary: '【开放】设置音色元信息（如名称）（无鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        voice_id: { type: 'string', description: '音色ID' },
        meta: { type: 'object', description: '元信息，如 { name }' },
      },
      required: ['voice_id', 'meta'],
    },
    examples: { demo: { value: { voice_id: 'cosyvoice-v2-ls3-xxxx', meta: { name: '小甜' } } } },
  })
  setMeta(@Body() body: { voice_id: string; meta: any }) {
    return this.voiceService.setVoiceMeta(body);
  }

  @Post('asr')
  @ApiOperation({ summary: '【开放】语音识别（无鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audioBase64: {
          type: 'string',
          description: '音频数据：支持Base64编码（dataURL或纯base64）或音频文件URL（http/https）',
        },
        format: { type: 'string', description: '音频格式，如 wav/mp3 等（可选）' },
        sample_rate: { type: 'number', description: '采样率（可选）' },
        model: { type: 'string', description: 'ASR 模型（可选）' },
        language_hints: {
          type: 'array',
          items: { type: 'string' },
          description: '语言提示（可选）',
        },
        disfluency_removal_enabled: { type: 'boolean', description: '口吃去除（可选）' },
      },
      required: ['audioBase64'],
    },
    examples: {
      withBase64: {
        summary: '使用Base64编码',
        value: { audioBase64: '<base64>', format: 'wav', sample_rate: 16000 },
      },
      withUrl: {
        summary: '使用音频URL',
        value: {
          audioBase64: 'https://example.com/audio.mp3',
          format: 'mp3',
          sample_rate: 16000,
        },
      },
    },
  })
  asr(
    @Body()
    body: {
      audioBase64: string;
      format?: 'wav' | 'pcm' | 'mp3' | 'opus' | 'speex' | 'aac' | 'amr';
      sample_rate?: number;
      model?: string;
      language_hints?: string[];
      disfluency_removal_enabled?: boolean;
    },
  ) {
    return this.voiceService.asr(body as any);
  }

  // 试听（读）
  @Post('preview')
  @ApiOperation({ summary: '【开放】试听：根据音色合成音频并返回URL（无鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        voice_id: { type: 'string', description: '音色ID' },
        text: { type: 'string', description: '要合成的文本' },
        model: { type: 'string', description: 'TTS 模型（可选）' },
        format: { type: 'string', description: '输出格式：mp3/wav/pcm（可选）' },
        sample_rate: { type: 'number', description: '采样率（可选）' },
        volume: { type: 'number', description: '音量（可选）' },
        rate: { type: 'number', description: '语速（可选）' },
        pitch: { type: 'number', description: '音调（可选）' },
      },
      required: ['voice_id', 'text'],
    },
    examples: {
      demo: {
        value: { voice_id: 'cosyvoice-v2-ls3-xxxx', text: '你好，欢迎使用。', format: 'mp3' },
      },
    },
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
