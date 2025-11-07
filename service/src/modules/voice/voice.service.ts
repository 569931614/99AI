import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ILike, IsNull, Repository } from 'typeorm';
import { AppEntity } from '../app/app.entity';
import { AppEmotionVoiceEntity } from '../app/appEmotionVoice.entity';
import { AppVoiceEntity } from '../app/appVoice.entity';
import { GlobalConfigService } from '../globalConfig/globalConfig.service';
import { UploadService } from '../upload/upload.service';
import { VoiceEntity } from './voice.entity';

const COSY_CUSTOMIZATION_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization';
const COSY_WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/';

@Injectable()
export class VoiceService {
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

  private async upsertVoice(partial: {
    voiceId: string;
    userId?: number | null;
    prefix?: string | null;
    model?: string | null;
    status?: string | null;
    name?: string | null;
    rate?: number;
    pitch?: number;
    volume?: number;
    sampleRate?: number;
    format?: string;
  }) {
    if (!partial.voiceId) {
      console.warn('upsertVoice: voiceId为空，跳过保存');
      return;
    }

    try {
      console.log(`upsertVoice: 查找现有记录 voiceId=${partial.voiceId}`);
      const existing = await this.voiceRepo.findOne({ where: { voiceId: partial.voiceId } });
      const now = new Date();

      const data = existing
        ? {
            ...existing,
            ...partial,
            // 关键修复：如果 partial 没有明确传递 userId，保留原有记录的 userId
            userId: partial.userId !== undefined ? partial.userId : existing.userId,
            updatedAt: now,
          }
        : ({
            ...partial,
            // 为新记录设置优化后的默认参数
            rate: partial.rate ?? 0.98, // 语速稍慢，发音更清晰
            pitch: partial.pitch ?? 1.0,
            volume: partial.volume ?? 52, // 音量稍大，更清晰
            sampleRate: partial.sampleRate ?? 24000, // 采样率提高，音质更好
            format: partial.format ?? 'mp3',
            createdAt: now,
            updatedAt: now,
          } as any);

      // 标准化：清洗空字符串为 null
      if (data && typeof data === 'object') {
        for (const k of ['prefix', 'model', 'status', 'name', 'format']) {
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

  async listFromDB(query: {
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

    // 处理关键词搜索
    if (query?.keyword) {
      where.name = ILike(`%${query.keyword}%`);
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
        name: r.name,
        prefix: r.prefix,
        model: r.model,
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
      name: r.name,
      prefix: r.prefix,
      model: r.model,
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

  // 自动同步PENDING状态的音色
  async syncPendingVoicesStatus() {
    try {
      console.log('开始自动同步PENDING状态的音色...');

      // 1. 获取所有PENDING状态的音色
      const pendingVoices = await this.voiceRepo.find({
        where: { status: 'PENDING' },
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

    try {
      console.log(`开始删除音色: ${voice_id}`);

      // 1. 调用上游API删除音色
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

      // 2. 从本地数据库删除记录和相关关联
      try {
        // 2.1 删除应用音色关联
        const appVoiceDeleteResult = await this.appVoiceRepo.delete({ voiceId: voice_id });
        console.log(`删除应用音色关联: affected rows = ${appVoiceDeleteResult.affected}`);

        // 2.2 删除应用情绪音色关联
        const appEmotionVoiceDeleteResult = await this.appEmotionVoiceRepo.delete({
          voiceId: voice_id,
        });
        console.log(
          `删除应用情绪音色关联: affected rows = ${appEmotionVoiceDeleteResult.affected}`,
        );

        // 2.3 清空应用表中的默认音色ID
        const appUpdateResult = await this.appRepo.update({ voiceId: voice_id }, { voiceId: null });
        console.log(`清空应用默认音色: affected rows = ${appUpdateResult.affected}`);

        // 2.4 删除音色记录
        const deleteResult = await this.voiceRepo.delete({ voiceId: voice_id });
        console.log(`删除音色记录: affected rows = ${deleteResult.affected}`);

        if (deleteResult.affected === 0) {
          console.warn(`本地数据库中未找到音色记录: ${voice_id}`);
        } else {
          console.log(`本地数据库删除成功: ${voice_id}`);
        }
      } catch (dbError) {
        console.error(`本地数据库删除失败: ${voice_id}`, dbError.message);
        // 不抛出错误，因为上游API删除可能已经成功
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
        const payload: any = {
          header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
          payload: {
            task_group: 'audio',
            task: 'asr',
            function: 'recognition',
            model: modelName,
            parameters: {
              // DashScope 实时识别参数：使用原始 PCM 流，请设置 format=pcm
              format: fmt === 'wav' || fmt === 'pcm' ? 'pcm' : fmt,
              sample_rate: sampleRate,
              disfluency_removal_enabled: disfluency,
            },
            input: {},
          },
        };
        if (languageHints && Array.isArray(languageHints) && languageHints.length) {
          payload.payload.parameters.language_hints = languageHints;
        }
        Logger.debug(
          `发送 run-task: model=${modelName}, sampleRate=${sampleRate}, format=${payload.payload.parameters.format}`,
          'VoiceService',
        );
        ws.send(JSON.stringify(payload));
      };

      const chunkAndSendAudio = async () => {
        // 若是WAV容器，去掉44字节头；其余保持原样（仅支持PCM类）
        let sendBuf = audioBuf;
        if (fmt === 'wav' && audioBuf.length >= 44 && audioBuf.toString('ascii', 0, 4) === 'RIFF') {
          sendBuf = audioBuf.subarray(44);
        }

        // 以100ms一帧推送：16kHz * 0.1s * 2bytes = 3200字节
        const chunkSize = Math.max(3200, 3200); // 明确3200字节
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
          // 尽快送完以减少延迟，但避免阻塞事件循环
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

            // 详细日志：打印所有收到的消息
            Logger.debug(`收到 WebSocket 消息: event=${event}`, 'VoiceService');
            if (event === 'task-failed') {
              Logger.error(`完整错误消息: ${JSON.stringify(msg, null, 2)}`, 'VoiceService');
            }

            if (event === 'task-started') {
              Logger.debug('任务已启动，开始发送音频', 'VoiceService');
              // 服务端已就绪，开始送音频
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

      return {
        rate: voice.rate,
        pitch: voice.pitch,
        volume: voice.volume,
        sample_rate: voice.sampleRate,
        format: voice.format,
      };
    } catch (error) {
      console.error(`获取音色参数失败: ${voiceId}`, error.message);
      return null;
    }
  }

  async setVoiceParams(body: { voice_id: string; params: any }) {
    const { voice_id, params } = body;
    if (!voice_id || !params)
      throw new HttpException('voice_id 与 params 必填', HttpStatus.BAD_REQUEST);

    try {
      console.log(`设置音色参数: ${voice_id}`, params);

      // 查找现有音色记录
      const existing = await this.voiceRepo.findOne({ where: { voiceId: voice_id } });

      if (!existing) {
        throw new HttpException(`音色 ${voice_id} 不存在`, HttpStatus.NOT_FOUND);
      }

      // 更新音色参数
      const updateData: any = {};
      if (params.rate !== undefined) updateData.rate = Number(params.rate);
      if (params.pitch !== undefined) updateData.pitch = Number(params.pitch);
      if (params.volume !== undefined) updateData.volume = Number(params.volume);
      if (params.sample_rate !== undefined) updateData.sampleRate = Number(params.sample_rate);
      if (params.format !== undefined) updateData.format = String(params.format);

      await this.voiceRepo.update({ voiceId: voice_id }, updateData);

      console.log(`音色参数设置成功: ${voice_id}`);
      return { success: true, message: '参数保存成功' };
    } catch (error) {
      console.error(`设置音色参数失败: ${voice_id}`, error.message);
      throw new HttpException(`参数保存失败: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
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
  }): Promise<{ url: string; duration: number }> {
    const { voice_id, text } = body;
    if (!voice_id || !text)
      throw new HttpException('voice_id 与 text 必填', HttpStatus.BAD_REQUEST);

    // 读取该音色的默认参数，缺省时应用优化后的默认值
    const saved = (await this.getVoiceParams(voice_id)) || {};
    const format = (body.format || saved.format || 'mp3') as 'mp3' | 'wav' | 'pcm';
    const sample_rate = Number(body.sample_rate ?? saved.sample_rate ?? 24000); // 采样率提高
    const volume = Number(body.volume ?? saved.volume ?? 52); // 音量稍大
    const rate = Number(body.rate ?? saved.rate ?? 0.98); // 语速稍慢，发音更清晰
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

    const uploadOnFinish = new Promise<{ url: string; duration: number }>((resolve, reject) => {
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

        // 如果传入了instruction参数，添加到parameters中
        if (body.instruction) {
          parameters.instruction = body.instruction;
        }

        const runTask = {
          header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
          payload: {
            task_group: 'audio',
            task: 'tts',
            function: 'SpeechSynthesizer',
            model: modelToUse,
            parameters,
            input: {},
          },
        };
        ws.send(JSON.stringify(runTask));
      });

      ws.on('message', (data: any, isBinary: boolean) => {
        // ws@8: (data, isBinary) signature
        if (isBinary) {
          const chunkBuf: Buffer = Buffer.isBuffer(data) ? (data as Buffer) : Buffer.from(data);
          audioBuffers.push(new Uint8Array(chunkBuf));
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
            reject(
              new HttpException(
                msg?.header?.error_message || 'TTS任务失败',
                HttpStatus.BAD_GATEWAY,
              ),
            );
          }
        } catch (err) {
          // ignore parse errors
        }
      });

      ws.on('close', async () => {
        try {
          if (!audioBuffers.length) throw new Error('未收到音频数据');
          const buffer = Buffer.concat(audioBuffers);
          const mimetype =
            format === 'mp3'
              ? 'audio/mpeg'
              : format === 'wav'
              ? 'audio/wav'
              : 'application/octet-stream';
          const url = await this.uploadService.uploadFile(
            { buffer, mimetype } as any,
            'voicePreview',
          );

          // 计算音频时长
          const duration = await this.getAudioDuration(buffer, format, sample_rate);
          Logger.log(
            `[preview] 音频生成完成 - URL: ${url}, 时长: ${Math.round(duration)}秒`,
            'VoiceService',
          );

          resolve({ url: url as any, duration });
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

    const result = await uploadOnFinish;
    return result;
  }

  /**
   * 流式语音合成（旧版，单次文本）：边合成边通过回调吐出音频片段
   * @deprecated 推荐使用 createTTSStreamSession 实现真正的流式合成
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
    },
    opts?: {
      onStart?: (info: { format: 'mp3' | 'wav' | 'pcm'; sample_rate: number }) => void;
      onData?: (chunk: Buffer) => void;
      onEnd?: () => void;
    },
  ) {
    const { voice_id, text } = body || ({} as any);
    if (!voice_id || !text)
      throw new HttpException('voice_id 与 text 必填', HttpStatus.BAD_REQUEST);

    const saved = (await this.getVoiceParams(voice_id)) || {};
    const format = (body.format || saved.format || 'mp3') as 'mp3' | 'wav' | 'pcm';
    const sample_rate = Number(body.sample_rate ?? saved.sample_rate ?? 24000); // 采样率提高
    const volume = Number(body.volume ?? saved.volume ?? 52); // 音量稍大
    const rate = Number(body.rate ?? saved.rate ?? 0.98); // 语速稍慢，发音更清晰
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
        // 通知开始（在 task-started 后再发一次可靠参数）
        try {
          opts?.onStart?.({ format, sample_rate });
        } catch {}

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
        if (body.instruction) {
          parameters.instruction = body.instruction;
        }

        const runTask = {
          header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
          payload: {
            task_group: 'audio',
            task: 'tts',
            function: 'SpeechSynthesizer',
            model: modelToUse,
            parameters,
            input: {},
          },
        };
        ws.send(JSON.stringify(runTask));
      });

      ws.on('message', (data: any, isBinary: boolean) => {
        if (isBinary) {
          try {
            opts?.onData?.(Buffer.from(data));
          } catch {}
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
            reject(
              new HttpException(
                msg?.header?.error_message || 'TTS任务失败',
                HttpStatus.BAD_GATEWAY,
              ),
            );
          }
        } catch {
          // ignore
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

  /**
   * 创建真正的流式TTS会话：一次连接，多次发送文本，实时合成
   * 使用示例：
   * const session = await voiceService.createTTSStreamSession({...});
   * session.sendText('第一段文本');  // 边发边合成
   * session.sendText('第二段文本');  // 继续合成
   * await session.finish();         // 结束会话
   */
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
