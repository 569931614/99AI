import { Body, Controller, Get, HttpException, HttpStatus, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import axios from 'axios';
import { Request, Response } from 'express';
import { AffectionService } from '../affection/affection.service';
import { VoiceService } from '../voice/voice.service';
import { ChatService } from './chat.service';

@ApiTags('open-chat')
@Controller('open/chat')
export class OpenChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly voiceService: VoiceService,
    private readonly affectionService: AffectionService,
  ) {}

  @Post('chat-process')
  @ApiOperation({ summary: '【开放】聊天对话（无鉴权，需显式传 userId；支持 audioUrl 自动ASR）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID（必须为系统中存在的用户）' },
        model: { type: 'string' },
        modelName: { type: 'string' },
        modelType: { type: 'number' },
        modelAvatar: { type: 'string' },
        prompt: { type: 'string' },
        audioUrl: { type: 'string' },
        imageUrl: { type: 'string' },
        fileUrl: { type: 'string' },
        appId: { type: 'number' },
        options: { type: 'object' },
        extraParam: { type: 'object' },
        usingPluginId: { type: 'number' },
      },
      required: ['userId'],
    },
    examples: {
      demo: {
        value: {
          userId: 1,
          model: 'deepseek-chat',
          prompt: '你好',
        },
      },
    },
  })
  async chatProcess(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { userId } = body || {};
      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);

      // 如果传入了音频链接，则优先进行ASR识别
      if (body?.audioUrl) {
        const url = body.audioUrl;
        const resp = await axios.get(url, { responseType: 'arraybuffer' });
        const buf: Buffer = Buffer.from(resp.data);
        const lower = url.toLowerCase();
        const mime = lower.endsWith('.mp3')
          ? 'audio/mpeg'
          : lower.endsWith('.aac')
          ? 'audio/aac'
          : lower.endsWith('.amr')
          ? 'audio/amr'
          : lower.endsWith('.ogg') || lower.endsWith('.opus')
          ? 'audio/ogg'
          : 'audio/wav';
        const audioBase64 = `data:${mime};base64,${buf.toString('base64')}`;
        const asr = await this.voiceService.asr({ audioBase64 } as any);
        const text = (asr?.text || '').trim();
        if (text) body.prompt = text;
      }
      if (!body?.prompt || body.prompt.trim() === '') {
        throw new HttpException('提问信息不能为空！', HttpStatus.BAD_REQUEST);
      }

      // 构造伪造的 req.user 以复用服务逻辑
      const fakeReq: any = { user: { id: userId } };
      return this.chatService.chatProcess(body as any, fakeReq, res);
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '对话处理失败';
      return res.status(status).json({ code: status, message });
    }
  }

  @Post('tts-process')
  @ApiOperation({ summary: '【开放】TTS 文字转语音（无鉴权，需显式传 userId）' })
  @ApiBody({
    schema: { type: 'object', properties: { userId: { type: 'number' }, chatId: { type: 'number' }, prompt: { type: 'string' } }, required: ['userId', 'prompt'] },
  })
  ttsProcess(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    const { userId } = body || {};
    if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);
    const fakeReq: any = { user: { id: userId } };
    return this.chatService.ttsProcess(body, fakeReq, res);
  }

  @Post('chat-process-voice')
  @ApiOperation({ summary: '【开放】语音对话（无鉴权，需显式传 userId；audioUrl 或 audioBase64）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number' },
        audioUrl: { type: 'string' },
        audioBase64: { type: 'string' },
        model: { type: 'string' },
        modelName: { type: 'string' },
        modelType: { type: 'number' },
        modelAvatar: { type: 'string' },
        appId: { type: 'number' },
        options: { type: 'object' },
        usingPluginId: { type: 'number' },
        extraParam: { type: 'object' },
      },
      required: ['userId'],
    },
  })
  async chatProcessVoice(
    @Body()
    body: {
      userId: number;
      audioUrl?: string;
      audioBase64?: string;
      model?: string;
      modelName?: string;
      modelType?: number;
      modelAvatar?: string;
      appId?: number;
      options?: any;
      usingPluginId?: number;
      extraParam?: any;
    },
    @Req() _req: Request,
    @Res() res: Response,
  ) {
    try {
      const { userId, audioUrl, audioBase64 } = body || ({} as any);
      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);
      let base64 = audioBase64;
      if (!base64 && audioUrl) {
        const url = audioUrl;
        const resp = await axios.get(url, { responseType: 'arraybuffer' });
        const buf: Buffer = Buffer.from(resp.data);
        const lower = url.toLowerCase();
        const mime = lower.endsWith('.mp3')
          ? 'audio/mpeg'
          : lower.endsWith('.aac')
          ? 'audio/aac'
          : lower.endsWith('.amr')
          ? 'audio/amr'
          : lower.endsWith('.ogg') || lower.endsWith('.opus')
          ? 'audio/ogg'
          : 'audio/wav';
        base64 = `data:${mime};base64,${buf.toString('base64')}`;
      }
      if (!base64) throw new HttpException('请提供 audioUrl 或 audioBase64', HttpStatus.BAD_REQUEST);

      const asr = await this.voiceService.asr({ audioBase64: base64 } as any);
      const text = (asr?.text || '').trim();
      if (!text) {
        throw new HttpException('未识别到有效语音内容', HttpStatus.BAD_REQUEST);
      }

      const payload: any = { ...body, prompt: text };
      const fakeReq: any = { user: { id: userId } };
      return this.chatService.chatProcess(payload, fakeReq, res);
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '语音对话处理失败';
      return res.status(status).json({ code: status, message });
    }
  }

  @Get('affection/status')
  @ApiOperation({ summary: '【开放】获取某用户在某app的好感度与阶段（无鉴权，需显式传 userId, appId）' })
  @ApiQuery({ name: 'userId', type: Number, required: true })
  @ApiQuery({ name: 'appId', type: Number, required: true })
  async affectionStatus(@Query('userId') userId: string, @Query('appId') appId: string) {
    if (!userId || !appId) {
      throw new HttpException('userId, appId 必填', HttpStatus.BAD_REQUEST);
    }
    const data = await this.affectionService.getUserAffection(userId as any, Number(appId));
    return { success: true, data };
  }

}

