import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { StickerEntity } from './sticker.entity';
import { GlobalConfigService } from '../globalConfig/globalConfig.service';

// 表情包支持的标准情绪列表
const STICKER_EMOTION_LABELS = ['happy', 'sad', 'angry', 'comfort', 'surprised', 'neutral'];

interface StickerQuery {
  keyword?: string;
  tags?: string[];
  emotion?: string;
  page?: number;
  size?: number;
}

interface StickerPayload {
  name: string;
  imageUrl: string;
  tags?: string[] | null;
  emotion?: string | null;
  scenario?: string | null;
}

@Injectable()
export class StickerService {
  constructor(
    @InjectRepository(StickerEntity)
    private readonly stickerRepo: Repository<StickerEntity>,
    private readonly globalConfigService: GlobalConfigService,
  ) {}

  async list(params: StickerQuery) {
    const page = Math.max(Number(params.page) || 1, 1);
    const size = Math.min(Math.max(Number(params.size) || 20, 1), 100);
    const keyword = params.keyword?.trim();
    const emotion = params.emotion?.trim();
    const tags = this.normalizeTags(params.tags);

    const qb = this.stickerRepo.createQueryBuilder('sticker');

    if (keyword) {
      qb.andWhere(
        new Brackets(qb1 => {
          qb1
            .where('sticker.name LIKE :keyword', { keyword: `%${keyword}%` })
            .orWhere('sticker.scenario LIKE :keyword', { keyword: `%${keyword}%` });
        }),
      );
    }

    if (emotion) {
      qb.andWhere('sticker.emotion = :emotion', { emotion });
    }

    if (tags?.length) {
      qb.andWhere(
        new Brackets(qb2 => {
          tags.forEach((tag, index) => {
            qb2.orWhere(`FIND_IN_SET(:tag${index}, IFNULL(sticker.tags, '')) > 0`, {
              [`tag${index}`]: tag,
            });
          });
        }),
      );
    }

    qb.orderBy('sticker.uploadDate', 'DESC')
      .skip((page - 1) * size)
      .take(size);

    const [rows, count] = await qb.getManyAndCount();
    return { rows, count, page, size };
  }

