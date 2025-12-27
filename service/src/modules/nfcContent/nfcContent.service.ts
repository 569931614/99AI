import { Injectable, Logger } from '@nestjs/common';
import { UserAppSettingsService } from '../userAppSettings/userAppSettings.service';

/**
 * NFC 内容偏好类型
 */
export type NfcContentType = 'calendar_reminder' | 'chat_memory' | 'check_in' | 'report';

/**
 * NFC 消息内容生成服务
 * 负责根据用户偏好生成不同风格的 NFC 触发消息提示词
 */
@Injectable()
export class NfcContentService {
  private readonly logger = new Logger(NfcContentService.name);

  // 默认规则列表
  private readonly defaultRules: NfcContentType[] = [
    'calendar_reminder',
    'chat_memory',
    'check_in',
    'report',
  ];

  constructor(private readonly userAppSettingsService: UserAppSettingsService) {}

  /**
   * 构建 NFC 消息提示词
   * 根据用户偏好选择内容类型，生成对应的提示词
   * @param originalPrompt 原始 prompt（由客户端传入）
   * @param userId 用户 ID
   * @param appId 角色 ID
   * @returns 处理后的提示词
   */
  async buildNfcMessagePrompt(
    originalPrompt: string,
    userId: number,
    appId?: number,
  ): Promise<string> {
    // 获取用户偏好并选择规则
    const selectedRule = await this.selectContentRule(userId, appId);

    this.logger.log(`NFC消息规则选择: ${selectedRule} (userId: ${userId}, appId: ${appId})`);

    // 根据规则生成提示词
    switch (selectedRule) {
      case 'calendar_reminder':
        return this.buildCalendarReminderPrompt(originalPrompt);
      case 'chat_memory':
        return this.buildChatMemoryPrompt(originalPrompt);
      case 'check_in':
        return this.buildCheckInPrompt(originalPrompt, 'check_user');
      case 'report':
        return this.buildCheckInPrompt(originalPrompt, 'report_activity');
      default:
        return originalPrompt;
    }
  }

  /**
   * 根据用户偏好选择内容规则
   */
  private async selectContentRule(userId: number, appId?: number): Promise<NfcContentType> {
    let availableRules = this.defaultRules;

    // 从数据库查询用户的 NFC 内容偏好
    if (appId) {
      try {
        const preference = await this.userAppSettingsService.getNfcContentPreference(userId, appId);
        if (preference && preference.trim()) {
          // 用户设置了偏好，使用用户的偏好列表
          const userRules = preference
            .split(',')
            .map(r => r.trim())
            .filter(r => r) as NfcContentType[];
          if (userRules.length > 0) {
            availableRules = userRules;
            this.logger.log(
              `NFC消息使用用户偏好: ${userRules.join(',')} (userId: ${userId}, appId: ${appId})`,
            );
          }
        }
      } catch (error) {
        this.logger.warn(`获取NFC内容偏好失败，使用默认随机: ${error.message}`);
      }
    }

    // 从可用规则中随机选择一个
    return availableRules[Math.floor(Math.random() * availableRules.length)];
  }

  /**
   * 规则1: 备忘录提醒（包含天气信息）
   */
  private buildCalendarReminderPrompt(originalPrompt: string): string {
    // 提取原始 prompt 中的天气信息
    const weatherMatch = originalPrompt.match(/天气信息[：:]\s*(.+?)(?:\n|$)/);
    const weatherInfo = weatherMatch ? weatherMatch[1].trim() : '天气信息暂时无法获取';

    // 检查是否有备忘录内容
    const hasCalendarContent =
      !originalPrompt.includes('用户今天没有特别的备忘事项') &&
      !originalPrompt.includes('没有设置备忘录');

    if (hasCalendarContent) {
      return `${originalPrompt}

【角色指令】你现在需要根据上面的备忘录内容，向用户发送提醒消息。
要求：
1. 仔细阅读用户备忘录中记录的重要事情（如考试、会议、姨妈期等）
2. 结合天气信息，用温柔关心的语气提醒用户
3. 重点提醒今天的重要安排
4. 语气要亲切自然，像朋友或恋人之间的关心
5. 【重要】只生成一条简短的提醒消息，不要解释你在做什么

请现在生成提醒消息：`;
    } else {
      // 无备忘录时，根据天气发送温馨问候
      return `天气信息：${weatherInfo}

【角色指令】你现在需要向用户发送一条温馨的问候消息。
要求：
1. 根据天气信息，发送一条温暖的问候
2. 可以根据天气建议用户的活动（如天气好可以出去走走，下雨记得带伞等）
3. 语气要亲切自然，像朋友或恋人之间的关心
4. 【重要】不要编造任何具体的日程安排，只根据天气问候
5. 【重要】只生成一条简短的问候消息，不要解释你在做什么

请现在生成问候消息：`;
    }
  }

  /**
   * 规则2: 聊天上下文记忆（关心）
   */
  private buildChatMemoryPrompt(originalPrompt: string): string {
    // 提取天气信息
    const weatherMatch = originalPrompt.match(/天气信息[：:]\s*(.+?)(?:\n|$)/);
    const weatherInfo = weatherMatch ? weatherMatch[1].trim() : '';

    return `${
      weatherInfo ? `天气信息：${weatherInfo}\n\n` : ''
    }【角色指令】你现在需要基于之前的聊天记忆，主动关心用户。
要求：
1. 回忆之前和用户聊过的内容，主动询问用户的近况
2. 表现出真诚的关心和体贴
3. 语气要温柔亲切，像恋人或好友之间的问候
4. 可以提出具体的关心建议（如身体不舒服要多休息、工作累了要放松等）
5. 让用户感受到被记住、被关心的温暖
6. 【重要】只生成一条简短的关心消息，不要解释你在做什么

示例风格：
- "之前你说肚子不舒服，现在好点了吗？"
- "你上次说工作压力大，这两天有好一点吗？累了就休息一下~"

请现在生成一条关心消息：`;
  }

  /**
   * 规则3: 查岗
   * 规则4: 报备
   */
  private buildCheckInPrompt(
    originalPrompt: string,
    type: 'check_user' | 'report_activity',
  ): string {
    if (type === 'check_user') {
      // 查岗：询问用户在做什么
      return `【角色指令】你现在需要用撒娇的语气向用户"查岗"，询问用户在做什么。
要求：
1. 用撒娇、略带醋意但不过分的语气
2. 询问用户现在在做什么、有没有好好吃饭/休息
3. 可以先说自己在做什么，然后问用户
4. 语气要俏皮可爱，让人觉得sweet而不是controlling
5. 【重要】只生成一条简短的查岗消息，不要解释你在做什么

示例风格：
- "我刚吃完饭，你呢？有没有乖乖吃饭呀？"
- "在干嘛呢？有没有想我？"
- "你那边怎么样？有没有按时休息？"

请现在生成一条查岗消息：`;
    } else {
      // 报备：主动报备自己的活动并关心用户
      return `【角色指令】你现在需要主动向用户"报备"你在做什么，并关心用户。
要求：
1. 先主动说自己在做什么（可以是日常活动如吃饭、逛街、看书等）
2. 然后关心地询问用户的情况
3. 用撒娇、略带黏人的语气
4. 语气要俏皮可爱，表现出想和用户分享日常的感觉
5. 【重要】只生成一条简短的报备消息，不要解释你在做什么

示例风格：
- "我刚在外面逛街呢~看到一个好可爱的东西想给你看！你在干嘛呀？"
- "我刚忙完休息一下，突然想你了，你那边怎么样？"

请现在生成一条报备消息：`;
    }
  }
}
