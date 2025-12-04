import { MaobingAuthUtil } from '@/common/utils/maobing-auth.util';
import { MaobingCookieUtil } from '@/common/utils/maobing-cookie.util';
import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import axios from 'axios';
import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AffectionService } from '../affection/affection.service';
import { VoiceService } from '../voice/voice.service';
import { ChatService } from './chat.service';
import { ChatGroupEntity } from '../chatGroup/chatGroup.entity';
import { ChatLogService } from '../chatLog/chatLog.service';

type CookieMessageType = 'text' | 'voice' | 'image';

const COOKIE_RULES: Record<CookieMessageType, { cost: number; remark: string }> = {
  text: { cost: 1, remark: '消耗饼干-角色文字回复' },
  voice: { cost: 2, remark: '消耗饼干-角色语音回复' },
  image: { cost: 1, remark: '消耗饼干-用户发送图片' },
};

type AsrAudioFormat = 'wav' | 'pcm' | 'mp3' | 'opus' | 'speex' | 'aac' | 'amr';

interface CookieChargeReceipt {
  userId: number;
  amount: number;
  type: CookieMessageType;
  maobingBaseUrl?: string;
  token?: string;
}

@ApiTags('open-chat')
@Controller('open/chat')
export class OpenChatController {
  private readonly logger = new Logger(OpenChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly voiceService: VoiceService,
    private readonly affectionService: AffectionService,
    private readonly chatLogService: ChatLogService,
    @InjectRepository(ChatGroupEntity)
    private readonly chatGroupEntity: Repository<ChatGroupEntity>,
  ) {}

