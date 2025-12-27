import { HttpException, HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import { ILike, IsNull, Repository } from 'typeorm';
import type { Express } from 'express';
import { AppEntity } from '../app/app.entity';
import { AppEmotionVoiceEntity } from '../app/appEmotionVoice.entity';
import { AppVoiceEntity } from '../app/appVoice.entity';
import { GlobalConfigService } from '../globalConfig/globalConfig.service';
import { UploadService } from '../upload/upload.service';
import { VoiceEntity } from './voice.entity';
import { MaobingCookieUtil } from '../../common/utils/maobing-cookie.util';

const COSY_CUSTOMIZATION_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization';
const COSY_WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/';
const DEFAULT_GPT_SOVITS_BASE_URL = process.env.GPT_SOVITS_BASE_URL || 'http://127.0.0.1:9880';
const DEFAULT_GPT_SOVITS_TEXT_LANGUAGE = process.env.GPT_SOVITS_DEFAULT_TEXT_LANGUAGE || 'zh';
const DEFAULT_GPT_SOVITS_STORAGE_ROOT = (() => {
  const custom = process.env.GPT_SOVITS_STORAGE_ROOT;
  if (custom && path.isAbsolute(custom)) return custom;
  if (custom) return path.resolve(process.cwd(), custom);
  return path.resolve(process.cwd(), 'storage/gpt-sovits');
})();
const GPT_SOVITS_MODEL_EXT = ['.ckpt', '.pth', '.pt', '.bin'];
const GPT_SOVITS_AUDIO_EXT = ['.wav', '.mp3', '.m4a', '.flac', '.ogg'];
const GPT_SOVITS_LIBRARY_DIR = {
  gpt: 'gpt-models',
  sovits: 'sovits-models',
};
// MiniMax 配置（实际使用在 providers/minimax.provider.ts 中）
// API URL: https://api.minimaxi.com
const fsp = fs.promises;

// GPT-SoVITS 重试配置
const GPT_SOVITS_MAX_RETRIES = Number(process.env.GPT_SOVITS_MAX_RETRIES) || 3;
const GPT_SOVITS_RETRY_DELAY = Number(process.env.GPT_SOVITS_RETRY_DELAY) || 1000; // 毫秒
const GPT_SOVITS_RETRY_BACKOFF = Number(process.env.GPT_SOVITS_RETRY_BACKOFF) || 2; // 指数退避倍数

type VoiceProvider = 'dashscope' | 'gpt-sovits' | 'minimax';

/**
 * 通用重试工具函数
 * @param fn 需要重试的异步函数
 * @param options 重试配置
 * @returns 函数执行结果
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    backoffFactor?: number;
    retryableErrors?: (error: any) => boolean;
    onRetry?: (error: any, attempt: number, nextDelay: number) => void;
  } = {},
): Promise<T> {
  const {
    maxRetries = GPT_SOVITS_MAX_RETRIES,
    initialDelay = GPT_SOVITS_RETRY_DELAY,
    backoffFactor = GPT_SOVITS_RETRY_BACKOFF,
    retryableErrors = (error: any) => {
      // 默认可重试的错误：网络错误、超时、5xx服务器错误
      if (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND'
      ) {
        return true;
      }
      if (error.response?.status >= 500 && error.response?.status < 600) {
        return true;
      }
      // 503 Service Unavailable 也重试
      if (error.response?.status === 503) {
        return true;
      }
      return false;
    },
    onRetry,
  } = options;

  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 如果已达到最大重试次数或错误不可重试，直接抛出
      if (attempt >= maxRetries || !retryableErrors(error)) {
        throw error;
      }

      // 计算延迟时间（指数退避）
      const delay = initialDelay * Math.pow(backoffFactor, attempt);

      // 调用重试回调
      if (onRetry) {
        onRetry(error, attempt + 1, delay);
      }

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

interface VoiceGptSovitsConfig {
  gptModelPath: string;
  sovitsModelPath: string;
  promptAudioPath: string;
  promptText: string;
  promptLanguage: string;
  textLanguage: string;
  cutPunc?: string;
  topK?: number;
  topP?: number;
  temperature?: number;
  speed?: number;
  sampleSteps?: number;
  sampleRate?: number;
}

type GptSovitsLibraryType = 'gpt' | 'sovits';

interface GptSovitsLibraryEntry {
  type: GptSovitsLibraryType;
  filename: string;
  path: string;
  relativePath: string;
  size: number;
  updatedAt: number;
}

@Injectable()
export class VoiceService implements OnModuleInit {
  constructor(
    private readonly globalConfigService: GlobalConfigService,
    private readonly uploadService: UploadService,
    @InjectRepository(VoiceEntity)
    private readonly voiceRepo: Repository<VoiceEntity>,
    @InjectRepository(AppVoiceEntity)
    private readonly appVoiceRepo: Repository<AppVoiceEntity>,
    @InjectRepository(AppEmotionVoiceEntity)
    private readonly appEmotionVoiceRepo: Repository<AppEmotionVoiceEntity>,
    @InjectRepository(AppEntity)
    private readonly appRepo: Repository<AppEntity>,
  ) {}

  // Lazy-load MinimaxProvider to avoid circular dependencies
  private _minimaxProvider: any;
  private get minimaxProvider() {
    if (!this._minimaxProvider) {
      const { MinimaxProvider } = require('./providers/minimax.provider');
      this._minimaxProvider = new MinimaxProvider(this.globalConfigService);
    }
    return this._minimaxProvider;
  }

  private async getApiKey(): Promise<string> {
    const dashscopeApiKey = await this.globalConfigService.getConfigs(['dashscopeApiKey']);
    const apiKey = (dashscopeApiKey as any) || process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      throw new HttpException(
        '未配置阿里百炼 DashScope API Key。请在系统配置中设置 dashscopeApiKey，或在环境变量中设置 DASHSCOPE_API_KEY。',
        HttpStatus.BAD_REQUEST,
      );
    }
    return apiKey as string;
  }

  private getAxiosHeaders(apiKey: string) {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private readonly gptSovitsBaseUrl = DEFAULT_GPT_SOVITS_BASE_URL;
  private readonly gptSovitsStorageRoot = DEFAULT_GPT_SOVITS_STORAGE_ROOT;
  private readonly gptSovitsModelCache = new Map<
    string,
    { gptModelPath: string; sovitsModelPath: string; loadedAt: number }
  >();

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureVoiceProviderColumns();
    } catch (error) {
      Logger.warn(
        `[VoiceService] ensureVoiceProviderColumns failed: ${error?.message || error}`,
        'VoiceService',
      );
    }
  }

  private async upsertVoice(partial: {
    voiceId: string;

    userId?: number | null;

    prefix?: string | null;

    model?: string | null;

    provider?: VoiceProvider;

    status?: string | null;

    name?: string | null;

    rate?: number;

    pitch?: number;

    volume?: number;

    sampleRate?: number;

    format?: string;

    providerVoiceId?: string | null;

    config?: Record<string, any> | null;
  }) {
    if (!partial.voiceId) {
      console.warn('upsertVoice: voiceId为空，跳过保存');

      return;
    }

    try {
      console.log(`upsertVoice: 查找现有记录 voiceId=${partial.voiceId}`);

      const existing = await this.voiceRepo.findOne({ where: { voiceId: partial.voiceId } });

      const now = new Date();

      const provider =
        (partial.provider as VoiceProvider) ||
        (existing?.provider as VoiceProvider) ||
        ('dashscope' as VoiceProvider);

      const mergedConfig = partial.config !== undefined ? partial.config : existing?.config ?? null;

      const data = existing
        ? {
            ...existing,

            ...partial,

            userId: partial.userId !== undefined ? partial.userId : existing.userId,

            provider,

            config: mergedConfig,

            updatedAt: now,
          }
        : ({
            ...partial,

            rate: partial.rate ?? 0.98,

            pitch: partial.pitch ?? 1.0,

            volume: partial.volume ?? 52,

            sampleRate: partial.sampleRate ?? 24000,

            format: partial.format ?? 'mp3',

            provider,

            config: mergedConfig,

            createdAt: now,

            updatedAt: now,
          } as any);

      if (data && typeof data === 'object') {
        for (const k of ['prefix', 'model', 'status', 'name', 'format', 'providerVoiceId']) {
          if (data[k] === '') data[k] = null;
        }
      }

      console.log(`upsertVoice: 保存数据 voiceId=${partial.voiceId}, data=`, data);

      const result = await this.voiceRepo.save(this.voiceRepo.create(data));

      console.log(`upsertVoice: 保存成功 voiceId=${partial.voiceId}`);

      return result;
    } catch (error) {
      console.error(`upsertVoice: 保存失败 voiceId=${partial.voiceId}`, error.message);

      throw error;
    }
  }

  async listGptSovitsCharacters() {
    return await retryWithBackoff(
      async () => {
        const url = this.normalizeGptSovitsUrl('/characters/list');
        Logger.log(`[listGptSovitsCharacters] 获取角色列表: ${url}`, 'VoiceService');
        const response = await axios.get(url, { timeout: 5000 });
        return response.data;
      },
      {
        onRetry: (error, attempt, delay) => {
          Logger.warn(
            `[listGptSovitsCharacters] 获取角色列表失败，正在重试 (${attempt}/${GPT_SOVITS_MAX_RETRIES})，` +
              `延迟 ${delay}ms。错误: ${error?.message || error}`,
            'VoiceService',
          );
        },
      },
    ).catch(error => {
      Logger.error(
        `[listGptSovitsCharacters] 获取角色列表失败: ${error?.message || error}`,
        'VoiceService',
      );
      throw new HttpException(
        `获取GPT-SoVITS角色列表失败: ${error?.message || error}`,
        HttpStatus.BAD_GATEWAY,
      );
    });
  }

  async getGptSovitsCharacterInfo(characterName: string) {
    return await retryWithBackoff(
      async () => {
        const url = this.normalizeGptSovitsUrl(
          `/characters/info?character_name=${encodeURIComponent(characterName)}`,
        );
        Logger.log(`[getGptSovitsCharacterInfo] 获取角色信息: ${characterName}`, 'VoiceService');
        const response = await axios.get(url, { timeout: 5000 });
        return response.data;
      },
      {
        onRetry: (error, attempt, delay) => {
          Logger.warn(
            `[getGptSovitsCharacterInfo] 获取角色信息失败，正在重试 (${attempt}/${GPT_SOVITS_MAX_RETRIES})，` +
              `延迟 ${delay}ms。错误: ${error?.message || error}`,
            'VoiceService',
          );
        },
      },
    ).catch(error => {
      Logger.error(
        `[getGptSovitsCharacterInfo] 获取角色信息失败: ${error?.message || error}`,
        'VoiceService',
      );
      throw new HttpException(
        `获取角色信息失败: ${error?.message || error}`,
        HttpStatus.BAD_GATEWAY,
      );
    });
  }

  async listGptSovitsFiles() {
    try {
      // 优先从远程 GPT-SoVITS 服务获取模型列表
      try {
        const remoteUrl = this.normalizeGptSovitsUrl('/models/list');
        Logger.log(`[listGptSovitsFiles] 尝试从远程服务获取模型列表: ${remoteUrl}`, 'VoiceService');

        const response = await axios.get(remoteUrl, { timeout: 5000 });
        const remoteData = response.data;

        const gptModels: string[] = [];
        const sovitsModels: string[] = [];
        const library: GptSovitsLibraryEntry[] = [];

        // 处理 GPT 模型
        if (Array.isArray(remoteData?.gpt_models)) {
          for (const model of remoteData.gpt_models) {
            const modelPath = model.path || model.name;
            gptModels.push(modelPath);
            library.push({
              type: 'gpt',
              filename: model.name,
              path: modelPath,
              relativePath: modelPath,
              size: model.size || 0,
              updatedAt: model.modified ? new Date(model.modified).getTime() : Date.now(),
            });
          }
        }

        // 处理 SoVITS 模型
        if (Array.isArray(remoteData?.sovits_models)) {
          for (const model of remoteData.sovits_models) {
            const modelPath = model.path || model.name;
            sovitsModels.push(modelPath);
            library.push({
              type: 'sovits',
              filename: model.name,
              path: modelPath,
              relativePath: modelPath,
              size: model.size || 0,
              updatedAt: model.modified ? new Date(model.modified).getTime() : Date.now(),
            });
          }
        }

        Logger.log(
          `[listGptSovitsFiles] 从远程服务获取成功: ${gptModels.length} GPT模型, ${sovitsModels.length} SoVITS模型`,
          'VoiceService',
        );

        return {
          gptModels,
          sovitsModels,
          promptAudios: [],
          storageRoot: this.gptSovitsStorageRoot,
          library,
        };
      } catch (remoteError) {
        Logger.warn(
          `[listGptSovitsFiles] 远程服务获取失败，回退到本地文件系统: ${
            remoteError?.message || remoteError
          }`,
          'VoiceService',
        );
        // 回退到原有的本地文件系统扫描逻辑
      }

      // 回退：扫描本地文件系统
      await fsp.mkdir(this.gptSovitsStorageRoot, { recursive: true });
      const entries = await fsp.readdir(this.gptSovitsStorageRoot, { withFileTypes: true });

      const gptModels: string[] = [];
      const sovitsModels: string[] = [];
      const promptAudios: string[] = [];
      const library: GptSovitsLibraryEntry[] = [];

      const processFile = async (fullPath: string) => {
        const ext = path.extname(fullPath).toLowerCase();
        const libraryType = this.getLibraryFileType(ext);
        if (libraryType) {
          const stat = await this.safeStat(fullPath);
          if (!stat) return;
          const entry: GptSovitsLibraryEntry = {
            type: libraryType,
            filename: path.basename(fullPath),
            path: fullPath,
            relativePath: this.normalizeLibraryRelativePath(fullPath),
            size: stat.size,
            updatedAt: stat.mtimeMs,
          };
          library.push(entry);
          if (libraryType === 'gpt') {
            gptModels.push(fullPath);
          } else {
            sovitsModels.push(fullPath);
          }
          return;
        }
        if (GPT_SOVITS_AUDIO_EXT.includes(ext)) {
          promptAudios.push(fullPath);
        }
      };

      for (const file of entries) {
        if (file.isFile()) {
          await processFile(path.join(this.gptSovitsStorageRoot, file.name));
        } else if (file.isDirectory()) {
          const subDir = path.join(this.gptSovitsStorageRoot, file.name);
          const subFiles = await fsp.readdir(subDir, { withFileTypes: true });
          for (const subFile of subFiles) {
            if (subFile.isFile()) {
              await processFile(path.join(subDir, subFile.name));
            }
          }
        }
      }

      return {
        gptModels,
        sovitsModels,
        promptAudios,
        storageRoot: this.gptSovitsStorageRoot,
        library,
      };
    } catch (error) {
      Logger.warn(`[listGptSovitsFiles] 读取文件失败: ${error?.message || error}`, 'VoiceService');
      return {
        gptModels: [],
        sovitsModels: [],
        promptAudios: [],
        storageRoot: this.gptSovitsStorageRoot,
        library: [],
      };
    }
  }

  async uploadGptSovitsModel(file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('file 为必传参数', HttpStatus.BAD_REQUEST);
    }
    if (!file?.buffer?.length) {
      throw new HttpException('文件内容为空', HttpStatus.BAD_REQUEST);
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    const type = this.getLibraryFileType(ext);
    if (!type) {
      throw new HttpException('仅支持上传 .ckpt/.bin/.pth/.pt 文件', HttpStatus.BAD_REQUEST);
    }

    await fsp.mkdir(this.gptSovitsStorageRoot, { recursive: true });
    const subDir = type === 'gpt' ? GPT_SOVITS_LIBRARY_DIR.gpt : GPT_SOVITS_LIBRARY_DIR.sovits;
    const targetDir = path.join(this.gptSovitsStorageRoot, subDir);
    await fsp.mkdir(targetDir, { recursive: true });

    const savedPath = await this.persistLibraryUpload(file, targetDir, type);
    const stat = await this.safeStat(savedPath);
    if (!stat) {
      throw new HttpException('保存模型失败，请稍后重试', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const entry = {
      type,
      filename: path.basename(savedPath),
      path: savedPath,
      relativePath: this.normalizeLibraryRelativePath(savedPath),
      size: stat.size,
      updatedAt: stat.mtimeMs,
      storageRoot: this.gptSovitsStorageRoot,
    };

    Logger.log(`[uploadGptSovitsModel] 上传 ${entry.filename} (${entry.type})`, 'VoiceService');
    return entry;
  }

  async importGptSovitsVoice(
    files: {
      gptModel?: Array<{ originalname: string; buffer: Buffer }>;
      sovitsModel?: Array<{ originalname: string; buffer: Buffer }>;
      promptAudio?: Array<{ originalname: string; buffer: Buffer }>;
    },
    body: Record<string, any>,
  ) {
    // 支持三种模式：1. 使用角色名 2. 上传文件 3. 从服务器路径选择
    const useServerFiles = body?.useServerFiles === 'true' || body?.useServerFiles === true;
    const characterName = String(body?.characterName || body?.character_name || '').trim();

    let gptModelFile = files?.gptModel?.[0];
    let sovitsModelFile = files?.sovitsModel?.[0];
    let promptAudioFile = files?.promptAudio?.[0];

    let gptModelPath: string;
    let sovitsModelPath: string;
    let promptAudioPath: string;

    const promptText = String(body?.promptText || body?.prompt_text || '').trim();
    if (!promptText) {
      throw new HttpException('promptText 必填', HttpStatus.BAD_REQUEST);
    }
    const promptLanguage = String(body?.promptLanguage || body?.prompt_language || 'zh').trim();
    const textLanguage = String(
      body?.textLanguage || body?.text_language || DEFAULT_GPT_SOVITS_TEXT_LANGUAGE,
    ).trim();

    const voiceId = this.generateGptSovitsVoiceId(body?.voiceId || body?.voice_id);
    await this.assertVoiceIdAvailable(voiceId);

    // 如果使用角色名，从角色信息获取模型路径
    if (characterName) {
      Logger.log(`[importGptSovitsVoice] 使用角色名: ${characterName}`, 'VoiceService');
      const characterInfo = await this.getGptSovitsCharacterInfo(characterName);
      const gptModelServerPath = characterInfo.gpt_model_path;
      const sovitsModelServerPath = characterInfo.sovits_model_path;

      if (!gptModelServerPath || !sovitsModelServerPath) {
        throw new HttpException(`角色 ${characterName} 的模型路径未找到`, HttpStatus.BAD_REQUEST);
      }

      // 处理音频
      let promptAudioPath: string;
      const promptAudioServerPath = String(body?.promptAudioPath || '').trim();

      if (promptAudioServerPath) {
        promptAudioPath = promptAudioServerPath;
      } else if (files?.promptAudio?.[0]) {
        const voiceDir = await this.ensureGptSovitsDir(voiceId);
        // 使用时间戳生成唯一文件名
        const timestamp = Date.now();
        promptAudioPath = await this.persistGptSovitsFile(
          files.promptAudio[0],
          voiceDir,
          `prompt-audio-${timestamp}`,
          GPT_SOVITS_AUDIO_EXT,
          '.wav',
        );
      } else {
        throw new HttpException(
          '请提供 promptAudioPath 或上传 promptAudio 文件',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 上传音频到 GPT-SoVITS 服务器
      const serverPromptAudioPath = await this.uploadAudioToGptSovits(promptAudioPath);

      const config: VoiceGptSovitsConfig = {
        gptModelPath: gptModelServerPath,
        sovitsModelPath: sovitsModelServerPath,
        promptAudioPath: serverPromptAudioPath,
        promptText,
        promptLanguage,
        textLanguage,
        cutPunc: (body?.cutPunc || body?.cut_punc || '').trim() || undefined,
        topK: this.parseOptionalNumber(body?.topK ?? body?.top_k),
        topP: this.parseOptionalNumber(body?.topP ?? body?.top_p),
        temperature: this.parseOptionalNumber(body?.temperature),
        speed: this.parseOptionalNumber(body?.speed),
        sampleSteps: this.parseOptionalNumber(body?.sampleSteps ?? body?.sample_steps),
        sampleRate: this.parseOptionalNumber(body?.sampleRate ?? body?.sample_rate),
      };

      const name = String(body?.name || '').trim() || characterName; // 默认使用角色名
      await this.upsertVoice({
        voiceId,
        name,
        provider: 'gpt-sovits',
        status: 'SUCCEEDED',
        prefix: 'gptsovits',
        model: characterName, // 保存角色名到 model 字段
        format: 'wav',
        sampleRate: config.sampleRate ?? 32000,
        config: { ...config, characterName }, // 在 config 中也保存角色名
      });
      this.gptSovitsModelCache.delete(voiceId);

      Logger.log(
        `[importGptSovitsVoice] 新增 GPT-SoVITS 音色 ${voiceId} (角色: ${characterName})`,
        'VoiceService',
      );
      return {
        voice_id: voiceId,
        provider: 'gpt-sovits',
        status: 'SUCCEEDED',
        character_name: characterName,
      };
    }

    if (useServerFiles) {
      // 模式2：模型从服务器路径选择，音频可选择上传或从服务器选择
      const gptModelServerPath = String(body?.gptModelPath || '').trim();
      const sovitsModelServerPath = String(body?.sovitsModelPath || '').trim();
      const promptAudioServerPath = String(body?.promptAudioPath || '').trim();

      if (!gptModelServerPath || !sovitsModelServerPath) {
        throw new HttpException(
          '使用服务器文件时，gptModelPath、sovitsModelPath 为必填',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 分别判断每个路径类型：绝对路径（本地文件）或相对路径（远程 GPT-SoVITS 服务）
      const normalizedStorageRoot = path.resolve(this.gptSovitsStorageRoot);

      // 处理 GPT 模型路径
      if (path.isAbsolute(gptModelServerPath)) {
        // 本地文件模式：验证文件存在性和安全性
        const normalizedGptPath = path.resolve(gptModelServerPath);
        try {
          await fsp.access(normalizedGptPath);
        } catch (error) {
          throw new HttpException(
            '指定的 GPT 模型文件路径不存在或无法访问',
            HttpStatus.BAD_REQUEST,
          );
        }
        if (!normalizedGptPath.startsWith(normalizedStorageRoot)) {
          throw new HttpException('GPT 模型文件路径必须在存储目录范围内', HttpStatus.BAD_REQUEST);
        }
        gptModelPath = normalizedGptPath;
      } else {
        // 远程路径：直接使用
        gptModelPath = gptModelServerPath;
      }

      // 处理 SoVITS 模型路径
      if (path.isAbsolute(sovitsModelServerPath)) {
        // 本地文件模式：验证文件存在性和安全性
        const normalizedSovitsPath = path.resolve(sovitsModelServerPath);
        try {
          await fsp.access(normalizedSovitsPath);
        } catch (error) {
          throw new HttpException(
            '指定的 SoVITS 模型文件路径不存在或无法访问',
            HttpStatus.BAD_REQUEST,
          );
        }
        if (!normalizedSovitsPath.startsWith(normalizedStorageRoot)) {
          throw new HttpException(
            'SoVITS 模型文件路径必须在存储目录范围内',
            HttpStatus.BAD_REQUEST,
          );
        }
        sovitsModelPath = normalizedSovitsPath;
      } else {
        // 远程路径：直接使用
        sovitsModelPath = sovitsModelServerPath;
      }

      // Prompt 音频处理：支持从服务器选择或上传文件
      if (promptAudioServerPath) {
        // 从服务器路径选择音频
        try {
          await fsp.access(promptAudioServerPath);
        } catch (error) {
          throw new HttpException(
            '指定的 Prompt 音频文件路径不存在或无法访问',
            HttpStatus.BAD_REQUEST,
          );
        }

        const normalizedPromptPath = path.resolve(promptAudioServerPath);
        const normalizedStorageRoot = path.resolve(this.gptSovitsStorageRoot);
        if (!normalizedPromptPath.startsWith(normalizedStorageRoot)) {
          throw new HttpException(
            'Prompt 音频文件路径必须在存储目录范围内',
            HttpStatus.BAD_REQUEST,
          );
        }
        promptAudioPath = normalizedPromptPath;
      } else if (promptAudioFile) {
        // 上传音频文件，使用时间戳生成唯一文件名
        const voiceDir = await this.ensureGptSovitsDir(voiceId);
        const timestamp = Date.now();
        promptAudioPath = await this.persistGptSovitsFile(
          promptAudioFile,
          voiceDir,
          `prompt-audio-${timestamp}`,
          GPT_SOVITS_AUDIO_EXT,
          '.wav',
        );
      } else {
        throw new HttpException(
          '请提供 promptAudioPath 或上传 promptAudio 文件',
          HttpStatus.BAD_REQUEST,
        );
      }
    } else {
      // 模式1：上传文件
      if (!gptModelFile || !sovitsModelFile || !promptAudioFile) {
        throw new HttpException(
          'gptModel、sovitsModel、promptAudio 均为必传文件',
          HttpStatus.BAD_REQUEST,
        );
      }

      const voiceDir = await this.ensureGptSovitsDir(voiceId);
      gptModelPath = await this.persistGptSovitsFile(
        gptModelFile,
        voiceDir,
        'gpt-model',
        GPT_SOVITS_MODEL_EXT,
        '.ckpt',
      );
      sovitsModelPath = await this.persistGptSovitsFile(
        sovitsModelFile,
        voiceDir,
        'sovits-model',
        GPT_SOVITS_MODEL_EXT,
        '.pth',
      );
      // 使用时间戳生成唯一文件名
      const timestamp = Date.now();
      promptAudioPath = await this.persistGptSovitsFile(
        promptAudioFile,
        voiceDir,
        `prompt-audio-${timestamp}`,
        GPT_SOVITS_AUDIO_EXT,
        '.wav',
      );
    }

    // 上传音频文件到 GPT-SoVITS 服务器（如果是本地绝对路径）
    Logger.log(
      `[importGptSovitsVoice] 准备上传音频到 GPT-SoVITS 服务器: ${promptAudioPath}`,
      'VoiceService',
    );
    const serverPromptAudioPath = await this.uploadAudioToGptSovits(promptAudioPath);
    Logger.log(`[importGptSovitsVoice] 音频路径已处理: ${serverPromptAudioPath}`, 'VoiceService');

    const config: VoiceGptSovitsConfig = {
      gptModelPath,
      sovitsModelPath,
      promptAudioPath: serverPromptAudioPath, // 使用服务器路径
      promptText,
      promptLanguage,
      textLanguage,
      cutPunc: (body?.cutPunc || body?.cut_punc || '').trim() || undefined,
      topK: this.parseOptionalNumber(body?.topK ?? body?.top_k),
      topP: this.parseOptionalNumber(body?.topP ?? body?.top_p),
      temperature: this.parseOptionalNumber(body?.temperature),
      speed: this.parseOptionalNumber(body?.speed),
      sampleSteps: this.parseOptionalNumber(body?.sampleSteps ?? body?.sample_steps),
      sampleRate: this.parseOptionalNumber(body?.sampleRate ?? body?.sample_rate),
    };

    const name = String(body?.name || '').trim() || null;
    await this.upsertVoice({
      voiceId,
      name,
      provider: 'gpt-sovits',
      status: 'SUCCEEDED',
      prefix: 'gptsovits',
      model: 'gpt-sovits',
      format: 'wav',
      sampleRate: config.sampleRate ?? 32000,
      config,
    });
    this.gptSovitsModelCache.delete(voiceId);

    Logger.log(`[importGptSovitsVoice] 新增 GPT-SoVITS 音色 ${voiceId}`, 'VoiceService');
    return { voice_id: voiceId, provider: 'gpt-sovits', status: 'SUCCEEDED' };
  }

  /**
   * 导入 MiniMax 音色（语音克隆）
   * 上传音频文件到 MiniMax，获取 file_id 用于后续 TTS
   */
  async importMinimaxVoice(body: {
    voiceId?: string;
    name?: string;
    userId?: number;
    audioUrl?: string;
    audioFile?: Express.Multer.File;
    testText?: string; // 试听时朗读的文本
  }) {
    const timestamp = body.voiceId || Date.now();
    const voiceId = `minimax-${timestamp}`;
    await this.assertVoiceIdAvailable(voiceId);

    const minimaxVoiceId = `voice${timestamp}`;
    const cloneResult = await this.minimaxProvider.cloneVoice({
      audioUrl: body.audioUrl,
      audioBuffer: body.audioFile?.buffer,
      fileName: body.audioFile?.originalname,
      voiceId: minimaxVoiceId,
      testText: body.testText,
    });

    await this.upsertVoice({
      voiceId,
      name: body.name || null,
      userId: body.userId || null,
      provider: 'minimax',
      status: cloneResult.status === 'success' ? 'SUCCEEDED' : 'PENDING',
      prefix: 'minimax',
      model: 'speech-2.6-hd',
      format: 'mp3',
      sampleRate: 32000,
      providerVoiceId: cloneResult.voiceId,
      config: {
        voiceId: cloneResult.voiceId,
        fileId: cloneResult.fileId,
        model: 'speech-2.6-hd',
        speed: 1,
        vol: 1,
        pitch: 0,
        languageBoost: 'auto',
      },
    });

    return {
      voice_id: voiceId,
      provider: 'minimax',
      status: cloneResult.status === 'success' ? 'SUCCEEDED' : 'PENDING',
      minimax_voice_id: cloneResult.voiceId,
      demo_audio: cloneResult.demoAudio || null,
    };
  }

  /** 关联已有的 MiniMax 音色ID */
  async linkMinimaxVoice(body: {
    voiceId?: string;
    name?: string;
    userId?: number;
    minimaxVoiceId: string;
    model?: string;
    speed?: number;
    vol?: number;
    pitch?: number;
    languageBoost?: string;
    isDesign?: boolean;
  }) {
    const voiceId = `minimax-${body.voiceId || Date.now()}`;
    await this.assertVoiceIdAvailable(voiceId);

    const prefix = body.isDesign ? 'minimax-design' : 'minimax';

    await this.upsertVoice({
      voiceId,
      name: body.name || null,
      userId: body.userId || null,
      provider: 'minimax',
      status: 'SUCCEEDED',
      prefix,
      model: body.model || 'speech-2.6-hd',
      format: 'mp3',
      sampleRate: 32000,
      providerVoiceId: body.minimaxVoiceId,
      config: {
        voiceId: body.minimaxVoiceId,
        model: body.model || 'speech-2.6-hd',
        speed: body.speed || 1,
        vol: body.vol || 1,
        pitch: body.pitch || 0,
        languageBoost: body.languageBoost || 'auto',
      },
    });

    return { voice_id: voiceId, provider: 'minimax', status: 'SUCCEEDED' };
  }

  /**
   * MiniMax 音色设计
   * 通过文字描述生成AI音色，并保存到数据库
   */
  async designMinimaxVoice(body: {
    voiceId?: string;
    name?: string;
    userId?: number;
    prompt: string; // 音色风格描述
    previewOnly?: boolean;
    previewText?: string;
  }) {
    // 使用默认试听文本（MiniMax API 需要此参数）
    const defaultPreviewText = '你好，我是AI生成的虚拟音色，很高兴认识你。';
    const previewText = body.previewText || (body as any).preview_text || defaultPreviewText;

    // 调用 MiniMax 音色设计 API
    const designResult = await this.minimaxProvider.voiceDesign({
      prompt: body.prompt,
      previewText,
    });

    // 将试听音频上传到 OSS（避免 base64 在某些设备上的兼容性问题）
    let previewAudioUrl: string | null = null;
    if (designResult.trialAudioHex && typeof designResult.trialAudioHex === 'string') {
      try {
        const audioBuffer = Buffer.from(designResult.trialAudioHex, 'hex');
        const filename = `voice-design-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)}.mp3`;
        previewAudioUrl = await this.uploadService.uploadFileFromBuffer(
          audioBuffer,
          filename,
          'audio/mpeg',
          'voiceDesign',
        );
        Logger.log(`[designMinimaxVoice] 试听音频已上传: ${previewAudioUrl}`, 'VoiceService');
      } catch (uploadError) {
        Logger.error(
          `[designMinimaxVoice] 上传试听音频失败: ${uploadError?.message}`,
          '',
          'VoiceService',
        );
        // 上传失败时回退到 base64（兼容性降级）
        previewAudioUrl = `data:audio/mp3;base64,${Buffer.from(
          designResult.trialAudioHex,
          'hex',
        ).toString('base64')}`;
      }
    }

    // 预览模式：仅返回试听音频和 voice_id，不落库
    if (body.previewOnly === true) {
      return {
        voice_id: designResult.voiceId,
        provider: 'minimax',
        status: 'PREVIEW',
        minimax_voice_id: designResult.voiceId,
        preview_audio_url: previewAudioUrl,
      };
    }

    const timestamp = body.voiceId || Date.now();
    const voiceId = `minimax-design-${timestamp}`;
    await this.assertVoiceIdAvailable(voiceId);

    // 保存到数据库
    await this.upsertVoice({
      voiceId,
      name: body.name || `AI设计音色-${timestamp}`,
      userId: body.userId || null,
      provider: 'minimax',
      status: 'SUCCEEDED',
      prefix: 'minimax-design',
      model: 'speech-2.6-hd',
      format: 'mp3',
      sampleRate: 32000,
      providerVoiceId: designResult.voiceId,
      config: {
        voiceId: designResult.voiceId, // MiniMax返回的音色ID
        designPrompt: body.prompt, // 保存设计提示词
        model: 'speech-2.6-hd',
        speed: 1,
        vol: 1,
        pitch: 0,
        languageBoost: 'auto',
      },
    });

    return {
      voice_id: voiceId,
      provider: 'minimax',
      status: 'SUCCEEDED',
      minimax_voice_id: designResult.voiceId,
      preview_audio_url: previewAudioUrl,
    };
  }

  async listFromDB(query: {
    name?: string;
    prefix?: string;
    userId?: number;
    page_index?: number;
    page_size?: number;
    categoryId?: number;
    category?: string;
    keyword?: string;
  }): Promise<{ rows: any[]; count: number }> {
    const pageIndex = Math.max(0, Number(query?.page_index ?? 0));
    const pageSize = Math.max(1, Number(query?.page_size ?? 10));
    const where: any = {};
    if (query?.prefix) where.prefix = ILike(`${query.prefix}%`);

    // 处理 userId 查询条件
    if (query?.userId !== undefined) {
      // 如果明确传了 userId，则查询该用户的音色
      where.userId = query.userId;
      // 用户音色需要过滤 isEnabled = true（只显示已付费启用的音色）
      where.isEnabled = true;
    } else {
      // 如果没有传 userId，则只查询官方音色（userId 为 null）
      // 注意：TypeORM 查询 null 需要使用 IsNull()
      where.userId = IsNull();
    }

    // 处理分类查询条件（支持分类ID或分类名称）
    let categoryFilter = null;
    if (query?.categoryId !== undefined) {
      if (query.categoryId === null || query.categoryId === 0) {
        // 查询未分类的音色
        where.categoryId = IsNull();
      } else {
        // 查询指定分类的音色
        where.categoryId = query.categoryId;
      }
    } else if (query?.category) {
      // 如果传入分类名称，需要先查询分类ID
      categoryFilter = query.category;
    }

    // 处理关键词搜索（支持 name 和 keyword 参数）
    const searchKeyword = query?.name || query?.keyword;
    if (searchKeyword) {
      where.name = ILike(`%${searchKeyword}%`);
    }

    // 如果有分类名称过滤，需要使用 QueryBuilder
    if (categoryFilter) {
      const queryBuilder = this.voiceRepo
        .createQueryBuilder('voice')
        .leftJoinAndSelect('voice.category', 'category')
        .where(where)
        .andWhere('category.name = :categoryName', { categoryName: categoryFilter })
        .orderBy('voice.id', 'DESC')
        .skip(pageIndex * pageSize)
        .take(pageSize);

      const [rows, count] = await queryBuilder.getManyAndCount();
      const mapped = rows.map(r => ({
        voice_id: r.voiceId,
        user_id: r.userId,
        status: r.status,
        isEnabled: r.isEnabled,
        name: r.name,
        prefix: r.prefix,
        model: r.model,
        provider: r.provider,
        rate: r.rate,
        pitch: r.pitch,
        categoryId: r.categoryId,
        category: r.category?.name,
        categoryName: r.category?.name,
      }));
      return { rows: mapped, count };
    }

    // 检查数据库是否为空
    let count = await this.voiceRepo.count({ where });
    if (count === 0 && !query?.userId) {
      // 数据库为空且不是查询用户音色时，直接同步全部官方数据
      try {
        await this.syncAllVoicesFromUpstream(undefined);
        count = await this.voiceRepo.count({ where });
      } catch (error) {
        console.error('同步声音数据失败:', error.message);
        // 同步失败时，返回空列表而不是抛出错误
        return { rows: [], count: 0 };
      }
    }

    const rows = await this.voiceRepo.find({
      where,
      order: { id: 'DESC' },
      skip: pageIndex * pageSize,
      take: pageSize,
      relations: ['category'], // 关联查询分类信息
    });
    const mapped = rows.map(r => ({
      voice_id: r.voiceId,
      user_id: r.userId,
      status: r.status,
      isEnabled: r.isEnabled,
      name: r.name,
      prefix: r.prefix,
      model: r.model,
      provider: r.provider,
      rate: r.rate,
      pitch: r.pitch,
      categoryId: r.categoryId,
      category: r.category?.name, // 添加分类名称
      categoryName: r.category?.name, // 添加分类名称（别名）
    }));
    return { rows: mapped, count };
  }

  private extractRowsAndStatus(body: any): { rows: any[] } {
    const rows =
      body?.rows ??
      body?.data?.voices ??
      body?.voices ??
      body?.data?.output?.voices ??
      body?.output?.voices ??
      body?.data?.output?.voice_list ??
      body?.output?.voice_list ??
      (Array.isArray(body) ? body : []);
    return { rows: Array.isArray(rows) ? rows : [] };
  }

  async syncAllVoicesFromUpstream(prefix?: string) {
    console.log('开始同步声音数据...');
    // 优化同步：按页拉取上游，获取所有数据
    // 注意：API对page_size有限制，使用较小的值确保能获取到数据
    const pageSize = 10;
    let totalSynced = 0;
    let pageIndex = 1;
    let hasMoreData = true;

    while (hasMoreData) {
      try {
        console.log(`同步第 ${pageIndex} 页数据...`);
        const raw = await this.list({
          prefix: prefix ?? undefined,
          page_index: pageIndex,
          page_size: pageSize,
        });
        const body: any = raw || {};
        const { rows } = this.extractRowsAndStatus(body);

        if (!rows.length) {
          console.log('没有更多数据，同步完成');
          hasMoreData = false;
          break;
        }

        console.log(`第 ${pageIndex} 页获取到 ${rows.length} 条记录`);

        // 批量处理当前页的数据
        for (const v of rows) {
          const voiceId = String(v?.voice_id || v?.id || '');
          if (!voiceId) continue;
          const statusRaw = String(v?.status || '').toUpperCase();
          const status = statusRaw || null;
          // 从 voice_id 推断模型与前缀
          const parts = voiceId.split('-');
          const maybePrefix = parts.length >= 3 ? parts[2] : null;
          let model: string | null = null;
          const lowerId = voiceId.toLowerCase();
          if (lowerId.startsWith('cosyvoice-v3-plus-')) model = 'cosyvoice-v3-plus';
          else if (lowerId.startsWith('cosyvoice-v3-')) model = 'cosyvoice-v3';
          else if (lowerId.startsWith('cosyvoice-v2-')) model = 'cosyvoice-v2';
          await this.upsertVoice({ voiceId, status, prefix: maybePrefix, model });
          totalSynced++;
        }

        // 如果当前页数据少于页面大小，说明是最后一页
        if (rows.length < pageSize) {
          console.log('最后一页数据，同步完成');
          hasMoreData = false;
        } else {
          pageIndex++;
          // 添加延迟，避免API请求过于频繁
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // 安全限制：防止无限循环，最多同步10000条记录
        if (pageIndex > 100) {
          console.log('已达到最大页数限制(100页)，停止同步');
          hasMoreData = false;
        }
      } catch (e) {
        console.error(`同步第 ${pageIndex} 页时出错:`, e.message);
        // 如果是API限制错误，等待一段时间后重试
        if (e.message.includes('rate limit') || e.message.includes('too many requests')) {
          console.log('遇到API限制，等待5秒后重试...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        // 其他错误直接抛出
        throw e;
      }
    }
    console.log(`同步完成，共同步 ${totalSynced} 条声音记录`);
  }

  private async getDefaultModel(): Promise<string> {
    const cosyvoiceDefaultModel = await this.globalConfigService.getConfigs([
      'cosyvoiceDefaultModel',
    ]);
    return (cosyvoiceDefaultModel as any) || 'cosyvoice-v2';
  }

  /**
   * 预处理音频文件到本地，使其符合阿里云 CosyVoice 要求
   * - 采样率: 16000 Hz
   * - 声道: 单声道 (Mono)
   * - 时长: 最多 10 秒
   * - 格式: WAV (PCM)
   * @returns 返回本地文件路径
   */
  private async preprocessAudioToLocal(audioUrl: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const tempDir = os.tmpdir();
      const inputFile = path.join(tempDir, `input-${Date.now()}.wav`);
      const outputFile = path.join(tempDir, `voice-preprocessed-${Date.now()}.wav`);

      try {
        Logger.log(`[preprocessAudioToLocal] 开始下载音频: ${audioUrl}`, 'VoiceService');

        // 下载音频文件
        const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(inputFile, response.data);

        Logger.log(`[preprocessAudioToLocal] 音频下载完成，开始转换`, 'VoiceService');

        // 动态引入 fluent-ffmpeg，避免在未安装依赖的运行环境报错
        let ffmpeg: any;
        try {
          const mod: any = await import('fluent-ffmpeg');
          ffmpeg = mod?.default || mod;
        } catch (e: any) {
          Logger.warn(
            `[preprocessAudioToLocal] 未安装 fluent-ffmpeg，无法进行本地预处理: ${e?.message || e}`,
            'VoiceService',
          );
          throw new HttpException(
            '服务器未安装 fluent-ffmpeg 依赖，无法进行本地预处理',
            HttpStatus.NOT_IMPLEMENTED,
          );
        }

        // 使用 ffmpeg 转换音频
        ffmpeg(inputFile)
          .audioFrequency(16000) // 采样率 16000 Hz
          .audioChannels(1) // 单声道
          .duration(10) // 最多 10 秒
          .audioCodec('pcm_s16le') // PCM 16-bit
          .format('wav') // WAV 格式
          .on('start', commandLine => {
            Logger.log(`[preprocessAudioToLocal] FFmpeg 命令: ${commandLine}`, 'VoiceService');
          })
          .on('end', async () => {
            try {
              Logger.log(`[preprocessAudioToLocal] 音频转换完成: ${outputFile}`, 'VoiceService');

              // 清理输入文件
              try {
                fs.unlinkSync(inputFile);
              } catch (cleanupError) {
                Logger.warn(
                  `[preprocessAudioToLocal] 清理输入文件失败: ${cleanupError.message}`,
                  'VoiceService',
                );
              }

              resolve(outputFile);
            } catch (error) {
              Logger.error(`[preprocessAudioToLocal] 处理失败: ${error.message}`, 'VoiceService');
              reject(error);
            }
          })
          .on('error', err => {
            Logger.error(
              `[preprocessAudioToLocal] FFmpeg 转换失败: ${err.message}`,
              'VoiceService',
            );

            // 清理临时文件
            try {
              if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
              if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
            } catch (cleanupError) {
              Logger.warn(
                `[preprocessAudioToLocal] 清理临时文件失败: ${cleanupError.message}`,
                'VoiceService',
              );
            }

            reject(err);
          })
          .save(outputFile);
      } catch (error) {
        Logger.error(`[preprocessAudioToLocal] 预处理失败: ${error.message}`, 'VoiceService');

        // 清理临时文件
        try {
          if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
          if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        } catch (cleanupError) {
          Logger.warn(
            `[preprocessAudioToLocal] 清理临时文件失败: ${cleanupError.message}`,
            'VoiceService',
          );
        }

        reject(error);
      }
    });
  }

  /**
   * 预处理音频文件，使其符合阿里云 CosyVoice 要求
   * - 采样率: 16000 Hz
   * - 声道: 单声道 (Mono)
   * - 时长: 最多 10 秒
   * - 格式: WAV (PCM)
   * @deprecated 使用 preprocessAudioToLocal 代替
   */
  private async preprocessAudio(audioUrl: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const tempDir = os.tmpdir();
      const inputFile = path.join(tempDir, `input-${Date.now()}.wav`);
      const outputFile = path.join(tempDir, `output-${Date.now()}.wav`);

      try {
        Logger.log(`[preprocessAudio] 开始下载音频: ${audioUrl}`, 'VoiceService');

        // 下载音频文件
        const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(inputFile, response.data);

        Logger.log(`[preprocessAudio] 音频下载完成，开始转换`, 'VoiceService');

        // 动态引入 fluent-ffmpeg，避免在未安装依赖的运行环境报错
        let ffmpeg: any;
        try {
          const mod: any = await import('fluent-ffmpeg');
          ffmpeg = mod?.default || mod;
        } catch (e: any) {
          Logger.warn(
            `[preprocessAudio] 未安装 fluent-ffmpeg，无法进行预处理: ${e?.message || e}`,
            'VoiceService',
          );
          throw new HttpException(
            '服务器未安装 fluent-ffmpeg 依赖，无法进行预处理',
            HttpStatus.NOT_IMPLEMENTED,
          );
        }

        // 使用 ffmpeg 转换音频
        ffmpeg(inputFile)
          .audioFrequency(16000) // 采样率 16000 Hz
          .audioChannels(1) // 单声道
          .duration(10) // 最多 10 秒
          .audioCodec('pcm_s16le') // PCM 16-bit
          .format('wav') // WAV 格式
          .on('start', commandLine => {
            Logger.log(`[preprocessAudio] FFmpeg 命令: ${commandLine}`, 'VoiceService');
          })
          .on('end', async () => {
            try {
              Logger.log(`[preprocessAudio] 音频转换完成`, 'VoiceService');

              // 读取转换后的文件
              const convertedData = fs.readFileSync(outputFile);

              // 上传到 OSS
              Logger.log(`[preprocessAudio] 开始上传转换后的音频`, 'VoiceService');
              const uploadResult = await this.uploadService.uploadFileFromBuffer(
                convertedData,
                `voice-preprocessed-${Date.now()}.wav`,
                'audio/wav',
              );

              Logger.log(`[preprocessAudio] 音频上传成功: ${uploadResult}`, 'VoiceService');

              // 清理临时文件
              try {
                fs.unlinkSync(inputFile);
                fs.unlinkSync(outputFile);
              } catch (cleanupError) {
                Logger.warn(
                  `[preprocessAudio] 清理临时文件失败: ${cleanupError.message}`,
                  'VoiceService',
                );
              }

              resolve(uploadResult);
            } catch (uploadError) {
              Logger.error(`[preprocessAudio] 上传失败: ${uploadError.message}`, 'VoiceService');
              reject(uploadError);
            }
          })
          .on('error', err => {
            Logger.error(`[preprocessAudio] FFmpeg 转换失败: ${err.message}`, 'VoiceService');

            // 清理临时文件
            try {
              if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
              if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
            } catch (cleanupError) {
              Logger.warn(
                `[preprocessAudio] 清理临时文件失败: ${cleanupError.message}`,
                'VoiceService',
              );
            }

            reject(err);
          })
          .save(outputFile);
      } catch (error) {
        Logger.error(`[preprocessAudio] 预处理失败: ${error.message}`, 'VoiceService');

        // 清理临时文件
        try {
          if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
          if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        } catch (cleanupError) {
          Logger.warn(
            `[preprocessAudio] 清理临时文件失败: ${cleanupError.message}`,
            'VoiceService',
          );
        }

        reject(error);
      }
    });
  }

  async enroll(body: {
    prefix?: string;
    url: string;
    targetModel?: string;
    name?: string;
    userId?: number;
    enablePreprocess?: boolean;
  }) {
    try {
      Logger.log(`[enroll] 收到请求: ${JSON.stringify(body)}`, 'VoiceService');

      const { url } = body;
      const targetModel = body.targetModel || (await this.getDefaultModel());

      // 如果没有提供 prefix，自动生成一个随机的 prefix
      let prefix = body.prefix;
      if (!prefix) {
        // 生成格式：video{userId}，例如 video16、video123
        const userId = body.userId || 0;
        prefix = `video${userId}`;
        Logger.log(`[enroll] 自动生成 prefix: ${prefix}`, 'VoiceService');
      }

      Logger.log(
        `[enroll] 参数验证: prefix=${prefix}, url=${url}, targetModel=${targetModel}`,
        'VoiceService',
      );

      if (!url) {
        Logger.error(`[enroll] 参数验证失败: url=${url}`, 'VoiceService');
        throw new HttpException('url 为必填', HttpStatus.BAD_REQUEST);
      }

      // 验证 prefix 格式：只允许英文字母、数字和下划线
      const prefixRegex = /^[a-zA-Z0-9_]+$/;
      if (!prefixRegex.test(prefix)) {
        Logger.error(`[enroll] prefix 格式错误: ${prefix}`, 'VoiceService');
        throw new HttpException(
          'prefix 只能包含英文字母、数字和下划线 (只允许 a-z, A-Z, 0-9, _)',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 验证 prefix 长度：最多10个字符
      if (prefix.length > 10) {
        Logger.error(`[enroll] prefix 长度超限: ${prefix}`, 'VoiceService');
        throw new HttpException('prefix 最多10个字符', HttpStatus.BAD_REQUEST);
      }

      const apiKey = await this.getApiKey();
      Logger.log(`[enroll] 获取到 API Key: ${apiKey ? '已配置' : '未配置'}`, 'VoiceService');

      // 固定不进行预处理，直接使用原始 URL
      const processedUrl: string = url;

      const payload = {
        model: 'voice-enrollment',
        input: {
          action: 'create_voice',
          target_model: targetModel,
          prefix,
          url: processedUrl,
        },
      };

      Logger.log(`[enroll] 准备调用阿里云API: ${JSON.stringify(payload)}`, 'VoiceService');

      const res = await axios.post(COSY_CUSTOMIZATION_URL, payload, {
        headers: this.getAxiosHeaders(apiKey),
      });
      const data = res.data;

      Logger.log(`[enroll] 阿里云API响应: ${JSON.stringify(data)}`, 'VoiceService');

      try {
        const voiceId = data?.output?.voice_id || data?.voice_id;
        if (voiceId) {
          console.log(`开始保存声音记录: ${voiceId}`);
          // 入库：便于分页与管理
          await this.upsertVoice({
            voiceId: String(voiceId),
            userId: body?.userId || null,
            prefix: String(prefix),
            model: String(targetModel),
            status: 'PENDING',
            name: body?.name ? String(body.name) : null,
          });
          console.log(`声音记录保存成功: ${voiceId}`);
        } else {
          console.warn('API响应中没有voice_id，无法保存到数据库');
        }
      } catch (error) {
        console.error('保存声音记录失败:', error.message);
        console.error('错误详情:', error);
        // 不抛出错误，避免影响API响应
      }

      return data;
    } catch (error) {
      Logger.error(`[enroll] 发生错误: ${error.message}`, 'VoiceService');
      Logger.error(`[enroll] 错误堆栈: ${error.stack}`, 'VoiceService');

      // 如果是 axios 错误，记录响应详情
      if (error.response) {
        Logger.error(`[enroll] API响应状态: ${error.response.status}`, 'VoiceService');
        Logger.error(
          `[enroll] API响应数据: ${JSON.stringify(error.response.data)}`,
          'VoiceService',
        );
      }

      throw error;
    }
  }

  async list(query: { prefix?: string; page_index?: number; page_size?: number }) {
    const { prefix, page_index, page_size } = (query || {}) as any;
    const pi = Math.max(1, Number(page_index ?? 1)); // 上游页码从 1 开始
    const ps = Math.max(1, Number(page_size ?? 10));
    const apiKey = await this.getApiKey();
    const input: any = { action: 'list_voice', page_index: pi, page_size: ps };
    if (typeof prefix === 'string' && prefix.length > 0) input.prefix = prefix;
    const payload = { model: 'voice-enrollment', input };
    const res = await axios.post(COSY_CUSTOMIZATION_URL, payload, {
      headers: this.getAxiosHeaders(apiKey),
    });
    return res.data;
  }

  async query(voiceId: string) {
    if (!voiceId) throw new HttpException('voiceId 必填', HttpStatus.BAD_REQUEST);
    const local = await this.voiceRepo.findOne({ where: { voiceId } });
    if (local && (local.provider as VoiceProvider) === 'gpt-sovits') {
      return {
        voice_id: local.voiceId,
        status: local.status || 'SUCCEEDED',
        provider: local.provider,
        name: local.name,
      };
    }
    // 对于 minimax 等其他 provider，直接返回本地数据
    if (local && (local.provider as VoiceProvider) === 'minimax') {
      return {
        voice_id: local.voiceId,
        status: local.status || 'SUCCEEDED',
        provider: local.provider,
        name: local.name,
      };
    }
    const apiKey = await this.getApiKey();
    const payload = {
      model: 'voice-enrollment',
      input: {
        action: 'query_voice',
        voice_id: voiceId,
      },
    };
    const res = await axios.post(COSY_CUSTOMIZATION_URL, payload, {
      headers: this.getAxiosHeaders(apiKey),
    });
    const data = res.data;
    try {
      const statusCandidate =
        data?.status ?? data?.result?.status ?? data?.data?.status ?? data?.output?.status;
      const status = statusCandidate ? String(statusCandidate).toUpperCase() : null;
      console.log(`查询声音状态: ${voiceId} -> ${status}`);
      await this.upsertVoice({ voiceId: String(voiceId), status });
      console.log(`声音状态更新成功: ${voiceId} -> ${status}`);
    } catch (error) {
      console.error(`更新声音状态失败: ${voiceId}`, error.message);
    }
    // 合并本地数据库中的 name
    if (local && local.name) {
      return { ...data, name: local.name };
    }
    return data;
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
    const res = await axios.post(COSY_CUSTOMIZATION_URL, payload, {
      headers: this.getAxiosHeaders(apiKey),
    });
    const data = res.data;
    try {
      console.log(`更新声音训练数据: ${voice_id}`);
      await this.upsertVoice({ voiceId: String(voice_id), status: 'PENDING' });
      console.log(`声音训练数据更新成功: ${voice_id}`);
    } catch (error) {
      console.error(`更新声音训练数据失败: ${voice_id}`, error.message);
    }
    return data;
  }

  // 专门的状态更新方法
  async updateStatus(voiceId: string, status: string) {
    if (!voiceId) throw new HttpException('voiceId 必填', HttpStatus.BAD_REQUEST);
    try {
      console.log(`手动更新声音状态: ${voiceId} -> ${status}`);
      await this.upsertVoice({ voiceId: String(voiceId), status: String(status).toUpperCase() });
      console.log(`声音状态手动更新成功: ${voiceId} -> ${status}`);
      return { success: true, message: '状态更新成功' };
    } catch (error) {
      console.error(`手动更新声音状态失败: ${voiceId}`, error.message);
      throw new HttpException(`状态更新失败: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  // 启用音色（设置 isEnabled = true，同时确保 status = SUCCEEDED，并扣除饼干）
  async enableVoice(voiceId: string, token?: string) {
    if (!voiceId) throw new HttpException('voiceId 必填', HttpStatus.BAD_REQUEST);
    try {
      console.log(`启用音色: ${voiceId}`);
      const voice = await this.voiceRepo.findOne({ where: { voiceId: String(voiceId) } });
      if (!voice) {
        throw new HttpException(`音色不存在: ${voiceId}`, HttpStatus.NOT_FOUND);
      }

      // 如果音色已经启用，直接返回成功（避免重复扣费）
      if (voice.isEnabled) {
        console.log(`音色已启用，跳过: ${voiceId}`);
        return { success: true, message: '音色已启用', voiceId };
      }

      // 扣除 3000 饼干
      const VOICE_ENABLE_COST = 3000;
      if (token && voice.userId) {
        console.log(`扣除饼干: userId=${voice.userId}, amount=${VOICE_ENABLE_COST}`);
        const deductResult = await MaobingCookieUtil.deductCookies({
          userId: voice.userId,
          amount: VOICE_ENABLE_COST,
          remark: `启用音色: ${voice.name || voiceId}`,
          token,
        });
        if (!deductResult.success) {
          throw new HttpException(
            deductResult.message || '饼干扣费失败，余额不足',
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
        console.log(`饼干扣费成功: ${deductResult.message}`);
      } else {
        console.warn(`缺少 token 或 userId，跳过扣费: voiceId=${voiceId}, userId=${voice.userId}`);
      }

      voice.status = 'SUCCEEDED';
      voice.isEnabled = true;
      await this.voiceRepo.save(voice);
      console.log(`音色启用成功: ${voiceId}`);
      return { success: true, message: '音色启用成功', voiceId };
    } catch (error) {
      console.error(`启用音色失败: ${voiceId}`, error.message);
      if (error instanceof HttpException) throw error;
      throw new HttpException(`启用音色失败: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  // 自动同步PENDING状态的音色
  async syncPendingVoicesStatus() {
    try {
      console.log('开始自动同步PENDING状态的音色...');

      // 1. 获取所有PENDING状态的音色
      const pendingVoices = await this.voiceRepo.find({
        where: { status: 'PENDING', provider: 'dashscope' },
        order: { createdAt: 'ASC' },
      });

      console.log(`找到 ${pendingVoices.length} 个PENDING状态的音色`);

      if (pendingVoices.length === 0) {
        console.log('没有需要同步状态的音色');
        return { synced: 0, message: '没有需要同步的音色' };
      }

      let syncedCount = 0;

      // 2. 逐个查询状态
      for (const voice of pendingVoices) {
        try {
          console.log(`查询音色状态: ${voice.voiceId}`);

          // 调用上游API查询状态
          const apiKey = await this.getApiKey();
          const payload = {
            model: 'voice-enrollment',
            input: {
              action: 'query_voice',
              voice_id: voice.voiceId,
            },
          };

          const res = await axios.post(COSY_CUSTOMIZATION_URL, payload, {
            headers: this.getAxiosHeaders(apiKey),
          });

          const data = res.data;
          const statusCandidate =
            data?.status ??
            data?.data?.status ??
            data?.data?.output?.status ??
            data?.output?.status ??
            data?.result?.status;

          if (statusCandidate && statusCandidate.toUpperCase() !== 'PENDING') {
            const newStatus = String(statusCandidate).toUpperCase();
            console.log(`音色 ${voice.voiceId} 状态更新: PENDING -> ${newStatus}`);

            await this.upsertVoice({
              voiceId: voice.voiceId,
              status: newStatus,
            });

            syncedCount++;
          } else {
            console.log(`音色 ${voice.voiceId} 状态仍为PENDING`);
          }

          // 添加延迟，避免API请求过于频繁
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`查询音色 ${voice.voiceId} 状态失败:`, error.message);
          // 如果是404错误，说明音色可能已被删除，标记为FAILED
          if (error.response?.status === 404 || error.message.includes('not found')) {
            console.log(`音色 ${voice.voiceId} 可能已被删除，标记为FAILED`);
            await this.upsertVoice({
              voiceId: voice.voiceId,
              status: 'FAILED',
            });
            syncedCount++;
          }
        }
      }

      console.log(`自动同步完成，共更新 ${syncedCount} 个音色状态`);
      return { synced: syncedCount, message: `成功同步 ${syncedCount} 个音色状态` };
    } catch (error) {
      console.error('自动同步音色状态失败:', error.message);
      throw new HttpException(`自动同步失败: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  async remove(body: { voice_id: string }) {
    const { voice_id } = body;

    if (!voice_id) throw new HttpException('voice_id 必填', HttpStatus.BAD_REQUEST);

    const existing = await this.voiceRepo.findOne({ where: { voiceId: voice_id } });

    if (existing) {
      const provider = existing.provider as VoiceProvider;

      if (provider === 'gpt-sovits') {
        Logger.log(`开始删除 GPT-SoVITS 音色 ${voice_id}`, 'VoiceService');

        await this.deleteVoiceAssociations(voice_id);

        await this.cleanupGptSovitsAssets(voice_id);

        return { success: true };
      }

      if (provider === 'minimax') {
        Logger.log(`开始删除 MiniMax 音色 ${voice_id}`, 'VoiceService');

        const config = (existing.config || {}) as { voiceId?: string };
        const minimaxVoiceId = existing.providerVoiceId || config?.voiceId;
        if (!minimaxVoiceId) {
          Logger.warn(
            `MiniMax 音色 ${voice_id} 缺少 voiceId 配置，跳过远程删除，仅清理本地记录`,
            'VoiceService',
          );
          await this.deleteVoiceAssociations(voice_id);
          return {
            success: true,
            provider: 'minimax',
            message: '已删除本地记录，但缺少 MiniMax voiceId，未调用远程API',
          };
        }

        const prefix = existing.prefix || '';
        const isDesignVoice =
          prefix.startsWith('minimax-design') || voice_id.startsWith('minimax-design');
        const voiceType = isDesignVoice ? 'voice_design' : 'voice_cloning';

        // 尝试调用 MiniMax 删除接口，失败不影响本地数据删除
        // （只有调用过 TTS 的音色才能成功调用 MiniMax 删除接口）
        try {
          const remoteResult = await this.minimaxProvider.deleteVoice({
            voiceId: minimaxVoiceId,
            voiceType,
          });
          Logger.log(
            `MiniMax 音色 ${voice_id} 远程删除成功（远程ID: ${minimaxVoiceId}, type: ${voiceType})`,
            'VoiceService',
          );
        } catch (error) {
          Logger.warn(
            `MiniMax 音色 ${voice_id} 远程删除失败（远程ID: ${minimaxVoiceId}): ${
              error?.message || error
            }，继续删除本地数据`,
            'VoiceService',
          );
        }

        // 无论远程删除是否成功，都删除本地数据
        await this.deleteVoiceAssociations(voice_id);

        return {
          success: true,
          provider: 'minimax',
          message: '音色删除完成',
        };
      }
    }

    try {
      console.log(`开始删除音色 ${voice_id}`);

      const apiKey = await this.getApiKey();

      const payload = {
        model: 'voice-enrollment',

        input: {
          action: 'delete_voice',

          voice_id,
        },
      };

      const res = await axios.post(COSY_CUSTOMIZATION_URL, payload, {
        headers: this.getAxiosHeaders(apiKey),
      });

      try {
        await this.deleteVoiceAssociations(voice_id);
      } catch (dbError) {
        console.error(`本地数据库删除失败: ${voice_id}`, dbError.message);
      }

      console.log(`音色删除完成: ${voice_id}`);

      return res.data;
    } catch (error) {
      console.error(`删除音色失败: ${voice_id}`, error.message);

      throw new HttpException(`删除音色失败: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * 辅助方法：检测并处理音频URL，下载后转换为Base64
   */
  private async convertAudioUrlToBase64(audioInput: string): Promise<string> {
    // 检测是否为URL（http或https开头）
    const isUrl = /^https?:\/\//i.test(audioInput);
    if (!isUrl) {
      return audioInput; // 不是URL，直接返回原始输入（假定已是Base64）
    }

    Logger.debug(`检测到音频URL，开始下载: ${audioInput}`, 'VoiceService');
    try {
      const response = await axios.get(audioInput, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30秒超时
      });

      const audioBuffer = Buffer.from(response.data);
      const base64Audio = audioBuffer.toString('base64');
      Logger.debug(
        `音频下载成功，大小: ${audioBuffer.length} bytes, Base64长度: ${base64Audio.length}`,
        'VoiceService',
      );
      return base64Audio;
    } catch (error) {
      Logger.error(`下载音频URL失败: ${audioInput}`, error.message, 'VoiceService');
      throw new HttpException(`下载音频URL失败: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * 将 PCM 音频转换为 MP3 格式
   * @param pcmBuffer PCM 音频 Buffer
   * @param sampleRate 采样率（默认 16000Hz）
   * @param channels 声道数（默认 1）
   * @returns MP3 音频 Buffer
   */
  async convertPcmToMp3(
    pcmBuffer: Buffer,
    sampleRate: number = 16000,
    channels: number = 1,
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const tempDir = os.tmpdir();
      const inputFile = path.join(tempDir, `pcm-input-${Date.now()}.pcm`);
      const outputFile = path.join(tempDir, `mp3-output-${Date.now()}.mp3`);

      try {
        // 保存 PCM 为临时文件
        fs.writeFileSync(inputFile, pcmBuffer);

        // 动态导入 fluent-ffmpeg
        let ffmpeg: any;
        try {
          const mod: any = await import('fluent-ffmpeg');
          ffmpeg = mod?.default || mod;
        } catch (e: any) {
          Logger.error(
            `[convertPcmToMp3] 未安装 fluent-ffmpeg: ${e?.message || e}`,
            'VoiceService',
          );
          throw new HttpException(
            '服务器未安装 fluent-ffmpeg 依赖，无法转换音频格式',
            HttpStatus.NOT_IMPLEMENTED,
          );
        }

        // 使用 ffmpeg 转换：PCM -> MP3
        ffmpeg()
          .input(inputFile)
          .inputFormat('s16le') // PCM 16-bit little-endian
          .inputOptions([
            `-ar ${sampleRate}`, // 采样率
            `-ac ${channels}`, // 声道数
          ])
          .audioCodec('libmp3lame')
          .audioBitrate('128k')
          .format('mp3')
          .on('start', commandLine => {
            Logger.debug(`[convertPcmToMp3] FFmpeg 命令: ${commandLine}`, 'VoiceService');
          })
          .on('end', () => {
            try {
              // 读取转换后的文件
              const mp3Buffer = fs.readFileSync(outputFile);

              // 清理临时文件
              try {
                fs.unlinkSync(inputFile);
                fs.unlinkSync(outputFile);
              } catch (cleanupError) {
                Logger.warn(
                  `[convertPcmToMp3] 清理临时文件失败: ${cleanupError.message}`,
                  'VoiceService',
                );
              }

              resolve(mp3Buffer);
            } catch (error) {
              Logger.error(
                `[convertPcmToMp3] 读取转换后文件失败: ${error.message}`,
                'VoiceService',
              );
              reject(error);
            }
          })
          .on('error', err => {
            Logger.error(`[convertPcmToMp3] FFmpeg 转换失败: ${err.message}`, 'VoiceService');

            // 清理临时文件
            try {
              if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
              if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
            } catch (cleanupError) {
              Logger.warn(
                `[convertPcmToMp3] 清理临时文件失败: ${cleanupError.message}`,
                'VoiceService',
              );
            }

            reject(err);
          })
          .save(outputFile);
      } catch (error) {
        Logger.error(`[convertPcmToMp3] 处理失败: ${error.message}`, 'VoiceService');

        // 清理临时文件
        try {
          if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
          if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        } catch (cleanupError) {
          Logger.warn(
            `[convertPcmToMp3] 清理临时文件失败: ${cleanupError.message}`,
            'VoiceService',
          );
        }

        reject(error);
      }
    });
  }

  /**
   * 语音识别（ASR）：接收 base64 音频或音频URL（建议 WAV PCM 单声道 16kHz），调用 DashScope Paraformer 实时识别（WebSocket）
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
    opts?: { onPartial?: (text: string, begin?: number, end?: number | null) => void },
  ): Promise<{
    text: string;
    sentences?: Array<{ begin_time: number; end_time: number | null; text: string }>;
  }> {
    let { audioBase64 } = body || ({} as any);
    if (!audioBase64) throw new HttpException('audioBase64 必填', HttpStatus.BAD_REQUEST);

    // 如果传入的是URL，先下载并转换为Base64
    audioBase64 = await this.convertAudioUrlToBase64(audioBase64);

    const fmt = (body.format || 'wav') as 'wav' | 'pcm' | 'mp3' | 'opus' | 'speex' | 'aac' | 'amr';
    const sampleRate = Number(body.sample_rate ?? 16000);
    // 根据采样率自动选择合适的默认模型
    const defaultModel =
      sampleRate <= 8000 ? 'paraformer-realtime-8k-v2' : 'paraformer-realtime-v2';
    const requestedModel = body.model || defaultModel;
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
      throw new HttpException(
        '服务器未安装 ws 依赖，无法进行WebSocket识别。',
        HttpStatus.NOT_IMPLEMENTED,
      );
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
      Authorization: `Bearer ${apiKey}`,
      'X-DashScope-DataInspection': 'enable',
    } as Record<string, string>;

    const runOnce = async (modelName: string): Promise<{ text: string; sentences: any[] }> => {
      const ws = new WS(COSY_WS_URL, { headers });

      let finished = false;
      let finalText = '';
      const sentences: Array<{ begin_time: number; end_time: number | null; text: string }> = [];

      const sendRunTask = () => {
        const message = {
          header: {
            action: 'run-task',
            task_id: taskId,
            streaming: 'duplex',
          },
          payload: {
            task_group: 'audio',
            task: 'asr',
            function: 'recognition',
            model: modelName,
            parameters: {
              format: fmt === 'wav' || fmt === 'pcm' ? 'pcm' : fmt,
              sample_rate: sampleRate,
              disfluency_removal_enabled: disfluency,
              language_hints: undefined as string[] | undefined,
            },
            input: {},
          },
        };

        if (languageHints && Array.isArray(languageHints) && languageHints.length) {
          message.payload.parameters.language_hints = languageHints;
        }

        ws.send(JSON.stringify(message));
      };

      const chunkAndSendAudio = async () => {
        let sendBuf = audioBuf;

        // 只对 WAV 格式去掉文件头，PCM 格式直接发送
        if (fmt === 'wav' && audioBuf.length >= 44) {
          const header = audioBuf.toString('ascii', 0, 4);
          if (header === 'RIFF') {
            sendBuf = audioBuf.subarray(44);
          }
        }

        if (sendBuf.length === 0) {
          Logger.error('[ASR] 音频数据为空', 'VoiceService');
          return;
        }

        // 以100ms一帧推送：16kHz * 0.1s * 2bytes = 3200字节
        const chunkSize = 3200;
        let offset = 0;

        const sendNext = () => {
          if (finished) return;

          if (offset >= sendBuf.length) {
            const finishMsg = {
              header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' },
              payload: { input: {} },
            };
            ws.send(JSON.stringify(finishMsg));
            return;
          }

          const end = Math.min(offset + chunkSize, sendBuf.length);
          const buf = sendBuf.subarray(offset, end);
          ws.send(buf);
          offset = end;
          setImmediate(sendNext);
        };
        sendNext();
      };

      const done = new Promise<{ text: string; sentences: any[] }>((resolve, reject) => {
        ws.on('open', () => {
          Logger.log(`WebSocket 已连接到 ${COSY_WS_URL}`, 'VoiceService');
          sendRunTask();
        });

        ws.on('message', (data: any, isBinary: boolean) => {
          if (isBinary) return; // ASR 返回为 JSON 事件
          try {
            const msg = JSON.parse(data.toString());
            const event = msg?.header?.event;

            if (event === 'task-failed') {
              Logger.error(`ASR 任务失败: ${JSON.stringify(msg)}`, 'VoiceService');
            }

            if (event === 'task-started') {
              chunkAndSendAudio();
              return;
            }

            // 兼容多种返回结构，尽可能提取文本
            // 重要：只处理最终结果（is_final=true 或有 end_time），避免中间结果重复累加
            const pushSentence = (
              text: string,
              b?: number,
              e?: number | null,
              isFinal?: boolean,
            ) => {
              if (!text) return;

              // 只累加最终结果到 finalText，避免重复
              // 判断依据：有 end_time（句子结束）或 isFinal=true
              const shouldAccumulate = isFinal || (e !== null && e !== undefined);

              if (shouldAccumulate) {
                sentences.push({ begin_time: b ?? 0, end_time: e ?? null, text });
                finalText += text;
              }

              // 无论是否最终结果，都通知回调（用于实时显示）
              try {
                opts?.onPartial?.(text, b, e ?? null);
              } catch {}
            };

            const out = msg?.payload?.output;
            if (
              event === 'result-generated' ||
              event === 'result' ||
              event === 'recognition.result'
            ) {
              const s = out?.sentence;
              if (s?.text) {
                // 检查是否为最终结果
                const isFinal = s?.is_final === true;
                pushSentence(s.text, s.begin_time, s.end_time ?? null, isFinal);
              } else if (Array.isArray(out?.sentences)) {
                for (const it of out.sentences) {
                  const isFinal = it?.is_final === true;
                  pushSentence(it?.text || '', it?.begin_time, it?.end_time ?? null, isFinal);
                }
              } else if (typeof out?.text === 'string') {
                // 如果没有详细信息，假定为最终结果
                const isFinal = out?.is_final !== false;
                pushSentence(out.text, undefined, undefined, isFinal);
              } else if (Array.isArray(out?.nbest) && out.nbest.length > 0) {
                const best = out.nbest[0];
                const isFinal = best?.is_final !== false;
                pushSentence(best?.text || best?.sentence || '', undefined, undefined, isFinal);
              }
              return;
            }

            if (event === 'task-finished' || event === 'recognition.completed') {
              Logger.debug('任务完成', 'VoiceService');
              finished = true;
              ws.close();
              return;
            }
            if (event === 'task-failed') {
              finished = true;
              const errorCode = msg?.header?.error_code;
              const errorMsg = msg?.header?.error_message || msg?.header?.message;
              const fullError = `ASR 任务失败 [${errorCode}]: ${errorMsg}`;
              Logger.error(fullError, 'VoiceService');
              ws.close();
              return reject(new HttpException(fullError, HttpStatus.BAD_GATEWAY));
            }
          } catch (e) {
            Logger.error(`解析 WebSocket 消息失败: ${e}`, 'VoiceService');
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
    };

    // 模型回退链：按顺序尝试，直至成功或全部失败
    // 根据阿里云官方文档和实际可用模型列表
    // 正确的模型名称：
    // - paraformer-realtime-8k-v2 (8k 采样率，推荐用于 8kHz 音频)
    // - paraformer-realtime-v2 (16k 采样率，推荐用于 16kHz 音频)
    // - paraformer-realtime-v1 (旧版，16k 采样率)
    // - paraformer-realtime-8k-v1 (旧版，8k 采样率)
    const candidates = Array.from(
      new Set([
        requestedModel,
        // 根据采样率选择合适的模型
        sampleRate <= 8000 ? 'paraformer-realtime-8k-v2' : 'paraformer-realtime-v2',
        'paraformer-realtime-v2',
        'paraformer-realtime-8k-v2',
        'paraformer-realtime-v1',
        'paraformer-realtime-8k-v1',
      ]),
    );

    let lastErr: any = null;
    for (const m of candidates) {
      try {
        return await runOnce(m);
      } catch (e: any) {
        lastErr = e;
        const msg = (e?.message || '').toLowerCase();
        if (msg.includes('model not found')) {
          Logger.warn(`ASR模型不可用，回退尝试：${m} -> 下一候选`, 'VoiceService');
          continue;
        }
        break;
      }
    }
    throw lastErr || new HttpException('ASR 调用失败', HttpStatus.BAD_GATEWAY);
  }

  // 读取/保存音色默认合成参数（数据库存储）

  async getVoiceParams(voiceId: string): Promise<any | null> {
    if (!voiceId) return null;

    try {
      const voice = await this.voiceRepo.findOne({ where: { voiceId } });

      if (!voice) return null;

      const data: any = {
        rate: voice.rate,

        pitch: voice.pitch,

        volume: voice.volume,

        sample_rate: voice.sampleRate,

        format: voice.format,
      };

      if ((voice.provider as VoiceProvider) === 'gpt-sovits') {
        const cfg = this.getGptSovitsConfig(voice);

        data.textLanguage = cfg.textLanguage;
        data.text_language = cfg.textLanguage; // 兼容下划线命名

        data.promptLanguage = cfg.promptLanguage;
        data.prompt_language = cfg.promptLanguage; // 兼容下划线命名

        data.promptText = cfg.promptText;
        data.prompt_text = cfg.promptText; // 兼容下划线命名

        data.cutPunc = cfg.cutPunc;
        data.cut_punc = cfg.cutPunc; // 兼容下划线命名

        data.topK = cfg.topK;
        data.topP = cfg.topP;
        data.temperature = cfg.temperature;
        data.speed = cfg.speed;
        data.sampleSteps = cfg.sampleSteps;
        data.sample_steps = cfg.sampleSteps; // 兼容下划线命名

        data.sampleRate = cfg.sampleRate ?? voice.sampleRate ?? 32000;
        data.sample_rate = cfg.sampleRate ?? voice.sampleRate ?? 32000; // 兼容下划线命名

        data.format = 'wav';
      }

      return data;
    } catch (error) {
      console.error(`获取音色参数失败: ${voiceId}`, error.message);

      return null;
    }
  }

  async setVoiceParams(body: { voice_id: string; params: any }) {
    const { voice_id, params } = body || ({} as any);
    if (!voice_id || !params)
      throw new HttpException('voice_id 和 params 必填', HttpStatus.BAD_REQUEST);

    const voice = await this.voiceRepo.findOne({ where: { voiceId: voice_id } });
    if (!voice) throw new HttpException(`音色不存在: ${voice_id}`, HttpStatus.NOT_FOUND);

    const updateData: any = { updatedAt: new Date() };
    if (params.rate !== undefined) updateData.rate = Number(params.rate);
    if (params.pitch !== undefined) updateData.pitch = Number(params.pitch);
    if (params.volume !== undefined) updateData.volume = Number(params.volume);
    if (params.sample_rate !== undefined) updateData.sampleRate = Number(params.sample_rate);
    if (params.format !== undefined) updateData.format = String(params.format);

    if ((voice.provider as VoiceProvider) === 'gpt-sovits') {
      const cfg = this.getGptSovitsConfig(voice);
      const nextCfg: VoiceGptSovitsConfig = {
        ...cfg,
        textLanguage: params.text_language || params.textLanguage || cfg.textLanguage,
        promptLanguage: params.prompt_language || params.promptLanguage || cfg.promptLanguage,
        promptText: params.prompt_text || params.promptText || cfg.promptText,
        sampleRate:
          params.sample_rate || params.sampleRate
            ? Number(params.sample_rate || params.sampleRate)
            : cfg.sampleRate,
        cutPunc: params.cut_punc || params.cutPunc || cfg.cutPunc,
        topK: params.topK !== undefined ? Number(params.topK) : cfg.topK,
        topP: params.topP !== undefined ? Number(params.topP) : cfg.topP,
        temperature:
          params.temperature !== undefined ? Number(params.temperature) : cfg.temperature,
        speed: params.speed !== undefined ? Number(params.speed) : cfg.speed,
        sampleSteps:
          params.sampleSteps || params.sample_steps !== undefined
            ? Number(params.sampleSteps || params.sample_steps)
            : cfg.sampleSteps,
      };
      updateData.config = nextCfg;
    }

    await this.voiceRepo.update({ voiceId: voice_id }, updateData);
    return { success: true };
  }

  // 读取音色元信息（如自定义名称），从voice表读取
  async getVoiceMeta(voiceId: string): Promise<any | null> {
    if (!voiceId) return null;
    try {
      const voice = await this.voiceRepo.findOne({ where: { voiceId } });
      if (!voice || !voice.name) return null;
      return { name: voice.name };
    } catch (error) {
      console.error(`获取音色元信息失败: ${voiceId}`, error.message);
      return null;
    }
  }

  async setVoiceMeta(body: { voice_id: string; meta: any }) {
    const { voice_id, meta } = body;
    if (!voice_id || !meta)
      throw new HttpException('voice_id 与 meta 必填', HttpStatus.BAD_REQUEST);

    try {
      // 更新voice表中的名称
      const voice = await this.voiceRepo.findOne({ where: { voiceId: voice_id } });
      if (!voice) {
        throw new HttpException(`音色不存在: ${voice_id}`, HttpStatus.NOT_FOUND);
      }

      await this.voiceRepo.update(
        { voiceId: voice_id },
        { name: meta.name || null, updatedAt: new Date() },
      );

      return { success: true };
    } catch (error) {
      console.error(`设置音色元信息失败: ${voice_id}`, error.message);
      throw new HttpException(`设置音色元信息失败: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  async setVoiceCategory(body: { voice_id: string; categoryId: number | null }) {
    const { voice_id, categoryId } = body;
    if (!voice_id) throw new HttpException('voice_id 必填', HttpStatus.BAD_REQUEST);

    try {
      const voice = await this.voiceRepo.findOne({ where: { voiceId: voice_id } });
      if (!voice) {
        throw new HttpException(`音色不存在: ${voice_id}`, HttpStatus.NOT_FOUND);
      }

      await this.voiceRepo.update(
        { voiceId: voice_id },
        { categoryId: categoryId || null, updatedAt: new Date() },
      );

      return { success: true };
    } catch (error) {
      console.error(`设置音色分类失败: ${voice_id}`, error.message);
      throw new HttpException(`设置音色分类失败: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * 计算音频时长（秒）
   * 使用 ffprobe 获取精确的音频时长
   */
  private async getAudioDuration(
    audioBuffer: Buffer,
    format: 'mp3' | 'wav' | 'pcm',
    sampleRate: number,
  ): Promise<number> {
    // 方案1: 使用 ffprobe 获取精确时长（适用于所有格式）
    try {
      // 动态引入 fluent-ffmpeg
      const mod: any = await import('fluent-ffmpeg');
      const ffmpeg = mod?.default || mod;

      // 创建临时文件
      const tempDir = os.tmpdir();
      const tempFile = path.join(
        tempDir,
        `audio-duration-${Date.now()}.${format === 'pcm' ? 'wav' : format}`,
      );

      // 写入音频数据
      fs.writeFileSync(tempFile, audioBuffer);

      // 使用 ffprobe 获取时长
      return new Promise<number>((resolve, reject) => {
        ffmpeg.ffprobe(tempFile, (err, metadata) => {
          // 清理临时文件
          try {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          } catch {}

          if (err) {
            Logger.warn(
              `[getAudioDuration] ffprobe 失败: ${err.message}，使用估算方法`,
              'VoiceService',
            );
            // 回退到估算方法
            resolve(this.estimateAudioDuration(audioBuffer, format, sampleRate));
          } else {
            const duration = metadata?.format?.duration || 0;
            Logger.debug(`[getAudioDuration] ffprobe 获取时长: ${duration}秒`, 'VoiceService');
            resolve(duration);
          }
        });
      });
    } catch (error) {
      Logger.warn(
        `[getAudioDuration] 无法使用 ffprobe: ${error.message}，使用估算方法`,
        'VoiceService',
      );
      // 回退到估算方法
      return this.estimateAudioDuration(audioBuffer, format, sampleRate);
    }
  }

  /**
   * 估算音频时长（备用方法）
   * 基于数据大小和格式参数估算
   */
  private estimateAudioDuration(
    audioBuffer: Buffer,
    format: 'mp3' | 'wav' | 'pcm',
    sampleRate: number,
  ): number {
    const dataSize = audioBuffer.length;

    if (format === 'pcm' || format === 'wav') {
      // PCM/WAV: duration = dataSize / (sampleRate * channels * bytesPerSample)
      // 假设单声道、16位采样（2字节）
      const channels = 1;
      const bytesPerSample = 2;

      // 如果是 WAV 格式，去掉44字节的头部
      const audioDataSize =
        format === 'wav' && dataSize > 44 && audioBuffer.toString('ascii', 0, 4) === 'RIFF'
          ? dataSize - 44
          : dataSize;

      const duration = audioDataSize / (sampleRate * channels * bytesPerSample);
      Logger.debug(`[estimateAudioDuration] PCM/WAV 估算时长: ${duration}秒`, 'VoiceService');
      return duration;
    } else if (format === 'mp3') {
      // MP3: 使用比特率估算
      // 假设平均比特率 128kbps (16KB/s)
      const bitrate = 128 * 1024; // bits per second
      const bytesPerSecond = bitrate / 8; // bytes per second
      const duration = dataSize / bytesPerSecond;
      Logger.debug(`[estimateAudioDuration] MP3 估算时长: ${duration}秒`, 'VoiceService');
      return duration;
    }

    // 其他格式，使用保守估算
    Logger.warn(`[estimateAudioDuration] 未知格式 ${format}，使用保守估算`, 'VoiceService');
    return dataSize / (sampleRate * 2); // 假设单声道16位
  }

  private async ensureVoiceProviderColumns() {
    const columns = await this.voiceRepo.query(
      "SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'voice'",
    );
    const columnNames = new Set(
      columns.map((c: any) => String(c?.COLUMN_NAME || c?.column_name || '').toLowerCase()),
    );
    const alters: string[] = [];
    if (!columnNames.has('provider')) {
      alters.push(
        "ADD COLUMN `provider` varchar(64) NOT NULL DEFAULT 'dashscope' COMMENT '音色提供商（dashscope/gpt-sovits）' AFTER `model`",
      );
    }
    if (!columnNames.has('config')) {
      alters.push("ADD COLUMN `config` text NULL COMMENT '提供商配置JSON' AFTER `status`");
    }
    if (alters.length) {
      await this.voiceRepo.query(`ALTER TABLE \`voice\` ${alters.join(', ')}`);
      Logger.log('[VoiceService] 自动添加 provider/config 列成功', 'VoiceService');
    }
    if (!columnNames.has('provider')) {
      columnNames.add('provider');
    }
    const indexRows = await this.voiceRepo.query(
      "SHOW INDEX FROM `voice` WHERE Key_name = 'IDX_voice_provider'",
    );
    if (!indexRows?.length && columnNames.has('provider')) {
      await this.voiceRepo.query('ALTER TABLE `voice` ADD INDEX `IDX_voice_provider` (`provider`)');
      Logger.log('[VoiceService] 自动添加 IDX_voice_provider 索引成功', 'VoiceService');
    }
  }

  private generateGptSovitsVoiceId(raw?: string): string {
    const base = String(raw || '')
      .trim()
      .toLowerCase();
    const sanitized = base.replace(/[^a-z0-9-_]/g, '');
    if (sanitized) return sanitized;
    return `gptsovits-${Date.now().toString(36)}-${cryptoRandomId().slice(0, 8)}`;
  }

  private async assertVoiceIdAvailable(voiceId: string) {
    const exists = await this.voiceRepo.findOne({ where: { voiceId } });
    if (exists) {
      throw new HttpException(`音色 ${voiceId} 已存在`, HttpStatus.CONFLICT);
    }
  }

  private async ensureGptSovitsDir(voiceId: string): Promise<string> {
    await fsp.mkdir(this.gptSovitsStorageRoot, { recursive: true });
    const dir = path.join(this.gptSovitsStorageRoot, voiceId);
    await fsp.mkdir(dir, { recursive: true });
    return dir;
  }

  private async persistGptSovitsFile(
    file: { originalname?: string; buffer: Buffer },
    dir: string,
    baseName: string,
    allowedExts: string[],
    fallbackExt: string,
  ): Promise<string> {
    if (!file?.buffer?.length) {
      throw new HttpException(`${baseName} 文件内容为空`, HttpStatus.BAD_REQUEST);
    }
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext && !allowedExts.includes(ext)) {
      throw new HttpException(
        `${baseName} 文件扩展名仅支持 ${allowedExts.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const safeName = `${baseName}${ext || fallbackExt}`;
    const target = path.join(dir, safeName);
    await fsp.writeFile(target, file.buffer);
    return target;
  }

  private getLibraryFileType(ext: string): GptSovitsLibraryType | null {
    if (ext === '.ckpt' || ext === '.bin') return 'gpt';
    if (ext === '.pth' || ext === '.pt') return 'sovits';
    return null;
  }

  private normalizeLibraryRelativePath(fullPath: string): string {
    const relative = path.relative(this.gptSovitsStorageRoot, fullPath);
    return relative.split(path.sep).join('/');
  }

  private buildLibraryFileName(original: string, type: GptSovitsLibraryType) {
    const fallbackBase = type === 'gpt' ? 'gpt-model' : 'sovits-model';
    const fallbackExt = type === 'gpt' ? '.ckpt' : '.pth';
    let ext = path.extname(original || '').toLowerCase();
    if (!ext) {
      ext = fallbackExt;
    }
    const baseRaw = path.basename(original || '', ext);
    const sanitizedBase = baseRaw.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+$/, '');
    return {
      base: sanitizedBase || `${fallbackBase}-${Date.now()}`,
      ext,
    };
  }

  private async persistLibraryUpload(
    file: Express.Multer.File,
    dir: string,
    type: GptSovitsLibraryType,
  ): Promise<string> {
    const { base, ext } = this.buildLibraryFileName(file.originalname || '', type);
    let candidate = `${base}${ext}`;
    let attempt = 1;
    while (true) {
      const target = path.join(dir, candidate);
      try {
        await fsp.access(target);
        candidate = `${base}-${Date.now()}-${attempt}${ext}`;
        attempt += 1;
      } catch {
        await fsp.writeFile(target, file.buffer);
        return target;
      }
    }
  }

  private async safeStat(target: string): Promise<fs.Stats | null> {
    try {
      return await fsp.stat(target);
    } catch {
      return null;
    }
  }

  private parseOptionalNumber(input: any): number | undefined {
    if (input === undefined || input === null || input === '') return undefined;
    const num = Number(input);
    if (Number.isFinite(num)) return num;
    return undefined;
  }

  private getGptSovitsConfig(voice: VoiceEntity): VoiceGptSovitsConfig {
    const cfg = (voice.config || {}) as VoiceGptSovitsConfig;
    if (!cfg?.gptModelPath || !cfg?.sovitsModelPath || !cfg?.promptAudioPath || !cfg?.promptText) {
      throw new HttpException(`音色 ${voice.voiceId} 缺少 GPT-SoVITS 配置`, HttpStatus.BAD_REQUEST);
    }
    return {
      ...cfg,
      promptLanguage: cfg.promptLanguage || 'zh',
      textLanguage: cfg.textLanguage || DEFAULT_GPT_SOVITS_TEXT_LANGUAGE,
    };
  }

  private normalizeGptSovitsUrl(pathname = '/'): string {
    // 运行时动态读取环境变量，确保能获取到最新配置
    const envBaseUrl = process.env.GPT_SOVITS_BASE_URL;
    const base = (envBaseUrl || this.gptSovitsBaseUrl || 'http://127.0.0.1:9880').replace(
      /\/+$/,
      '',
    );
    const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return `${base}${path}`;
  }

  private async ensureGptSovitsModelLoaded(
    voiceId: string,
    config: VoiceGptSovitsConfig,
  ): Promise<void> {
    const cached = this.gptSovitsModelCache.get(voiceId);
    if (
      cached &&
      cached.gptModelPath === config.gptModelPath &&
      cached.sovitsModelPath === config.sovitsModelPath
    ) {
      return;
    }
    await retryWithBackoff(
      async () => {
        await axios.post(
          this.normalizeGptSovitsUrl('/set_model'),
          {
            gpt_model_path: config.gptModelPath,
            sovits_model_path: config.sovitsModelPath,
          },
          { timeout: 120000 },
        );
        this.gptSovitsModelCache.set(voiceId, {
          gptModelPath: config.gptModelPath,
          sovitsModelPath: config.sovitsModelPath,
          loadedAt: Date.now(),
        });
      },
      {
        onRetry: (error, attempt, delay) => {
          Logger.warn(
            `[ensureGptSovitsModelLoaded] 加载模型失败，正在重试 (${attempt}/${GPT_SOVITS_MAX_RETRIES})，` +
              `延迟 ${delay}ms。错误: ${error?.message || error}`,
            'VoiceService',
          );
        },
      },
    ).catch((error: any) => {
      Logger.error(
        `[ensureGptSovitsModelLoaded] 加载模型失败: ${error?.message || error}`,
        'VoiceService',
      );
      throw new HttpException(
        error?.response?.data?.message || '加载 GPT-SoVITS 模型失败',
        HttpStatus.BAD_GATEWAY,
      );
    });
  }

  private buildGptSovitsPayload(
    config: VoiceGptSovitsConfig,
    options: {
      text: string;
      textLanguage?: string;
      cutPunc?: string;
      streamingMode?: boolean;
    },
  ) {
    // 语言处理：保持 "auto" 不变，让服务器自动检测
    const promptLang = config.promptLanguage || 'auto';
    const textLang = options.textLanguage || config.textLanguage || 'auto';

    // 清理文本：
    // 1. 移除开头的标点符号
    // 2. 将句号替换成省略号（已注释）
    let cleanedText = options.text.replace(/^[。！？\.\!\?\,，、；;]+/, '');
    // cleanedText = cleanedText.replace(/。/g, '…').replace(/\./g, '…');

    const payload: any = {
      text: cleanedText,
      text_lang: textLang,
      ref_audio_path: config.promptAudioPath,
      prompt_text: config.promptText,
      prompt_lang: promptLang,
      text_split_method: options.cutPunc || config.cutPunc || 'cut5',
      top_k: config.topK,
      top_p: config.topP,
      temperature: config.temperature,
      speed_factor: config.speed || 1.0,
      media_type: 'wav',
      streaming_mode: options.streamingMode ?? false,
    };

    // 如果 config 中包含 characterName，优先使用 character_name
    if ((config as any).characterName) {
      payload.character_name = (config as any).characterName;
      // 有 character_name 时，不需要传 gpt_model_path 和 sovits_model_path
      // 因为服务器会根据角色名自动加载模型
    } else {
      // 没有 characterName 时，使用模型路径
      payload.gpt_model_path = config.gptModelPath;
      payload.sovits_model_path = config.sovitsModelPath;
    }

    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
        delete payload[key];
      }
    });
    return payload;
  }

  /**
   * 上传音频文件到 GPT-SoVITS 服务器
   * 如果路径是本地绝对路径，则上传文件并返回服务器路径
   * 如果路径是相对路径，则假定文件已在服务器上，直接返回
   */
  private async uploadAudioToGptSovits(audioPath: string): Promise<string> {
    // 如果是相对路径，直接返回（假定文件已在服务器上）
    if (!path.isAbsolute(audioPath)) {
      Logger.debug(`[uploadAudioToGptSovits] 使用服务器路径: ${audioPath}`, 'VoiceService');
      return audioPath;
    }

    // 如果是本地绝对路径，需要上传到服务器
    Logger.log(
      `[uploadAudioToGptSovits] 上传本地音频文件到 GPT-SoVITS 服务器: ${audioPath}`,
      'VoiceService',
    );

    return await retryWithBackoff(
      async () => {
        // 读取本地文件
        const audioBuffer = await fsp.readFile(audioPath);
        const fileName = path.basename(audioPath);

        // 使用 FormData 上传
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('file', audioBuffer, {
          filename: fileName,
          contentType: 'audio/wav',
        });

        const uploadUrl = this.normalizeGptSovitsUrl('/audio/upload');
        Logger.debug(`[uploadAudioToGptSovits] 上传到: ${uploadUrl}`, 'VoiceService');

        const response = await axios.post(uploadUrl, formData, {
          headers: formData.getHeaders(),
          timeout: 30000,
          maxContentLength: 100 * 1024 * 1024, // 100MB
          maxBodyLength: 100 * 1024 * 1024,
        });

        if (response.status !== 200) {
          const error: any = new Error(`上传失败: ${response.statusText}`);
          error.response = response;
          throw error;
        }

        const serverPath = response.data?.path;
        if (!serverPath) {
          throw new Error('服务器未返回音频路径');
        }

        Logger.log(`[uploadAudioToGptSovits] 上传成功，服务器路径: ${serverPath}`, 'VoiceService');
        return serverPath;
      },
      {
        onRetry: (error, attempt, delay) => {
          Logger.warn(
            `[uploadAudioToGptSovits] 上传音频失败，正在重试 (${attempt}/${GPT_SOVITS_MAX_RETRIES})，` +
              `延迟 ${delay}ms。错误: ${error?.message || error}`,
            'VoiceService',
          );
        },
      },
    ).catch((error: any) => {
      Logger.error(
        `[uploadAudioToGptSovits] 上传音频失败: ${error?.message || error}`,
        'VoiceService',
      );
      throw new HttpException(
        `上传音频到 GPT-SoVITS 服务器失败: ${error?.message || error}`,
        HttpStatus.BAD_GATEWAY,
      );
    });
  }

  /**
   * 使用 GPT-SoVITS 异步接口请求音频
   * 流程：1. 提交任务 -> 2. 轮询状态 -> 3. 下载音频
   */
  private async requestGptSovitsAudio(options: {
    voice: VoiceEntity;
    text: string;
    textLanguage?: string;
    cutPunc?: string;
    sampleRate?: number;
    stream: boolean;
    onStart?: (info: { sampleRate: number }) => void;
    onData?: (chunk: Buffer) => void;
    onEnd?: () => void;
  }): Promise<{ buffer?: Buffer; sampleRate: number }> {
    const config = this.getGptSovitsConfig(options.voice);
    const sampleRate = Number(options.sampleRate ?? config.sampleRate ?? 32000);

    // 直接使用配置中的路径（创建音色时已处理）
    const payload = this.buildGptSovitsPayload(config, {
      text: options.text,
      textLanguage: options.textLanguage,
      cutPunc: options.cutPunc,
    });

    // 使用异步接口
    const asyncUrl = this.normalizeGptSovitsUrl('/tts/async');
    Logger.log(`[requestGptSovitsAudio] 使用异步模式调用 GPT-SoVITS: ${asyncUrl}`, 'VoiceService');
    Logger.debug(`[requestGptSovitsAudio] Payload: ${JSON.stringify(payload)}`, 'VoiceService');

    // 1. 提交异步任务
    const taskId = await this.submitGptSovitsAsyncTask(asyncUrl, payload);
    Logger.log(`[requestGptSovitsAudio] 任务已提交，task_id: ${taskId}`, 'VoiceService');

    // 2. 轮询查询任务状态
    const audioUrl = await this.pollGptSovitsTaskStatus(taskId);
    Logger.log(`[requestGptSovitsAudio] 任务完成，音频URL: ${audioUrl}`, 'VoiceService');

    // 3. 下载音频
    const buffer = await this.downloadGptSovitsAudio(audioUrl);
    Logger.log(
      `[requestGptSovitsAudio] 音频下载完成，大小: ${buffer.length} bytes`,
      'VoiceService',
    );

    // 如果是流式模式，通过回调返回数据
    if (options.stream) {
      try {
        options.onStart?.({ sampleRate });
        options.onData?.(buffer);
        options.onEnd?.();
      } catch (err) {
        Logger.warn(`[requestGptSovitsAudio] 回调异常: ${err}`, 'VoiceService');
      }
      return { sampleRate };
    }

    // 非流式模式，直接返回 buffer
    return { buffer, sampleRate };
  }

  /**
   * 提交 GPT-SoVITS 异步任务
   */
  private async submitGptSovitsAsyncTask(url: string, payload: any): Promise<string> {
    return await retryWithBackoff(
      async () => {
        const response = await axios.post(url, payload, {
          timeout: 30000,
          validateStatus: () => true,
        });

        if (response.status >= 400) {
          const errorMsg = `提交 GPT-SoVITS 异步任务失败 (status ${response.status}): ${
            response.data?.message || response.data?.detail || JSON.stringify(response.data)
          }`;
          Logger.error(`[submitGptSovitsAsyncTask] ${errorMsg}`, 'VoiceService');
          const error: any = new HttpException(errorMsg, HttpStatus.BAD_GATEWAY);
          error.response = response;
          throw error;
        }

        const taskId = response.data?.task_id;
        if (!taskId) {
          throw new HttpException('GPT-SoVITS 未返回 task_id', HttpStatus.BAD_GATEWAY);
        }

        return taskId;
      },
      {
        onRetry: (error, attempt, delay) => {
          Logger.warn(
            `[submitGptSovitsAsyncTask] 提交任务失败，正在重试 (${attempt}/${GPT_SOVITS_MAX_RETRIES})，` +
              `延迟 ${delay}ms。错误: ${error?.message || error}`,
            'VoiceService',
          );
        },
      },
    );
  }

  /**
   * 轮询查询 GPT-SoVITS 任务状态
   */
  private async pollGptSovitsTaskStatus(taskId: string): Promise<string> {
    const maxPolls = 60; // 最多轮询60次
    const pollInterval = 1000; // 每次间隔1秒
    const taskUrl = this.normalizeGptSovitsUrl(`/task/${taskId}`);

    for (let i = 0; i < maxPolls; i++) {
      try {
        const response = await axios.get(taskUrl, { timeout: 10000 });
        const status = response.data?.status;

        Logger.debug(
          `[pollGptSovitsTaskStatus] 轮询 ${i + 1}/${maxPolls}，状态: ${status}`,
          'VoiceService',
        );

        if (status === 'completed') {
          // 任务完成，返回音频下载URL
          const audioUrl = this.normalizeGptSovitsUrl(`/task/${taskId}/audio`);
          return audioUrl;
        } else if (status === 'failed') {
          const errorMsg = response.data?.error || '任务失败';
          throw new HttpException(`GPT-SoVITS 任务失败: ${errorMsg}`, HttpStatus.BAD_GATEWAY);
        }

        // 状态为 pending 或 processing，继续等待
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }
        Logger.warn(
          `[pollGptSovitsTaskStatus] 查询任务状态失败: ${error?.message || error}`,
          'VoiceService',
        );
        // 网络错误，继续重试
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    // 超时
    throw new HttpException(`GPT-SoVITS 任务超时（${maxPolls}秒）`, HttpStatus.GATEWAY_TIMEOUT);
  }

  /**
   * 下载 GPT-SoVITS 生成的音频
   */
  private async downloadGptSovitsAudio(audioUrl: string): Promise<Buffer> {
    return await retryWithBackoff(
      async () => {
        const response = await axios.get(audioUrl, {
          responseType: 'arraybuffer',
          timeout: 60000,
          validateStatus: () => true,
        });

        if (response.status >= 400) {
          throw new HttpException(
            `下载 GPT-SoVITS 音频失败 (status ${response.status})`,
            HttpStatus.BAD_GATEWAY,
          );
        }

        return Buffer.from(response.data);
      },
      {
        onRetry: (error, attempt, delay) => {
          Logger.warn(
            `[downloadGptSovitsAudio] 下载音频失败，正在重试 (${attempt}/${GPT_SOVITS_MAX_RETRIES})，` +
              `延迟 ${delay}ms。错误: ${error?.message || error}`,
            'VoiceService',
          );
        },
      },
    );
  }

  /**
   * GPT-SoVITS 流式 TTS 请求
   * 使用 streaming_mode: true 进行真正的流式输出
   */
  private async streamGptSovitsAudio(options: {
    voice: VoiceEntity;
    text: string;
    textLanguage?: string;
    cutPunc?: string;
    sampleRate?: number;
    onStart?: (info: { sampleRate: number }) => void;
    onData?: (chunk: Buffer) => void;
    onEnd?: () => void;
    onError?: (error: Error) => void;
  }): Promise<void> {
    const config = this.getGptSovitsConfig(options.voice);
    const sampleRate = Number(options.sampleRate ?? config.sampleRate ?? 32000);

    // 构建流式请求 payload
    const payload = this.buildGptSovitsPayload(config, {
      text: options.text,
      textLanguage: options.textLanguage,
      cutPunc: options.cutPunc,
      streamingMode: true, // 启用流式模式
    });

    // 使用同步流式接口 /tts
    const streamUrl = this.normalizeGptSovitsUrl('/tts');
    Logger.log(`[streamGptSovitsAudio] 使用流式模式调用 GPT-SoVITS: ${streamUrl}`, 'VoiceService');
    Logger.debug(`[streamGptSovitsAudio] Payload: ${JSON.stringify(payload)}`, 'VoiceService');

    try {
      // 通知开始
      options.onStart?.({ sampleRate });

      const response = await axios.post(streamUrl, payload, {
        responseType: 'stream',
        timeout: 120000, // 2分钟超时
        validateStatus: () => true,
      });

      if (response.status >= 400) {
        const errorMsg = `GPT-SoVITS 流式请求失败 (status ${response.status})`;
        Logger.error(`[streamGptSovitsAudio] ${errorMsg}`, 'VoiceService');
        options.onError?.(new Error(errorMsg));
        return;
      }

      const stream = response.data;

      stream.on('data', (chunk: Buffer) => {
        try {
          options.onData?.(chunk);
        } catch (err) {
          Logger.warn(`[streamGptSovitsAudio] onData 回调异常: ${err}`, 'VoiceService');
        }
      });

      stream.on('end', () => {
        Logger.log(`[streamGptSovitsAudio] 流式 TTS 完成`, 'VoiceService');
        try {
          options.onEnd?.();
        } catch (err) {
          Logger.warn(`[streamGptSovitsAudio] onEnd 回调异常: ${err}`, 'VoiceService');
        }
      });

      stream.on('error', (error: Error) => {
        Logger.error(`[streamGptSovitsAudio] 流式错误: ${error.message}`, 'VoiceService');
        options.onError?.(error);
      });

      // 等待流结束
      await new Promise<void>((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    } catch (error: any) {
      Logger.error(`[streamGptSovitsAudio] 请求失败: ${error?.message || error}`, 'VoiceService');
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw new HttpException(
        error?.response?.data?.message || error?.message || 'GPT-SoVITS 流式合成失败',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private async deleteVoiceAssociations(voiceId: string) {
    const appVoiceDeleteResult = await this.appVoiceRepo.delete({ voiceId });
    console.log(`删除应用音色关联: affected rows = ${appVoiceDeleteResult.affected}`);

    const appEmotionVoiceDeleteResult = await this.appEmotionVoiceRepo.delete({ voiceId });
    console.log(`删除应用情绪音色关联: affected rows = ${appEmotionVoiceDeleteResult.affected}`);

    const appUpdateResult = await this.appRepo.update({ voiceId }, { voiceId: null });
    console.log(`清空应用默认音色: affected rows = ${appUpdateResult.affected}`);

    const deleteResult = await this.voiceRepo.delete({ voiceId });
    console.log(`删除音色记录: affected rows = ${deleteResult.affected}`);
  }

  private async cleanupGptSovitsAssets(voiceId: string) {
    const dir = path.join(this.gptSovitsStorageRoot, voiceId);
    try {
      await fsp.rm(dir, { recursive: true, force: true });
      Logger.log(`[cleanupGptSovitsAssets] 已清理 ${dir}`, 'VoiceService');
    } catch (error) {
      Logger.warn(
        `[cleanupGptSovitsAssets] 清理目录失败 ${dir}: ${error?.message || error}`,
        'VoiceService',
      );
    }
    this.gptSovitsModelCache.delete(voiceId);
  }

  /**
   * 合成试听音频并上传至当前配置的存储（本地/S3/OSS等），返回可访问URL和时长
   */
  /**
   * 合成试听音频并上传至当前配置的存储（本地/S3/OSS等），返回可访问URL和时长
   */
  async preview(body: {
    voice_id: string;
    text: string;
    model?: string;
    format?: 'mp3' | 'wav' | 'pcm';
    sample_rate?: number;
    volume?: number;
    rate?: number;
    pitch?: number;
    instruction?: string;
    text_language?: string;
    cut_punc?: string;
    emotion?: string;
  }): Promise<{ url: string; duration: number }> {
    const { voice_id, text } = body;
    if (!voice_id || !text)
      throw new HttpException('voice_id 和 text 必填', HttpStatus.BAD_REQUEST);

    const voiceEntity = await this.voiceRepo.findOne({ where: { voiceId: voice_id } });
    if (!voiceEntity) throw new HttpException(`音色不存在: ${voice_id}`, HttpStatus.NOT_FOUND);
    if ((voiceEntity.provider as VoiceProvider) === 'gpt-sovits') {
      return this.previewWithGptSovits(voiceEntity, body);
    }
    if ((voiceEntity.provider as VoiceProvider) === 'minimax') {
      return this.previewWithMinimax(voiceEntity, body);
    }

    const saved = (await this.getVoiceParams(voice_id)) || {};
    const format = (body.format || saved.format || 'mp3') as 'mp3' | 'wav' | 'pcm';
    const sample_rate = Number(body.sample_rate ?? saved.sample_rate ?? 24000);
    const volume = Number(body.volume ?? saved.volume ?? 52);
    const rate = Number(body.rate ?? saved.rate ?? 0.98);
    const pitch = Number(body.pitch ?? saved.pitch ?? 1);

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
      throw new HttpException(
        '服务器未安装 ws 依赖，无法进行WebSocket试听。请联系管理员安装依赖后重试。',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }

    const taskId = cryptoRandomId();
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'X-DashScope-DataInspection': 'enable',
    } as Record<string, string>;

    const ws = new WS(COSY_WS_URL, { headers });
    const audioBuffers: Uint8Array[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        const parameters: any = {
          text_type: 'PlainText',
          voice: voice_id,
          format,
          sample_rate,
          volume,
          rate,
          pitch,
        };
        if (body.instruction) parameters.instruction = body.instruction;

        ws.send(
          JSON.stringify({
            header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
            payload: {
              task_group: 'audio',
              task: 'tts',
              function: 'SpeechSynthesizer',
              model: modelToUse,
              parameters,
              input: {},
            },
          }),
        );
      });

      ws.on('message', (data: any, isBinary: boolean) => {
        if (isBinary) {
          const chunkBuf: Buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
          audioBuffers.push(new Uint8Array(chunkBuf));
          return;
        }
        try {
          const msg = JSON.parse(data.toString());
          const event = msg?.header?.event;
          if (event === 'task-started') {
            ws.send(
              JSON.stringify({
                header: { action: 'continue-task', task_id: taskId, streaming: 'duplex' },
                payload: { input: { text } },
              }),
            );
            ws.send(
              JSON.stringify({
                header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' },
                payload: { input: {} },
              }),
            );
          } else if (event === 'task-finished') {
            ws.close();
          } else if (event === 'task-failed') {
            ws.close();
            reject(
              new HttpException(
                msg?.header?.error_message || 'TTS任务失败',
                HttpStatus.BAD_GATEWAY,
              ),
            );
          }
        } catch (err) {
          Logger.warn(`解析TTS消息失败: ${err}`, 'VoiceService');
        }
      });

      ws.on('close', () => resolve());
      ws.on('error', (err: any) => {
        reject(new HttpException(err?.message || 'WebSocket错误', HttpStatus.BAD_GATEWAY));
      });
    });

    if (!audioBuffers.length) {
      throw new HttpException('未收到音频数据', HttpStatus.BAD_GATEWAY);
    }
    const buffer = Buffer.concat(audioBuffers);
    const mimetype =
      format === 'mp3' ? 'audio/mpeg' : format === 'wav' ? 'audio/wav' : 'application/octet-stream';
    const url = await this.uploadService.uploadFile({ buffer, mimetype } as any, 'voicePreview');
    const duration = await this.getAudioDuration(buffer, format, sample_rate);
    Logger.log(
      `[preview] 音频生成完成 - URL: ${url}, 时长: ${Math.round(duration)}秒`,
      'VoiceService',
    );
    return { url: url as any, duration };
  }

  private async previewWithGptSovits(
    voice: VoiceEntity,
    body: { text: string; text_language?: string; cut_punc?: string; sample_rate?: number },
  ): Promise<{ url: string; duration: number }> {
    const config = this.getGptSovitsConfig(voice);
    const sampleRate = Number(body.sample_rate ?? config.sampleRate ?? 32000);
    const response = await this.requestGptSovitsAudio({
      voice,
      text: body.text,
      textLanguage: body.text_language,
      cutPunc: body.cut_punc,
      sampleRate,
      stream: false,
    });
    const buffer = response.buffer;
    const uploadUrl = await this.uploadService.uploadFile(
      { buffer, mimetype: 'audio/wav' } as any,
      'voicePreview',
    );
    const duration = await this.getAudioDuration(buffer!, 'wav', sampleRate);
    Logger.log(
      `[previewWithGptSovits] 音频生成完成 - URL: ${uploadUrl}, 时长: ${Math.round(duration)}秒`,
      'VoiceService',
    );
    return { url: uploadUrl as any, duration };
  }

  /** MiniMax 预览合成 */
  private async previewWithMinimax(
    voice: VoiceEntity,
    body: { text: string; sample_rate?: number; emotion?: string },
  ): Promise<{ url: string; duration: number }> {
    const config = (voice.config || {}) as any;
    const minimaxVoiceId = voice.providerVoiceId || config.voiceId;
    if (!minimaxVoiceId) {
      throw new HttpException(
        `音色 ${voice.voiceId} 缺少 MiniMax voiceId 配置`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.minimaxProvider.synthesizeSpeech({
      text: body.text,
      voiceId: String(minimaxVoiceId),
      model: config.model || 'speech-2.6-hd',
      speed: config.speed || 1,
      vol: config.vol || 1,
      pitch: config.pitch || 0,
      languageBoost: config.languageBoost || 'auto',
      audioSampleRate: body.sample_rate || 32000,
      emotion: body.emotion,
    });

    const uploadUrl = await this.uploadService.uploadFile(
      { buffer: result.audioBuffer, mimetype: 'audio/mpeg' } as any,
      'voicePreview',
    );
    const duration = await this.getAudioDuration(result.audioBuffer, 'mp3', 32000);

    return { url: uploadUrl as any, duration };
  }

  /**
   * 流式语音合成（旧版，单次文本）：边合成边通过回调吐出音频片段
   * 支持 DashScope、GPT-SoVITS（流式）、MiniMax（流式）
   */
  async ttsStream(
    body: {
      voice_id: string;
      text: string;
      model?: string;
      format?: 'mp3' | 'wav' | 'pcm';
      sample_rate?: number;
      volume?: number;
      rate?: number;
      pitch?: number;
      instruction?: string;
      text_language?: string;
      cut_punc?: string;
      emotion?: string;
    },
    opts?: {
      onStart?: (info: { format: 'mp3' | 'wav' | 'pcm'; sample_rate: number }) => void;
      onData?: (chunk: Buffer) => void;
      onEnd?: () => void;
    },
  ) {
    const { voice_id, text } = body || ({} as any);
    if (!voice_id || !text)
      throw new HttpException('voice_id 和 text 必填', HttpStatus.BAD_REQUEST);

    const voiceEntity = await this.voiceRepo.findOne({ where: { voiceId: voice_id } });
    if (!voiceEntity) throw new HttpException(`音色不存在: ${voice_id}`, HttpStatus.NOT_FOUND);

    // GPT-SoVITS 流式输出
    if ((voiceEntity.provider as VoiceProvider) === 'gpt-sovits') {
      Logger.log(`[ttsStream] 使用 GPT-SoVITS 流式模式`, 'VoiceService');
      await this.streamGptSovitsAudio({
        voice: voiceEntity,
        text,
        textLanguage: body.text_language,
        cutPunc: body.cut_punc,
        sampleRate: body.sample_rate,
        onStart: info => {
          try {
            opts?.onStart?.({ format: 'wav', sample_rate: info.sampleRate });
          } catch {}
        },
        onData: chunk => {
          try {
            opts?.onData?.(chunk);
          } catch {}
        },
        onEnd: () => {
          try {
            opts?.onEnd?.();
          } catch {}
        },
      });
      return { success: true };
    }

    // MiniMax 流式输出 - 改用同步接口避免重复播放问题
    if ((voiceEntity.provider as VoiceProvider) === 'minimax') {
      const config = (voiceEntity.config || {}) as any;
      const minimaxVoiceId = voiceEntity.providerVoiceId || config.voiceId;
      if (!minimaxVoiceId) {
        throw new HttpException(
          `音色 ${voiceEntity.voiceId} 缺少 MiniMax voiceId 配置`,
          HttpStatus.BAD_REQUEST,
        );
      }

      try {
        // 通知开始
        opts?.onStart?.({
          format: (body.format || 'mp3') as any,
          sample_rate: body.sample_rate || 32000,
        });

        // 使用同步接口获取完整音频
        const result = await this.minimaxProvider.synthesizeSpeech({
          text,
          voiceId: String(minimaxVoiceId),
          model: config.model || 'speech-2.6-hd',
          speed: config.speed || 1,
          vol: config.vol || 1,
          pitch: config.pitch || 0,
          languageBoost: config.languageBoost || 'auto',
          audioSampleRate: body.sample_rate || 32000,
          format: body.format || 'mp3',
          emotion: body.emotion,
        });

        // 一次性发送完整音频
        if (result.audioBuffer && result.audioBuffer.length > 0) {
          opts?.onData?.(result.audioBuffer);
        }

        opts?.onEnd?.();
      } catch (error: any) {
        Logger.error(`[ttsStream] MiniMax TTS 失败: ${error?.message}`, 'VoiceService');
        throw error;
      }

      return { success: true };
    }

    // DashScope (CosyVoice) 流式输出 - 保持原有逻辑
    const saved = (await this.getVoiceParams(voice_id)) || {};
    const format = (body.format || saved.format || 'mp3') as 'mp3' | 'wav' | 'pcm';
    const sample_rate = Number(body.sample_rate ?? saved.sample_rate ?? 24000);
    const volume = Number(body.volume ?? saved.volume ?? 52);
    const rate = Number(body.rate ?? saved.rate ?? 0.98);
    const pitch = Number(body.pitch ?? saved.pitch ?? 1);

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
      throw new HttpException(
        '服务器未安装 ws 依赖，无法进行WebSocket合成。',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }

    const taskId = cryptoRandomId();
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'X-DashScope-DataInspection': 'enable',
    } as Record<string, string>;

    const ws = new WS(COSY_WS_URL, { headers });

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        const parameters: any = {
          text_type: 'PlainText',
          voice: voice_id,
          format,
          sample_rate,
          volume,
          rate,
          pitch,
        };
        if (body.instruction) parameters.instruction = body.instruction;

        ws.send(
          JSON.stringify({
            header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
            payload: {
              task_group: 'audio',
              task: 'tts',
              function: 'SpeechSynthesizer',
              model: modelToUse,
              parameters,
              input: {},
            },
          }),
        );
      });

      ws.on('message', (data: any, isBinary: boolean) => {
        if (isBinary) {
          try {
            opts?.onData?.(Buffer.isBuffer(data) ? data : Buffer.from(data));
          } catch {}
          return;
        }
        try {
          const msg = JSON.parse(data.toString());
          const event = msg?.header?.event;
          if (event === 'task-started') {
            ws.send(
              JSON.stringify({
                header: { action: 'continue-task', task_id: taskId, streaming: 'duplex' },
                payload: { input: { text } },
              }),
            );
            ws.send(
              JSON.stringify({
                header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' },
                payload: { input: {} },
              }),
            );
          } else if (event === 'task-finished') {
            ws.close();
          } else if (event === 'task-failed') {
            ws.close();
            reject(
              new HttpException(
                msg?.header?.error_message || 'TTS任务失败',
                HttpStatus.BAD_GATEWAY,
              ),
            );
          }
        } catch (err) {
          Logger.warn(`解析TTS消息失败: ${err}`, 'VoiceService');
        }
      });

      ws.on('close', () => {
        try {
          opts?.onEnd?.();
        } catch {}
        resolve();
      });

      ws.on('error', (err: any) => {
        reject(new HttpException(err?.message || 'WebSocket错误', HttpStatus.BAD_GATEWAY));
      });
    });

    return { success: true };
  }

  async createTTSStreamSession(params: {
    voice_id: string;
    model?: string;
    format?: 'mp3' | 'wav' | 'pcm';
    sample_rate?: number;
    volume?: number;
    rate?: number;
    pitch?: number;
    instruction?: string;
    onStart?: (info: { format: 'mp3' | 'wav' | 'pcm'; sample_rate: number }) => void;
    onData?: (chunk: Buffer) => void;
    onEnd?: () => void;
    onError?: (err: Error) => void;
  }): Promise<TTSStreamSession> {
    const { voice_id, onStart, onData, onEnd, onError } = params;
    if (!voice_id) throw new HttpException('voice_id 必填', HttpStatus.BAD_REQUEST);

    const voiceEntity = await this.voiceRepo.findOne({ where: { voiceId: voice_id } });
    if (!voiceEntity) throw new HttpException(`音色不存在: ${voice_id}`, HttpStatus.NOT_FOUND);
    if ((voiceEntity.provider as VoiceProvider) === 'gpt-sovits') {
      throw new HttpException(
        'GPT-SoVITS 暂不支持 createTTSStreamSession',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }

    const saved = (await this.getVoiceParams(voice_id)) || {};
    const format = (params.format || saved.format || 'mp3') as 'mp3' | 'wav' | 'pcm';
    const sample_rate = Number(params.sample_rate ?? saved.sample_rate ?? 24000); // 采样率提高
    const volume = Number(params.volume ?? saved.volume ?? 52); // 音量稍大
    const rate = Number(params.rate ?? saved.rate ?? 0.98); // 语速稍慢，发音更清晰
    const pitch = Number(params.pitch ?? saved.pitch ?? 1);
    const instruction = params.instruction || '';

    // 依据 voice_id 推断默认模型
    const lowerId = (voice_id || '').toLowerCase();
    let modelToUse: string;
    if (lowerId.startsWith('cosyvoice-v3-plus-')) modelToUse = 'cosyvoice-v3-plus';
    else if (lowerId.startsWith('cosyvoice-v3-')) modelToUse = 'cosyvoice-v3';
    else if (lowerId.startsWith('cosyvoice-v2-')) modelToUse = 'cosyvoice-v2';
    else modelToUse = params.model || (await this.getDefaultModel());

    const apiKey = await this.getApiKey();

    let WS: any;
    try {
      const WSMod: any = await import('ws');
      WS = WSMod?.default || WSMod;
      if (!WS) throw new Error('ws module not resolved');
    } catch (e) {
      Logger.error('缺少依赖 ws，请先安装: pnpm add ws', 'VoiceService');
      throw new HttpException(
        '服务器未安装 ws 依赖，无法进行WebSocket合成。',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }

    const session = new TTSStreamSession({
      WS,
      url: COSY_WS_URL,
      apiKey,
      taskId: cryptoRandomId(),
      model: modelToUse,
      voice_id,
      format,
      sample_rate,
      volume,
      rate,
      pitch,
      instruction,
      onStart,
      onData,
      onEnd,
      onError,
    });

    await session.connect();
    return session;
  }
}

/**
 * 真正的流式TTS会话类：一次连接，多次发送文本
 */
class TTSStreamSession {
  private ws: any;
  private taskId: string;
  private started: boolean = false;
  private finished: boolean = false;
  private config: any;

  constructor(config: {
    WS: any;
    url: string;
    apiKey: string;
    taskId: string;
    model: string;
    voice_id: string;
    format: 'mp3' | 'wav' | 'pcm';
    sample_rate: number;
    volume: number;
    rate: number;
    pitch: number;
    instruction?: string;
    onStart?: (info: { format: 'mp3' | 'wav' | 'pcm'; sample_rate: number }) => void;
    onData?: (chunk: Buffer) => void;
    onEnd?: () => void;
    onError?: (err: Error) => void;
  }) {
    this.config = config;
    this.taskId = config.taskId;
  }

  /**
   * 建立WebSocket连接并启动TTS任务
   */
  async connect(): Promise<void> {
    const {
      WS,
      url,
      apiKey,
      model,
      voice_id,
      format,
      sample_rate,
      volume,
      rate,
      pitch,
      instruction,
      onStart,
      onData,
      onError,
    } = this.config;

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'X-DashScope-DataInspection': 'enable',
    };

    this.ws = new WS(url, { headers });

    return new Promise<void>((resolve, reject) => {
      this.ws.on('open', () => {
        Logger.debug(`TTS会话已连接: taskId=${this.taskId}`, 'TTSStreamSession');

        const parameters: any = {
          text_type: 'PlainText',
          voice: voice_id,
          format,
          sample_rate,
          volume,
          rate,
          pitch,
        };

        // 如果传入了instruction参数，添加到parameters中
        if (instruction) {
          parameters.instruction = instruction;
        }

        const runTask = {
          header: { action: 'run-task', task_id: this.taskId, streaming: 'duplex' },
          payload: {
            task_group: 'audio',
            task: 'tts',
            function: 'SpeechSynthesizer',
            model,
            parameters,
            input: {},
          },
        };
        this.ws.send(JSON.stringify(runTask));
      });

      this.ws.on('message', (data: any, isBinary: boolean) => {
        if (isBinary) {
          // 音频二进制数据
          try {
            onData?.(Buffer.from(data));
          } catch {}
          return;
        }
        try {
          const msg = JSON.parse(data.toString());
          const event = msg?.header?.event;

          if (event === 'task-started') {
            this.started = true;
            Logger.debug(`TTS任务已启动: taskId=${this.taskId}`, 'TTSStreamSession');
            try {
              onStart?.({ format, sample_rate });
            } catch {}
            resolve();
          } else if (event === 'task-finished') {
            Logger.debug(`TTS任务已完成: taskId=${this.taskId}`, 'TTSStreamSession');
            this.finished = true;
            this.ws.close();
          } else if (event === 'task-failed') {
            const errorMsg = msg?.header?.error_message || 'TTS任务失败';
            Logger.error(`TTS任务失败: ${errorMsg}`, 'TTSStreamSession');
            this.ws.close();
            const error = new Error(errorMsg);
            onError?.(error);
            reject(error);
          }
        } catch (e) {
          Logger.warn(`解析TTS消息失败: ${e}`, 'TTSStreamSession');
        }
      });

      this.ws.on('close', () => {
        Logger.debug(`TTS会话已关闭: taskId=${this.taskId}`, 'TTSStreamSession');
        try {
          this.config.onEnd?.();
        } catch {}
      });

      this.ws.on('error', (err: any) => {
        Logger.error(`TTS WebSocket错误: ${err?.message || err}`, 'TTSStreamSession');
        const error = new Error(err?.message || 'WebSocket错误');
        onError?.(error);
        reject(error);
      });
    });
  }

  /**
   * 发送一段文本进行流式合成（可以多次调用）
   */
  sendText(text: string): void {
    if (!this.started) {
      Logger.warn('TTS会话尚未启动，忽略文本发送', 'TTSStreamSession');
      return;
    }
    if (this.finished) {
      Logger.warn('TTS会话已结束，忽略文本发送', 'TTSStreamSession');
      return;
    }
    if (!text || !text.trim()) return;

    try {
      const continueTask = {
        header: { action: 'continue-task', task_id: this.taskId, streaming: 'duplex' },
        payload: { input: { text } },
      };
      this.ws.send(JSON.stringify(continueTask));
      Logger.debug(
        `TTS发送文本 (${text.length}字): "${text.substring(0, 20)}..."`,
        'TTSStreamSession',
      );
    } catch (e) {
      Logger.error(`TTS发送文本失败: ${e}`, 'TTSStreamSession');
    }
  }

  /**
   * 结束TTS会话（发送 finish-task）
   */
  async finish(): Promise<void> {
    if (this.finished) return;
    if (!this.started) {
      Logger.warn('TTS会话尚未启动，无法结束', 'TTSStreamSession');
      return;
    }

    try {
      const finishTask = {
        header: { action: 'finish-task', task_id: this.taskId, streaming: 'duplex' },
        payload: { input: {} },
      };
      this.ws.send(JSON.stringify(finishTask));
      Logger.debug(`TTS发送结束信号: taskId=${this.taskId}`, 'TTSStreamSession');
    } catch (e) {
      Logger.error(`TTS发送结束信号失败: ${e}`, 'TTSStreamSession');
    }

    // 等待任务完成
    return new Promise<void>(resolve => {
      const checkFinished = setInterval(() => {
        if (this.finished) {
          clearInterval(checkFinished);
          resolve();
        }
      }, 100);

      // 10秒超时保护
      setTimeout(() => {
        clearInterval(checkFinished);
        if (!this.finished) {
          Logger.warn(`TTS会话结束超时，强制关闭`, 'TTSStreamSession');
          try {
            this.ws.close();
          } catch {}
        }
        resolve();
      }, 10000);
    });
  }

  /**
   * 取消TTS会话（立即关闭连接）
   */
  cancel(): void {
    if (this.finished) return;
    try {
      this.finished = true;
      this.ws.close();
      Logger.debug(`TTS会话已取消: taskId=${this.taskId}`, 'TTSStreamSession');
    } catch {}
  }
}

function cryptoRandomId() {
  // 简易UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
