import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import * as FormData from 'form-data';
import { GlobalConfigService } from '../../globalConfig/globalConfig.service';

export interface MinimaxConfig {
  voiceId: string;
  model?: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  languageBoost?: string;
}

export interface FileUploadRequest {
  audioUrl?: string;
  audioBuffer?: Buffer;
  fileName?: string;
  purpose?: 'voice_clone' | 'speech';
}

export interface TTSCreateRequest {
  text: string;
  voiceId: string;
  model?: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  languageBoost?: string;
  audioSampleRate?: number;
  bitrate?: number;
  format?: string;
  channel?: number;
  emotion?: string;
}

export interface TTSQueryResponse {
  taskId: string;
  status: 'Processing' | 'Success' | 'Failed' | string;
  fileId?: string;
  message?: string;
}

export interface VoiceDesignRequest {
  prompt: string; // 音色风格描述，如"讲述悬疑故事的播音员，声音低沉富有磁性"
  previewText: string; // 试听文本，用于生成试听音频
}

export interface VoiceDesignResponse {
  voiceId: string; // 生成的音色ID，如 ttv-voice-2025060717322425-xxxxxxxx
  trialAudioHex?: string | null;
}

/**
 * MiniMax 语音克隆和语音合成 Provider
 */
@Injectable()
export class MinimaxProvider {
  private readonly logger = new Logger(MinimaxProvider.name);
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly pollInterval: number;
  private readonly pollTimeout: number;

  constructor(private readonly globalConfigService: GlobalConfigService) {
    this.baseUrl = process.env.MINIMAX_API_BASE_URL || 'https://api.minimaxi.com';
    this.maxRetries = Number(process.env.MINIMAX_MAX_RETRIES) || 3;
    this.pollInterval = Number(process.env.MINIMAX_POLL_INTERVAL) || 2000; // 2秒轮询一次
    this.pollTimeout = Number(process.env.MINIMAX_POLL_TIMEOUT) || 180000; // 3分钟超时
  }

