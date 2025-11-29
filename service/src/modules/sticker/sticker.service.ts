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

    // 优先判断对话场景（scenario），场景表情包优先级高于情绪表情包
    if (normalizedText) {
      const detectedScenario = await this.detectScenarioWithAI(normalizedText);
      if (detectedScenario) {
        Logger.log(`[Sticker场景] AI判断场景为: ${detectedScenario}`, 'StickerService');
        const scenarioSticker = await this.pickStickerByScenario(detectedScenario);
        if (scenarioSticker) {
          Logger.log(
            `[Sticker场景] ✓ 找到场景表情包: ${scenarioSticker.name}`,
            'StickerService',
          );
          return scenarioSticker;
        }
        Logger.debug(`[Sticker场景] 未找到场景"${detectedScenario}"的表情包`, 'StickerService');
      }
    }

    // 没有匹配到场景表情包，使用AI识别情绪
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

  /**
   * 使用AI判断对话场景
   * @param text 对话内容
   * @returns 场景描述或 null
   */
  private async detectScenarioWithAI(text: string): Promise<string | null> {
    if (!text) return null;

    try {
      const dashscopeApiKey =
        (await this.globalConfigService.getConfigs(['dashscopeApiKey'])) ||
        process.env.DASHSCOPE_API_KEY;

      if (!dashscopeApiKey) {
        Logger.warn('[Sticker场景AI判断] 未配置DashScope API Key，跳过AI判断', 'StickerService');
        return null;
      }

      const prompt = `你是一个专业的对话场景分析专家。请分析以下AI回复内容，判断是否属于特定的表情包使用场景。

AI回复内容：
${text}

场景列表：
1. 表达给用户买些零食奶茶等 - AI提到要给用户买零食、奶茶等小礼物
2. 表达爱意，小小奖励用户时 - AI表达爱意、表扬、奖励用户
3. 庆祝用户重要节日或成就重要里程碑 - AI祝贺用户生日、节日、成就等
4. 表达为用户添置购买车子等贵重物品 - AI提到要给用户买车、房子等贵重物品

判断规则：
- 只有在AI明确表达了"想送礼物、想给你买东西、奖励你、爱你、祝贺你"等给予性、奖励性、祝福性情感时，才返回对应场景
- 如果是普通聊天、提问、回答问题、闲聊、问候等，返回：NO

要求：
1. 如果匹配到场景，返回完整的场景描述（如"表达给用户买些零食奶茶等"）
2. 如果不匹配任何场景，返回：NO
3. 不要返回任何解释或额外内容

示例：
- "我想给你买些奶茶和零食~" → 表达给用户买些零食奶茶等
- "你真棒！爱你哦~" → 表达爱意，小小奖励用户时
- "生日快乐！" → 庆祝用户重要节日或成就重要里程碑
- "我要给你买辆车" → 表达为用户添置购买车子等贵重物品
- "今天天气不错" → NO
- "你好吗？" → NO

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
            max_tokens: 50,
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
      Logger.debug(`[Sticker场景AI判断] AI原始返回: "${result}"`, 'StickerService');

      // 检查是否为NO（不匹配任何场景）
      if (result.toUpperCase() === 'NO' || result.includes('不匹配')) {
        Logger.debug(`[Sticker场景AI判断] ⚠ AI判断为无特定场景`, 'StickerService');
        return null;
      }

      // 验证是否为有效场景（包含关键词）
      const validScenarios = [
        '表达给用户买些零食奶茶等',
        '表达爱意，小小奖励用户时',
        '庆祝用户重要节日或成就重要里程碑',
        '表达为用户添置购买车子等贵重物品',
      ];

      // 模糊匹配：AI返回的场景只要包含有效场景的部分关键词即可
      for (const scenario of validScenarios) {
        if (result.includes(scenario) || scenario.includes(result.replace(/[。，、]/g, ''))) {
          Logger.debug(`[Sticker场景AI判断] ✓ 匹配场景: ${scenario}`, 'StickerService');
          return scenario;
        }
      }

      Logger.warn(`[Sticker场景AI判断] ✗ AI返回了无效的场景: "${result}"`, 'StickerService');
      return null;
    } catch (error: any) {
      Logger.error(
        `[Sticker场景AI判断] ✗ 调用失败: ${error?.message || error}`,
        error?.stack || '',
        'StickerService',
      );
      return null;
    }
  }

  /**
   * 根据场景查询表情包
   * @param scenario 场景描述
   * @returns 表情包实体或 null
   */
  private async pickStickerByScenario(scenario: string): Promise<StickerEntity | null> {
    try {
      // 查询scenario字段匹配的表情包
      const sticker = await this.stickerRepo
        .createQueryBuilder('sticker')
        .where('sticker.scenario LIKE :scenario', { scenario: `%${scenario}%` })
        .getOne();

      return sticker;
    } catch (error: any) {
      Logger.error(
        `[Sticker场景] ✗ 查询场景表情包失败: ${error?.message || error}`,
        error?.stack || '',
        'StickerService',
      );
      return null;
    }
  }
}
