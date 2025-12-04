import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { VoiceService } from './voice.service';
import { VoiceCategoryService } from './voiceCategory.service';

@ApiTags('open-voice')
@Controller('open/voice')
export class OpenVoiceController {
  constructor(
    private readonly voiceService: VoiceService,
    private readonly voiceCategoryService: VoiceCategoryService,
  ) {}

  // 查询（读）
  @Get('categories')
  @ApiOperation({ summary: '【开放】获取音色分类列表（无鉴权）' })
  async getCategories() {
    const categories = await this.voiceCategoryService.list();
    // 只返回启用的分类
    return categories.filter(cat => cat.isEnabled);
  }

  @Get('list')
  @ApiOperation({ summary: '【开放】查询音色列表（无鉴权，先同步PENDING状态后再返回）' })
  @ApiQuery({
    name: 'prefix',
    type: String,
    required: false,
    description: '按前缀过滤，例如 cosyvoice-v2',
  })
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: false,
    description: '按用户ID过滤（查询用户自己的音色，NULL表示查询系统音色）',
  })
  @ApiQuery({
    name: 'category',
    type: String,
    required: false,
    description: '按分类名称过滤',
  })
  @ApiQuery({
    name: 'keyword',
    type: String,
    required: false,
    description: '按关键词搜索音色名称',
  })
  @ApiQuery({
    name: 'page_index',
    type: Number,
    required: false,
    description: '页码（从1开始），默认 1',
  })
  @ApiQuery({ name: 'page_size', type: Number, required: false, description: '每页数量，默认 10' })
  async list(
    @Query()
    query: {
      prefix?: string;
      userId?: number;
      category?: string;
      keyword?: string;
      page_index?: number;
      page_size?: number;
    },
  ) {
    // 先尝试同步一次PENDING状态，保证列表尽可能新
    try {
      await this.voiceService.syncPendingVoicesStatus();
    } catch (_) {}
    const pageIndexOneBased = Math.max(1, Number(query?.page_index ?? 1));
    const pageSize = Math.max(1, Number(query?.page_size ?? 10));
    const dbQuery = {
      prefix: query?.prefix,
      userId: query?.userId,
      category: query?.category,
      keyword: query?.keyword,
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
    description:
      '默认使用 DashScope(cosyvoice)，兼容旧接口。新增 provider=minimax 支持 MiniMax 语音克隆。',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['dashscope', 'minimax'],
          description: '语音服务提供商（可选，默认 dashscope，兼容旧接口）',
        },
        url: {
          type: 'string',
          description: '训练音频URL（DashScope必填，MiniMax可选）',
        },
        prefix: {
          type: 'string',
          description: '【DashScope】目标模型前缀（可选，最多10个字符）',
          maxLength: 10,
        },
        targetModel: {
          type: 'string',
          description: '【DashScope】目标模型（可选，默认 cosyvoice-v2）',
        },
        audioFile: {
          type: 'string',
          format: 'binary',
          description: '【MiniMax】音频文件（mp3/m4a/wav，10秒-5分钟，≤20MB）',
        },
        promptText: {
          type: 'string',
          description: '【MiniMax】音频对应的文本（可选，提升克隆质量）',
        },
        name: { type: 'string', description: '音色名称（可选）' },
        userId: { type: 'number', description: '用户ID（可选）' },
      },
      required: ['url'],
    },
    examples: {
      default: {
        summary: '旧接口调用方式（默认cosyvoice）',
        value: {
          url: 'https://example.com/sample.wav',
          name: '示例音色',
        },
      },
      dashscope: {
        summary: 'DashScope 语音克隆',
        value: {
          provider: 'dashscope',
          url: 'https://example.com/sample.wav',
          name: '示例音色',
          targetModel: 'cosyvoice-v2',
        },
      },
      minimax: {
        summary: 'MiniMax 语音克隆（需上传文件）',
        value: {
          provider: 'minimax',
          name: '克隆音色',
          promptText: '音频中说的话',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('audioFile', { limits: { fileSize: 20 * 1024 * 1024 } }))
  enroll(
    @Req() req: Request,
    @UploadedFile() audioFile: Express.Multer.File,
    @Body()
    body: {
      provider?: 'dashscope' | 'minimax';
      prefix?: string;
      url?: string;
      targetModel?: string;
      name?: string;
      userId?: number;
      promptText?: string;
    },
  ) {
    const userId = body.userId || (req as any).user?.id;

    // provider=minimax 时使用 MiniMax 语音克隆
    if (body.provider === 'minimax') {
      return this.voiceService.importMinimaxVoice({
        name: body.name,
        userId,
        audioFile,
        audioUrl: body.url,
        promptText: body.promptText,
      });
    }

    // 默认使用 DashScope（兼容旧接口）
    return this.voiceService.enroll({
      prefix: body.prefix,
      url: body.url,
      targetModel: body.targetModel,
      name: body.name,
      userId,
    });
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
        text_language: { type: 'string', description: '文本语言（GPT-SoVITS 可选）' },
        cut_punc: { type: 'string', description: '文本切分符（GPT-SoVITS 可选）' },
      },
      required: ['voice_id', 'text'],
    },
    examples: {
      demo: {
        value: { voice_id: 'cosyvoice-v2-ls3-xxxx', text: '你好，欢迎使用。', format: 'mp3' },
      },
    },
  })
  async preview(
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
      text_language?: string;
      cut_punc?: string;
    },
  ) {
    try {
      return await this.voiceService.preview(body);
    } catch (error) {
      console.error('[OpenVoiceController.preview] Error:', error);
      throw error;
    }
  }

  // ==================== MiniMax 关联预置音色 ====================

  @Post('minimax/link')
  @ApiOperation({
    summary: '【开放】MiniMax 关联音色：使用已有音色ID（无鉴权）',
    description: '关联 MiniMax 预置音色（如 audiobook_male_1）或已克隆的音色ID',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        minimaxVoiceId: { type: 'string', description: 'MiniMax 音色ID（必填）' },
        name: { type: 'string', description: '音色名称（可选）' },
        userId: { type: 'number', description: '用户ID（可选）' },
        model: { type: 'string', description: '模型（可选，默认 speech-2.6-hd）' },
        speed: { type: 'number', description: '语速 0.5-2.0（可选，默认 1）' },
        vol: { type: 'number', description: '音量 0.1-10（可选，默认 1）' },
        pitch: { type: 'number', description: '音调 -12到12（可选，默认 0）' },
        languageBoost: { type: 'string', description: '语言增强（可选，默认 auto）' },
      },
      required: ['minimaxVoiceId'],
    },
    examples: {
      preset: {
        summary: '使用预置音色',
        value: { minimaxVoiceId: 'audiobook_male_1', name: '男声有声书' },
      },
      cloned: {
        summary: '使用克隆音色',
        value: { minimaxVoiceId: 'voice1234567890', name: '我的克隆音色' },
      },
    },
  })
  minimaxLink(
    @Body()
    body: {
      minimaxVoiceId: string;
      name?: string;
      userId?: number;
      model?: string;
      speed?: number;
      vol?: number;
      pitch?: number;
      languageBoost?: string;
    },
  ) {
    return this.voiceService.linkMinimaxVoice(body);
  }

  // ==================== MiniMax 音色设计 ====================

  @Post('minimax/design')
  @ApiOperation({
    summary: '【开放】MiniMax 音色设计：通过文字描述生成AI音色（无鉴权）',
    description:
      '使用 prompt 描述音色风格（如"讲述悬疑故事的播音员，声音低沉富有磁性"），' +
      '系统会自动生成音色。返回生成的音色ID。',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '音色风格描述（必填）' },
        name: { type: 'string', description: '音色名称（可选）' },
        userId: { type: 'number', description: '用户ID（可选）' },
      },
      required: ['prompt'],
    },
    examples: {
      demo: {
        summary: '音色设计示例',
        value: {
          prompt: '讲述悬疑故事的播音员，声音低沉富有磁性，语速时快时慢，营造紧张神秘的氛围。',
          name: '悬疑男声',
        },
      },
    },
  })
  designMinimaxVoice(
    @Body()
    body: {
      prompt: string;
      name?: string;
      userId?: number;
    },
  ) {
    return this.voiceService.designMinimaxVoice(body);
  }
}