  private async getApiKey(): Promise<string> {
    const config = await this.globalConfigService.getConfigs(['minimaxApiKey']);
    const apiKey = (config as any) || process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      throw new HttpException('未配置 MiniMax API Key', HttpStatus.BAD_REQUEST);
    }
    return apiKey as string;
  }

  private async getHeaders(isFormData = false): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey();
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    return headers;
  }

  private async retryRequest<T>(fn: () => Promise<T>, operation: string): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const isRetryable =
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ENOTFOUND' ||
          (error.response?.status >= 500 && error.response?.status < 600);
        if (attempt < this.maxRetries && isRetryable) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }
    throw lastError;
  }

  /** 将 MiniMax API 错误消息转换为友好的中文提示 */
  private translateErrorMessage(message: string): string {
    if (!message) return '操作失败，请重试';
    const errorMap: Record<string, string> = {
      'voice duration too short': '音频时长不能少于10秒，请重新上传',
      'voice duration too long': '音频时长过长，请上传10秒至5分钟的音频',
      'file not found': '音频文件不存在，请重新上传',
      'invalid file format': '音频格式不支持，请上传 mp3、m4a、wav 格式',
      'file size too large': '音频文件过大，请上传不超过20MB的文件',
    };
    // 遍历错误映射，进行模糊匹配
    for (const [key, value] of Object.entries(errorMap)) {
      if (message.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
    return message;
  }

  /** 根据文件名或URL推断音频的 MIME 类型 */
  private getAudioContentType(fileName?: string): string {
    if (!fileName) return 'audio/wav';
    const ext = fileName.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
      webm: 'audio/webm',
    };
    return mimeTypes[ext || ''] || 'audio/wav';
  }

  /** 上传音频文件 */
  async uploadFile(request: FileUploadRequest): Promise<{ fileId: number | string }> {
    const headers = await this.getHeaders(true);
    const formData = new FormData();
    formData.append('purpose', request.purpose || 'voice_clone');

    // 根据文件名推断正确的 MIME 类型
    const fileName = request.fileName || 'audio.wav';
    const contentType = this.getAudioContentType(fileName);
    this.logger.log(`[uploadFile] 上传文件: ${fileName}, contentType: ${contentType}`);

    if (request.audioBuffer) {
      formData.append('file', request.audioBuffer, {
        filename: fileName,
        contentType,
      });
    } else if (request.audioUrl) {
      // 从 URL 推断文件名和类型
      const urlFileName = request.audioUrl.split('/').pop()?.split('?')[0] || fileName;
      const urlContentType = this.getAudioContentType(urlFileName);
      this.logger.log(`[uploadFile] 从URL下载: ${urlFileName}, contentType: ${urlContentType}`);

      const audioResponse = await axios.get(request.audioUrl, { responseType: 'arraybuffer' });
      formData.append('file', Buffer.from(audioResponse.data), {
        filename: urlFileName,
        contentType: urlContentType,
      });
    } else {
      throw new HttpException('必须提供 audioUrl 或 audioBuffer', HttpStatus.BAD_REQUEST);
    }

    try {
      const config: AxiosRequestConfig = {
        headers: { ...headers, ...formData.getHeaders() },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      };
      const response = await this.retryRequest(
        () => axios.post(`${this.baseUrl}/v1/files/upload`, formData, config),
        'uploadFile',
      );

      if (response.data.base_resp?.status_code !== 0) {
        throw new HttpException(
          response.data.base_resp?.status_msg || '文件上传失败',
          HttpStatus.BAD_REQUEST,
        );
      }
      return { fileId: response.data.file.file_id };
    } catch (error) {
      this.logger.error(`[uploadFile] ${error?.message || error}`);
      throw new HttpException(
        error?.response?.data?.base_resp?.status_msg || error?.message || '文件上传失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** 创建异步 TTS 任务 */
  async createTTS(request: TTSCreateRequest): Promise<{ taskId: string; fileId: string }> {
    const headers = await this.getHeaders();
    const payload = {
      model: request.model || 'speech-2.6-hd',
      text: request.text,
      language_boost: request.languageBoost || 'auto',
      voice_setting: {
        voice_id: String(request.voiceId),
        speed: request.speed || 1,
        vol: request.vol || 1,
        pitch: request.pitch || 0,
        ...(request.emotion ? { emotion: request.emotion } : {}),
      },
      audio_setting: {
        audio_sample_rate: request.audioSampleRate || 32000,
        bitrate: request.bitrate || 128000,
        format: request.format || 'mp3',
        channel: request.channel || 2,
      },
    };

    try {
      const response = await this.retryRequest(
        () => axios.post(`${this.baseUrl}/v1/t2a_async_v2`, payload, { headers }),
        'createTTS',
      );

      if (response.data.base_resp?.status_code !== 0) {
        throw new HttpException(
          response.data.base_resp?.status_msg || 'TTS 任务创建失败',
          HttpStatus.BAD_REQUEST,
        );
      }
      return { taskId: String(response.data.task_id), fileId: String(response.data.file_id) };
    } catch (error) {
      this.logger.error(`[createTTS] ${error?.message || error}`);
      throw new HttpException(
        error?.response?.data?.base_resp?.status_msg || error?.message || 'TTS 任务创建失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 同步 TTS 合成（直接返回音频，无需轮询）
   * 适用于短文本，避免异步轮询超时问题
   */
  async createTTSSync(request: TTSCreateRequest): Promise<{ audioBuffer: Buffer }> {
    const headers = await this.getHeaders();
    const payload = {
      model: request.model || 'speech-2.6-hd',
      text: request.text,
      language_boost: request.languageBoost || 'auto',
      voice_setting: {
        voice_id: String(request.voiceId),
        speed: request.speed || 1,
        vol: request.vol || 1,
        pitch: request.pitch || 0,
        ...(request.emotion ? { emotion: request.emotion } : {}),
      },
      audio_setting: {
        audio_sample_rate: request.audioSampleRate || 32000,
        bitrate: request.bitrate || 128000,
        format: request.format || 'mp3',
        channel: request.channel || 2,
      },
    };

    try {
      this.logger.log(`[createTTSSync] 开始同步 TTS 合成，文本长度: ${request.text.length}`);
      this.logger.log(`[createTTSSync] 完整文本内容: "${request.text}"`);
      this.logger.log(`[createTTSSync] 请求参数: ${JSON.stringify(payload, null, 2)}`);
      const response = await this.retryRequest(
        () =>
          axios.post(`${this.baseUrl}/v1/t2a_v2`, payload, {
            headers,
            timeout: 120000, // 2分钟超时
          }),
        'createTTSSync',
      );

      if (response.data.base_resp?.status_code !== 0) {
        throw new HttpException(
          response.data.base_resp?.status_msg || 'TTS 合成失败',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 同步接口返回 hex 编码的音频数据
      const audioHex = response.data.data?.audio;
      this.logger.log(
        `[createTTSSync] MiniMax响应: status_code=${
          response.data.base_resp?.status_code
        }, extra_info=${JSON.stringify(response.data.extra_info || {})}`,
      );
      if (!audioHex) {
        throw new HttpException('TTS 合成未返回音频数据', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const audioBuffer = Buffer.from(audioHex, 'hex');
      this.logger.log(`[createTTSSync] 合成完成，音频大小: ${audioBuffer.length} bytes`);
      return { audioBuffer };
    } catch (error) {
      this.logger.error(`[createTTSSync] ${error?.message || error}`);
      throw new HttpException(
        error?.response?.data?.base_resp?.status_msg || error?.message || 'TTS 合成失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** 查询 TTS 任务状态 */
  async queryTTS(taskId: string): Promise<TTSQueryResponse> {
    const headers = await this.getHeaders();
    try {
      const response = await this.retryRequest(
        () =>
          axios.get(`${this.baseUrl}/v1/query/t2a_async_query_v2?task_id=${taskId}`, { headers }),
        'queryTTS',
      );

      if (response.data.base_resp?.status_code !== 0) {
        throw new HttpException(
          response.data.base_resp?.status_msg || '查询失败',
          HttpStatus.BAD_REQUEST,
        );
      }
      return {
        taskId: String(response.data.task_id),
        status: response.data.status,
        fileId: response.data.file_id ? String(response.data.file_id) : undefined,
      };
    } catch (error) {
      this.logger.error(`[queryTTS] ${error?.message || error}`);
      throw new HttpException(
        error?.response?.data?.base_resp?.status_msg || error?.message || '查询失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** 下载音频文件 */
  async downloadFile(fileId: string | number): Promise<Buffer> {
    const headers = await this.getHeaders();
    try {
      const response = await this.retryRequest(
        () =>
          axios.get(`${this.baseUrl}/v1/files/retrieve_content?file_id=${fileId}`, {
            headers,
            responseType: 'arraybuffer',
          }),
        'downloadFile',
      );
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(`[downloadFile] ${error?.message || error}`);
      throw new HttpException(error?.message || '下载文件失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /** 轮询等待 TTS 任务完成 */
  async pollTTSCompletion(taskId: string): Promise<TTSQueryResponse> {
    const startTime = Date.now();
    let pollCount = 0;
    this.logger.log(`[pollTTSCompletion] 开始轮询任务 ${taskId}，超时时间: ${this.pollTimeout}ms`);

    while (Date.now() - startTime < this.pollTimeout) {
      pollCount++;
      const result = await this.queryTTS(taskId);
      const elapsed = Date.now() - startTime;
      this.logger.debug(
        `[pollTTSCompletion] 第${pollCount}次查询，状态: ${result.status}，已耗时: ${elapsed}ms`,
      );

      if (result.status === 'Success') {
        this.logger.log(`[pollTTSCompletion] 任务 ${taskId} 完成，耗时: ${elapsed}ms`);
        return result;
      }
      if (result.status === 'Failed') {
        this.logger.error(`[pollTTSCompletion] 任务 ${taskId} 失败: ${result.message}`);
        throw new HttpException(result.message || 'TTS 任务失败', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));
    }

    const totalTime = Date.now() - startTime;
    this.logger.error(
      `[pollTTSCompletion] 任务 ${taskId} 超时，共轮询 ${pollCount} 次，耗时: ${totalTime}ms`,
    );
    throw new HttpException(
      `TTS 任务超时（已等待 ${Math.round(totalTime / 1000)} 秒）`,
      HttpStatus.REQUEST_TIMEOUT,
    );
  }

  /** 一站式 TTS：使用同步接口直接返回音频 */
  async synthesizeSpeech(
    request: TTSCreateRequest,
  ): Promise<{ audioBuffer: Buffer; fileId?: string }> {
    const result = await this.createTTSSync(request);
    return { audioBuffer: result.audioBuffer };
  }

  /** 创建克隆音色 */
  async createClonedVoice(options: {
    fileId: string | number;
    voiceId: string;
    testText?: string;
    model?: string;
    languageBoost?: string;
  }): Promise<{ voiceId: string; demoAudio?: string; status: string }> {
    const headers = await this.getHeaders();
    const payload: any = {
      file_id: options.fileId,
      voice_id: options.voiceId,
      text: options.testText || '你好，这是语音克隆测试。',
      model: options.model || 'speech-2.6-hd',
      language_boost: options.languageBoost || 'auto',
      need_noise_reduction: false,
      need_volume_normalization: false,
      aigc_watermark: false,
    };

    try {
      const response = await this.retryRequest(
        () => axios.post(`${this.baseUrl}/v1/voice_clone`, payload, { headers }),
        'createClonedVoice',
      );

      if (response.data.base_resp?.status_code !== 0) {
        const rawMsg = response.data.base_resp?.status_msg || '创建克隆音色失败';
        throw new HttpException(this.translateErrorMessage(rawMsg), HttpStatus.BAD_REQUEST);
      }
      return { voiceId: options.voiceId, demoAudio: response.data.demo_audio, status: 'success' };
    } catch (error) {
      this.logger.error(`[createClonedVoice] ${error?.message || error}`);
      const rawMsg =
        error?.response?.data?.base_resp?.status_msg || error?.message || '创建克隆音色失败';
      throw new HttpException(this.translateErrorMessage(rawMsg), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /** 完整的语音克隆流程：上传音频 + 创建克隆音色 */
  async cloneVoice(request: {
    audioUrl?: string;
    audioBuffer?: Buffer;
    fileName?: string;
    voiceId: string;
    testText?: string;
    model?: string;
    languageBoost?: string;
  }): Promise<{ voiceId: string; fileId: string | number; demoAudio?: string; status: string }> {
    const uploadResult = await this.uploadFile({
      audioUrl: request.audioUrl,
      audioBuffer: request.audioBuffer,
      fileName: request.fileName,
      purpose: 'voice_clone',
    });

    const cloneResult = await this.createClonedVoice({
      fileId: uploadResult.fileId,
      voiceId: request.voiceId,
      testText: request.testText,
      model: request.model,
      languageBoost: request.languageBoost,
    });

    return {
      voiceId: cloneResult.voiceId,
      fileId: uploadResult.fileId,
      demoAudio: cloneResult.demoAudio,
      status: cloneResult.status,
    };
  }

  /**
   * 音色设计：通过文字描述生成AI音色
   * 根据提示词描述音色风格，自动生成一个新的AI音色
   * @param request.prompt 音色风格描述，如"讲述悬疑故事的播音员，声音低沉富有磁性"
   * @param request.previewText 试听文本（API必需参数）
   * @returns 生成的音色ID
   */
  async voiceDesign(request: VoiceDesignRequest): Promise<VoiceDesignResponse> {
    const headers = await this.getHeaders();
    const payload = {
      prompt: request.prompt,
      preview_text: request.previewText,
    };

    try {
      const response = await this.retryRequest(
        () => axios.post(`${this.baseUrl}/v1/voice_design`, payload, { headers }),
        'voiceDesign',
      );

      if (response.data.base_resp?.status_code !== 0) {
        throw new HttpException(
          response.data.base_resp?.status_msg || '音色设计失败',
          HttpStatus.BAD_REQUEST,
        );
      }

      const trialAudioHex = response.data?.trial_audio || response.data?.data?.trial_audio || null;

      return {
        voiceId: response.data.voice_id,
        trialAudioHex,
      };
    } catch (error) {
      this.logger.error(`[voiceDesign] ${error?.message || error}`);
      throw new HttpException(
        error?.response?.data?.base_resp?.status_msg || error?.message || '音色设计失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** 删除 MiniMax 音色 */
  async deleteVoice(request: {
    voiceId: string;
    voiceType?: 'voice_cloning' | 'voice_design';
  }): Promise<any> {
    const headers = await this.getHeaders();
    const payload = {
      voice_type: request.voiceType || 'voice_cloning',
      voice_id: request.voiceId,
    };

    try {
      const response = await this.retryRequest(
        () => axios.post(`${this.baseUrl}/v1/delete_voice`, payload, { headers }),
        'deleteVoice',
      );

      if (response.data?.base_resp?.status_code !== 0) {
        throw new HttpException(
          response.data?.base_resp?.status_msg || '删除 MiniMax 音色失败',
          HttpStatus.BAD_REQUEST,
        );
      }

      return response.data;
    } catch (error) {
      this.logger.error(`[deleteVoice] ${error?.message || error}`);
      throw new HttpException(
        error?.response?.data?.base_resp?.status_msg || error?.message || '删除 MiniMax 音色失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
