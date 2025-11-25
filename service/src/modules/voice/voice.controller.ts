import { JwtAuthGuard } from '@/common/auth/jwtAuth.guard';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Express } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { VoiceService } from './voice.service';

// Multer diskStorage 配置
const multer = require('multer');
const diskStorage = multer.diskStorage;

@ApiTags('voice')
@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('enroll')
  @ApiOperation({ summary: '声音复刻：创建音色' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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

  @Get('gpt-sovits/files')
  @ApiOperation({ summary: '列出服务器上的 GPT-SoVITS 模型文件' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listGptSovitsFiles() {
    return this.voiceService.listGptSovitsFiles();
  }

  @Get('gpt-sovits/characters')
  @ApiOperation({ summary: '获取 GPT-SoVITS 角色列表' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listGptSovitsCharacters() {
    return this.voiceService.listGptSovitsCharacters();
  }

  @Get('gpt-sovits/character/:characterName')
  @ApiOperation({ summary: '获取指定角色信息' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getGptSovitsCharacterInfo(@Param('characterName') characterName: string) {
    return this.voiceService.getGptSovitsCharacterInfo(characterName);
  }

  @Post('gpt-sovits/import')
  @ApiOperation({ summary: '导入 GPT-SoVITS 模型' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'gptModel', maxCount: 1 },
        { name: 'sovitsModel', maxCount: 1 },
        { name: 'promptAudio', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 600 * 1024 * 1024,
        },
      },
    ),
  )
  importGptSovits(@UploadedFiles() files, @Body() body: Record<string, any>) {
    return this.voiceService.importGptSovitsVoice(files, body);
  }

  @Post('gpt-sovits/models/upload')
  @ApiOperation({ summary: '上传 GPT-SoVITS 模型文件' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const tempDir = path.join(process.cwd(), 'storage', 'temp');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          cb(null, tempDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + '-' + file.originalname);
        },
      }),
      limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
    }),
  )
  uploadGptSovitsModel(@UploadedFile() file: Express.Multer.File) {
    return this.voiceService.uploadGptSovitsModel(file);
  }

  @Get('list')
  @ApiOperation({ summary: '查询音色列表' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async list(
    @Query()
    query: {
      prefix?: string;
      page_index?: number;
      page_size?: number;
      categoryId?: number;
    },
  ) {
    // 在返回列表前先尝试同步一次PENDING状态，确保列表尽量反映最新训练状态
    try {
      await this.voiceService.syncPendingVoicesStatus();
    } catch (_) {}
    // 直接使用数据库分页，数据库已包含名称信息
    const { rows, count } = await this.voiceService.listFromDB(query);
    return { rows, count };
  }

  @Get('detail/:voiceId')
  @ApiOperation({ summary: '查询音色详情/状态' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  detail(@Param('voiceId') voiceId: string) {
    return this.voiceService.query(voiceId);
  }

  @Post('update')
  @ApiOperation({ summary: '更新音色（训练）' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(@Body() body: { voice_id: string; url: string }) {
    return this.voiceService.update(body);
  }

  @Post('update-status')
  @ApiOperation({ summary: '更新音色状态' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateStatus(@Body() body: { voiceId: string; status: string }) {
    return this.voiceService.updateStatus(body.voiceId, body.status);
  }

  @Post('sync-pending-status')
  @ApiOperation({ summary: '自动同步PENDING状态的音色' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  syncPendingStatus() {
    return this.voiceService.syncPendingVoicesStatus();
  }

  @Post('delete')
  @ApiOperation({ summary: '删除音色' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  remove(@Body() body: { voice_id: string }) {
    return this.voiceService.remove(body);
  }

  @Post('preview')
  @ApiOperation({ summary: '试听：根据音色合成音频并返回URL' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
      text_language?: string;
      cut_punc?: string;
    },
  ) {
    return this.voiceService.preview(body);
  }

  @Get('params/:voiceId')
  @ApiOperation({ summary: '获取音色默认合成参数' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getParams(@Param('voiceId') voiceId: string) {
    return this.voiceService.getVoiceParams(voiceId);
  }

  @Post('params')
  @ApiOperation({ summary: '设置音色默认合成参数' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  setParams(@Body() body: { voice_id: string; params: any }) {
    return this.voiceService.setVoiceParams(body);
  }

  @Get('meta/:voiceId')
  @ApiOperation({ summary: '获取音色元信息（如名称）' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getMeta(@Param('voiceId') voiceId: string) {
    return this.voiceService.getVoiceMeta(voiceId);
  }

  @Post('meta')
  @ApiOperation({ summary: '设置音色元信息（如名称）' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  setMeta(@Body() body: { voice_id: string; meta: any }) {
    return this.voiceService.setVoiceMeta(body);
  }

  @Post('category')
  @ApiOperation({ summary: '设置音色分类' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  setCategory(@Body() body: { voice_id: string; categoryId: number | null }) {
    return this.voiceService.setVoiceCategory(body);
  }

  @Post('asr')
  @ApiOperation({ summary: '语音识别：上传音频并返回识别文本' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
}
