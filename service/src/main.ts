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
  console.log('        99AI 服务启动中...            ');
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
    .setTitle('开放 API')
    .setDescription('99AI服务API文档（含 /api/open/* 开放接口：对外可直接调用）')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag(
      'open-app',
      '开放的角色管理接口（读写）：角色列表/详情、分类CRUD、角色CRUD、全局情绪映射',
    )
    .addTag(
      'open-voice',
      '开放的语音管理接口（读写）：音色列表/详情、复刻/更新/删除、参数/元信息、试听、ASR',
    )
    .addTag('open-affection', '开放的好感度接口（读写）：规则查询/维护、用户状态查询')
    .addTag(
      'open-chat',
      '开放的前端聊天接口（读写）：文字对话、语音对话、TTS 播报（需显式 userId）',
    )
    .addTag(
      'open-chatLog',
      '开放的聊天记录接口（读）：查询我的对话列表、按应用查询、查询单条消息（需显式 userId）',
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
      } = { llmAbort: null, ttsCanceled: false, ttsActive: false };

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

      // 流式LLM处理 - 使用真正的流式TTS会话
      const processLLMStream = async (text: string) => {
        if (session.ttsCanceled) return;

        sendJson({ type: 'llm.start' });
        const abortController = new AbortController();
        session.llmAbort = abortController;

        // 如果配置了音色，建立流式TTS会话（一次连接，多次发送）
        let ttsSession: any = null;
        if (cfg.voice_id) {
          try {
            Logger.debug('创建流式TTS会话', 'VoiceCall');
            ttsSession = await voiceService.createTTSStreamSession({
              voice_id: cfg.voice_id,
              format: 'mp3',
              sample_rate: 22050,
              onStart: info => {
                sendJson({ type: 'tts.start', format: info.format, sample_rate: info.sample_rate });
                Logger.debug('TTS会话已启动', 'VoiceCall');
              },
              onData: chunk => {
                if (session.ttsCanceled) return;
                try {
                  socket.send(chunk, { binary: true });
                } catch {}
              },
              onEnd: () => {
                sendJson({ type: 'tts.end' });
                Logger.debug('TTS会话已结束', 'VoiceCall');
              },
              onError: err => {
                Logger.error(`TTS会话错误: ${err?.message}`, 'VoiceCall');
                sendJson({ type: 'error', stage: 'tts', message: err?.message || 'TTS错误' });
              },
            });
          } catch (e: any) {
            Logger.error(`创建TTS会话失败: ${e?.message}`, 'VoiceCall');
            sendJson({ type: 'error', stage: 'tts', message: e?.message || 'TTS初始化失败' });
          }
        }

        try {
          const chatConfig = {
            chatId: 'realtime',
            apiKey: '',
            model: session.chatConfig?.model || 'gpt-4o-mini',
            modelName: session.chatConfig?.modelName || 'AI助手',
            temperature: session.chatConfig?.temperature || 1,
            prompt: session.chatConfig?.prompt
              ? `${session.chatConfig.prompt}\n\n用户说：${text}`
              : text,
            timeout: 300000,
            proxyUrl: '',
            abortController,
            usingDeepThinking: false,
            usingNetwork: false,
            extraParam: null,
            deepThinkingType: 0,
            isFileUpload: 0,
            isImageUpload: 0,
            onProgress: async (delta: any) => {
              const t = delta?.content?.[0]?.text || '';
              if (t) {
                llmBuffer += t;
                sendJson({ type: 'llm.partial', text: t });

                // 通过同一个TTS会话流式发送文本（不阻塞LLM输出）
                if (ttsSession && !session.ttsCanceled) {
                  try {
                    ttsSession.sendText(t);
                  } catch (e: any) {
                    Logger.warn(`TTS发送文本失败: ${e?.message}`, 'VoiceCall');
                  }
                }
              }
            },
          };

          await openAIChatService.chat([{ role: 'user', content: text }], chatConfig);
          sendJson({ type: 'llm.final', text: llmBuffer });

          // LLM完成后，结束TTS会话
          if (ttsSession && !session.ttsCanceled) {
            try {
              Logger.debug('结束TTS会话', 'VoiceCall');
              await ttsSession.finish();
            } catch (e: any) {
              Logger.warn(`结束TTS会话失败: ${e?.message}`, 'VoiceCall');
            }
          }
        } catch (e: any) {
          sendJson({ type: 'error', stage: 'llm', message: e?.message || 'LLM failed' });
          // 出错时也要关闭TTS会话
          if (ttsSession) {
            try {
              ttsSession.cancel();
            } catch {}
          }
        }
      };

      socket.on('message', async (data: any, isBinary: boolean) => {
        try {
          const isBuf = Buffer.isBuffer(data) || typeof data !== 'string';
          if (isBuf) {
            // 持续通话模式：实时处理音频数据
            if (session.ttsCanceled) {
              // 如果已取消，忽略新的音频数据
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
          const text: string =
            typeof data === 'string' ? data : Buffer.from(data as any).toString('utf8');
          let msg: any;
          try {
            msg = JSON.parse(text);
          } catch {
            return;
          }

          if (msg?.type === 'start_call') {
            // 开始持续通话模式
            audioChunks = [];
            cfg.sampleRate = Number(msg.sampleRate || 8000);
            cfg.format = msg.format || 'wav';
            cfg.voice_id = msg.voice_id || '';
            session.ttsCanceled = false;
            session.ttsActive = false;

            // 保存角色配置
            session.chatConfig = {
              appId: msg.appId,
              model: msg.model || 'gpt-4o-mini',
              modelName: msg.modelName || 'AI助手',
              prompt: msg.prompt || '',
              temperature: Number(msg.temperature || 1),
              config: msg.config || {},
            };

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
            const buf = Buffer.concat(audioChunks);
            audioChunks = [];
            if (!buf.length) {
              // 放宽：空音频直接返回空结果，避免前端体验受阻
              sendJson({ type: 'asr.final', text: '' });
              sendJson({ type: 'done' });
              return;
            }

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

            // 2) LLM chat (streaming text)
            sendJson({ type: 'llm.start' });
            const abortController = new AbortController();
            session.llmAbort = abortController;
            let llmFull = '';
            try {
              await openAIChatService.chat([{ role: 'user', content: asrText }], {
                chatId: 'realtime',
                apiKey: '',
                model: 'gpt-4o-mini',
                modelName: 'AI助手',
                temperature: 1,
                prompt: asrText,
                timeout: 300000,
                proxyUrl: '',
                abortController,
                usingDeepThinking: false,
                usingNetwork: false,
                extraParam: null,
                deepThinkingType: 0,
                isFileUpload: 0,
                isImageUpload: 0,
                onProgress: (delta: any) => {
                  const t = delta?.content?.[0]?.text || '';
                  if (t) {
                    llmFull += t;
                    sendJson({ type: 'llm.partial', text: t });
                  }
                },
              });
              sendJson({ type: 'llm.final', text: llmFull });
            } catch (e: any) {
              sendJson({ type: 'error', stage: 'llm', message: e?.message || 'LLM failed' });
              return;
            }

            // 3) TTS (streaming audio frames)
            if (cfg.voice_id && llmFull) {
              if (session.ttsCanceled) {
                // 若在 LLM 期间已被取消，则不再进入 TTS
                sendJson({ type: 'done' });
                return;
              }
              sendJson({ type: 'tts.start' });
              session.ttsActive = true;
              try {
                await voiceService.ttsStream(
                  { voice_id: cfg.voice_id, text: llmFull, format: 'mp3', sample_rate: 22050 },
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