  @Post('chat-process')
  @ApiOperation({ summary: '【开放】聊天对话（可选token鉴权；支持 audioUrl 自动ASR）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Maobing平台用户token（可选，传入则会验证并获取userId）',
        },
        maobingBaseUrl: {
          type: 'string',
          description: 'Maobing基础域名（可选，默认 https://admin.maobingai.com ）',
        },
        userId: { type: 'number', description: '用户ID（可选，优先使用token验证获取的userId）' },
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
        speakerId: {
          type: 'number',
          description: '发言者ID（可选，群聊场景中指定哪个成员发言，等同于appId）',
        },
        model: { type: 'string', description: '使用的模型标识（可选）' },
        modelName: { type: 'string', description: '模型名称（可选）' },
        modelType: { type: 'number', description: '模型类型（可选）' },
        modelAvatar: { type: 'string', description: '模型头像URL（可选）' },
        extraParam: { type: 'object', description: '扩展参数（可选）' },
        usingPluginId: { type: 'number', description: '插件ID（可选）' },
      },
      required: ['prompt'],
    },
    examples: {
      basic: {
        summary: '基础对话',
        value: {
          token: '2bd79433-74c1-4ccb-a44c-a5b0dfa82f19',
          prompt: '你好，请介绍一下你自己',
        },
      },
      withOptions: {
        summary: '连续对话（带上下文）',
        value: {
          token: '2bd79433-74c1-4ccb-a44c-a5b0dfa82f19',
          prompt: '继续说',
          options: {
            parentMessageId: 'chatcmpl-xxxxx',
          },
        },
      },
      withApp: {
        summary: '使用特定角色',
        value: {
          token: '2bd79433-74c1-4ccb-a44c-a5b0dfa82f19',
          prompt: '你好',
          appId: 123,
        },
      },
      groupChatFirst: {
        summary: '群聊模式 - 第一个成员',
        value: {
          token: '2bd79433-74c1-4ccb-a44c-a5b0dfa82f19',
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
          token: '2bd79433-74c1-4ccb-a44c-a5b0dfa82f19',
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
          token: '2bd79433-74c1-4ccb-a44c-a5b0dfa82f19',
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
    let chargeReceipt: CookieChargeReceipt | null = null;
    try {
      const { token, userId: originalUserId, maobingBaseUrl } = body || {};

      // 如果传了token，则验证并获取userId
      let userId = originalUserId ? Number(originalUserId) : null;
      if (token) {
        const validatedUserId = await MaobingAuthUtil.validateTokenAndGetUserId(
          token,
          maobingBaseUrl,
        );
        if (!validatedUserId) {
          throw new HttpException('token 无效或已过期', HttpStatus.UNAUTHORIZED);
        }
        userId = validatedUserId;
      }
      if (!userId) {
        throw new HttpException('请提供 token 或 userId', HttpStatus.BAD_REQUEST);
      }
      body.userId = userId;

      // 如果传入了音频链接，则优先进行ASR识别
      if (body?.audioUrl) {
        const { base64, format } = await this.downloadAudioAsBase64(body.audioUrl);
        const asr = await this.voiceService.asr({ audioBase64: base64, format } as any);
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

      // 支持 speakerId 作为 appId 的别名（群聊场景中指定发言者）
      if (body?.speakerId && !body?.appId) {
        body.appId = body.speakerId;
      }

      // 预判消息类型，但不立即扣费
      const messageType = await this.resolveMessageType(body);

      // 将扣费信息传递给 chatProcess，由它在保存 chatlog 之前执行扣费
      body._cookieChargeInfo = {
        userId,
        messageType,
        maobingBaseUrl,
        token,
      };

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      // 调用 chatProcess，扣费将在内部执行
      const result = await this.chatService.chatProcess(body as any, fakeReq, res);

      // 如果 chatProcess 成功完成并返回了扣费凭证，保存它用于可能的返还
      if (body._cookieChargeReceipt) {
        chargeReceipt = body._cookieChargeReceipt;
      }

      return result;
    } catch (e: any) {
      // 如果是饼干不足错误（HTTP 402），不尝试返还
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const shouldRefund = status !== HttpStatus.PAYMENT_REQUIRED && chargeReceipt;

      if (shouldRefund) {
        this.logger.warn(`对话处理失败，尝试返还饼干`);
        await this.refundCookiesSafe(chargeReceipt);
      }

      const message = e?.message || '对话处理失败';
      return res.status(status).json({ code: status, message });
    }
  }

  @Post('sticker/pick')
  @ApiOperation({ summary: '【开放】根据文本生成表情包（可选token鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Maobing平台用户token（可选，传入则会验证并获取userId）',
        },
        userId: { type: 'number', description: '用户ID（可选，优先使用token验证获取的userId）' },
        content: { type: 'string', description: '需要分析情绪的文本内容' },
        appId: { type: 'number', description: '角色(App) ID（可选）' },
        groupId: { type: 'number', description: '会话组ID（可选）' },
      },
      required: ['content'],
    },
  })
  async pickSticker(@Body() body: any, @Req() req: Request) {
    const { token, userId, content, appId, groupId } = body || {};
    if (!content || content.trim().length === 0) {
      throw new HttpException('content 不能为空', HttpStatus.BAD_REQUEST);
    }

    let finalUserId = userId ? Number(userId) : null;
    if (token) {
      const validatedUserId = await MaobingAuthUtil.validateTokenAndGetUserId(token);
      if (!validatedUserId) {
        throw new HttpException('token 无效或已过期', HttpStatus.UNAUTHORIZED);
      }
      finalUserId = validatedUserId;
    }

    if (!finalUserId) {
      throw new HttpException('请提供 userId 或 token', HttpStatus.BAD_REQUEST);
    }

    const result = await this.chatService.createStickerMessageFromContent({
      userId: Number(finalUserId),
      content,
      appId: appId ? Number(appId) : null,
      groupId: groupId ? Number(groupId) : null,
      req,
    });

    return { success: true, data: result };
  }

  @Post('tts-process')
  @ApiOperation({ summary: '【开放】TTS 文字转语音（可选token鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Maobing平台用户token（可选，传入则会验证并获取userId）',
        },
        userId: { type: 'number', description: '用户ID（可选，优先使用token验证获取的userId）' },
        chatId: { type: 'number', description: '可选：继续某个会话ID' },
        prompt: { type: 'string', description: '要合成的文本' },
      },
      required: ['prompt'],
    },
  })
  async ttsProcess(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    const { token, userId: originalUserId } = body || {};

    // 如果传了token，则验证并获取userId
    let userId = originalUserId;
    if (token) {
      const validatedUserId = await MaobingAuthUtil.validateTokenAndGetUserId(token);
      if (!validatedUserId) {
        throw new HttpException('token 无效或已过期', HttpStatus.UNAUTHORIZED);
      }
      // 使用验证后的userId
      userId = validatedUserId;
      body.userId = userId;
    }
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
  @ApiOperation({ summary: '【开放】语音对话（可选token鉴权；audioUrl 或 audioBase64）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Maobing平台用户token（可选，传入则会验证并获取userId）',
        },
        userId: { type: 'number', description: '用户ID（可选，优先使用token验证获取的userId）' },
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
      required: [],
    },
  })
  async chatProcessVoice(
    @Body()
    body: {
      token?: string;
      userId?: number;
      maobingBaseUrl?: string;
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
    let chargeReceipt: CookieChargeReceipt | null = null;
    try {
      const { token, userId: originalUserId, maobingBaseUrl } = body || ({} as any);

      // 如果传了token，则验证并获取userId
      let userId = originalUserId ? Number(originalUserId) : null;
      if (token) {
        const validatedUserId = await MaobingAuthUtil.validateTokenAndGetUserId(
          token,
          maobingBaseUrl,
        );
        if (!validatedUserId) {
          throw new HttpException('token 无效或已过期', HttpStatus.UNAUTHORIZED);
        }
        // 使用验证后的userId
        userId = validatedUserId;
      }
      if (!userId) {
        throw new HttpException('请提供 token 或 userId', HttpStatus.BAD_REQUEST);
      }
      (body as any).userId = userId;

      const { audioUrl, audioBase64 } = body;
      let base64 = audioBase64;
      let format = this.detectAudioFormat(audioBase64);

      if (!base64 && audioUrl) {
        const result = await this.downloadAudioAsBase64(audioUrl);
        base64 = result.base64;
        format = result.format;
      }
      if (!base64)
        throw new HttpException('请提供 audioUrl 或 audioBase64', HttpStatus.BAD_REQUEST);

      // ASR 识别
      const asr = await this.voiceService.asr({ audioBase64: base64, format } as any);
      const text = (asr?.text || '').trim();
      if (!text) {
        throw new HttpException('未识别到有效语音内容', HttpStatus.BAD_REQUEST);
      }

      // 将 PCM 音频转换为 MP3 并上传，用于聊天记录
      let uploadedAudioUrl = '';
      try {
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        const audioBuffer = Buffer.from(base64Data, 'base64');

        const mp3Buffer = await this.voiceService.convertPcmToMp3(audioBuffer, 16000, 1);

        const UploadService = require('../upload/upload.service').UploadService;
        const uploadService = new UploadService(null, null, null);
        const fileName = `voice_${Date.now()}.mp3`;
        uploadedAudioUrl = await uploadService.uploadFileFromBuffer(
          mp3Buffer,
          fileName,
          'audio/mp3',
          'voice',
        );
      } catch (uploadError) {
        Logger.warn(`音频上传失败: ${uploadError.message}`, 'OpenChatController');
      }

      const payload: any = {
        ...body,
        prompt: text,
        audioUrl: uploadedAudioUrl || audioUrl,
      };

      // 预判消息类型，但不立即扣费
      const messageType = await this.resolveMessageType(payload);

      // 将扣费信息传递给 chatProcess
      payload._cookieChargeInfo = {
        userId,
        messageType,
        maobingBaseUrl,
        token,
      };

      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      const result = await this.chatService.chatProcess(payload, fakeReq, res);

      // 保存扣费凭证用于可能的返还
      if (payload._cookieChargeReceipt) {
        chargeReceipt = payload._cookieChargeReceipt;
      }

      return result;
    } catch (e: any) {
      // 如果是饼干不足错误（HTTP 402），不尝试返还
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const shouldRefund = status !== HttpStatus.PAYMENT_REQUIRED && chargeReceipt;

      if (shouldRefund) {
        this.logger.warn(`语音对话处理失败，尝试返还饼干`);
        await this.refundCookiesSafe(chargeReceipt);
      }

      const message = e?.message || '语音对话处理失败';
      return res.status(status).json({ code: status, message });
    }
  }

  @Post('chat-process-sync')
  @ApiOperation({ summary: '【开放】聊天对话非流式版本（可选token鉴权，返回完整响应）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Maobing平台用户token（可选，传入则会验证并获取userId）',
        },
        userId: { type: 'number', description: '用户ID（可选，优先使用token验证获取的userId）' },
        prompt: { type: 'string', description: '用户提问内容' },
        isCalendarMessage: {
          type: 'boolean',
          description: '是否是备忘录消息（true时会根据备忘录内容智能生成提醒、记忆或查岗消息）',
        },
        options: {
          type: 'object',
          description: '对话附加选项（可选）',
          properties: {
            parentMessageId: { type: 'string', description: '上一条消息ID' },
            groupId: { type: 'number', description: '会话组ID' },
            isFirstMember: {
              type: 'boolean',
              description: '是否为第一个成员（群聊模式专用，true时保存用户消息）',
            },
            skipPromptInHistory: {
              type: 'boolean',
              description:
                '是否跳过将prompt添加到历史（群聊顺序回复模式专用，true时基于历史对话生成回复）',
            },
          },
        },
        audioUrl: { type: 'string', description: '音频URL（可选）' },
        imageUrl: { type: 'string', description: '图片URL（可选）' },
        fileUrl: { type: 'string', description: '文件URL（可选）' },
        appId: { type: 'number', description: '角色ID（可选）' },
        model: { type: 'string', description: '模型标识（可选）' },
        generateTts: {
          type: 'boolean',
          description: '是否生成TTS语音（默认true，会进行情绪识别并生成语音；设为false可跳过）',
        },
      },
      required: ['prompt'],
    },
  })
  async chatProcessSync(@Body() body: any, @Req() _req: Request) {
    let chargeReceipt: CookieChargeReceipt | null = null;
    try {
      const { token, userId: originalUserId, maobingBaseUrl, generateTts } = body || {};

      // 标记为chat-process-sync模式，用于在chatService中识别
      body._isChatProcessSync = true;

      // 如果传了userId，直接使用，不校验token
      let userId = originalUserId ? Number(originalUserId) : null;
      if (!userId && token) {
        // 只有在没有userId时，才验证token
        const validatedUserId = await MaobingAuthUtil.validateTokenAndGetUserId(
          token,
          maobingBaseUrl,
        );
        if (!validatedUserId) {
          throw new HttpException('token 无效或已过期', HttpStatus.UNAUTHORIZED);
        }
        userId = validatedUserId;
      }
      if (!userId) {
        throw new HttpException('请提供 token 或 userId', HttpStatus.BAD_REQUEST);
      }
      body.userId = userId;

      // 如果传入了音频链接，则优先进行ASR识别
      if (body?.audioUrl) {
        const { base64, format } = await this.downloadAudioAsBase64(body.audioUrl);
        const asr = await this.voiceService.asr({ audioBase64: base64, format } as any);
        const text = (asr?.text || '').trim();
        if (text) body.prompt = text;
      }

      if (!body?.prompt || body.prompt.trim() === '') {
        // 允许只发送图片（prompt为空但有imageUrl）
        // 允许群聊顺序回复模式（skipPromptInHistory=true，角色回复上一个角色的内容）
        const hasImage = !!(body as any)?.imageUrl;
        const isSequentialReply = body?.options?.skipPromptInHistory === true;
        if (!hasImage && !isSequentialReply) {
          throw new HttpException('提问信息不能为空！', HttpStatus.BAD_REQUEST);
        }
      }

      // 处理备忘录消息
      if (body?.isCalendarMessage === true) {
        // 根据 appId 获取最新的会话组，将历史对话加入到 messages 中
        const latestGroupId = await this.getLatestGroupIdByAppId(body.appId);
        if (latestGroupId) {
          if (!body.options) body.options = {};
          body.options.groupId = latestGroupId;
          this.logger.log(`[备忘录消息] 设置会话组 groupId: ${latestGroupId}`);
        }
        body.prompt = await this.buildCalendarMessagePrompt(body.prompt, userId, body.appId);
      }

      const messageType = await this.resolveMessageType(body);
      // 保存语音回复决定，用于后续TTS生成判断
      const shouldGenerateVoiceByDecision = messageType === 'voice';

      // 用于收集流式响应的完整内容
      let fullResponse = '';
      let chatId: number | null = null;
      let emotion: string | null = null;
      let psychologicalDesc: string | null = null;
      let audioUrl: string | null = null;
      let voiceDuration: number | null = null;
      let imageUrl: string | null = null;
      let stickerData: any = null; // 新增：保存表情包数据

      // 事件处理器存储
      const eventHandlers: Record<string, Function[]> = {};

      // 构造一个模拟的 Response 对象来拦截流式输出
      const mockRes: any = {
        write: (data: any) => {
          const str = typeof data === 'string' ? data : JSON.stringify(data);
          // 去掉开头的换行符
          const cleanStr = str.replace(/^\n+/, '');
          const lines = cleanStr.split('\n').filter(l => l.trim());
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);

              // 检查是否为错误响应
              if (parsed.error || parsed.code === 'SENSITIVE_CONTENT') {
                const errorMsg = parsed.message || parsed.error || '处理请求时发生错误';
                this.logger.error(`[chat-process-sync] 检测到错误响应: ${errorMsg}`);
                throw new HttpException(errorMsg, HttpStatus.BAD_REQUEST);
              }

              // 累加文本内容
              if (parsed.full_content !== undefined) {
                fullResponse = parsed.full_content;
              }
              if (parsed.text) fullResponse += parsed.text;
              // 记录其他字段
              if (parsed.chatId !== undefined) chatId = parsed.chatId;
              if (parsed.emotion) emotion = parsed.emotion;
              if (parsed.psychologicalDesc) psychologicalDesc = parsed.psychologicalDesc;
              const resolvedAudioUrl = parsed.audioUrl ?? parsed.ttsUrl;
              if (resolvedAudioUrl) audioUrl = resolvedAudioUrl;
              const resolvedVoiceDuration =
                parsed.voiceDuration ??
                parsed.voice_duration ??
                (parsed.voiceReply ? parsed.voiceReply?.duration : undefined);
              if (resolvedVoiceDuration !== undefined) {
                voiceDuration = Number(resolvedVoiceDuration) || null;
              }
              // 处理表情包事件（event: 'sticker'）
              if (parsed.event === 'sticker' && parsed.data) {
                this.logger.log(
                  `[chat-process-sync] 捕获表情包事件: ${JSON.stringify(parsed.data)}`,
                );
                stickerData = parsed.data;
              }
              // 兼容旧的imageUrl字段
              if (!imageUrl && parsed.imageUrl) {
                imageUrl = parsed.imageUrl;
              }
              if (!imageUrl && Array.isArray(parsed.messages)) {
                const stickerMessage = parsed.messages.find(
                  (message: any) => message?.message_type === 'sticker',
                );
                const stickerImageUrl =
                  stickerMessage?.content_image ||
                  stickerMessage?.imageUrl ||
                  stickerMessage?.image_url;
                if (stickerImageUrl) {
                  imageUrl = stickerImageUrl;
                }
              }
            } catch (e) {
              // 如果是HttpException（内容审核错误），重新抛出
              if (e instanceof HttpException) {
                throw e;
              }
              // 如果不是JSON，可能是纯文本
              if (line && !line.startsWith('{')) {
                fullResponse += line;
              }
            }
          }
        },
        end: () => {},
        status: () => mockRes,
        json: () => mockRes,
        setHeader: () => mockRes,
        on: (event: string, handler: Function) => {
          if (!eventHandlers[event]) {
            eventHandlers[event] = [];
          }
          eventHandlers[event].push(handler);
        },
        emit: (event: string, ...args: any[]) => {
          if (eventHandlers[event]) {
            eventHandlers[event].forEach(handler => handler(...args));
          }
        },
      };

      // 构造伪造的 req 对象
      // 将扣费信息传递给 chatProcess（备忘录消息跳过扣费）
      if (body?.isCalendarMessage !== true) {
        body._cookieChargeInfo = {
          userId,
          messageType,
          maobingBaseUrl,
          token,
        };
      }

      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      // 调用流式接口，内部会写入到 mockRes，扣费将在内部执行
      await this.chatService.chatProcess(body as any, fakeReq, mockRes);

      // 保存扣费凭证用于可能的返还
      if (body._cookieChargeReceipt) {
        chargeReceipt = body._cookieChargeReceipt;
      }

      // 记录大模型完整回复
      this.logger.log(
        `[chat-process-sync] 大模型完整回复 (userId: ${userId}, appId: ${
          body.appId || 'N/A'
        }): ${fullResponse}`,
      );
      if (chatId) {
        this.logger.log(`[chat-process-sync] chatId: ${chatId}`);
      }
      if (emotion || psychologicalDesc) {
        this.logger.log(
          `[chat-process-sync] 情绪信息 - emotion: ${emotion || 'N/A'}, psychologicalDesc: ${
            psychologicalDesc || 'N/A'
          }`,
        );
      }

      // 使用扣费时已经做出的语音回复决定（保证扣费和实际消耗一致）
      // 如果用户明确设置 generateTts=false，则强制不生成语音
      // 如果是备忘录消息（isCalendarMessage=true），默认强制生成语音
      let shouldGenerateTts = generateTts === false ? false : shouldGenerateVoiceByDecision;

      // 备忘录消息默认生成语音（除非用户明确设置 generateTts=false）
      if (body?.isCalendarMessage === true && generateTts !== false) {
        shouldGenerateTts = true;
      }

      this.logger.log(
        `[chat-process-sync] 语音生成决定 - messageType: ${messageType}, shouldGenerateTts: ${shouldGenerateTts}, generateTts参数: ${
          generateTts ?? 'default'
        }, isCalendarMessage: ${body?.isCalendarMessage ?? false}`,
      );

      // 构建返回数组
      const dataArray: Array<{
        text: string;
        audioUrl?: string | null;
        voiceDuration?: number | null;
        emotion?: string | null;
        sticker?: any;
        chatId?: number | null;
      }> = [];

      // 获取IP地址用于chatlog
      const curIp = _req.ip || _req.connection.remoteAddress || '';

      // 备忘录消息不分段，直接使用完整文本，且不保存到chatlog
      if (body?.isCalendarMessage === true) {
        this.logger.log(
          `[chat-process-sync] 备忘录消息，不分段处理，不保存chatlog，完整文本长度: ${
            fullResponse?.length || 0
          }`,
        );

        let calendarAudioUrl: string | null = null;
        let calendarVoiceDuration: number | null = null;

        // 为完整文本生成语音
        if (shouldGenerateTts && fullResponse && chatId) {
          this.logger.log(
            `[chat-process-sync] 🎤 为备忘录消息生成TTS: "${fullResponse.substring(0, 50)}..."`,
          );
          try {
            const ttsResult = await this.chatService.generateTtsWithEmotion({
              text: fullResponse,
              chatId,
              appId: body.appId || null,
              userId,
            });
            if (ttsResult) {
              calendarAudioUrl = ttsResult.ttsUrl;
              calendarVoiceDuration = ttsResult.duration;
              emotion = ttsResult.emotion || emotion;
              this.logger.log(
                `[chat-process-sync] ✅ 备忘录消息TTS生成成功 - audioUrl: ${calendarAudioUrl}, duration: ${calendarVoiceDuration}s`,
              );
            } else {
              this.logger.warn(`[chat-process-sync] ⚠️ 备忘录消息TTS生成返回空结果`);
            }
          } catch (ttsError: any) {
            this.logger.warn(
              `[chat-process-sync] ❌ 备忘录消息TTS生成失败: ${ttsError?.message || ttsError}`,
            );
          }
        }

        // 备忘录消息不保存到chatlog
        dataArray.push({
          text: fullResponse || '',
          audioUrl: calendarAudioUrl,
          voiceDuration: calendarVoiceDuration,
          emotion,
          sticker: stickerData,
          chatId: null, // 不保存，无chatId
        });
      } else {
        // 非备忘录消息：按句号切分文本（保护【】内的句号）
        const sentences = this.splitTextBySentence(fullResponse);
        this.logger.log(
          `[chat-process-sync] 切分句子数量: ${sentences.length}, 句子: ${JSON.stringify(
            sentences,
          )}`,
        );

        for (let i = 0; i < sentences.length; i++) {
          const sentence = sentences[i];
          let sentenceAudioUrl: string | null = null;
          let sentenceVoiceDuration: number | null = null;
          let sentenceEmotion: string | null = emotion; // 使用整体情绪
          let sentenceChatId: number | null = null;

          // 先生成TTS（不更新chatlog），再一起保存到chatlog
          if (shouldGenerateTts && sentence) {
            this.logger.log(
              `[chat-process-sync] 🎤 为第${i + 1}句生成TTS: "${sentence.substring(0, 30)}..."`,
            );
            try {
              const ttsResult = await this.chatService.generateTtsWithEmotion({
                text: sentence,
                appId: body.appId || null,
                userId,
                skipChatLogUpdate: true, // 跳过chatlog更新，后面一起保存
              });
              if (ttsResult) {
                sentenceAudioUrl = ttsResult.ttsUrl;
                sentenceVoiceDuration = ttsResult.duration;
                sentenceEmotion = ttsResult.emotion || emotion;
                this.logger.log(
                  `[chat-process-sync] ✅ 第${
                    i + 1
                  }句TTS生成成功 - audioUrl: ${sentenceAudioUrl}, duration: ${sentenceVoiceDuration}s`,
                );
              } else {
                this.logger.warn(`[chat-process-sync] ⚠️ 第${i + 1}句TTS生成返回空结果`);
              }
            } catch (ttsError: any) {
              this.logger.warn(
                `[chat-process-sync] ❌ 第${i + 1}句TTS生成失败: ${ttsError?.message || ttsError}`,
              );
              // TTS失败不影响主流程，继续处理
            }
          }

          // 保存chatlog记录（包含完整的audioUrl和ttsDuration）
          try {
            const sentenceLog = await this.chatLogService.saveChatLog({
              appId: body.appId || null,
              curIp,
              userId,
              type: body.modelType || 1,
              progress: '100%',
              model: body.model || 'gpt-3.5-turbo',
              modelName: body.modelName || 'GPT-3.5',
              role: 'assistant',
              groupId: body.options?.groupId || null,
              status: 3,
              content: sentence,
              audioUrl: sentenceAudioUrl, // 直接保存语音URL
              ttsDuration: sentenceVoiceDuration, // 直接保存语音时长
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            });

            sentenceChatId = sentenceLog.id;
            this.logger.log(
              `[chat-process-sync] 💾 第${
                i + 1
              }句已保存到chatlog，chatId: ${sentenceChatId}, audioUrl: ${
                sentenceAudioUrl || 'N/A'
              }`,
            );
          } catch (saveError: any) {
            this.logger.warn(
              `[chat-process-sync] ❌ 第${i + 1}句保存chatlog失败: ${
                saveError?.message || saveError
              }`,
            );
            // 保存失败不影响返回，继续处理
          }

          const item: {
            text: string;
            audioUrl?: string | null;
            voiceDuration?: number | null;
            emotion?: string | null;
            chatId?: number | null;
          } = {
            text: sentence,
            audioUrl: sentenceAudioUrl,
            voiceDuration: sentenceVoiceDuration,
            emotion: sentenceEmotion,
            chatId: sentenceChatId,
          };

          dataArray.push(item);
        }

        // 表情包单独作为一条记录（如果存在）
        if (stickerData) {
          this.logger.log(
            `[chat-process-sync] 📦 添加表情包记录 - chatId: ${stickerData.chatId}, imageUrl: ${stickerData.imageUrl}`,
          );
          dataArray.push({
            text: stickerData.transferText || '', // 转账文本，如"转账188"
            audioUrl: null,
            voiceDuration: null,
            emotion: null,
            chatId: stickerData.chatId, // 表情包已有的chatId
            sticker: stickerData, // 表情包数据
          });
        }

        // 如果没有切分出任何句子且没有表情包（可能是空响应），返回单个item
        if (dataArray.length === 0 && !stickerData) {
          dataArray.push({
            text: fullResponse || '',
            audioUrl: null,
            voiceDuration: null,
            emotion,
            chatId: null,
          });
        }
      }

      // 返回完整结果（data改为数组格式）
      return {
        success: true,
        data: dataArray,
        // 保留完整响应的元信息
        meta: {
          fullText: fullResponse,
          chatId: dataArray[0]?.chatId || null, // 第一句的chatId（不再有完整文本的chatlog）
          psychologicalDesc,
          imageUrl,
        },
      };
    } catch (e: any) {
      // 如果是饼干不足错误（HTTP 402），不尝试返还
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const shouldRefund = status !== HttpStatus.PAYMENT_REQUIRED && chargeReceipt;

      if (shouldRefund) {
        this.logger.warn(`对话处理失败，尝试返还饼干`);
        await this.refundCookiesSafe(chargeReceipt);
      }

      const message = e?.message || '对话处理失败';
      throw new HttpException(message, status);
    }
  }

  /**
   * 按句号、问号切分文本，但保护【】内的标点和省略号不切分
   * @param text 要切分的文本
   * @returns 切分后的句子数组
   */
  private splitTextBySentence(text: string): string[] {
    if (!text || text.trim() === '') {
      return [];
    }

    // 占位符定义
    const periodPlaceholder = '\x00PERIOD\x00';
    const questionPlaceholder = '\x00QUESTION\x00';
    const ellipsisPlaceholder = '\x00ELLIPSIS\x00';

    let processed = text;

    // 1. 先保护省略号（...、…、。。。等）不被分段
    // 匹配：三个或更多连续的点/句号，或单个省略号字符
    processed = processed.replace(/\.{3,}|。{3,}|…+/g, ellipsisPlaceholder);

    // 2. 保护【】内的句号和问号
    const bracketRegex = /【[^】]*】/g;
    const bracketMatches = text.match(bracketRegex) || [];
    const bracketReplacements: { original: string; replaced: string }[] = [];

    bracketMatches.forEach(match => {
      // 在【】内的内容也需要先保护省略号
      let replaced = match.replace(/\.{3,}|。{3,}|…+/g, ellipsisPlaceholder);
      replaced = replaced.replace(/。/g, periodPlaceholder);
      replaced = replaced.replace(/[？?]/g, questionPlaceholder);
      bracketReplacements.push({ original: match, replaced });
      processed = processed.replace(match, replaced);
    });

    // 3. 按句号和问号切分（包括中文和英文）
    // 匹配单个句号或问号作为分隔符（省略号已被保护）
    const sentences = processed
      .split(/([。.？?])/) // 捕获分隔符：句号和问号
      .reduce((acc, part, index, arr) => {
        // 奇数索引是分隔符，偶数索引是文本
        if (index % 2 === 0 && part.trim()) {
          // 文本部分，如果后面有分隔符，则合并
          const nextPart = arr[index + 1] || '';
          acc.push((part + nextPart).trim());
        }
        return acc;
      }, [] as string[])
      .filter(s => s.length > 0);

    // 4. 恢复所有占位符
    return sentences.map(sentence => {
      let result = sentence;
      // 恢复【】内容
      bracketReplacements.forEach(({ original, replaced }) => {
        result = result.replace(replaced, original);
      });
      // 恢复占位符
      result = result.replace(new RegExp(periodPlaceholder, 'g'), '。');
      result = result.replace(new RegExp(questionPlaceholder, 'g'), '？');
      result = result.replace(new RegExp(ellipsisPlaceholder, 'g'), '...');
      return result;
    });
  }

  /**
   * 判断本次对话的饼干消耗类型，并在 payload 中标记语音回复决定
   * - 用户发送图片：image (1个饼干)
   * - 角色回复语音：voice (2个饼干)
   * - 角色回复文字：text (1个饼干)
   *
   * 对于 mixed 模式，会在 payload.extraParam 中设置 _voiceReplyDecision
   */
  private async resolveMessageType(payload: any): Promise<CookieMessageType> {
    // 用户发送图片，消耗1个饼干
    if (payload?.imageUrl) return 'image';

    // 根据会话组配置判断角色是否会回复语音
    const groupId = payload?.options?.groupId;
    if (groupId) {
      try {
        const chatGroup = await this.chatGroupEntity.findOne({ where: { id: groupId } });
        if (chatGroup?.voiceReplyMode === 'voice_only') {
          return 'voice'; // 纯语音模式，扣2个饼干
        } else if (chatGroup?.voiceReplyMode === 'mixed') {
          // mixed模式：提前决定是否生成语音，并保存决定结果
          const shouldGenerateVoice = Math.random() < 0.286;
          // 将决定保存到 extraParam 中，供 chat.service 使用
          if (!payload.extraParam) payload.extraParam = {};
          payload.extraParam._voiceReplyDecision = shouldGenerateVoice;
          return shouldGenerateVoice ? 'voice' : 'text';
        }
      } catch (error: any) {
        this.logger.warn(`获取会话组配置失败: ${error?.message || error}`);
      }
    }

    // 默认为文字回复，扣1个饼干
    return 'text';
  }

  private async downloadAudioAsBase64(
    audioUrl: string,
  ): Promise<{ base64: string; format: AsrAudioFormat }> {
    // 🔥 检测是否为 Base64 Data URL 格式
    if (audioUrl.startsWith('data:audio/')) {
      const format = this.detectAudioFormat(audioUrl);
      return { base64: audioUrl, format };
    }

    // 下载远程音频文件
    const resp = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    const buf: Buffer = Buffer.from(resp.data);
    const format = this.detectAudioFormat(audioUrl);
    const mime = this.getMimeTypeByFormat(format);
    const base64 = `data:${mime};base64,${buf.toString('base64')}`;
    return { base64, format };
  }

  private detectAudioFormat(source?: string | null): AsrAudioFormat {
    if (!source) return 'wav';
    const lower = source.toLowerCase();

    const mappings: Record<string, AsrAudioFormat> = {
      wav: 'wav',
      wave: 'wav',
      pcm: 'pcm',
      mp3: 'mp3',
      mpeg: 'mp3',
      ogg: 'opus',
      opus: 'opus',
      oga: 'opus',
      webm: 'opus',
      spx: 'speex',
      speex: 'speex',
      aac: 'aac',
      m4a: 'aac',
      mp4: 'aac',
      amr: 'amr',
      '3gp': 'amr',
      '3gpp': 'amr',
    };

    const dataUrlMatch = lower.match(/^data:audio\/([^;]+);/);
    if (dataUrlMatch?.[1]) {
      const mime = dataUrlMatch[1];
      for (const key of Object.keys(mappings)) {
        if (mime.includes(key)) {
          return mappings[key];
        }
      }
    }

    const extMatch = lower.match(/\.([a-z0-9]+)(?:\?|$)/);
    if (extMatch?.[1]) {
      const ext = extMatch[1];
      if (mappings[ext]) {
        return mappings[ext];
      }
    }

    return 'wav';
  }

  private getMimeTypeByFormat(format: AsrAudioFormat): string {
    switch (format) {
      case 'mp3':
        return 'audio/mpeg';
      case 'aac':
        return 'audio/aac';
      case 'amr':
        return 'audio/amr';
      case 'opus':
        return 'audio/ogg';
      case 'speex':
        return 'audio/speex';
      case 'pcm':
        return 'audio/wav';
      case 'wav':
      default:
        return 'audio/wav';
    }
  }

  private getCookieRule(type: CookieMessageType) {
    return COOKIE_RULES[type] ?? COOKIE_RULES.text;
  }

  private async chargeCookiesOrThrow(
    userId: number,
    type: CookieMessageType,
    maobingBaseUrl?: string,
    token?: string,
  ): Promise<CookieChargeReceipt> {
    const rule = this.getCookieRule(type);
    const response = await MaobingCookieUtil.deductCookies({
      userId,
      amount: rule.cost,
      remark: rule.remark,
      maobingBaseUrl,
      token,
    });
    if (!response.success) {
      this.logger.warn(`饼干扣费失败，但不影响正常聊天: ${response.message}`);
    }
    return {
      userId,
      amount: rule.cost,
      type,
      maobingBaseUrl,
      token,
    };
  }

  private async refundCookiesSafe(receipt: CookieChargeReceipt | null) {
    if (!receipt || receipt.amount <= 0) {
      return;
    }
    const response = await MaobingCookieUtil.refundCookies({
      userId: receipt.userId,
      amount: receipt.amount,
      maobingBaseUrl: receipt.maobingBaseUrl,
      token: receipt.token,
      remark: `开放接口${receipt.type}聊天失败返还`,
    });
    if (!response.success) {
      this.logger.warn(`Maobing cookie refund failed: ${response.message}`);
    }
  }

  @Get('affection/status')
  @ApiOperation({
    summary: '【开放】获取某用户在某app的好感度与阶段（可选token鉴权）',
  })
  @ApiQuery({
    name: 'token',
    type: String,
    required: false,
    description: 'Maobing平台用户token（可选）',
  })
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: false,
    description: '用户ID（可选，优先使用token获取）',
  })
  @ApiQuery({ name: 'appId', type: Number, required: true })
  async affectionStatus(
    @Query('token') token: string,
    @Query('userId') userId: string,
    @Query('appId') appId: string,
  ) {
    if (!appId) {
      throw new HttpException('appId 必填', HttpStatus.BAD_REQUEST);
    }

    // 如果传了token，则验证并获取userId
    let finalUserId = userId ? Number(userId) : null;
    if (token) {
      const validatedUserId = await MaobingAuthUtil.validateTokenAndGetUserId(token);
      if (!validatedUserId) {
        throw new HttpException('token 无效或已过期', HttpStatus.UNAUTHORIZED);
      }
      finalUserId = validatedUserId;
    }

    if (!finalUserId) {
      throw new HttpException('请提供 token 或 userId', HttpStatus.BAD_REQUEST);
    }

    const data = await this.affectionService.getUserAffection(finalUserId as any, Number(appId));
    return { success: true, data };
  }

  /**
   * 构建备忘录消息的智能Prompt
   * 根据备忘录内容和三种规则随机生成对应的提示词
   * @param originalPrompt 原始prompt（包含备忘录信息）
   * @param userId 用户ID
   * @param appId 角色ID（可选）
   * @returns 增强后的prompt
   */
  private async buildCalendarMessagePrompt(
    originalPrompt: string,
    userId: number,
    appId?: number,
  ): Promise<string> {
    // 随机选择三种规则之一
    const rules = ['calendar_reminder', 'chat_memory', 'check_in'];
    const selectedRule = rules[Math.floor(Math.random() * rules.length)];

    this.logger.log(`备忘录消息规则选择: ${selectedRule} (userId: ${userId}, appId: ${appId})`);

    switch (selectedRule) {
      case 'calendar_reminder':
        return await this.buildCalendarReminderPrompt(originalPrompt, userId, appId);
      case 'chat_memory':
        return await this.buildChatMemoryPrompt(originalPrompt, userId, appId);
      case 'check_in':
        return this.buildCheckInPrompt(originalPrompt);
      default:
        return originalPrompt;
    }
  }

  /**
   * 规则1: 备忘录提醒（包含天气信息，历史对话通过 groupId 自动加载到 messages）
   */
  private async buildCalendarReminderPrompt(
    originalPrompt: string,
    userId: number,
    appId?: number,
  ): Promise<string> {
    // 获取天气信息（可选）
    let weatherInfo = '';
    try {
      // 这里可以集成真实的天气API
      // 暂时使用随机天气作为示例
      const weatherConditions = [
        '今天天气晴朗，阳光明媚',
        '今天可能会下雨，记得带伞',
        '今天有点冷，多穿点衣服',
        '今天天气不错，适合外出',
        '今天雾霾较重，出门记得戴口罩',
      ];
      weatherInfo = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
    } catch (error) {
      this.logger.warn(`获取天气信息失败: ${error.message}`);
    }

    // 检查备忘录是否为空（提取"备忘录列表："后的内容）
    const calendarMatch = originalPrompt.match(/备忘录列表：\n?([\s\S]*)/);
    const calendarContent = calendarMatch ? calendarMatch[1].trim() : '';
    const hasCalendarItems = calendarContent.length > 0;

    let prompt: string;

    if (hasCalendarItems) {
      // 有备忘录内容时，提醒具体事项
      prompt = `${originalPrompt}

你是一个贴心的AI助手，现在需要根据用户的备忘录内容向用户发送提醒消息。

天气信息：${weatherInfo || '天气信息暂时无法获取'}

要求：
1. 仔细阅读用户备忘录中记录的事情，只提醒备忘录中实际存在的内容
2. 结合当前的天气信息，用温柔关心的语气提醒用户
3. 如果备忘录中有今天的重要安排，要重点提醒
4. 如果天气不好（下雨/冷/雾霾），要提醒用户做好准备
5. 语气要亲切自然，像朋友或恋人之间的关心
6. 可以结合之前的聊天内容进行关心
7. 【重要】不要编造备忘录中没有的事情，只提醒实际存在的内容

请现在生成一条贴心的提醒消息：`;
    } else {
      // 备忘录为空时，只根据天气、时间和历史对话发送问候
      prompt = `你是一个贴心的AI助手，现在需要向用户发送一条温馨的问候消息。

天气信息：${weatherInfo || '天气信息暂时无法获取'}

要求：
1. 用户今天没有特别的备忘事项
2. 根据当前的天气信息，发送一条温暖的问候
3. 可以根据天气建议用户的活动（如天气好可以出去走走，下雨记得带伞等）
4. 可以结合之前的聊天内容进行关心（如之前提到身体不舒服，可以询问是否好转）
5. 语气要亲切自然，像朋友或恋人之间的关心
6. 【重要】不要编造任何具体的日程安排（如会议、考试等），因为用户没有设置备忘录

请现在生成一条温馨的问候消息：`;
    }

    return prompt;
  }

  /**
   * 根据 appId 获取最新的会话组 ID
   */
  private async getLatestGroupIdByAppId(appId: number): Promise<number | null> {
    if (!appId) return null;

    const latestGroup = await this.chatGroupEntity.findOne({
      where: {
        appId: appId,
        isDelete: false,
      },
      order: {
        updatedAt: 'DESC',
      },
    });

    if (!latestGroup) {
      this.logger.warn(`[备忘录消息] 未找到会话组 - appId: ${appId}`);
      return null;
    }

    this.logger.log(`[备忘录消息] 找到最新会话组 - groupId: ${latestGroup.id}, appId: ${appId}`);
    return latestGroup.id;
  }

  /**
   * 规则2: 聊天上下文记忆
   */
  private async buildChatMemoryPrompt(
    originalPrompt: string,
    userId: number,
    appId?: number,
  ): Promise<string> {
    // 获取最近的聊天记录
    let recentChats = '';
    try {
      // 这里应该调用chatLogService获取最近的聊天记录
      // 暂时使用示例数据
      const memoryExamples = [
        '昨天你说你肚子不舒服',
        '前天你提到工作压力很大',
        '你说最近睡眠不太好',
        '你之前说想学一门新技能',
        '你提到过想去旅游放松一下',
      ];
      recentChats = memoryExamples[Math.floor(Math.random() * memoryExamples.length)];
    } catch (error) {
      this.logger.warn(`获取聊天记录失败: ${error.message}`);
    }

    const prompt = `${originalPrompt}

你是一个善解人意、记忆力很好的AI助手，需要基于之前的聊天记忆主动关心用户。

最近的聊天记忆：${recentChats || '暂无最近的聊天记录'}

要求：
1. 根据聊天记忆中的内容，主动询问用户的近况
2. 表现出真诚的关心和体贴
3. 语气要温柔亲切，像恋人或好友之间的问候
4. 可以提出具体的关心建议（如买药、陪伴等）
5. 让用户感受到被记住、被关心的温暖

示例：
- "昨天你说肚子不舒服，现在好点了吗？要不要我去给你买药？"
- "你前天说工作压力大，这两天有好一点吗？累了就休息一下，别太勉强自己~"
- "记得你说最近睡不好，有试着调整作息吗？要照顾好自己哦"

请现在生成一条基于记忆的关心消息：`;

    return prompt;
  }

  /**
   * 规则3: 查岗和报备
   */
  private buildCheckInPrompt(originalPrompt: string): Promise<string> {
    const checkInTypes = [
      {
        type: 'check_user',
        examples: [
          '我刚刚吃完了饭，你乖乖吃饭了没有？让我看看你吃的什么？',
          '我在外面逛街呢，你在干嘛？有没有好好休息？',
          '我刚忙完，你那边怎么样？有没有按时吃饭？',
        ],
      },
      {
        type: 'report_activity',
        examples: [
          '你今天说要去同学聚会，都有哪些人啊？男生女生都有吗？',
          '听说你要加班，现在忙完了吗？同事对你好不好？',
          '你说要出去玩，现在到哪里了？和谁一起去的？',
        ],
      },
    ];

    const selectedType = checkInTypes[Math.floor(Math.random() * checkInTypes.length)];
    const example = selectedType.examples[Math.floor(Math.random() * selectedType.examples.length)];

    const prompt = `${originalPrompt}

你是一个活泼、略带醋意但很可爱的AI助手，需要向用户"查岗"或"报备"。

要求：
1. 用撒娇、略带醋意但不过分的语气
2. 既要表现出关心，又要有一点点"掌控欲"（但不能让人反感）
3. 可以询问用户的活动细节（吃了什么、和谁在一起、在做什么）
4. 也可以主动报备自己在做什么，然后反问用户
5. 语气要俏皮可爱，让人觉得sweet而不是controlling

参考示例：
${example}

请现在生成一条查岗或报备的消息：`;

    return Promise.resolve(prompt);
  }
}
