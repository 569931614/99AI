import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import axios from 'axios';
import { JwtAuthGuard } from '../../common/auth/jwtAuth.guard';
import { VoiceService } from '../voice/voice.service';
import { ChatService } from './chat.service';

import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ChatProcessDto } from './dto/chatProcess.dto';

@ApiTags('chatgpt')
@Controller('chatgpt')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly voiceService: VoiceService,
  ) {}

  @Post('chat-process')
  @ApiOperation({ summary: 'gpt聊天对话（支持携带audioUrl，服务端自动ASR转文字）' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async chatProcess(@Body() body: ChatProcessDto, @Req() req: Request, @Res() res: Response) {
    try {
      // 如果传入了音频链接，则优先进行ASR识别，识别结果将覆盖prompt
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
        // 允许只发送图片（prompt为空但有imageUrl）
        // 允许群聊自动对话模式（skipPromptInHistory=true）
        const isAutoChat = body?.options?.skipPromptInHistory === true;
        if (!(body as any)?.imageUrl && !isAutoChat) {
          throw new HttpException('提问信息不能为空！', HttpStatus.BAD_REQUEST);
        }
      }
      return this.chatService.chatProcess(body as any, req, res);
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '对话处理失败';
      return res.status(status).json({ code: status, message });
    }
  }

  @Post('tts-process')
  @ApiOperation({ summary: 'tts语音播报' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  ttsProcess(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    return this.chatService.ttsProcess(body, req, res);
  }

  @Post('chat-process-voice')
  @ApiOperation({
    summary: '语音对话：传入音频URL或Base64，服务端识别后转文本并发给大模型（流式返回）',
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async chatProcessVoice(
    @Body()
    body: {
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
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      let audioBase64 = body?.audioBase64;
      if (!audioBase64) {
        const url = body?.audioUrl;
        if (!url) throw new HttpException('audioUrl 或 audioBase64 必填', HttpStatus.BAD_REQUEST);
        const resp = await axios.get(url, { responseType: 'arraybuffer' });
        const buf: Buffer = Buffer.from(resp.data);
        // 尝试根据URL后缀推断mime，默认wav
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
        audioBase64 = `data:${mime};base64,${buf.toString('base64')}`;
      }

      const asr = await this.voiceService.asr({ audioBase64 } as any);
      const text = (asr?.text || '').trim();
      if (!text) {
        throw new HttpException('未识别到有效语音内容', HttpStatus.BAD_REQUEST);
      }

      // 复用文字对话接口，保持流式返回
      const payload: any = {
        prompt: text,
        model: body?.model,
        modelName: body?.modelName,
        modelType: body?.modelType,
        modelAvatar: body?.modelAvatar,
        appId: body?.appId,
        options: body?.options,
        usingPluginId: body?.usingPluginId,
        extraParam: body?.extraParam,
      };
      return this.chatService.chatProcess(payload, req, res);
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '语音对话处理失败';
      return res.status(status).json({ code: status, message });
    }
  }
}
