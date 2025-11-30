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
          Logger.log(`[Sticker场景] ✓ 找到场景表情包: ${scenarioSticker.name}`, 'StickerService');
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

    // 排除场景表情包，只选择纯情绪表情包（scenario为null的）
    qb.andWhere('sticker.scenario IS NULL');

    if (emotion) {
      qb.andWhere('sticker.emotion = :emotion', { emotion });
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
      Logger.log(`[Sticker场景AI判断] 开始判断 - 待分析文本: "${text}"`, 'StickerService');

      const dashscopeApiKey =
        (await this.globalConfigService.getConfigs(['dashscopeApiKey'])) ||
        process.env.DASHSCOPE_API_KEY;

      if (!dashscopeApiKey) {
        Logger.warn('[Sticker场景AI判断] 未配置DashScope API Key，跳过AI判断', 'StickerService');
        return null;
      }

      // 从数据库获取所有标签包含"转账"的表情包场景
      const moneyStickers = await this.stickerRepo
        .createQueryBuilder('sticker')
        .where('sticker.scenario IS NOT NULL')
        .andWhere('FIND_IN_SET(:tag, IFNULL(sticker.tags, "")) > 0', { tag: '转账' })
        .select(['sticker.scenario'])
        .getMany();

      const scenarios = Array.from(new Set(moneyStickers.map(s => s.scenario).filter(Boolean)));

      if (scenarios.length === 0) {
        Logger.warn('[Sticker场景AI判断] 未找到任何"转账"标签的场景，跳过AI判断', 'StickerService');
        return null;
      }

      Logger.log(
        `[Sticker场景AI判断] 从数据库获取到 ${scenarios.length} 个转账场景: ${scenarios.join(
          ', ',
        )}`,
        'StickerService',
      );

      // 构建场景列表字符串
      const scenarioListText = scenarios.map((s, idx) => `${idx + 1}. ${s}`).join('\n');

      const prompt = `你是一个严格的场景分类器。分析AI回复是否属于以下场景之一。

【AI回复】
${text}

【场景列表】
${scenarioListText}

【判断规则】
只有同时满足以下所有条件才能匹配：

A. 购买类场景（场景描述包含"买"字）：
   必须满足：AI明确表示"正在/即将立即购买"，且包含"买"字

   ✅ 匹配示例：
   - "给你买奶茶"
   - "我买零食给你"
   - "买个蛋糕给你"

   ❌ 拒绝示例：
   - "带你去喝奶茶" （无"买"字）
   - "请你喝奶茶" （无"买"字）
   - "送你奶茶" （无"买"字）
   - "明天带你去买" （未来承诺，不是立即购买）
   - "想要什么我给你买" （条件承诺，不是立即购买）
   - "下次买给你" （未来承诺）
   - "工资卡给你，你自己买" （让用户自己买）

B. 金钱奖励类场景（场景描述包含"奖励"/"生活费"等）：
   必须满足：明确提到具体金额数字 或 "红包"/"转账" 等词

   ✅ 匹配示例：
   - "奖励你100元"
   - "给你发红包"
   - "转你188"
   - "给你生活费2000"

   ❌ 拒绝示例：
   - "爱你哦" （无金钱）
   - "送你礼物" （不是金钱）
   - "工资卡给你保管" （不是转账，是管理权）
   - "下次给你" （未来承诺）

C. 节日庆祝类场景：
   必须满足：提到具体节日名称 且 明确送礼/购买/转账

   ✅ 匹配示例：
   - "生日快乐！买蛋糕给你"
   - "新年快乐！发个红包给你"

   ❌ 拒绝示例：
   - "生日快乐" （未送礼）
   - "祝你开心" （非节日）

【输出格式】
- 如果匹配到场景：直接返回场景描述（不要加序号和任何其他文字）
  示例：表达给用户买些零食奶茶等
- 如果不匹配：只返回 NO

立即返回：`;

      const requestBody = {
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
      };

      Logger.debug(
        `[Sticker场景AI判断] 发送API请求 - model: qwen-turbo, prompt长度: ${prompt.length}`,
        'StickerService',
      );
      Logger.debug(`[Sticker场景AI判断] 完整Prompt:\n${prompt}`, 'StickerService');

      const axios = require('axios');
      const response = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${dashscopeApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
        },
      );

      const result = response.data?.output?.text?.trim() || '';
      Logger.log(`[Sticker场景AI判断] ✓ API返回成功 - 原始返回: "${result}"`, 'StickerService');

      // 检查是否为NO（不匹配任何场景）
      if (result.toUpperCase() === 'NO' || result.includes('不匹配')) {
        Logger.log(`[Sticker场景AI判断] ⚠ AI判断为无特定场景 - 跳过表情包`, 'StickerService');
        return null;
      }

      Logger.log(`[Sticker场景AI判断] 开始场景验证 - AI返回: "${result}"`, 'StickerService');

      // 清理AI返回结果（移除可能的序号和前缀）
      let cleanedResult = result
        .replace(/^场景列表中的完整文字[：:]\s*/i, '')
        .replace(/^\d+\.\s*/, '')
        .trim();

      Logger.debug(`[Sticker场景AI判断] 清理后的返回: "${cleanedResult}"`, 'StickerService');

      // 模糊匹配：AI返回的场景只要包含有效场景的部分关键词即可
      for (const scenario of scenarios) {
        if (
          cleanedResult.includes(scenario) ||
          scenario.includes(cleanedResult.replace(/[。，、]/g, ''))
        ) {
          Logger.log(
            `[Sticker场景AI判断] → 初步匹配到场景: "${scenario}"，开始关键词验证`,
            'StickerService',
          );

          // 关键词二次验证：场景描述中包含"买"字的，必须验证文本中也包含"买"字且是立即购买
          if (scenario.includes('买')) {
            const hasBuyKeyword = text.includes('买');
            Logger.log(
              `[Sticker场景AI判断] → 验证"买"字: ${
                hasBuyKeyword ? '✓ 包含' : '✗ 缺失'
              } (原文: "${text}")`,
              'StickerService',
            );

            if (!hasBuyKeyword) {
              Logger.log(
                `[Sticker场景AI判断] ✗ 拒绝场景"${scenario}" - 原因: 场景需要"买"字，但文本缺失`,
                'StickerService',
              );
              continue;
            }

            // 检查是否为未来承诺或条件承诺（不应触发）
            const futurePromisePatterns = [
              /明天.*买/,
              /下次.*买/,
              /以后.*买/,
              /晚点.*买/,
              /有空.*买/,
              /回头.*买/,
              /想要.*买/, // "想要什么我给你买"
              /带你去买/, // "带你去买"
              /陪你.*买/,
              /一起.*买/,
            ];

            const isFuturePromise = futurePromisePatterns.some(pattern => pattern.test(text));

            if (isFuturePromise) {
              Logger.log(
                `[Sticker场景AI判断] ✗ 拒绝场景"${scenario}" - 原因: 检测到未来承诺或条件承诺，不是立即购买 (原文: "${text}")`,
                'StickerService',
              );
              continue;
            }
          }

          // 关键词二次验证：场景描述中包含"奖励"或"爱意"或"生活费"的，必须验证文本中包含金钱关键词
          if (
            scenario.includes('奖励') ||
            scenario.includes('爱意') ||
            scenario.includes('生活费')
          ) {
            const moneyPattern = /\d+元|\d+块|红包|转账|转你|发你\d+|给你\d+/;
            const hasMoneyKeywords =
              moneyPattern.test(text) || text.includes('红包') || text.includes('转账');
            const matchedPattern = text.match(moneyPattern);

            // 排除"工资卡"、"卡给你"等管理权限类表达
            const isManagementPermission =
              text.includes('工资卡') ||
              text.includes('卡给你') ||
              text.includes('保管') ||
              text.includes('管钱');

            Logger.log(
              `[Sticker场景AI判断] → 验证金钱关键词: ${
                hasMoneyKeywords ? '✓ 包含' : '✗ 缺失'
              } (匹配: ${matchedPattern ? matchedPattern[0] : '无'}, 原文: "${text}")`,
              'StickerService',
            );

            if (isManagementPermission) {
              Logger.log(
                `[Sticker场景AI判断] ✗ 拒绝场景"${scenario}" - 原因: 检测到管理权限类表达（非转账），不触发金钱场景`,
                'StickerService',
              );
              continue;
            }

            if (!hasMoneyKeywords) {
              Logger.log(
                `[Sticker场景AI判断] ✗ 拒绝场景"${scenario}" - 原因: 场景需要金钱关键词，但文本缺失`,
                'StickerService',
              );
              continue;
            }
          }

          Logger.log(
            `[Sticker场景AI判断] ✓✓✓ 最终匹配成功 - 场景: "${scenario}"`,
            'StickerService',
          );
          return scenario;
        }
      }

      Logger.warn(`[Sticker场景AI判断] ✗ AI返回了无效的场景: "${result}"`, 'StickerService');
      return null;
    } catch (error: any) {
      Logger.error(
        `[Sticker场景AI判断] ✗ 调用失败 - 错误: ${error?.message || error}`,
        error?.stack || '',
        'StickerService',
      );
      Logger.error(`[Sticker场景AI判断] ✗ 请求详情 - 待分析文本: "${text}"`, 'StickerService');
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
