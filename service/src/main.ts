import { TypeOrmQueryFailedFilter } from '@/common/filters/typeOrmQueryFailed.filter';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { CustomLoggerService } from '@/common/logger/custom-logger.service';
import { FastXmlMiddleware } from '@/common/middleware/fast-xml-middleware';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import { randomBytes } from 'crypto';
import * as Dotenv from 'dotenv';
import * as fs from 'fs';
import Redis from 'ioredis';
import * as path from 'path';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/allExceptions.filter';
import { OpenAIChatService } from './modules/aiTool/chat/chat.service';
import { VoiceService } from './modules/voice/voice.service';
Dotenv.config({ path: '.env' });

/**
 * 查找文件的多种可能路径
 * @param filename 文件名
 * @returns 找到的文件路径或null
 */
function findFilePath(filename: string): string | null {
  const possiblePaths = [
    path.join(process.cwd(), filename), // 当前工作目录
    path.join(__dirname, '..', filename), // 应用根目录
    path.join(__dirname, filename), // 与主程序同级
    path.resolve(filename), // 绝对路径解析
    path.join(process.cwd(), '..', filename), // 上级目录
    path.join(process.cwd(), 'dist', filename), // dist目录
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

async function bootstrap() {
  console.log('\n======================================');
  console.log('        AI服务启动中...            ');
  console.log('======================================\n');

  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB || 0),
  });

  // 尝试获取现有的 JWT_SECRET
  const existingSecret = await redis.get('JWT_SECRET');

  if (!existingSecret) {
    // 如果不存在，生成新的 JWT_SECRET
    const jwtSecret = randomBytes(256).toString('base64');
    Logger.log('Generating and setting new JWT_SECRET');
    await redis.set('JWT_SECRET', jwtSecret);
  }

  // 导入初始化数据库函数
  const { initDatabase } = require('./modules/database/initDatabase');

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // 在应用配置后，但在监听端口前初始化数据库表结构
  try {
    Logger.log('正在预初始化数据库结构...', 'Bootstrap');
    await initDatabase();
    Logger.log('数据库结构预初始化完成', 'Bootstrap');
  } catch (dbError) {
    Logger.error(`数据库预初始化失败: ${dbError.message}`, 'Bootstrap');
    // 即使失败也继续启动应用
  }

  // 根据环境变量设置全局 Logger
  app.useLogger(app.get(CustomLoggerService));

  // 使用我们的自定义XML中间件替代express-xml-bodyparser
  const xmlMiddleware = new FastXmlMiddleware();
  app.use(xmlMiddleware.use.bind(xmlMiddleware));

  app.use(
    // Re-enable compression
    compression({
      filter: (req, res) => {
        // 对流式响应路由禁用压缩
        if (req.path.includes('/api/chatgpt/chat-process')) {
          return false;
        }
        return compression.filter(req, res);
      },
    }),
  );

  // 启用并配置 CORS
  app.enableCors({
    origin: '*', // 或者配置允许的具体域名
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // app.enableCors();
  app.setGlobalPrefix('/api', {
    exclude: [{ path: '*', method: RequestMethod.GET }], // 排除GET请求的通配符路由
  });
  app.useGlobalInterceptors(new TransformInterceptor()); // Re-enable TransformInterceptor
  app.useGlobalFilters(new TypeOrmQueryFailedFilter());
  app.useGlobalFilters(new AllExceptionsFilter()); // Re-enable AllExceptionsFilter
  app.useGlobalPipes(new ValidationPipe());
  app.getHttpAdapter().getInstance().set('views', 'templates/pages');
  app.getHttpAdapter().getInstance().set('view engine', 'hbs');

  // 只在测试环境下启用Swagger
  // 构建 Swagger 文档（开发环境提供完整UI；生产环境始终提供开放接口文档JSON+开放UI）
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI服务 开放 API')
    .setDescription(
      `
# AI服务 API 文档

## 开放接口说明

所有 \`/api/open/*\` 路径下的接口均为**开放接口**，可直接调用（当前无需鉴权）。

## WebSocket 实时语音通话

**地址**: \`ws://your-domain/api/realtime/voice-call\`

### 功能特性
- ✅ 实时语音识别（ASR）
- ✅ AI 智能对话（LLM）
- ✅ 语音合成播报（TTS）
- ✅ 情绪识别与音色切换
- ✅ 好感度系统集成
- ✅ VAD 智能打断

### 使用流程
1. 建立 WebSocket 连接
2. 发送 \`start_call\` 消息（包含 userId, appId 等配置）
3. 发送音频数据（二进制 PCM/WAV）
4. 接收 ASR、LLM、TTS 事件和音频流
5. 发送 \`stop\` 触发识别，或 \`cancel\` 打断播放
6. 发送 \`end_call\` 或关闭连接结束通话

### 详细文档
请查看项目根目录：
- \`VOICE_CALL_API.md\` - 完整技术文档
- \`VOICE_CALL_QUICK_START.md\` - 快速上手指南
- \`API_OVERVIEW.md\` - 接口总览

## HTTP 接口
`,
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('open-app', '【角色管理】角色列表/详情、分类CRUD、角色CRUD、全局情绪映射')
    .addTag('open-voice', '【语音管理】音色列表/详情、声音复刻、参数设置、试听、ASR 语音识别')
    .addTag('open-affection', '【好感度系统】规则查询/维护、用户好感度状态查询')
    .addTag(
      'open-chat',
      '【对话接口】文字对话、语音对话（ASR+LLM）、TTS 文字转语音（需显式 userId）',
    )
    .addTag('open-chatLog', '【聊天记录】查询对话列表、按应用查询、查询单条消息（需显式 userId）')
    .addTag(
      'open-chatGroup',
      '【对话组管理】创建/查询/更新/删除对话组、群聊成员管理、任务分配（需显式 userId）',
    )
    .build();

  const fullDoc = SwaggerModule.createDocument(app, swaggerConfig);

  // 添加全局响应定义（仅用于UI展示，不改变实际返回结构）
  const responseSchema = {
    type: 'object',
    properties: {
      code: { type: 'number', example: 200 },
      data: { type: 'object' },
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: '请求成功' },
    },
  } as any;
  Object.values(fullDoc.paths).forEach((path: any) => {
    Object.values(path).forEach((method: any) => {
      method.responses = {
        ...method.responses,
        '200': {
          description: '成功响应',
          content: { 'application/json': { schema: responseSchema } },
        },
      };
    });
  });

  // 过滤仅开放接口（路径中包含 /open/）
  const openDoc = JSON.parse(JSON.stringify(fullDoc));
  openDoc.paths = Object.keys(fullDoc.paths)
    .filter(p => p.includes('/open/'))
    .reduce((acc, key) => ({ ...acc, [key]: fullDoc.paths[key] }), {});

  // 永远暴露开放接口JSON与UI
  app
    .getHttpAdapter()
    .getInstance()
    .get('/open-api.json', (_req, res) => res.json(openDoc));
  SwaggerModule.setup('open-api-docs', app, openDoc);

  if (process.env.ISDEV === 'true') {
    SwaggerModule.setup('api-docs', app, fullDoc);
    Logger.log(
      'Swagger API文档已启用: http://localhost:' + (process.env.PORT || 3000) + '/api-docs',
      'Main',
    );
  }

  const PORT = process.env.PORT || 3000;

  const server = await app.listen(PORT, () => {
    console.log('\n======================================');
    console.log(`  服务启动成功: http://localhost:${PORT}`);
    console.log('======================================\n');
  });

  server.timeout = 5 * 60 * 1000;

  // Realtime Voice Call WS server (push-to-talk): /api/realtime/voice-call
  try {
    const voiceService = app.get(VoiceService);
    const openAIChatService = app.get(OpenAIChatService);
    // 获取 ChatService 用于情绪识别
    const { ChatService } = await import('./modules/chat/chat.service');
    const chatService = app.get(ChatService);
    // 获取 AppService 用于查询应用信息（角色预设等）
    const { AppService } = await import('./modules/app/app.service');
    const appService = app.get(AppService);
    // 获取 AffectionService 用于查询好感度
    const { AffectionService } = await import('./modules/affection/affection.service');
    const affectionService = app.get(AffectionService);

    // Dynamically import ws to avoid build issues
    const WSMod: any = await import('ws');
    const WSServer = WSMod?.Server || WSMod?.WebSocketServer;
    if (!WSServer) {
      Logger.warn('ws Server not available, skip realtime voice-call');
      return;
    }

    const wss = new WSServer({ server, path: '/api/realtime/voice-call' });
    Logger.log('Realtime WS ready at /api/realtime/voice-call', 'Main');

    wss.on('connection', (socket: any, req: any) => {
      Logger.debug('WS client connected', 'VoiceCall');

      // 辅助函数：查询应用信息（带缓存）
      const getAppInfo = async (appId: number) => {
        // 检查缓存
        if (session.cache?.appInfo?.id === appId) {
          Logger.debug(`[VoiceCall] 使用缓存的应用信息: appId=${appId}`, 'VoiceCall');
          return session.cache.appInfo;
        }

        try {
          // AppService 中的 repository 是私有的，需要通过 as any 访问
          const appInfo = await (appService as any).appEntity.findOne({
            where: { id: appId },
          });

          // 缓存结果
          if (appInfo) {
            session.cache!.appInfo = appInfo;
            Logger.debug(
              `[VoiceCall] 已缓存应用信息: appId=${appId}, name=${appInfo.name}`,
              'VoiceCall',
            );
          }

          return appInfo;
        } catch (error: any) {
          Logger.warn(
            `[VoiceCall] 查询应用信息失败: appId=${appId}, error=${error?.message}`,
            'VoiceCall',
          );
          return null;
        }
      };

      // 辅助函数：查询应用的默认音色（从 app_voice 表，带缓存）
      const getAppDefaultVoice = async (appId: number): Promise<string | null> => {
        // 检查缓存
        if (session.cache?.defaultVoiceId !== undefined && session.cache?.appInfo?.id === appId) {
          Logger.debug(
            `[VoiceCall] 使用缓存的默认音色: appId=${appId}, voiceId=${session.cache.defaultVoiceId}`,
            'VoiceCall',
          );
          return session.cache.defaultVoiceId;
        }

        try {
          // 查询 app_voice 表获取默认音色
          const appVoice = await (appService as any).appVoiceRepo.findOne({
            where: { appId: Number(appId), isDefault: 1 },
          });

          const voiceId = appVoice?.voiceId || null;

          // 缓存结果（包括 null）
          session.cache!.defaultVoiceId = voiceId;
          Logger.debug(
            `[VoiceCall] 已缓存默认音色: appId=${appId}, voiceId=${voiceId || 'null'}`,
            'VoiceCall',
          );

          return voiceId;
        } catch (error: any) {
          Logger.warn(
            `[VoiceCall] 查询默认音色失败: appId=${appId}, error=${error?.message}`,
            'VoiceCall',
          );
          return null;
        }
      };

      // 辅助函数：构建完整的角色预设（包含好感度行为规范，带缓存）
      const buildRolePrompt = async (
        appInfo: any,
        userId: string | number | undefined,
        basePrompt: string,
      ): Promise<string> => {
        // 检查缓存：如果 appId 和 userId 都匹配，使用缓存的角色预设
        const cacheKey = `${appInfo?.id}_${userId}`;
        if (
          session.cache?.rolePromptWithAffection &&
          session.cache?.appInfo?.id === appInfo?.id &&
          session.cache?.affectionData?.userId === userId
        ) {
          Logger.debug(
            `[VoiceCall] 使用缓存的角色预设（含好感度）: appId=${appInfo?.id}, userId=${userId}`,
            'VoiceCall',
          );
          return session.cache.rolePromptWithAffection;
        }

        let finalPrompt = appInfo?.preset || basePrompt || '';

        // 如果有 userId 和 appId，获取好感度并添加行为规范
        if (userId && appInfo?.id) {
          try {
            const affectionData = await affectionService.getUserAffection(userId, appInfo.id);

            // 缓存好感度数据
            session.cache!.affectionData = { ...affectionData, userId };

            if (affectionData?.stage?.behaviors) {
              const behaviors = affectionData.stage.behaviors.trim();
              if (behaviors) {
                finalPrompt = `${finalPrompt}\n\n## 当前好感度等级: ${affectionData.stage.name}\n${behaviors}`;
                Logger.debug(
                  `[VoiceCall] 添加好感度行为规范: 等级=${affectionData.stage.name}, score=${affectionData.score}`,
                  'VoiceCall',
                );
              }
            }
          } catch (error: any) {
            Logger.warn(
              `[VoiceCall] 获取好感度失败: userId=${userId}, appId=${appInfo.id}, error=${error?.message}`,
              'VoiceCall',
            );
          }
        }

        // 缓存构建好的角色预设
        session.cache!.rolePromptWithAffection = finalPrompt;
        Logger.debug(
          `[VoiceCall] 已缓存角色预设（含好感度）: appId=${appInfo?.id}, userId=${userId}, 长度=${finalPrompt.length}`,
          'VoiceCall',
        );

        return finalPrompt;
      };

      let audioChunks: Buffer[] = [];
      let cfg = {
        sampleRate: 8000,
        format: 'wav' as 'wav' | 'pcm' | 'mp3' | 'opus' | 'speex' | 'aac' | 'amr',
        voice_id: '',
      };
      const session: {
        llmAbort?: AbortController | null;
        ttsCanceled?: boolean;
        ttsActive?: boolean;
        chatConfig?: any;
        // 缓存数据，减少数据库查询
        cache?: {
          appInfo?: any;
          affectionData?: any;
          rolePromptWithAffection?: string;
          defaultVoiceId?: string | null; // 默认音色缓存
        };
      } = { llmAbort: null, ttsCanceled: false, ttsActive: false, cache: {} };

      // 诊断指标
      let recvBytesTotal = 0;
      let recvChunkCount = 0;
      let lastRecvAt: number = 0;
      let lastRmsAmplitude: number = 0;

      const sendJson = (obj: any) => {
        try {
          socket.send(JSON.stringify(obj));
        } catch {}
      };

      // keepalive: 30s ping
      const pingInterval = setInterval(() => {
        try {
          socket.ping();
        } catch {}
      }, 30000);
      socket.on('pong', () => {});

      // 实时语音识别和流式处理
      let asrBuffer = '';
      let llmBuffer = '';
      let isProcessing = false;

      const processRealTimeAudio = async () => {
        if (audioChunks.length === 0 || session.ttsCanceled || session.ttsActive || isProcessing) {
          Logger.debug(
            `跳过处理: chunks=${audioChunks.length}, canceled=${session.ttsCanceled}, active=${session.ttsActive}, processing=${isProcessing}`,
            'VoiceCall',
          );
          return;
        }

        isProcessing = true;
        Logger.debug(`开始处理音频: ${audioChunks.length} 块`, 'VoiceCall');

        try {
          const buf = Buffer.concat(audioChunks);
          audioChunks = []; // 清空缓存

          if (!buf.length) {
            Logger.debug('音频数据为空，跳过处理', 'VoiceCall');
            isProcessing = false;
            return;
          }

          // 将可能由多段WAV片段拼接而成的 buffer 统一转换为纯PCM
          const extractPcmFromConcatWav = (input: Buffer): Buffer => {
            const outChunks: Buffer[] = [];
            let pos = 0;
            const total = input.length;
            const readUInt32LE = (b: Buffer, off: number) =>
              off + 4 <= b.length ? b.readUInt32LE(off) : 0;
            while (pos < total) {
              // 查找下一个 'RIFF'
              let riffIdx = input.indexOf('RIFF', pos, 'ascii');
              if (riffIdx === -1) break;
              // 读取 RIFF chunk size: 文件总长度 = 8 + size
              const size = readUInt32LE(input, riffIdx + 4);
              let fileEnd = riffIdx + 8 + size;
              if (!Number.isFinite(fileEnd) || fileEnd <= riffIdx || fileEnd > total) {
                // 兜底：若不合理，则尝试向后移动一字节以避免死循环
                pos = riffIdx + 1;
                continue;
              }
              // 解析子chunk，寻找 'data'
              let cursor = riffIdx + 12; // 跳过 'RIFF' + size(4) + 'WAVE'
              while (cursor + 8 <= fileEnd) {
                const id = input.toString('ascii', cursor, cursor + 4);
                const chunkSize = readUInt32LE(input, cursor + 4);
                const payloadStart = cursor + 8;
                const payloadEnd = payloadStart + chunkSize;
                if (payloadEnd > fileEnd) break;
                if (id === 'data') {
                  outChunks.push(input.subarray(payloadStart, payloadEnd));
                }
                cursor = payloadEnd;
              }
              pos = fileEnd;
            }
            // 如果没有识别出任何WAV头，认为输入本身就是裸PCM
            if (outChunks.length === 0) return input;
            return Buffer.concat(outChunks);
          };

          // 仅当前端发送的是 wav 分片时需要提取；否则直接按原格式处理
          const pcmBuf = cfg.format === 'wav' ? extractPcmFromConcatWav(buf) : buf;

          // 直接使用纯PCM走ASR（避免多次封装解封带来的噪声）
          const audioBase64 = `data:application/octet-stream;base64,${pcmBuf.toString('base64')}`;

          // 检查音频数据质量（基于纯PCM数据）
          const audioData = new Int16Array(
            pcmBuf.buffer,
            pcmBuf.byteOffset,
            Math.floor(pcmBuf.length / 2),
          );
          let maxAmplitude = 0;
          let sumAbs = 0;
          for (let i = 0; i < audioData.length; i++) {
            const v = Math.abs(audioData[i]);
            sumAbs += v;
            if (v > maxAmplitude) maxAmplitude = v;
          }
          const avgAmplitude = sumAbs / Math.max(1, audioData.length);

          Logger.debug(
            `音频质量检查: 最大振幅=${maxAmplitude}, 平均振幅=${avgAmplitude.toFixed(
              2,
            )}, 数据长度=${pcmBuf.length}`,
            'VoiceCall',
          );

          // 优化：放宽弱信号阈值，只过滤完全静音的音频
          if (maxAmplitude < 5) {
            Logger.debug('音频几乎无声，跳过识别', 'VoiceCall');
            isProcessing = false;
            return;
          }

          // 检查音频时长
          const audioDuration = audioData.length / cfg.sampleRate;
          Logger.debug(`音频时长: ${audioDuration.toFixed(2)}秒`, 'VoiceCall');

          // 优化：允许更短的音频片段
          if (audioDuration < 0.2) {
            Logger.debug('音频时长过短(<0.2s)，跳过识别', 'VoiceCall');
            isProcessing = false;
            return;
          }

          Logger.debug(`开始ASR识别: ${pcmBuf.length} bytes (raw PCM)`, 'VoiceCall');

          // 1) 实时语音识别
          let asrRes: any;
          let asrRetries = 0;
          const maxAsrRetries = 2;

          while (asrRetries <= maxAsrRetries) {
            try {
              Logger.debug(
                `ASR调用参数 (尝试 ${asrRetries + 1}/${
                  maxAsrRetries + 1
                }): format=pcm, sampleRate=${cfg.sampleRate}, audioSize=${pcmBuf.length}`,
                'VoiceCall',
              );
              asrRes = await voiceService.asr(
                {
                  audioBase64,
                  format: 'pcm',
                  sample_rate: cfg.sampleRate,
                  // 不指定 model，让 voice.service 根据采样率自动选择
                  language_hints: ['zh-CN'],
                  disfluency_removal_enabled: true,
                },
                {
                  onPartial: (t: string, b?: number, e?: number | null) => {
                    Logger.debug(`ASR部分识别: "${t}"`, 'VoiceCall');
                    asrBuffer += t;
                    sendJson({ type: 'asr.partial', text: t, begin: b, end: e });
                  },
                },
              );
              Logger.debug(`ASR服务调用成功`, 'VoiceCall');
              break; // 成功则跳出重试循环
            } catch (asrError: any) {
              asrRetries++;
              Logger.error(
                `ASR服务调用失败 (尝试 ${asrRetries}/${maxAsrRetries + 1}): ${
                  asrError?.message || asrError
                }`,
                'VoiceCall',
              );

              if (asrRetries > maxAsrRetries) {
                Logger.error(`ASR重试次数已用尽`, 'VoiceCall');
                sendJson({ type: 'error', stage: 'asr', message: '语音识别失败，请重试' });
                return;
              }

              // 等待一小段时间再重试
              await new Promise(resolve => setTimeout(resolve, 500 * asrRetries));
            }
          }

          const asrText = (asrRes?.text || '').trim();
          Logger.debug(`ASR识别结果: "${asrText}"`, 'VoiceCall');
          Logger.debug(`ASR原始结果:`, asrRes, 'VoiceCall');

          if (asrText) {
            asrBuffer += asrText;
            sendJson({ type: 'asr.final', text: asrText });

            // 2) 流式大模型处理
            Logger.debug('开始LLM处理', 'VoiceCall');
            await processLLMStream(asrText);
          } else {
            Logger.debug('ASR未识别到有效文本', 'VoiceCall');
          }
        } catch (e: any) {
          Logger.error(`音频处理错误: ${e?.message || e}`, 'VoiceCall');
          sendJson({ type: 'error', stage: 'asr', message: e?.message || 'ASR failed' });
        } finally {
          isProcessing = false;
          Logger.debug('音频处理完成', 'VoiceCall');
        }
      };

      // 流式LLM处理 - 先收集完整回复，再根据情绪选择音色进行TTS
      const processLLMStream = async (text: string) => {
        if (session.ttsCanceled) return;

        sendJson({ type: 'llm.start' });
        const abortController = new AbortController();
        session.llmAbort = abortController;

        // 先收集完整的LLM回复
        llmBuffer = ''; // 重置缓冲区
        try {
          // 获取应用信息（用于获取角色预设）
          Logger.debug(
            `[VoiceCall] 开始获取角色配置: session.chatConfig=${JSON.stringify({
              userId: session.chatConfig?.userId,
              appId: session.chatConfig?.appId,
              prompt: session.chatConfig?.prompt?.substring(0, 30),
            })}`,
            'VoiceCall',
          );

          let rolePrompt = '';
          let appInfo: any = null;

          if (session.chatConfig?.appId) {
            // 使用辅助函数查询应用信息
            appInfo = await getAppInfo(session.chatConfig.appId);
          }

          // 构建角色预设（包含好感度行为规范）
          rolePrompt = await buildRolePrompt(
            appInfo,
            session.chatConfig?.userId,
            session.chatConfig?.prompt || '',
          );

          Logger.debug(
            `[VoiceCall] 角色预设已构建: appId=${session.chatConfig?.appId}, name=${appInfo?.name}, preset长度=${rolePrompt?.length}`,
            'VoiceCall',
          );

          // 确保角色预设不为空（星尘API要求 botProfile.content 不能为空）
          if (!rolePrompt || rolePrompt.trim() === '') {
            rolePrompt = '你是一个友好、乐于助人的AI助手。请用简洁、自然的方式回答用户的问题。';
            Logger.debug(`[VoiceCall] 使用默认角色预设`, 'VoiceCall');
          }

          // 构建星尘API扩展配置
          const appConfigForXingchen = session.chatConfig?.appId
            ? {
                botName: appInfo?.name || session.chatConfig?.modelName || 'AI助手',
                userId: session.chatConfig?.userId,
                appId: session.chatConfig?.appId,
                enableRealTime: appInfo?.enableRealTime ?? session.chatConfig?.enableRealTime,
                enableLongTermMemory:
                  appInfo?.enableLongTermMemory ?? session.chatConfig?.enableLongTermMemory,
                enableKnowledgeBase:
                  appInfo?.enableKnowledgeBase ?? session.chatConfig?.enableKnowledgeBase,
                knowledgeBaseIds: appInfo?.knowledgeBaseIds ?? session.chatConfig?.knowledgeBaseIds,
                dialogueExamples: appInfo?.dialogueExamples ?? session.chatConfig?.dialogueExamples,
                openingRemark: appInfo?.openingRemark ?? session.chatConfig?.openingRemark,
              }
            : undefined;

          Logger.debug(
            `[VoiceCall] 星尘API配置: userId=${session.chatConfig?.userId}, appId=${
              session.chatConfig?.appId
            }, botName=${appConfigForXingchen?.botName}, prompt=${rolePrompt?.substring(0, 50)}...`,
            'VoiceCall',
          );

          // 调用星尘API（chatFree）
          Logger.debug(`[VoiceCall] 开始调用星尘API: 用户输入="${text}"`, 'VoiceCall');

          const xingchenResult = await openAIChatService.chatFree(
            text,
            rolePrompt,
            [], // messagesHistory - 可以考虑维护会话历史
            undefined, // imageUrl
            {
              onProgress: (delta: string) => {
                if (delta) {
                  Logger.debug(`[VoiceCall] LLM流式输出: "${delta}"`, 'VoiceCall');
                  llmBuffer += delta;
                  sendJson({ type: 'llm.partial', text: delta });
                }
              },
              abortSignal: abortController.signal,
            },
            appConfigForXingchen,
          );

          const xingchenText = xingchenResult.text || '';
          // 语音通话不记录token使用数据

          Logger.debug(
            `[VoiceCall] 星尘API调用完成: xingchenText="${xingchenText?.substring(
              0,
              100,
            )}...", llmBuffer="${llmBuffer?.substring(0, 100)}..."`,
            'VoiceCall',
          );

          // 如果没有流式输出，使用完整结果
          if (!llmBuffer && xingchenText) {
            llmBuffer = xingchenText;
            Logger.debug(
              `[VoiceCall] 使用非流式结果: "${llmBuffer?.substring(0, 100)}..."`,
              'VoiceCall',
            );
          }

          if (!llmBuffer) {
            Logger.warn('[VoiceCall] LLM返回为空！', 'VoiceCall');
            sendJson({ type: 'error', stage: 'llm', message: 'LLM返回为空' });
            return;
          }

          sendJson({ type: 'llm.final', text: llmBuffer });

          // LLM完成后，进行情绪识别并选择音色
          if (!session.ttsCanceled && llmBuffer) {
            Logger.debug(
              `[情绪识别] 开始分析LLM回复: ${llmBuffer.substring(0, 50)}...`,
              'VoiceCall',
            );

            // 使用 ChatService 进行情绪识别并获取音色
            const emotionResult = await chatService.detectEmotionForVoiceCall(
              llmBuffer,
              session.chatConfig?.appId || null,
            );

            let selectedVoiceId: string | null = null;
            let selectedEmotion: string | null = null;

            if (emotionResult) {
              selectedVoiceId = emotionResult.voiceId;
              selectedEmotion = emotionResult.emotion;
              Logger.debug(
                `[情绪识别] ✓ 识别成功: emotion=${selectedEmotion}, voiceId=${selectedVoiceId}, method=${emotionResult.method}`,
                'VoiceCall',
              );
              sendJson({ type: 'emotion.detected', emotion: selectedEmotion });
            } else {
              // 没有识别到情绪，使用默认音色
              selectedVoiceId = await getAppDefaultVoice(session.chatConfig?.appId);
              if (!selectedVoiceId) {
                selectedVoiceId = cfg.voice_id || null;
              }
              selectedEmotion = '默认';
              Logger.debug(
                `[情绪识别] 未识别到情绪，使用默认音色: ${selectedVoiceId}`,
                'VoiceCall',
              );
              sendJson({ type: 'emotion.detected', emotion: '默认' });
            }

            Logger.debug(
              `[情绪识别] 最终选择: voiceId=${selectedVoiceId}, emotion=${selectedEmotion}`,
              'VoiceCall',
            );

            // 5. 移除括号内容，得到实际要朗读的文本
            const textToSpeak = chatService.removeBracketedContent(llmBuffer);

            Logger.debug(
              `[TTS] 准备播报: textToSpeak="${textToSpeak?.substring(0, 100)}...", 长度=${
                textToSpeak?.length
              }`,
              'VoiceCall',
            );

            // 6. 使用选择的音色进行TTS
            if (selectedVoiceId && textToSpeak) {
              Logger.debug(
                `[TTS] 开始播报: 音色=${selectedVoiceId}, 情绪=${
                  selectedEmotion || '默认'
                }, 文本长度=${textToSpeak.length}`,
                'VoiceCall',
              );

              sendJson({ type: 'tts.start' });
              session.ttsActive = true;

              try {
                await voiceService.ttsStream(
                  {
                    voice_id: selectedVoiceId,
                    text: textToSpeak,
                    format: 'mp3',
                    sample_rate: 22050,
                  },
                  {
                    onStart: info =>
                      sendJson({
                        type: 'tts.info',
                        format: info.format,
                        sample_rate: info.sample_rate,
                      }),
                    onData: chunk => {
                      if (session.ttsCanceled) return;
                      try {
                        socket.send(chunk, { binary: true });
                      } catch {}
                    },
                    onEnd: () => {
                      if (!session.ttsCanceled) sendJson({ type: 'tts.end' });
                      session.ttsActive = false;
                      Logger.debug('[TTS] 播报完成', 'VoiceCall');
                    },
                  },
                );
              } catch (e: any) {
                Logger.error(`[TTS] 播报失败: ${e?.message}`, 'VoiceCall');
                sendJson({ type: 'error', stage: 'tts', message: e?.message || 'TTS failed' });
                session.ttsActive = false;
              }
            } else {
              Logger.warn(
                `[TTS] 跳过播报: selectedVoiceId=${selectedVoiceId || 'null'}, textToSpeak=${
                  textToSpeak ? textToSpeak.substring(0, 50) : 'empty'
                }`,
                'VoiceCall',
              );
              // 即使没有语音，也要告知前端处理完成
              sendJson({ type: 'done' });
            }
          }
        } catch (e: any) {
          Logger.error(`[VoiceCall] LLM处理失败: ${e?.message}`, 'VoiceCall');
          Logger.error(e?.stack, 'VoiceCall');
          sendJson({ type: 'error', stage: 'llm', message: e?.message || 'LLM failed' });
        }
      };

      socket.on('message', async (data: any, isBinary: boolean) => {
        try {
          // 优化判断逻辑：
          // 1. 如果 isBinary=true，直接作为音频数据处理（性能优化）
          // 2. 否则尝试解析为 JSON 控制消息，失败则当作音频数据
          let msg: any = null;
          let isControlMessage = false;

          if (isBinary) {
            // WebSocket 明确标记为二进制，直接作为音频处理
            Logger.debug(
              `[VoiceCall] 收到二进制消息（音频）: ${data?.length || 'N/A'} bytes`,
              'VoiceCall',
            );
            isControlMessage = false;
          } else {
            // 非二进制，尝试解析为 JSON 控制消息
            try {
              const text: string =
                typeof data === 'string' ? data : Buffer.from(data as any).toString('utf8');
              msg = JSON.parse(text);
              // 如果成功解析且有 type 字段，则是控制消息
              if (msg && typeof msg.type === 'string') {
                isControlMessage = true;
                Logger.debug(`[VoiceCall] 收到控制消息: type=${msg.type}`, 'VoiceCall');
              }
            } catch (error) {
              // JSON 解析失败，可能是音频数据被错误标记为非二进制
              Logger.debug(
                `[VoiceCall] 非二进制消息但JSON解析失败，作为音频处理: ${
                  data?.length || 'N/A'
                } bytes`,
                'VoiceCall',
              );
              isControlMessage = false;
            }
          }

          // 如果不是控制消息，则作为音频数据处理
          if (!isControlMessage) {
            // 持续通话模式：实时处理音频数据
            // 重要：收到新音频数据时，重置取消标志，允许处理新的录音
            if (session.ttsCanceled && audioChunks.length === 0) {
              // 如果之前被取消且音频缓冲区为空，说明这是新一轮录音，重置标志
              Logger.debug('[VoiceCall] 检测到新录音，重置ttsCanceled标志', 'VoiceCall');
              session.ttsCanceled = false;
            }

            if (session.ttsCanceled) {
              // 如果仍然是取消状态（正在处理中的录音），忽略新的音频数据
              return;
            }

            audioChunks.push(Buffer.from(data));
            Logger.debug(
              `收到音频数据: ${data.length} bytes, 累积: ${audioChunks.length} 块`,
              'VoiceCall',
            );

            // 诊断：累计与当前分片RMS
            try {
              recvBytesTotal += data.length;
              recvChunkCount += 1;
              lastRecvAt = Date.now();
              const buf: Buffer = Buffer.from(data);
              let pcm: Buffer;
              if (buf.length >= 44 && buf.toString('ascii', 0, 4) === 'RIFF') {
                // WAV 容器，取 data 段（简化：跳过44字节）
                pcm = buf.subarray(44);
              } else {
                pcm = buf;
              }
              if (pcm.length >= 2) {
                const view = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
                let sumSq = 0;
                for (let i = 0; i < view.length; i++) {
                  const v = view[i];
                  sumSq += v * v;
                }
                const rms = Math.sqrt(sumSq / Math.max(1, view.length));
                lastRmsAmplitude = Math.round(rms);
              }
            } catch {}

            // 实时处理音频数据 - 优化：减少累积量以降低延迟（每块约85ms，15块≈1.3s）
            // 同时增加处理间隔避免频繁调用
            if (audioChunks.length >= 15 && !isProcessing) {
              Logger.debug('触发音频处理', 'VoiceCall');
              processRealTimeAudio();
            } else if (audioChunks.length >= 40 && isProcessing) {
              // 如果累积过多（>3.4s）且仍在处理，强制触发新一轮以避免阻塞
              Logger.debug(`音频累积过多 (${audioChunks.length} 块)，强制触发新处理`, 'VoiceCall');
              isProcessing = false; // 重置处理标志
              processRealTimeAudio();
            }
            return;
          }

          // 处理控制消息（msg 已在上面解析）

          if (msg?.type === 'start_call') {
            // 开始持续通话模式
            Logger.debug(
              `[VoiceCall] 收到start_call消息: userId=${msg.userId}, appId=${msg.appId}, model=${
                msg.model
              }, modelName=${msg.modelName}, prompt=${msg.prompt?.substring(0, 30)}...`,
              'VoiceCall',
            );

            // 检查是否切换了角色或用户，如果是则清除缓存
            if (
              session.chatConfig?.appId !== msg.appId ||
              session.chatConfig?.userId !== msg.userId
            ) {
              Logger.debug(
                `[VoiceCall] 检测到角色或用户变更，清除缓存: 旧appId=${session.chatConfig?.appId}, 新appId=${msg.appId}`,
                'VoiceCall',
              );
              session.cache = {};
            }

            audioChunks = [];
            cfg.sampleRate = Number(msg.sampleRate || 8000);
            cfg.format = msg.format || 'wav';
            cfg.voice_id = msg.voice_id || '';
            session.ttsCanceled = false;
            session.ttsActive = false;

            // 保存角色配置（包括星尘API扩展配置）
            session.chatConfig = {
              appId: msg.appId,
              userId: msg.userId, // 用户ID（用于星尘API）
              model: msg.model || 'gpt-4o-mini',
              modelName: msg.modelName || 'AI助手',
              prompt: msg.prompt || '',
              temperature: Number(msg.temperature || 1),
              config: msg.config || {},
              // 从 config 中提取星尘API相关配置
              enableRealTime: msg.config?.enableRealTime,
              enableLongTermMemory: msg.config?.enableLongTermMemory,
              enableKnowledgeBase: msg.config?.enableKnowledgeBase,
              knowledgeBaseIds: msg.config?.knowledgeBaseIds,
              dialogueExamples: msg.config?.dialogueExamples,
              openingRemark: msg.config?.openingRemark,
            };

            Logger.debug(
              `[VoiceCall] start_call配置已保存: userId=${session.chatConfig.userId}, appId=${
                session.chatConfig.appId
              }, modelName=${
                session.chatConfig.modelName
              }, prompt=${session.chatConfig.prompt?.substring(0, 30)}...`,
              'VoiceCall',
            );

            sendJson({ type: 'call_started', sampleRate: cfg.sampleRate, format: cfg.format });
          } else if (msg?.type === 'end_call') {
            // 结束持续通话模式
            audioChunks = [];
            try {
              session.llmAbort?.abort();
            } catch {}
            session.ttsCanceled = true;
            session.ttsActive = false;
            sendJson({ type: 'call_ended' });
          } else if (msg?.type === 'start') {
            audioChunks = [];
            cfg.sampleRate = Number(msg.sampleRate || 8000);
            cfg.format = msg.format || 'wav';
            cfg.voice_id = msg.voice_id || '';
            session.ttsCanceled = false;
            session.ttsActive = false;
            sendJson({ type: 'started', sampleRate: cfg.sampleRate, format: cfg.format });
          } else if (msg?.type === 'cancel') {
            audioChunks = [];
            // 取消当前 LLM 与 TTS 推送
            try {
              session.llmAbort?.abort();
            } catch {}
            session.ttsCanceled = true;
            if (session.ttsActive) {
              // 立即通知前端结束当前TTS
              sendJson({ type: 'tts.end' });
              session.ttsActive = false;
            }
            sendJson({ type: 'canceled' });
          } else if (msg?.type === 'stop') {
            Logger.debug(
              `[VoiceCall] 收到stop消息: audioChunks.length=${audioChunks.length}`,
              'VoiceCall',
            );

            const buf = Buffer.concat(audioChunks);
            audioChunks = [];
            if (!buf.length) {
              // 放宽：空音频直接返回空结果，避免前端体验受阻
              Logger.debug(`[VoiceCall] 音频数据为空，返回空结果`, 'VoiceCall');
              sendJson({ type: 'asr.final', text: '' });
              sendJson({ type: 'done' });
              return;
            }

            Logger.debug(`[VoiceCall] 开始处理音频: ${buf.length} bytes`, 'VoiceCall');

            const mime =
              cfg.format === 'wav'
                ? 'audio/wav'
                : cfg.format === 'mp3'
                ? 'audio/mpeg'
                : cfg.format === 'pcm'
                ? 'application/octet-stream'
                : `audio/${cfg.format}`;
            const audioBase64 = `data:${mime};base64,${buf.toString('base64')}`;

            // 1) ASR (streaming partials)
            sendJson({ type: 'asr.start' });
            let asrText = '';
            try {
              const asrRes = await voiceService.asr(
                { audioBase64, format: cfg.format as any, sample_rate: cfg.sampleRate },
                {
                  onPartial: (t: string, b?: number, e?: number | null) =>
                    sendJson({ type: 'asr.partial', text: t, begin: b, end: e }),
                },
              );
              asrText = (asrRes?.text || '').trim();
              sendJson({ type: 'asr.final', text: asrText });
            } catch (e: any) {
              sendJson({ type: 'error', stage: 'asr', message: e?.message || 'ASR failed' });
              return;
            }
            if (!asrText) return;

            // 2) LLM chat (streaming text) - 使用星尘API，应用角色配置
            sendJson({ type: 'llm.start' });
            const abortController = new AbortController();
            session.llmAbort = abortController;
            let llmFull = '';
            // 定义在 try 外，以便在 TTS 阶段使用
            let appInfo: any = null;
            try {
              // 获取角色预设（与持续通话模式逻辑一致）
              let rolePrompt = '';

              if (session.chatConfig?.appId) {
                // 使用辅助函数查询应用信息
                appInfo = await getAppInfo(session.chatConfig.appId);
              }

              // 构建角色预设（包含好感度行为规范）
              rolePrompt = await buildRolePrompt(
                appInfo,
                session.chatConfig?.userId,
                session.chatConfig?.prompt || '',
              );

              Logger.debug(
                `[VoiceCall] stop模式-角色预设已构建: appId=${session.chatConfig?.appId}, name=${appInfo?.name}, voiceId=${appInfo?.voiceId}, preset长度=${rolePrompt?.length}`,
                'VoiceCall',
              );

              // 确保角色预设不为空
              if (!rolePrompt || rolePrompt.trim() === '') {
                rolePrompt = '你是一个友好、乐于助人的AI助手。请用简洁、自然的方式回答用户的问题。';
                Logger.debug(`[VoiceCall] stop模式-使用默认角色预设`, 'VoiceCall');
              }

              // 构建星尘API扩展配置
              const appConfigForXingchen = session.chatConfig?.appId
                ? {
                    botName: appInfo?.name || session.chatConfig?.modelName || 'AI助手',
                    userId: session.chatConfig?.userId,
                    appId: session.chatConfig?.appId,
                    enableRealTime: appInfo?.enableRealTime ?? session.chatConfig?.enableRealTime,
                    enableLongTermMemory:
                      appInfo?.enableLongTermMemory ?? session.chatConfig?.enableLongTermMemory,
                    enableKnowledgeBase:
                      appInfo?.enableKnowledgeBase ?? session.chatConfig?.enableKnowledgeBase,
                    knowledgeBaseIds:
                      appInfo?.knowledgeBaseIds ?? session.chatConfig?.knowledgeBaseIds,
                    dialogueExamples:
                      appInfo?.dialogueExamples ?? session.chatConfig?.dialogueExamples,
                    openingRemark: appInfo?.openingRemark ?? session.chatConfig?.openingRemark,
                  }
                : undefined;

              Logger.debug(
                `[VoiceCall] stop模式-星尘API配置: userId=${session.chatConfig?.userId}, appId=${session.chatConfig?.appId}, botName=${appConfigForXingchen?.botName}`,
                'VoiceCall',
              );

              // 调用星尘API（chatFree）
              const xingchenResult = await openAIChatService.chatFree(
                asrText,
                rolePrompt, // 使用角色预设
                [], // messagesHistory
                undefined, // imageUrl
                {
                  onProgress: (delta: string) => {
                    if (delta) {
                      llmFull += delta;
                      sendJson({ type: 'llm.partial', text: delta });
                    }
                  },
                  abortSignal: abortController.signal,
                },
                appConfigForXingchen, // 传递星尘API配置
              );

              const xingchenText = xingchenResult.text || '';
              // 语音通话不记录token使用数据

              // 如果没有流式输出，使用完整结果
              if (!llmFull && xingchenText) {
                llmFull = xingchenText;
              }

              sendJson({ type: 'llm.final', text: llmFull });
            } catch (e: any) {
              sendJson({ type: 'error', stage: 'llm', message: e?.message || 'LLM failed' });
              return;
            }

            // 3) TTS (streaming audio frames) - 添加情绪识别
            if (llmFull) {
              if (session.ttsCanceled) {
                // 若在 LLM 期间已被取消，则不再进入 TTS
                sendJson({ type: 'done' });
                return;
              }

              Logger.debug(
                `[VoiceCall] stop模式-开始情绪识别: ${llmFull.substring(0, 50)}...`,
                'VoiceCall',
              );

              // 使用 ChatService 进行情绪识别并获取音色
              const emotionResult = await chatService.detectEmotionForVoiceCall(
                llmFull,
                session.chatConfig?.appId || null,
              );

              let selectedVoiceId: string | null = null;
              let selectedEmotion: string | null = null;

              if (emotionResult) {
                selectedVoiceId = emotionResult.voiceId;
                selectedEmotion = emotionResult.emotion;
                Logger.debug(
                  `[VoiceCall] stop模式-✓ 识别成功: emotion=${selectedEmotion}, voiceId=${selectedVoiceId}, method=${emotionResult.method}`,
                  'VoiceCall',
                );
                sendJson({ type: 'emotion.detected', emotion: selectedEmotion });
              } else {
                // 没有识别到情绪，使用默认音色
                selectedVoiceId = await getAppDefaultVoice(session.chatConfig?.appId);
                if (!selectedVoiceId) {
                  selectedVoiceId = cfg.voice_id || null;
                }
                selectedEmotion = '默认';
                Logger.debug(
                  `[VoiceCall] stop模式-未识别到情绪，使用默认音色: ${selectedVoiceId}`,
                  'VoiceCall',
                );
                sendJson({ type: 'emotion.detected', emotion: '默认' });
              }

              Logger.debug(
                `[VoiceCall] stop模式-最终选择: voiceId=${selectedVoiceId}, emotion=${selectedEmotion}`,
                'VoiceCall',
              );

              // 4. 移除括号内容，得到实际要朗读的文本
              const textToSpeak = chatService.removeBracketedContent(llmFull);

              if (!textToSpeak || textToSpeak.trim().length === 0) {
                Logger.warn('[VoiceCall] stop模式-移除括号后文本为空，跳过TTS', 'VoiceCall');
                sendJson({ type: 'done' });
                return;
              }

              // 5. 使用选择的音色进行TTS
              if (!selectedVoiceId) {
                Logger.warn('[VoiceCall] stop模式-未找到可用音色，跳过TTS', 'VoiceCall');
                sendJson({ type: 'done' });
                return;
              }

              Logger.debug(
                `[VoiceCall] stop模式-开始播报: 音色=${selectedVoiceId}, 情绪=${
                  selectedEmotion || '默认'
                }, 文本长度=${textToSpeak.length}`,
                'VoiceCall',
              );

              sendJson({ type: 'tts.start' });
              session.ttsActive = true;
              try {
                await voiceService.ttsStream(
                  {
                    voice_id: selectedVoiceId,
                    text: textToSpeak,
                    format: 'mp3',
                    sample_rate: 22050,
                  },
                  {
                    onStart: info =>
                      sendJson({
                        type: 'tts.info',
                        format: info.format,
                        sample_rate: info.sample_rate,
                      }),
                    onData: chunk => {
                      if (session.ttsCanceled) return; // 忽略后续音频分片
                      try {
                        socket.send(chunk, { binary: true });
                      } catch {}
                    },
                    onEnd: () => {
                      if (!session.ttsCanceled) sendJson({ type: 'tts.end' });
                      session.ttsActive = false;
                    },
                  },
                );
              } catch (e: any) {
                sendJson({ type: 'error', stage: 'tts', message: e?.message || 'TTS failed' });
                return;
              }
            }

            sendJson({ type: 'done' });
          } else if (msg?.type === 'probe') {
            // 返回当前会话诊断数据
            sendJson({
              type: 'probe.resp',
              sampleRate: cfg.sampleRate,
              format: cfg.format,
              recvBytesTotal,
              recvChunkCount,
              bufferedChunks: audioChunks.length,
              isProcessing,
              ttsActive: session.ttsActive,
              lastRms: lastRmsAmplitude,
              lastRecvAt,
            });
          }
        } catch (err: any) {
          sendJson({ type: 'error', message: err?.message || 'unexpected error' });
        }
      });

      socket.on('close', () => {
        clearInterval(pingInterval);
        Logger.debug('WS client disconnected', 'VoiceCall');
      });
      socket.on('error', (e: any) =>
        Logger.warn(`WS client error: ${e?.message || e}`, 'VoiceCall'),
      );
    });
  } catch (e: any) {
    Logger.warn(`Failed to init realtime WS: ${e?.message || e}`, 'Main');
  }
}

bootstrap();