  async detail(id: number) {
    const record = await this.stickerRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Sticker not found');
    }
    return record;
  }

  async create(payload: StickerPayload, uploaderId?: number) {
    const entity = this.stickerRepo.create({
      ...payload,
      tags: this.normalizeTags(payload.tags),
      emotion: payload.emotion?.trim() || null,
      scenario: payload.scenario?.trim() || null,
      uploadDate: new Date(),
      uploadedBy: uploaderId,
    });
    return this.stickerRepo.save(entity);
  }

  async update(id: number, payload: StickerPayload) {
    const entity = await this.stickerRepo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Sticker not found');
    }
    entity.name = payload.name;
    entity.imageUrl = payload.imageUrl;
    entity.tags = this.normalizeTags(payload.tags);
    entity.emotion = payload.emotion?.trim() || null;
    entity.scenario = payload.scenario?.trim() || null;
    return this.stickerRepo.save(entity);
  }

  async remove(id: number) {
    const record = await this.stickerRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Sticker not found');
    }
    await this.stickerRepo.softDelete(id);
    return { success: true };
  }

  async pickStickerByText(
    text?: string | null,
    preferredEmotion?: string | null,
  ): Promise<StickerEntity | null> {
    const normalizedText = text?.trim() ?? '';

    // 使用AI识别情绪（而不是关键词匹配）
    let detectedEmotion = preferredEmotion?.trim()?.toLowerCase();

    if (!detectedEmotion && normalizedText) {
      detectedEmotion = await this.detectEmotionByAI(normalizedText);
    }

    let sticker = await this.pickRandomSticker(detectedEmotion);
    if (!sticker && detectedEmotion) {
      sticker = await this.pickRandomSticker();
    }
    return sticker;
  }

  /**
   * 使用AI识别文本情绪（复用语音TTS的AI情绪识别逻辑）
   */
  private async detectEmotionByAI(text: string): Promise<string | null> {
    if (!text) return null;

    try {
      const dashscopeApiKey =
        (await this.globalConfigService.getConfigs(['dashscopeApiKey'])) ||
        process.env.DASHSCOPE_API_KEY;

      if (!dashscopeApiKey) {
        Logger.warn('[Sticker AI情绪识别] 未配置DashScope API Key，跳过AI识别', 'StickerService');
        return null;
      }

      const numberedOptions = STICKER_EMOTION_LABELS.map((opt, idx) => `${idx + 1}. ${opt}`).join(
        '\n',
      );
      const prompt = `你是一个专业的情绪分析专家。请分析以下文本内容表达的情绪，从给定的候选情绪中选择最合适的一个。

文本内容：
${text}

候选情绪列表：
${numberedOptions}
0. neutral（中性/无法判断）

要求：
1. 仔细分析文本内容表达的主要情绪
2. 如果候选列表中有匹配的，返回对应的编号（如：1）或完整的情绪名称
3. 如果无法判断或都不合适，返回 0 或"neutral"
4. 只返回编号或名称，不要任何解释

示例：
- 文本"太开心了！"，返回：1 或 happy
- 文本"真让人生气..."，返回：3 或 angry
- 文本"今天天气不错"，返回：0 或 neutral

请返回：`;

      const axios = require('axios');
      const response = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        {
          model: 'qwen-turbo',
          input: {
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          },
          parameters: {
            max_tokens: 30,
            temperature: 0.1,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${dashscopeApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
        },
      );

      const result = response.data?.output?.text?.trim() || '';
      Logger.debug(`[Sticker AI情绪识别] AI原始返回: "${result}"`, 'StickerService');

      // 检查是否为neutral/无法判断
      if (
        result === '0' ||
        result.toLowerCase().includes('neutral') ||
        result.toLowerCase().includes('无法判断')
      ) {
        Logger.debug(`[Sticker AI情绪识别] ⚠ AI判断为中性情绪或无法判断`, 'StickerService');
        return null;
      }

      // 尝试解析编号
      const numberMatch = result.match(/^(\d+)/);
      if (numberMatch) {
        const index = parseInt(numberMatch[1]) - 1;
        if (index >= 0 && index < STICKER_EMOTION_LABELS.length) {
          const matchedEmotion = STICKER_EMOTION_LABELS[index];
          Logger.debug(
            `[Sticker AI情绪识别] ✓ 通过编号匹配成功: ${matchedEmotion}`,
            'StickerService',
          );
          return matchedEmotion;
        }
      }

      // 尝试直接匹配名称
      for (const emotion of STICKER_EMOTION_LABELS) {
        if (result.toLowerCase().includes(emotion)) {
          Logger.debug(`[Sticker AI情绪识别] ✓ 通过名称匹配成功: ${emotion}`, 'StickerService');
          return emotion;
        }
      }

      Logger.warn(
        `[Sticker AI情绪识别] ✗ 未能匹配 - AI返回: "${result}", 候选: [${STICKER_EMOTION_LABELS.join(
          ' | ',
        )}]`,
        'StickerService',
      );
      return null;
    } catch (error: any) {
      Logger.error(
        `[Sticker AI情绪识别] ✗ 调用失败: ${error?.message || error}`,
        error?.stack || '',
        'StickerService',
      );
      return null;
    }
  }

  private async pickRandomSticker(emotion?: string | null): Promise<StickerEntity | null> {
    const qb = this.stickerRepo.createQueryBuilder('sticker');
    if (emotion) {
      qb.where('sticker.emotion = :emotion', { emotion });
    }
    const total = await qb.clone().getCount();
    if (total === 0) {
      return null;
    }
    const offset = Math.floor(Math.random() * total);
    return qb.skip(offset).take(1).getOne();
  }

  private normalizeTags(tags?: string[] | null) {
    if (!tags || !tags.length) return null;
    const normalized = tags
      .map(tag => tag?.trim())
      .filter(Boolean)
      .map(tag => tag as string);
    const unique = Array.from(new Set(normalized));
    return unique.length ? unique : null;
  }
}
