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
  if (process.env.ISDEV === 'true') {
    const config = new DocumentBuilder()
      .setTitle('99AI API')
      .setDescription('99AI服务API文档（含 /api/open/* 开放接口：对外可直接调用）')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('open-app', '开放的角色管理接口（读写）：角色列表/详情、分类CRUD、App CRUD、全局情绪映射')
      .addTag('open-voice', '开放的语音管理接口（读写）：音色列表/详情、复刻/更新/删除、参数/元信息、试听、ASR')
      .addTag('open-affection', '开放的好感度接口（读写）：规则查询/维护、用户状态查询')
      .addTag('open-chat', '开放的前端聊天接口（读写）：文字对话、语音对话、TTS 播报（需显式 userId）')
      .addTag('open-chatLog', '开放的聊天记录接口（读）：查询我的对话列表、按应用查询、查询单条消息（需显式 userId）')
      .build();

    const document = SwaggerModule.createDocument(app, config);

    // 添加全局响应定义
    const responseSchema = {
      type: 'object',
      properties: {
        code: { type: 'number', example: 200 },
        data: { type: 'object' },
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '请求成功' },
      },
    };

    // 为每个路由添加标准响应格式
    Object.values(document.paths).forEach(path => {
      Object.values(path).forEach(method => {
        method.responses = {
          ...method.responses,
          '200': {
            description: '成功响应',
            content: {
              'application/json': {
                schema: responseSchema,
              },
            },
          },
        };
      });
    });

    SwaggerModule.setup('api-docs', app, document);
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
      let cfg = { sampleRate: 16000, format: 'wav' as 'wav'|'pcm'|'mp3'|'opus'|'speex'|'aac'|'amr', voice_id: '' };

      const sendJson = (obj: any) => {
        try { socket.send(JSON.stringify(obj)); } catch {}
      };

      socket.on('message', async (data: any, isBinary: boolean) => {
        try {
          if (isBinary) {
            audioChunks.push(Buffer.from(data));
            return;
          }
          const text = data.toString('utf8');
          let msg: any;
          try { msg = JSON.parse(text); } catch { return; }

          if (msg?.type === 'start') {
            audioChunks = [];
            cfg.sampleRate = Number(msg.sampleRate || 16000);
            cfg.format = (msg.format || 'wav');
            cfg.voice_id = msg.voice_id || '';
            sendJson({ type: 'started', sampleRate: cfg.sampleRate, format: cfg.format });
          } else if (msg?.type === 'cancel') {
            audioChunks = [];
            sendJson({ type: 'canceled' });
          } else if (msg?.type === 'stop') {
            const buf = Buffer.concat(audioChunks);
            audioChunks = [];
            if (!buf.length) {
              sendJson({ type: 'error', message: 'no audio received' });
              return;
            }

            const mime = cfg.format === 'wav' ? 'audio/wav'
              : cfg.format === 'mp3' ? 'audio/mpeg'
              : cfg.format === 'pcm' ? 'application/octet-stream' : `audio/${cfg.format}`;
            const audioBase64 = `data:${mime};base64,${buf.toString('base64')}`;

            // 1) ASR (streaming partials)
            sendJson({ type: 'asr.start' });
            let asrText = '';
            try {
              const asrRes = await voiceService.asr(
                { audioBase64, format: cfg.format as any, sample_rate: cfg.sampleRate },
                { onPartial: (t: string, b?: number, e?: number|null) => sendJson({ type: 'asr.partial', text: t, begin: b, end: e }) },
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
            let llmFull = '';
            try {
              await openAIChatService.chat(
                [ { role: 'user', content: asrText } ],
                {
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
                },
              );
              sendJson({ type: 'llm.final', text: llmFull });
            } catch (e: any) {
              sendJson({ type: 'error', stage: 'llm', message: e?.message || 'LLM failed' });
              return;
            }

            // 3) TTS (streaming audio frames)
            if (cfg.voice_id && llmFull) {
              sendJson({ type: 'tts.start' });
              try {
                await voiceService.ttsStream(
                  { voice_id: cfg.voice_id, text: llmFull, format: 'mp3', sample_rate: 22050 },
                  {
                    onStart: info => sendJson({ type: 'tts.info', format: info.format, sample_rate: info.sample_rate }),
                    onData: chunk => { try { socket.send(chunk, { binary: true }); } catch {} },
                    onEnd: () => sendJson({ type: 'tts.end' }),
                  },
                );
              } catch (e: any) {
                sendJson({ type: 'error', stage: 'tts', message: e?.message || 'TTS failed' });
                return;
              }
            }

            sendJson({ type: 'done' });
          }
        } catch (err: any) {
          sendJson({ type: 'error', message: err?.message || 'unexpected error' });
        }
      });

      socket.on('close', () => Logger.debug('WS client disconnected', 'VoiceCall'));
      socket.on('error', (e: any) => Logger.warn(`WS client error: ${e?.message || e}`, 'VoiceCall'));
    });
  } catch (e: any) {
    Logger.warn(`Failed to init realtime WS: ${e?.message || e}`, 'Main');
  }
}

bootstrap();
