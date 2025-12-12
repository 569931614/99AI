import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlobalConfigService } from '../globalConfig/globalConfig.service';
import { ConversationSummaryEntity } from './conversationSummary.entity';

@Injectable()
export class ConversationSummaryService {
  constructor(
    @InjectRepository(ConversationSummaryEntity)
    private readonly conversationSummaryRepo: Repository<ConversationSummaryEntity>,
    private readonly globalConfigService: GlobalConfigService,
  ) {}

  /**
   * 获取指定群组的对话总结
   */
  async getSummary(groupId: string): Promise<string | null> {
    try {
      const summary = await this.conversationSummaryRepo.findOne({
        where: { groupId },
      });
      if (summary) {
        Logger.debug(
          `[对话总结] 获取到groupId=${groupId}的历史总结，消息数=${summary.messageCount}`,
          'ConversationSummaryService',
        );
        return summary.summary;
      }
      Logger.debug(`[对话总结] groupId=${groupId}暂无历史总结`, 'ConversationSummaryService');
      return null;
    } catch (error: any) {
      Logger.error(
        `[对话总结] 获取总结失败: ${error?.message || error}`,
        error?.stack || '',
        'ConversationSummaryService',
      );
      return null;
    }
  }

  /**
   * 异步总结对话（非阻塞）
   * @param roleName 角色名称，用于在总结中替换"assistant"
   * @param userName 用户名称，用于在总结中替换"user"
   */
  async summarizeConversationAsync(
    groupId: string,
    userId: number,
    appId: number | null,
    previousSummary: string | null,
    newMessages: Array<{ role: string; content: string }>,
    roleName: string = '助理',
    userName: string = '用户',
  ): Promise<void> {
    setImmediate(async () => {
      try {
        Logger.debug(
          `[对话总结] 开始异步总结 - groupId=${groupId}, 新消息数=${newMessages.length}, 角色名=${roleName}, 用户名=${userName}`,
          'ConversationSummaryService',
        );

        const validMessages = newMessages.filter(
          msg => msg.content && msg.content.trim().length > 0,
        );
        if (validMessages.length === 0) {
          Logger.debug(`[对话总结] 没有有效的新消息，跳过总结`, 'ConversationSummaryService');
          return;
        }

        const newSummary = await this.generateSummary(previousSummary, validMessages, roleName, userName);
        if (!newSummary) {
          Logger.warn(`[对话总结] 总结生成失败，跳过保存`, 'ConversationSummaryService');
          return;
        }

        await this.saveSummary(groupId, userId, appId, newSummary, validMessages.length);
        Logger.debug(
          `[对话总结] ✓ 总结完成并保存 - groupId=${groupId}`,
          'ConversationSummaryService',
        );
      } catch (error: any) {
        Logger.error(
          `[对话总结] 异步总结失败: ${error?.message || error}`,
          error?.stack || '',
          'ConversationSummaryService',
        );
      }
    });
  }

  /**
   * 使用DashScope API生成总结
   * @param roleName 角色名称，用于替换"assistant"
   * @param userName 用户名称，用于替换"user"
   */
  private async generateSummary(
    previousSummary: string | null,
    messages: Array<{ role: string; content: string }>,
    roleName: string = '助理',
    userName: string = '用户',
  ): Promise<string | null> {
    try {
      const dashscopeApiKey =
        (await this.globalConfigService.getConfigs(['dashscopeApiKey'])) ||
        process.env.DASHSCOPE_API_KEY;

      if (!dashscopeApiKey) {
        Logger.warn('[对话总结] 未配置DashScope API Key，跳过总结', 'ConversationSummaryService');
        return null;
      }

      // 构建对话文本，将 assistant 替换为角色名，user 替换为用户名
      const conversationText = messages
        .map(m => {
          const displayRole = m.role === 'assistant' ? roleName : userName;
          return `${displayRole}: ${m.content}`;
        })
        .join('\n');

      // 构建消息：分离指令和数据
      const systemMessage = `你是一个**聊天记录概括助手**。你的任务是：
将两个人很长的聊天对话内容，尽可能压缩到最短。

## 要求
1. **长度**：不超过 400 字。
2. **整合**：将旧总结的核心信息 + 新对话中的重点，融合成一份连贯的内容。
3. **关注点**：
   - 事件的发生时间、顺序
   - 人物关系与情绪的变化
   - 关键事件的发展、转折
   - 重要信息的交换、决策
4. **风格**：客观、中立、简洁，保证信息完整。
5. **目标**：保留对话双方身份，双方后续能基于这份内容继续对话，关键信息都包含其中。

## 输出格式
直接输出一段合并后的文本，无需任何额外说明，无需评价。`;

      const userMessage = previousSummary
        ? `之前的总结：\n${previousSummary}\n\n新的对话：\n${conversationText}`
        : `对话内容：\n${conversationText}`;

      const axios = require('axios');
      const response = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        {
          model: 'qwen-turbo',
          input: {
            messages: [
              {
                role: 'system',
                content: systemMessage,
              },
              {
                role: 'user',
                content: userMessage,
              },
            ],
          },
          parameters: {
            max_tokens: 600,
            temperature: 0.3,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${dashscopeApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      const summary = response.data?.output?.text?.trim() || '';
      if (!summary) {
        Logger.warn(`[对话总结] API返回空内容`, 'ConversationSummaryService');
        return null;
      }

      Logger.debug(`[对话总结] ✓ 生成成功，长度=${summary.length}字`, 'ConversationSummaryService');
      return summary;
    } catch (error: any) {
      Logger.error(
        `[对话总结] 生成总结失败: ${error?.message || error}`,
        error?.stack || '',
        'ConversationSummaryService',
      );
      return null;
    }
  }

  /**
   * 保存总结到数据库
   */
  private async saveSummary(
    groupId: string,
    userId: number,
    appId: number | null,
    summary: string,
    messageCount: number,
  ): Promise<void> {
    try {
      let record = await this.conversationSummaryRepo.findOne({
        where: { groupId },
      });

      if (record) {
        // 更新现有记录
        record.summary = summary;
        record.messageCount = (record.messageCount || 0) + messageCount;
        record.lastSummarizedAt = new Date();
        await this.conversationSummaryRepo.save(record);
      } else {
        // 创建新记录
        record = this.conversationSummaryRepo.create({
          groupId,
          userId,
          appId,
          summary,
          messageCount,
          lastSummarizedAt: new Date(),
        });
        await this.conversationSummaryRepo.save(record);
      }

      Logger.debug(
        `[对话总结] ✓ 保存成功 - groupId=${groupId}, 累计消息=${record.messageCount}`,
        'ConversationSummaryService',
      );
    } catch (error: any) {
      Logger.error(
        `[对话总结] 保存失败: ${error?.message || error}`,
        error?.stack || '',
        'ConversationSummaryService',
      );
      throw error;
    }
  }

  /**
   * 删除指定群组的总结
   */
  async deleteSummary(groupId: string): Promise<void> {
    try {
      await this.conversationSummaryRepo.delete({ groupId });
      Logger.debug(`[对话总结] ✓ 删除成功 - groupId=${groupId}`, 'ConversationSummaryService');
    } catch (error: any) {
      Logger.error(
        `[对话总结] 删除失败: ${error?.message || error}`,
        error?.stack || '',
        'ConversationSummaryService',
      );
      throw error;
    }
  }
}
