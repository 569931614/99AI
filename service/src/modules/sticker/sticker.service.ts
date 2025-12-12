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

  /**
   * 根据文本内容匹配表情包
   * - 优先匹配场景表情包（scenario不为空 & tags不为空，如转账场景）
   * - 其次匹配普通表情包（scenario不为空 & tags为空）
   * @param text AI回复内容
   * @param userMessage 用户消息内容（可选，用于更准确判断场景）
   * @param options 识别选项
   *   - skipNormalSticker: 跳过普通表情包识别（只识别场景表情包）
   *   - onlyNormalSticker: 只识别普通表情包（跳过场景表情包）
   * @returns { sticker, isScenarioSticker } 或 null
   */
  async pickStickerByText(
    text?: string | null,
    userMessage?: string | null,
    options?: { skipNormalSticker?: boolean; onlyNormalSticker?: boolean },
  ): Promise<{ sticker: StickerEntity; isScenarioSticker: boolean } | null> {
    const normalizedText = text?.trim() ?? '';

    if (!normalizedText) {
      return null;
    }

    const { skipNormalSticker = false, onlyNormalSticker = false } = options || {};

    // 1. 优先识别场景表情包（有tags的，如转账场景）
    if (!onlyNormalSticker) {
      const detectedScenario = await this.detectScenarioWithAI(normalizedText, userMessage);
      if (detectedScenario) {
        Logger.log(`[Sticker场景] AI判断场景为: ${detectedScenario}`, 'StickerService');
        const scenarioSticker = await this.pickStickerByScenario(detectedScenario);
        if (scenarioSticker) {
          Logger.log(`[Sticker场景] ✓ 找到场景表情包: ${scenarioSticker.name}`, 'StickerService');
          return { sticker: scenarioSticker, isScenarioSticker: true };
        }
        Logger.debug(`[Sticker场景] 未找到场景"${detectedScenario}"的表情包`, 'StickerService');
      }
    }

    // 2. 尝试匹配普通表情包（scenario不为空 & tags为空）
    if (!skipNormalSticker) {
      const normalScenario = await this.detectNormalStickerScenarioWithAI(normalizedText);
      if (normalScenario) {
        Logger.log(`[Sticker普通] AI判断普通场景为: ${normalScenario}`, 'StickerService');
        const normalSticker = await this.pickStickerByNormalScenario(normalScenario);
        if (normalSticker) {
          Logger.log(`[Sticker普通] ✓ 找到普通表情包: ${normalSticker.name}`, 'StickerService');
          return { sticker: normalSticker, isScenarioSticker: false };
        }
        Logger.debug(`[Sticker普通] 未找到普通场景"${normalScenario}"的表情包`, 'StickerService');
      }

      // 3. Fallback: 如果AI识别失败或场景不匹配，随机选择一个普通表情包
      const randomSticker = await this.pickRandomNormalSticker();
      if (randomSticker) {
        Logger.log(
          `[Sticker普通] ✓ Fallback随机选择普通表情包: ${randomSticker.name}`,
          'StickerService',
        );
        return { sticker: randomSticker, isScenarioSticker: false };
      }
      Logger.debug(`[Sticker普通] Fallback失败，数据库中没有普通表情包`, 'StickerService');
    }

    return null;
  }

  /**
   * 使用AI识别普通表情包场景（从数据库动态获取场景列表）
   * 普通表情包：scenario不为空 & tags为空
   */
  private async detectNormalStickerScenarioWithAI(text: string): Promise<string | null> {
    if (!text) return null;

    try {
      Logger.log(
        `[Sticker普通AI识别] 开始识别 - 待分析文本: "${text.substring(0, 50)}${
          text.length > 50 ? '...' : ''
        }"`,
        'StickerService',
      );

      const dashscopeApiKey =
        (await this.globalConfigService.getConfigs(['dashscopeApiKey'])) ||
        process.env.DASHSCOPE_API_KEY;

      if (!dashscopeApiKey) {
        Logger.warn('[Sticker普通AI识别] 未配置DashScope API Key，跳过AI识别', 'StickerService');
        return null;
      }

      // 从数据库动态获取所有普通表情包的 scenario 值（scenario不为空，tags为空）
      const normalStickers = await this.stickerRepo
        .createQueryBuilder('sticker')
        .where('sticker.scenario IS NOT NULL')
        .andWhere("sticker.scenario != ''")
        .andWhere("(sticker.tags IS NULL OR sticker.tags = '')")
        .select(['sticker.scenario'])
        .getMany();

      const scenarios = Array.from(
        new Set(normalStickers.map(s => s.scenario?.trim()).filter(Boolean)),
      );

      if (scenarios.length === 0) {
        Logger.warn(
          '[Sticker普通AI识别] 数据库中未找到任何普通表情包（scenario不为空且tags为空），跳过AI识别',
          'StickerService',
        );
        return null;
      }

      Logger.log(
        `[Sticker普通AI识别] 从数据库获取到 ${scenarios.length} 种场景: ${scenarios.join(', ')}`,
        'StickerService',
      );

      // 构建场景列表字符串
      const scenarioListText = scenarios.map((s, idx) => `${idx + 1}. ${s}`).join('\n');

      const prompt = `# Role
你是一个对话场景匹配专家。请分析【角色回复内容】，从【动态场景列表】中选出最匹配的一个场景。

# Input Data
【角色回复内容】
${text}

【动态场景列表】
${scenarioListText}

# 匹配规则

场景描述是口语化的，需要理解其含义进行匹配：
- "晚上要睡觉的时候" → 角色说"晚安"、"睡了"、"困了要睡觉"等
- "没钱，没饭吃难过" → 角色表达穷、没钱、饿了等
- "撒娇，鼓励" → 角色撒娇或鼓励对方
- "表达肯定" → 角色表示同意、赞同、好的
- "被事情所吓倒" → 角色表达惊讶、害怕、震惊
- "表达喜欢" → 角色表达喜欢、爱、心动
- "累了" → 角色表达疲惫、累、想休息
- "不屑" → 角色表达不在意、看不起、嫌弃

# Logic
1. 理解角色回复的核心情绪/意图
2. 在【动态场景列表】中找语义最接近的场景
3. **必须且只能从上面的【动态场景列表】中选择一个**，绝对不能输出列表之外的内容

# Output
- **只能输出【动态场景列表】中的某一项原文**（不带编号）
- **严禁自己编造场景**，只能从列表中复制一个
- 如果列表只有一个选项，就输出那个选项`;

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
          max_tokens: 200, // 场景描述可能较长，增加 token 限制以避免截断
          temperature: 0.1,
        },
      };

      Logger.debug(
        `[Sticker普通AI识别] 发送API请求 - model: qwen-turbo, 候选场景数: ${scenarios.length}`,
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
      Logger.log(`[Sticker普通AI识别] ✓ API返回成功 - 原始返回: "${result}"`, 'StickerService');

      // 清理AI返回结果（移除可能的序号和前缀）
      let cleanedResult = result.replace(/^\d+\.\s*/, '').trim();

      Logger.debug(`[Sticker普通AI识别] 清理后的返回: "${cleanedResult}"`, 'StickerService');

      // 用于匹配的标准化函数：移除空格和常见标点
      const normalize = (text: string) =>
        text.toLowerCase().replace(/[\s。，、！？!?,.\-_：:；;""''「」『』【】（）()]/g, '');

      const normalizedResult = normalize(cleanedResult);

      // 精确匹配或模糊匹配场景
      for (const scenario of scenarios) {
        // 精确匹配（忽略大小写）
        if (cleanedResult.toLowerCase() === scenario.toLowerCase()) {
          Logger.log(
            `[Sticker普通AI识别] ✓✓✓ 精确匹配成功 - 场景: "${scenario}"`,
            'StickerService',
          );
          return scenario;
        }
      }

      // 标准化精确匹配（移除标点和空格后比较）
      for (const scenario of scenarios) {
        if (normalizedResult === normalize(scenario)) {
          Logger.log(
            `[Sticker普通AI识别] ✓✓✓ 标准化精确匹配成功 - 场景: "${scenario}"`,
            'StickerService',
          );
          return scenario;
        }
      }

      // 模糊匹配：AI返回包含有效场景，或有效场景包含AI返回
      for (const scenario of scenarios) {
        if (
          cleanedResult.toLowerCase().includes(scenario.toLowerCase()) ||
          scenario.toLowerCase().includes(cleanedResult.toLowerCase().replace(/[。，、]/g, ''))
        ) {
          Logger.log(`[Sticker普通AI识别] ✓✓ 模糊匹配成功 - 场景: "${scenario}"`, 'StickerService');
          return scenario;
        }
      }

      // 前缀匹配：处理 AI 返回被截断的情况
      // 如果 AI 返回的前 20 个字符（标准化后）与场景的前 20 个字符匹配，则认为匹配成功
      const minPrefixLen = 15;
      if (normalizedResult.length >= minPrefixLen) {
        const resultPrefix = normalizedResult.substring(0, Math.min(30, normalizedResult.length));
        for (const scenario of scenarios) {
          const scenarioNorm = normalize(scenario);
          if (scenarioNorm.length >= minPrefixLen) {
            const scenarioPrefix = scenarioNorm.substring(0, Math.min(30, scenarioNorm.length));
            // 检查前缀是否相同，或者一个是另一个的前缀
            if (
              resultPrefix === scenarioPrefix ||
              resultPrefix.startsWith(scenarioPrefix) ||
              scenarioPrefix.startsWith(resultPrefix)
            ) {
              Logger.log(
                `[Sticker普通AI识别] ✓✓ 前缀匹配成功 - 场景: "${scenario}"`,
                'StickerService',
              );
              return scenario;
            }
          }
        }
      }

      // AI返回无法匹配到数据库场景，强制选择列表中的第一个场景
      Logger.warn(
        `[Sticker普通AI识别] ⚠ AI返回"${result}"无法匹配到数据库场景，强制选择第一个场景: "${scenarios[0]}"`,
        'StickerService',
      );
      return scenarios[0];
    } catch (error: any) {
      Logger.error(
        `[Sticker普通AI识别] ✗ 调用失败: ${error?.message || error}`,
        error?.stack || '',
        'StickerService',
      );
      return null;
    }
  }

  /**
   * 根据场景选择一个普通表情包（scenario不为空 & tags为空）
   * 按上传时间倒序选择最新的一个
   * @param scenario 场景描述
   * @returns 表情包实体或 null
   */
  private async pickStickerByNormalScenario(scenario: string): Promise<StickerEntity | null> {
    const qb = this.stickerRepo.createQueryBuilder('sticker');

    // 选择普通表情包（scenario不为空且tags为空）
    qb.andWhere('sticker.scenario = :scenario', { scenario });
    qb.andWhere("(sticker.tags IS NULL OR sticker.tags = '')");
    // 按上传时间倒序，选择最新上传的
    qb.orderBy('sticker.uploadDate', 'DESC');

    return qb.getOne();
  }

  /**
   * 随机选择一个普通表情包（scenario不为空 & tags为空）
   * 用于当AI场景识别失败时的fallback
   * @returns 表情包实体或 null
   */
  private async pickRandomNormalSticker(): Promise<StickerEntity | null> {
    const stickers = await this.stickerRepo
      .createQueryBuilder('sticker')
      .where('sticker.scenario IS NOT NULL')
      .andWhere("sticker.scenario != ''")
      .andWhere("(sticker.tags IS NULL OR sticker.tags = '')")
      .getMany();

    if (stickers.length === 0) {
      return null;
    }

    // 随机选择一个
    const randomIndex = Math.floor(Math.random() * stickers.length);
    return stickers[randomIndex];
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
