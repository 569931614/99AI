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
   */
  async summarizeConversationAsync(
    groupId: string,
    userId: number,
    appId: number | null,
    previousSummary: string | null,
    newMessages: Array<{ role: string; content: string }>,
  ): Promise<void> {
    setImmediate(async () => {
      try {
        Logger.debug(
          `[对话总结] 开始异步总结 - groupId=${groupId}, 新消息数=${newMessages.length}`,
          'ConversationSummaryService',
        );

        const validMessages = newMessages.filter(
          msg => msg.content && msg.content.trim().length > 0,
        );
        if (validMessages.length === 0) {
          Logger.debug(`[对话总结] 没有有效的新消息，跳过总结`, 'ConversationSummaryService');
          return;
        }

        const newSummary = await this.generateSummary(previousSummary, validMessages);
        if (!newSummary) {
          Logger.warn(`[对话总结] 总结生成失败，跳过保存`, 'ConversationSummaryService');
          return;
        }

        await this.saveSummary(groupId, userId, appId, newSummary, validMessages.length);
        Logger.debug(`[对话总结] ✓ 总结完成并保存 - groupId=${groupId}`, 'ConversationSummaryService');
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
   */
  private async generateSummary(
    previousSummary: string | null,
    messages: Array<{ role: string; content: string }>,
  ): Promise<string | null> {
    try {
      const dashscopeApiKey =
        (await this.globalConfigService.getConfigs(['dashscopeApiKey'])) ||
        process.env.DASHSCOPE_API_KEY;

      if (!dashscopeApiKey) {
        Logger.warn('[对话总结] 未配置DashScope API Key，跳过总结', 'ConversationSummaryService');
        return null;
      }

      // 构建对话文本
      const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n');

      const systemPrompt = previousSummary
        ? `你是一个专业的对话总结助手。请基于之前的总结和新的对话内容，生成一个更新的总结。

之前的总结：
${previousSummary}

新的对话内容：
${conversationText}

要求：
1. 保留之前总结中的重要信息
2. 整合新对话的关键内容
3. 总结应简洁、连贯，突出重点
4. 字数控制在300字以内
5. 只返回总结内容，不要任何前缀或解释

请生成更新后的总结：`
        : `你是一个专业的对话总结助手。请对以下对话内容进行总结。

对话内容：
${conversationText}

要求：
1. 总结对话的主要内容和关键信息
2. 保持简洁、准确，突出重点
3. 字数控制在300字以内
4. 只返回总结内容，不要任何前缀或解释

请生成总结：`;

      const axios = require('axios');
      const response = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        {
          model: 'qwen-turbo',
          input: {
            messages: [
              {
                role: 'system',
                content: '你是一个专业的对话总结助手',
              },
              {
                role: 'user',
                content: systemPrompt,
              },
            ],
          },
          parameters: {
            max_tokens: 500,
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
