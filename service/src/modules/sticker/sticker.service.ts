import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { GlobalConfigService } from '../globalConfig/globalConfig.service';
import { StickerEntity } from './sticker.entity';

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
    userMessage?: string | null,
  ): Promise<StickerEntity | null> {
    const normalizedText = text?.trim() ?? '';

    // 优先判断对话场景（scenario），场景表情包优先级高于情绪表情包
    if (normalizedText) {
      const detectedScenario = await this.detectScenarioWithAI(normalizedText, userMessage);
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
   * 使用AI识别文本情绪（从数据库动态获取情绪列表，让AI选择匹配）
   */
  private async detectEmotionByAI(text: string): Promise<string | null> {
    if (!text) return null;

    try {
      Logger.log(
        `[Sticker情绪AI识别] 开始识别 - 待分析文本: "${text.substring(0, 50)}${
          text.length > 50 ? '...' : ''
        }"`,
        'StickerService',
      );

      const dashscopeApiKey =
        (await this.globalConfigService.getConfigs(['dashscopeApiKey'])) ||
        process.env.DASHSCOPE_API_KEY;

      if (!dashscopeApiKey) {
        Logger.warn('[Sticker情绪AI识别] 未配置DashScope API Key，跳过AI识别', 'StickerService');
        return null;
      }

      // 从数据库动态获取所有普通情绪表情包的 scenario 值（scenario不为空，tags为空）
      const emotionStickers = await this.stickerRepo
        .createQueryBuilder('sticker')
        .where('sticker.scenario IS NOT NULL')
        .andWhere("sticker.scenario != ''")
        .andWhere("(sticker.tags IS NULL OR sticker.tags = '')")
        .select(['sticker.scenario'])
        .getMany();

      const emotions = Array.from(
        new Set(emotionStickers.map(s => s.scenario?.trim()).filter(Boolean)),
      );

      if (emotions.length === 0) {
        Logger.warn(
          '[Sticker情绪AI识别] 数据库中未找到任何情绪表情包（scenario不为空且tags为空），跳过AI识别',
          'StickerService',
        );
        return null;
      }

      Logger.log(
        `[Sticker情绪AI识别] 从数据库获取到 ${emotions.length} 种情绪类型: ${emotions.join(', ')}`,
        'StickerService',
      );

      // 构建情绪列表字符串
      const emotionListText = emotions.map((e, idx) => `${idx + 1}. ${e}`).join('\n');

      const prompt = `# Role
你是一个专业的情绪分析专家。请分析【AI回复内容】表达的情绪，并从【动态情绪列表】中选择最合适的一项。

# Input Data
【AI回复内容】
${text}

【动态情绪列表】
${emotionListText}

# Logic Steps

## Step 1: 情绪分析
分析AI回复内容的主要情绪特征：
- 是否表达开心、兴奋、愉悦？
- 是否表达悲伤、失落、难过？
- 是否表达生气、愤怒、不满？
- 是否表达安慰、关心、温柔？
- 是否表达惊讶、震惊、意外？
- 是否表达害羞、撒娇、可爱？
- 是否表达调皮、俏皮、活泼？
- 是否为中性/日常对话？

## Step 2: 情绪匹配
将分析结果与【动态情绪列表】进行语义比对：
- 优先精确匹配情绪名称
- 若无精确匹配，选择语义最接近的情绪
- 若文本情绪过于中性或无法判断，输出 NO

# Output
- 仅输出匹配到的**情绪选项原文**（不带编号）
- 若无匹配或无法判断，输出 **NO**`;

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
        `[Sticker情绪AI识别] 发送API请求 - model: qwen-turbo, 候选情绪数: ${emotions.length}`,
        'StickerService',
      );

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
      Logger.log(`[Sticker情绪AI识别] ✓ API返回成功 - 原始返回: "${result}"`, 'StickerService');

      // 检查是否为NO（不匹配任何情绪）
      if (result.toUpperCase() === 'NO' || result.includes('无法判断') || result.includes('中性')) {
        Logger.log('[Sticker情绪AI识别] ⚠ AI判断为无特定情绪 - 跳过表情包', 'StickerService');
        return null;
      }

      // 清理AI返回结果（移除可能的序号和前缀）
      let cleanedResult = result.replace(/^\d+\.\s*/, '').trim();

      Logger.debug(`[Sticker情绪AI识别] 清理后的返回: "${cleanedResult}"`, 'StickerService');

      // 精确匹配或模糊匹配情绪
      for (const emotion of emotions) {
        // 精确匹配（忽略大小写）
        if (cleanedResult.toLowerCase() === emotion.toLowerCase()) {
          Logger.log(`[Sticker情绪AI识别] ✓✓✓ 精确匹配成功 - 情绪: "${emotion}"`, 'StickerService');
          return emotion;
        }
      }

      // 模糊匹配：AI返回包含有效情绪，或有效情绪包含AI返回
      for (const emotion of emotions) {
        if (
          cleanedResult.toLowerCase().includes(emotion.toLowerCase()) ||
          emotion.toLowerCase().includes(cleanedResult.toLowerCase().replace(/[。，、]/g, ''))
        ) {
          Logger.log(`[Sticker情绪AI识别] ✓✓ 模糊匹配成功 - 情绪: "${emotion}"`, 'StickerService');
          return emotion;
        }
      }

      Logger.warn(
        `[Sticker情绪AI识别] ✗ AI返回了无效的情绪: "${result}", 候选: [${emotions.join(' | ')}]`,
        'StickerService',
      );
      return null;
    } catch (error: any) {
      Logger.error(
        `[Sticker情绪AI识别] ✗ 调用失败: ${error?.message || error}`,
        error?.stack || '',
        'StickerService',
      );
      return null;
    }
  }

  private async pickRandomSticker(emotion?: string | null): Promise<StickerEntity | null> {
    const qb = this.stickerRepo.createQueryBuilder('sticker');

    // 选择普通情绪表情包（scenario不为空且tags为空）
    qb.andWhere('sticker.scenario IS NOT NULL');
    qb.andWhere("sticker.scenario != ''");
    qb.andWhere("(sticker.tags IS NULL OR sticker.tags = '')");

    if (emotion) {
      qb.andWhere('sticker.scenario = :emotion', { emotion });
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
   * @param text 对话内容（AI回复）
   * @param userMessage 用户消息内容（可选）
   * @returns 场景描述或 null
   */
  private async detectScenarioWithAI(
    text: string,
    userMessage?: string | null,
  ): Promise<string | null> {
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

      const prompt = `# Role
你是一个语义匹配专家。请分析【用户】与【AI】的对话，判断AI是否执行了"给钱"或"买东西"的动作，并将其精准匹配到【动态场景列表】中最合适的一项。

# Input Data
${userMessage ? `【用户说】\n${userMessage}\n\n` : ''}【AI说】
${text}

【动态场景列表】
${scenarioListText}

# Logic Steps (动作主导模式)

## Step 1: 独立动作扫描 (The Scanner)
**不要管用户说了什么，只看AI说了什么。**
AI的回复中是否包含以下**确切支付信号**？

*   **金钱类信号**：
    *   "红包发过去了" / "红包拿去"
    *   "转过去了" / "已转" / "转给你了"
    *   "钱打过去了" / "查收一下"
    *   动作描写：(发红包) / (转账) / (支付)
*   **物品类信号**：
    *   "买好了" / "下单了"
    *   "点好外卖了"
    *   动作描写：(递给你奶茶)/ (把买的东西给你)

👉 **判定结果**：
*   如果没有上述信号，或AI表示"下次给"、"教你做" -> **输出 NO**。
*   如果有上述信号 -> **进入 Step 2**。

## Step 2: 强制语义映射 (The Mapper)
**AI已经确认给了钱或东西，现在必须在【动态场景列表】中找一个最接近的坑位填进去。**

请根据 AI 的具体行为进行关键词碰撞：

*   **情形 A：AI 发红包 / 转账 / 给钱**
    *   **首选匹配**：寻找包含“红包”、“转账”、“生活费”、“给钱”关键词的场景。
    *   **次选匹配**：如果列表中没有上述词，寻找包含“添置东西”、“购买东西”、“奖励”的场景。
    *   *注意：即使列表描述是“为用户添置购买东西”，发红包/转账也可以算作此类（因为钱是用来买东西的）。*

*   **情形 B：AI 买零食 / 奶茶 / 饮料**
    *   **首选匹配**：寻找包含“零食”、“奶茶”、“吃喝”关键词的场景。
    *   **次选匹配**：寻找“购买东西”、“给钱”的通用场景。

*   **情形 C：AI 节日 / 补偿**
    *   优先匹配“节日”、“庆祝”、“歉意”、“奖励”类场景。

# Output Rules
1.  **必须输出**匹配到的【场景选项原文】。
2.  仅在 Step 1 确实没有任何支付动作时，才输出 **NO**。`;

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
   * 根据场景查询表情包（场景表情包必须有tags，如"转账"标签）
   * @param scenario 场景描述
   * @returns 表情包实体或 null
   */
  private async pickStickerByScenario(scenario: string): Promise<StickerEntity | null> {
    try {
      // 查询scenario字段匹配的表情包（必须有tags，区分于普通情绪表情包）
      const sticker = await this.stickerRepo
        .createQueryBuilder('sticker')
        .where('sticker.scenario LIKE :scenario', { scenario: `%${scenario}%` })
        .andWhere("sticker.tags IS NOT NULL AND sticker.tags != ''")
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
