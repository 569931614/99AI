import { Process, Processor } from '@nestjs/bull';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios from 'axios';
import { Job } from 'bull';
import { ChatService } from '../chat/chat.service';
import { VoiceService } from '../voice/voice.service';
import { ChatQueueService, ChatTaskData } from './chatQueue.service';

@Processor('chat-queue')
export class ChatQueueProcessor {
  private readonly logger = new Logger(ChatQueueProcessor.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly voiceService: VoiceService,
    private readonly chatQueueService: ChatQueueService,
  ) {}

  @Process('process-chat')
  async handleChatTask(job: Job<ChatTaskData>) {
    const { taskId, userId, body, headers, ip } = job.data;

    this.logger.log(`Processing chat task ${taskId} for user ${userId}`);

    try {
      // 标记任务为处理中
      await this.chatQueueService.markTaskProcessing(taskId);

      // 更新进度: 10% - 开始处理
      await job.progress(10);
      await this.chatQueueService.updateTaskProgress(taskId, 10);

      // 如果传入了音频链接，则优先进行ASR识别
      if (body?.audioUrl) {
        this.logger.log(`Task ${taskId}: Processing audio URL`);
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

        await job.progress(30);
        await this.chatQueueService.updateTaskProgress(taskId, 30);
      }

      if (!body?.prompt || body.prompt.trim() === '') {
        // 允许只发送图片（prompt为空但有imageUrl）
        // 允许群聊顺序回复模式（skipPromptInHistory=true）
        const hasImage = !!(body as any)?.imageUrl;
        const isSequentialReply = body?.options?.skipPromptInHistory === true;
        if (!hasImage && !isSequentialReply) {
          throw new HttpException('提问信息不能为空！', HttpStatus.BAD_REQUEST);
        }
      }

      // 更新进度: 40% - 准备调用AI
      await job.progress(40);
      await this.chatQueueService.updateTaskProgress(taskId, 40);

      // 用于收集流式响应的完整内容
      let fullResponse = '';
      let chatId: number | null = null;
      let emotion: string | null = null;
      let psychologicalDesc: string | null = null;
      let audioUrl: string | null = null;
      let voiceDuration: number | null = null;
      let imageUrl: string | null = null;

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

              // 根据内容长度更新进度 (40-90%)
              const estimatedProgress = Math.min(90, 40 + fullResponse.length / 10);
              job.progress(estimatedProgress).catch(() => {});
              this.chatQueueService.updateTaskProgress(taskId, estimatedProgress).catch(() => {});
            } catch (e) {
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
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => headers[name.toLowerCase()],
        headers: headers,
        connection: {},
        socket: {},
        ip: ip,
      };

      // 调用流式接口，内部会写入到 mockRes
      await this.chatService.chatProcess(body as any, fakeReq, mockRes);

      // 更新进度: 95% - 处理完成
      await job.progress(95);
      await this.chatQueueService.updateTaskProgress(taskId, 95);

      // 标记任务完成
      await this.chatQueueService.markTaskCompleted(taskId, {
        text: fullResponse,
        chatId,
        emotion,
        psychologicalDesc,
        audioUrl,
        voiceDuration,
        imageUrl,
      });

      // 更新进度: 100% - 完成
      await job.progress(100);

      this.logger.log(`Task ${taskId} completed successfully`);

      return {
        taskId,
        success: true,
      };
    } catch (error: any) {
      this.logger.error(`Task ${taskId} failed: ${error.message}`, error.stack);

      // 标记任务失败
      await this.chatQueueService.markTaskFailed(taskId, error.message);

      throw error;
    }
  }
}
