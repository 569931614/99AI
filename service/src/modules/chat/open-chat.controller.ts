import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
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
        userId: { type: 'number', description: '外部用户ID（任意数字即可，用于区分不同用户会话）' },
        prompt: { type: 'string', description: '用户提问内容；若传 audioUrl 将自动识别为文本' },
        options: {
          type: 'object',
          description: '对话附加选项（可选）',
          properties: {
            parentMessageId: { type: 'string', description: '上一条消息ID，用于连续对话' },
            groupId: { type: 'number', description: '会话组ID' },
            isFirstMember: {
              type: 'boolean',
              description: '是否为第一个成员（群聊模式专用，true时保存用户消息）',
            },
            skipPromptInHistory: {
              type: 'boolean',
              description:
                '是否跳过将prompt添加到历史（群聊自动对话模式专用，true时不将prompt加入上下文）',
            },
            skipSaveToDatabase: {
              type: 'boolean',
              description: '是否跳过保存到数据库（true时prompt会加入上下文但不保存到chatLog表）',
            },
          },
        },
        audioUrl: { type: 'string', description: '音频URL，自动进行ASR识别为文本（可选）' },
        imageUrl: { type: 'string', description: '图片URL（可选）' },
        fileUrl: { type: 'string', description: '文件URL（可选）' },
        appId: { type: 'number', description: '角色(App) ID（可选）' },
        model: { type: 'string', description: '使用的模型标识（可选）' },
        modelName: { type: 'string', description: '模型名称（可选）' },
        modelType: { type: 'number', description: '模型类型（可选）' },
        modelAvatar: { type: 'string', description: '模型头像URL（可选）' },
        extraParam: { type: 'object', description: '扩展参数（可选）' },
        usingPluginId: { type: 'number', description: '插件ID（可选）' },
      },
      required: ['userId', 'prompt'],
    },
    examples: {
      basic: {
        summary: '基础对话',
        value: {
          userId: 1001,
          prompt: '你好，请介绍一下你自己',
        },
      },
      withOptions: {
        summary: '连续对话（带上下文）',
        value: {
          userId: 1001,
          prompt: '继续说',
          options: {
            parentMessageId: 'chatcmpl-xxxxx',
          },
        },
      },
      withApp: {
        summary: '使用特定角色',
        value: {
          userId: 1001,
          prompt: '你好',
          appId: 123,
        },
      },
      groupChatFirst: {
        summary: '群聊模式 - 第一个成员',
        value: {
          userId: 1001,
          prompt: '大家好，请自我介绍',
          appId: 101,
          options: {
            groupId: 456,
            isFirstMember: true,
          },
        },
      },
      groupChatOther: {
        summary: '群聊模式 - 后续成员',
        value: {
          userId: 1001,
          prompt: '大家好，请自我介绍',
          appId: 102,
          options: {
            groupId: 456,
            isFirstMember: false,
          },
        },
      },
      groupChatAuto: {
        summary: '群聊自动对话 - 角色自动发言（无需用户提问）',
        value: {
          userId: 1001,
          prompt: '',
          appId: 102,
          options: {
            groupId: 456,
            isFirstMember: false,
            skipPromptInHistory: true,
          },
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
        // 允许只发送图片（prompt为空但有imageUrl）
        // 允许群聊自动对话模式（skipPromptInHistory=true）
        const isAutoChat = body?.options?.skipPromptInHistory === true;
        if (!(body as any)?.imageUrl && !isAutoChat) {
          throw new HttpException('提问信息不能为空！', HttpStatus.BAD_REQUEST);
        }
      }

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };
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
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID（任意数字即可）' },
        chatId: { type: 'number', description: '可选：继续某个会话ID' },
        prompt: { type: 'string', description: '要合成的文本' },
      },
      required: ['userId', 'prompt'],
    },
  })
  ttsProcess(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    const { userId } = body || {};
    if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);
    const fakeReq: any = {
      user: { id: userId, role: 'visitor' },
      header: (name: string) => _req.header(name),
      headers: _req.headers,
      connection: _req.connection,
      socket: _req.socket,
      ip: _req.ip,
    };
    return this.chatService.ttsProcess(body, fakeReq, res);
  }

  @Post('chat-process-voice')
  @ApiOperation({ summary: '【开放】语音对话（无鉴权，需显式传 userId；audioUrl 或 audioBase64）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID（任意数字即可，用于区分不同用户会话）' },
        audioUrl: { type: 'string', description: '音频URL（与 audioBase64 二选一）' },
        audioBase64: { type: 'string', description: '音频base64（与 audioUrl 二选一）' },
        model: { type: 'string', description: '使用的模型标识（可选）' },
        modelName: { type: 'string', description: '模型名称（可选）' },
        modelType: { type: 'number', description: '模型类型（可选）' },
        modelAvatar: { type: 'string', description: '模型头像URL（可选）' },
        appId: { type: 'number', description: '角色(App) ID（可选）' },
        options: { type: 'object', description: '对话附加选项（可选）' },
        usingPluginId: { type: 'number', description: '插件ID（可选）' },
        extraParam: { type: 'object', description: '扩展参数（可选）' },
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
      if (!base64)
        throw new HttpException('请提供 audioUrl 或 audioBase64', HttpStatus.BAD_REQUEST);

      const asr = await this.voiceService.asr({ audioBase64: base64 } as any);
      const text = (asr?.text || '').trim();
      if (!text) {
        throw new HttpException('未识别到有效语音内容', HttpStatus.BAD_REQUEST);
      }

      const payload: any = { ...body, prompt: text };
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };
      return this.chatService.chatProcess(payload, fakeReq, res);
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '语音对话处理失败';
      return res.status(status).json({ code: status, message });
    }
  }

  @Get('affection/status')
  @ApiOperation({
    summary: '【开放】获取某用户在某app的好感度与阶段（无鉴权，需显式传 userId, appId）',
  })
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
