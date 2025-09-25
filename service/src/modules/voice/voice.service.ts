import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { GlobalConfigService } from '../globalConfig/globalConfig.service';
import { UploadService } from '../upload/upload.service';

const COSY_CUSTOMIZATION_URL = 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization';
const COSY_WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/';

@Injectable()
export class VoiceService {
  constructor(
    private readonly globalConfigService: GlobalConfigService,
    private readonly uploadService: UploadService,
  ) {}

  private async getApiKey(): Promise<string> {
    const dashscopeApiKey = await this.globalConfigService.getConfigs(['dashscopeApiKey']);
    const apiKey = (dashscopeApiKey as any) || process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      throw new HttpException('未配置阿里百炼 DashScope API Key。请在系统配置中设置 dashscopeApiKey，或在环境变量中设置 DASHSCOPE_API_KEY。', HttpStatus.BAD_REQUEST);
    }
    return apiKey as string;
  }

  private getAxiosHeaders(apiKey: string) {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async getDefaultModel(): Promise<string> {
    const cosyvoiceDefaultModel = await this.globalConfigService.getConfigs(['cosyvoiceDefaultModel']);
    return (cosyvoiceDefaultModel as any) || 'cosyvoice-v2';
  }

  async enroll(body: { prefix: string; url: string; targetModel?: string; name?: string }) {
    const { prefix, url } = body;
    const targetModel = body.targetModel || (await this.getDefaultModel());
    if (!prefix || !url) {
      throw new HttpException('prefix 与 url 为必填', HttpStatus.BAD_REQUEST);
    }
    const apiKey = await this.getApiKey();
    const payload = {
      model: 'voice-enrollment',
      input: {
        action: 'create_voice',
        target_model: targetModel,
        prefix,
        url,
      },
    };
    const res = await axios.post(COSY_CUSTOMIZATION_URL, payload, { headers: this.getAxiosHeaders(apiKey) });
    const data = res.data;
    try {
      // 若传入了名称且返回了 voice_id，则保存名称元数据
      const voiceId = data?.output?.voice_id || data?.voice_id;
      if (body?.name && voiceId) {
        await this.setVoiceMeta({ voice_id: String(voiceId), meta: { name: String(body.name) } });
      }
    } catch (_) {}
    return data;
  }

  async list(query: { prefix?: string; page_index?: number; page_size?: number }) {
    const { prefix = null, page_index = 0, page_size = 10 } = query || {} as any;
    const apiKey = await this.getApiKey();
    const payload = {
      model: 'voice-enrollment',
      input: {
        action: 'list_voice',
        prefix,
        page_index,
        page_size,
      },
    };
    const res = await axios.post(COSY_CUSTOMIZATION_URL, payload, { headers: this.getAxiosHeaders(apiKey) });
    return res.data;
  }

  async query(voiceId: string) {
    if (!voiceId) throw new HttpException('voiceId 必填', HttpStatus.BAD_REQUEST);
    const apiKey = await this.getApiKey();
    const payload = {
      model: 'voice-enrollment',
      input: {
        action: 'query_voice',
        voice_id: voiceId,
      },
    };
    const res = await axios.post(COSY_CUSTOMIZATION_URL, payload, { headers: this.getAxiosHeaders(apiKey) });
    return res.data;
  }

  async update(body: { voice_id: string; url: string }) {
    const { voice_id, url } = body;
    if (!voice_id || !url) throw new HttpException('voice_id 与 url 必填', HttpStatus.BAD_REQUEST);
    const apiKey = await this.getApiKey();
    const payload = {
      model: 'voice-enrollment',
      input: {
        action: 'update_voice',
        voice_id,
        url,
      },
    };
    const res = await axios.post(COSY_CUSTOMIZATION_URL, payload, { headers: this.getAxiosHeaders(apiKey) });
    return res.data;
  }

  async remove(body: { voice_id: string }) {
    const { voice_id } = body;
    if (!voice_id) throw new HttpException('voice_id 必填', HttpStatus.BAD_REQUEST);
    const apiKey = await this.getApiKey();
    const payload = {
      model: 'voice-enrollment',
      input: {
        action: 'delete_voice',
        voice_id,
      },
    };
    const res = await axios.post(COSY_CUSTOMIZATION_URL, payload, { headers: this.getAxiosHeaders(apiKey) });
    return res.data;
  }

  /**
   * 语音识别（ASR）：接收 base64 音频（建议 WAV PCM 单声道 16kHz），调用 DashScope Paraformer 实时识别（WebSocket）
   * 返回聚合后的文本与句子列表
   */
  async asr(
    body: {
      audioBase64: string;
      format?: 'wav' | 'pcm' | 'mp3' | 'opus' | 'speex' | 'aac' | 'amr';
      sample_rate?: number;
      model?: string;
      language_hints?: string[];
      disfluency_removal_enabled?: boolean;
    },
    opts?: { onPartial?: (text: string, begin?: number, end?: number | null) => void }
  ): Promise<{ text: string; sentences?: Array<{ begin_time: number; end_time: number | null; text: string }> }> {
    const { audioBase64 } = body || ({} as any);
    if (!audioBase64) throw new HttpException('audioBase64 必填', HttpStatus.BAD_REQUEST);

    const fmt = (body.format || 'wav') as 'wav' | 'pcm' | 'mp3' | 'opus' | 'speex' | 'aac' | 'amr';
    const sampleRate = Number(body.sample_rate ?? 16000);
    const model = body.model || 'paraformer-realtime-v2';
    const languageHints = (body.language_hints || undefined) as string[] | undefined;
    const disfluency = body.disfluency_removal_enabled ?? false;

    const apiKey = await this.getApiKey();

    // 动态引入 ws 依赖
    let WS: any;
    try {
      const WSMod: any = await import('ws');
      WS = WSMod?.default || WSMod;
      if (!WS) throw new Error('ws module not resolved');
    } catch (e) {
      Logger.error('缺少依赖 ws，请先安装: pnpm add ws', 'VoiceService');
      throw new HttpException('服务器未安装 ws 依赖，无法进行WebSocket识别。', HttpStatus.NOT_IMPLEMENTED);
    }

    // 解析 base64，兼容 dataURL
    const base64 = (audioBase64 || '').split(',').pop() || audioBase64;
    let audioBuf: Buffer;
    try {
      audioBuf = Buffer.from(base64, 'base64');
    } catch {
      throw new HttpException('audioBase64 非法', HttpStatus.BAD_REQUEST);
    }

    const taskId = cryptoRandomId();
    const headers = {
      Authorization: `bearer ${apiKey}`,
      'X-DashScope-DataInspection': 'enable',
    } as Record<string, string>;

    const ws = new WS(COSY_WS_URL, { headers });

    let finished = false;
    let finalText = '';
    const sentences: Array<{ begin_time: number; end_time: number | null; text: string }> = [];

    const sendRunTask = () => {
      const payload: any = {
        header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
        payload: {
          task_group: 'audio',
          task: 'asr',
          function: 'recognition',
          model,
          parameters: {
            format: fmt,
            sample_rate: sampleRate,
            disfluency_removal_enabled: disfluency,
          },
          input: {},
        },
      };
      if (languageHints && Array.isArray(languageHints) && languageHints.length) {
        payload.payload.parameters.language_hints = languageHints;
      }
      ws.send(JSON.stringify(payload));
    };

    const chunkAndSendAudio = async () => {
      const chunkSize = 1024; // 近似 100ms 的数据块大小（仅示意）
      let offset = 0;
      const sendNext = () => {
        if (finished) return;
        if (offset >= audioBuf.length) {
          const finishMsg = {
            header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' },
            payload: { input: {} },
          };
          ws.send(JSON.stringify(finishMsg));
          return;
        }
        const end = Math.min(offset + chunkSize, audioBuf.length);
        const buf = audioBuf.subarray(offset, end);
        ws.send(buf);
        offset = end;
        setTimeout(sendNext, 100);
      };
      sendNext();
    };

    const done = new Promise<{ text: string; sentences: any[] }>((resolve, reject) => {
      ws.on('open', () => {
        sendRunTask();
      });

      ws.on('message', (data: any, isBinary: boolean) => {
        if (isBinary) return; // ASR 返回为 JSON 事件
        try {
          const msg = JSON.parse(data.toString());
          const event = msg?.header?.event;
          if (event === 'task-started') {
            chunkAndSendAudio();
          } else if (event === 'result-generated') {
            const s = msg?.payload?.output?.sentence;
            if (s?.text) {
              sentences.push({ begin_time: s.begin_time, end_time: s.end_time ?? null, text: s.text });
              finalText += s.text;
              try {
                opts?.onPartial?.(s.text, s.begin_time, s.end_time ?? null);
              } catch (_) {}
            }
          } else if (event === 'task-finished') {
            finished = true;
            ws.close();
          } else if (event === 'task-failed') {
            finished = true;
            ws.close();
            return reject(new HttpException(msg?.header?.error_message || 'ASR 任务失败', HttpStatus.BAD_GATEWAY));
          }
        } catch {
          // 忽略解析异常
        }
      });

      ws.on('close', () => {
        resolve({ text: finalText, sentences });
      });

      ws.on('error', (err: any) => {
        reject(new HttpException(err?.message || 'WebSocket 错误', HttpStatus.BAD_GATEWAY));
      });
    });

    const result = await done;
    return { text: result.text, sentences: result.sentences };
  }


  // 读取/保存音色默认合成参数（按 voice_id 存储）
  async getVoiceParams(voiceId: string): Promise<any | null> {
    if (!voiceId) return null;
    const key = `voiceParams:${voiceId}`;
    const raw = (await this.globalConfigService.getConfigs([key])) as any;
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async setVoiceParams(body: { voice_id: string; params: any }) {
    const { voice_id, params } = body;
    if (!voice_id || !params) throw new HttpException('voice_id 与 params 必填', HttpStatus.BAD_REQUEST);
    const key = `voiceParams:${voice_id}`;
    await this.globalConfigService.createOrUpdate({ configKey: key, configVal: JSON.stringify(params), status: 1 });
    return { success: true };
  }

  // 读取/保存音色元信息（如自定义名称），按 voice_id 存储
  async getVoiceMeta(voiceId: string): Promise<any | null> {
    if (!voiceId) return null;
    const key = `voiceMeta:${voiceId}`;
    const raw = (await this.globalConfigService.getConfigs([key])) as any;
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async setVoiceMeta(body: { voice_id: string; meta: any }) {
    const { voice_id, meta } = body;
    if (!voice_id || !meta) throw new HttpException('voice_id 与 meta 必填', HttpStatus.BAD_REQUEST);
    const key = `voiceMeta:${voice_id}`;
    await this.globalConfigService.createOrUpdate({ configKey: key, configVal: JSON.stringify(meta), status: 1 });
    return { success: true };
  }


  /**
   * 合成试听音频并上传至当前配置的存储（本地/S3/OSS等），返回可访问URL
   */
  async preview(body: { voice_id: string; text: string; model?: string; format?: 'mp3'|'wav'|'pcm'; sample_rate?: number; volume?: number; rate?: number; pitch?: number }) {
    const { voice_id, text } = body;
    if (!voice_id || !text) throw new HttpException('voice_id 与 text 必填', HttpStatus.BAD_REQUEST);

    // 读取该音色的默认参数，缺省时应用
    const saved = (await this.getVoiceParams(voice_id)) || {};
    const format = (body.format || saved.format || 'mp3') as 'mp3'|'wav'|'pcm';
    const sample_rate = Number(body.sample_rate ?? saved.sample_rate ?? 22050);
    const volume = Number(body.volume ?? saved.volume ?? 50);
    const rate = Number(body.rate ?? saved.rate ?? 1);
    const pitch = Number(body.pitch ?? saved.pitch ?? 1);

    // 强制使用与复刻相同的模型：从 voice_id 推断模型；若无法推断，再退回到前端传参或默认模型
    const lowerId = (voice_id || '').toLowerCase();
    let modelToUse: string;
    if (lowerId.startsWith('cosyvoice-v3-plus-')) modelToUse = 'cosyvoice-v3-plus';
    else if (lowerId.startsWith('cosyvoice-v3-')) modelToUse = 'cosyvoice-v3';
    else if (lowerId.startsWith('cosyvoice-v2-')) modelToUse = 'cosyvoice-v2';
    else modelToUse = body.model || (await this.getDefaultModel());

    const apiKey = await this.getApiKey();

    // 动态引入 ws 依赖，若未安装则给出提示
    let WS: any;
    try {
      const WSMod: any = await import('ws');
      WS = WSMod?.default || WSMod; // 兼容不同打包/导出方式
      if (!WS) throw new Error('ws module not resolved');
    } catch (e) {
      Logger.error('缺少依赖 ws，请先安装: pnpm add ws', 'VoiceService');
      throw new HttpException('服务器未安装 ws 依赖，无法进行WebSocket试听。请联系管理员安装依赖后重试。', HttpStatus.NOT_IMPLEMENTED);
    }

    const taskId = cryptoRandomId();
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'X-DashScope-DataInspection': 'enable',
    } as Record<string, string>;

    const ws = new WS(COSY_WS_URL, { headers });

    const audioBuffers: Buffer[] = [];

    const uploadOnFinish = new Promise<string>((resolve, reject) => {
      ws.on('open', () => {
        const runTask = {
          header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
          payload: {
            task_group: 'audio',
            task: 'tts',
            function: 'SpeechSynthesizer',
            model: modelToUse,
            parameters: { text_type: 'PlainText', voice: voice_id, format, sample_rate, volume, rate, pitch },
            input: {},
          },
        };
        ws.send(JSON.stringify(runTask));
      });

      ws.on('message', (data: any, isBinary: boolean) => {
        // ws@8: (data, isBinary) signature
        if (isBinary) {
          audioBuffers.push(Buffer.from(data));
          return;
        }
        try {
          const msg = JSON.parse(data.toString());
          const event = msg?.header?.event;
          if (event === 'task-started') {
            const continueTask = {
              header: { action: 'continue-task', task_id: taskId, streaming: 'duplex' },
              payload: { input: { text } },
            };
            ws.send(JSON.stringify(continueTask));
            const finishTask = {
              header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' },
              payload: { input: {} },
            };
            ws.send(JSON.stringify(finishTask));
          } else if (event === 'task-finished') {
            ws.close();
          } else if (event === 'task-failed') {
            ws.close();
            reject(new HttpException(msg?.header?.error_message || 'TTS任务失败', HttpStatus.BAD_GATEWAY));
          }
        } catch (err) {
          // ignore parse errors
        }
      });

      ws.on('close', async () => {
        try {
          if (!audioBuffers.length) throw new Error('未收到音频数据');
          const buffer = Buffer.concat(audioBuffers);
          const mimetype = format === 'mp3' ? 'audio/mpeg' : (format === 'wav' ? 'audio/wav' : 'application/octet-stream');
          const url = await this.uploadService.uploadFile({ buffer, mimetype } as any, 'voicePreview');
          resolve(url as any);
        } catch (e: any) {
          // 透传上传模块的异常状态码，避免一律 500
          if (e instanceof HttpException) return reject(e);
          reject(new HttpException(e?.message || '音频上传失败', HttpStatus.INTERNAL_SERVER_ERROR));
        }
      });

      ws.on('error', (err: any) => {
        reject(new HttpException(err?.message || 'WebSocket错误', HttpStatus.BAD_GATEWAY));
      });
    });

    const url = await uploadOnFinish;
    return { url };
  }

  /**
   * 流式语音合成：边合成边通过回调吐出音频片段
   */
  async ttsStream(
    body: { voice_id: string; text: string; model?: string; format?: 'mp3'|'wav'|'pcm'; sample_rate?: number; volume?: number; rate?: number; pitch?: number },
    opts?: { onStart?: (info: { format: 'mp3'|'wav'|'pcm'; sample_rate: number }) => void; onData?: (chunk: Buffer) => void; onEnd?: () => void }
  ) {
    const { voice_id, text } = body || ({} as any);
    if (!voice_id || !text) throw new HttpException('voice_id 与 text 必填', HttpStatus.BAD_REQUEST);

    const saved = (await this.getVoiceParams(voice_id)) || {};
    const format = (body.format || saved.format || 'mp3') as 'mp3'|'wav'|'pcm';
    const sample_rate = Number(body.sample_rate ?? saved.sample_rate ?? 22050);
    const volume = Number(body.volume ?? saved.volume ?? 50);
    const rate = Number(body.rate ?? saved.rate ?? 1);
    const pitch = Number(body.pitch ?? saved.pitch ?? 1);

    // 依据 voice_id 推断默认模型
    const lowerId = (voice_id || '').toLowerCase();
    let modelToUse: string;
    if (lowerId.startsWith('cosyvoice-v3-plus-')) modelToUse = 'cosyvoice-v3-plus';
    else if (lowerId.startsWith('cosyvoice-v3-')) modelToUse = 'cosyvoice-v3';
    else if (lowerId.startsWith('cosyvoice-v2-')) modelToUse = 'cosyvoice-v2';
    else modelToUse = body.model || (await this.getDefaultModel());

    const apiKey = await this.getApiKey();

    let WS: any;
    try {
      const WSMod: any = await import('ws');
      WS = WSMod?.default || WSMod;
      if (!WS) throw new Error('ws module not resolved');
    } catch (e) {
      Logger.error('缺少依赖 ws，请先安装: pnpm add ws', 'VoiceService');
      throw new HttpException('服务器未安装 ws 依赖，无法进行WebSocket合成。', HttpStatus.NOT_IMPLEMENTED);
    }

    const taskId = cryptoRandomId();
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'X-DashScope-DataInspection': 'enable',
    } as Record<string, string>;

    const ws = new WS(COSY_WS_URL, { headers });

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        // 通知开始（在 task-started 后再发一次可靠参数）
        try { opts?.onStart?.({ format, sample_rate }); } catch {}
        const runTask = {
          header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
          payload: {
            task_group: 'audio',
            task: 'tts',
            function: 'SpeechSynthesizer',
            model: modelToUse,
            parameters: { text_type: 'PlainText', voice: voice_id, format, sample_rate, volume, rate, pitch },
            input: {},
          },
        };
        ws.send(JSON.stringify(runTask));
      });

      ws.on('message', (data: any, isBinary: boolean) => {
        if (isBinary) {
          try { opts?.onData?.(Buffer.from(data)); } catch {}
          return;
        }
        try {
          const msg = JSON.parse(data.toString());
          const event = msg?.header?.event;
          if (event === 'task-started') {
            // 发送文本并结束上行
            const continueTask = {
              header: { action: 'continue-task', task_id: taskId, streaming: 'duplex' },
              payload: { input: { text } },
            };
            ws.send(JSON.stringify(continueTask));
            const finishTask = {
              header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' },
              payload: { input: {} },
            };
            ws.send(JSON.stringify(finishTask));
          } else if (event === 'task-finished') {
            ws.close();
          } else if (event === 'task-failed') {
            ws.close();
            reject(new HttpException(msg?.header?.error_message || 'TTS任务失败', HttpStatus.BAD_GATEWAY));
          }
        } catch {
          // ignore
        }
      });

      ws.on('close', () => {
        try { opts?.onEnd?.(); } catch {}
        resolve();
      });

      ws.on('error', (err: any) => {
        reject(new HttpException(err?.message || 'WebSocket错误', HttpStatus.BAD_GATEWAY));
      });
    });

    return { success: true };
  }

}

function cryptoRandomId() {
  // 简易UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

