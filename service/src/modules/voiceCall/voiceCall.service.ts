import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AffectionService } from '../affection/affection.service';
import { OpenAIChatService } from '../aiTool/chat/chat.service';
import { AppEntity } from '../app/app.entity';
import { AppService } from '../app/app.service';
import { ChatService } from '../chat/chat.service';

/**
 * 语音通话服务
 * 封装语音对话相关的业务逻辑，避免在 main.ts 中直接调用底层服务
 */
@Injectable()
export class VoiceCallService {
  constructor(
    @InjectRepository(AppEntity)
    private readonly appEntity: Repository<AppEntity>,
    private readonly chatService: ChatService,
    private readonly openAIChatService: OpenAIChatService,
    private readonly affectionService: AffectionService,
    private readonly appService: AppService,
  ) {}

  /**
   * 获取应用信息
   */
  async getAppInfo(appId: number): Promise<any> {
    try {
      const appInfo = await this.appEntity.findOne({
        where: { id: appId },
      });
      return appInfo;
    } catch (error: any) {
      Logger.error(
        `[VoiceCallService] 查询应用失败: appId=${appId}, error=${error?.message}`,
        error?.stack,
        'VoiceCallService',
      );
      return null;
    }
  }

  /**
   * 构建语音对话的角色预设（包含好感度行为规范和语音特殊约束）
   */
  async buildVoiceRolePrompt(
    appId: number | null,
    userId: string | number | undefined,
    basePrompt?: string,
  ): Promise<string> {
    let finalPrompt = '';

    // 1. 获取应用的角色预设
    if (appId) {
      const appInfo = await this.getAppInfo(appId);
      if (appInfo?.preset) {
        finalPrompt = appInfo.preset;
      }
    }

    // 如果没有应用预设，使用基础预设
    if (!finalPrompt && basePrompt) {
      finalPrompt = basePrompt;
    }

    // 2. 添加好感度行为规范
    if (userId && appId) {
      try {
        const affectionData = await this.affectionService.getUserAffection(userId, appId);
        if (affectionData?.stage?.behaviors) {
          const behaviors = affectionData.stage.behaviors.trim();
          if (behaviors) {
            finalPrompt = `${finalPrompt}\n\n## 当前好感度等级: ${affectionData.stage.name}\n${behaviors}`;
            Logger.debug(
              `[VoiceCallService] 添加好感度行为规范: 等级=${affectionData.stage.name}, score=${affectionData.score}`,
              'VoiceCallService',
            );
          }
        }
      } catch (error: any) {
        Logger.warn(
          `[VoiceCallService] 获取好感度失败: userId=${userId}, appId=${appId}, error=${error?.message}`,
          'VoiceCallService',
        );
      }
    }

    // 3. 添加语音对话特殊约束：确保括号外有实际对话内容
    finalPrompt = `${finalPrompt}\n\n【重要】在语音对话中，你的回复必须包含括号外的实际对话内容。可以使用括号（）、【】等标记心理活动或动作描写，但括号外必须有实际要说的话，不能让所有内容都在括号内。`;

    // 4. 如果最终预设为空，使用默认预设
    if (!finalPrompt || finalPrompt.trim() === '') {
      finalPrompt =
        '你是一个友好、乐于助人的AI助手。请用简洁、自然的方式回答用户的问题。\n\n【重要】在语音对话中，你的回复必须包含括号外的实际对话内容。可以使用括号（）、【】等标记心理活动或动作描写，但括号外必须有实际要说的话，不能让所有内容都在括号内。';
    }

    return finalPrompt;
  }

  /**
   * 处理语音对话的 LLM 请求（流式输出）
   */
  async processVoiceLLM(
    userInput: string,
    appId: number | null,
    userId: string | number | undefined,
    basePrompt?: string,
    options?: {
      onProgress?: (delta: string) => void;
      abortSignal?: AbortSignal;
      messagesHistory?: any[];
      imageUrl?: string;
      enableRealTime?: boolean;
      enableLongTermMemory?: boolean;
      enableKnowledgeBase?: boolean;
      knowledgeBaseIds?: string;
      dialogueExamples?: string;
      openingRemark?: string;
    },
  ): Promise<{ text: string }> {
    // 1. 构建角色预设
    const rolePrompt = await this.buildVoiceRolePrompt(appId, userId, basePrompt);
    Logger.debug(
      `[VoiceCallService] 角色预设已构建: appId=${appId}, 长度=${rolePrompt.length}`,
      'VoiceCallService',
    );

    // 2. 获取应用信息用于构建星尘API配置
    let appInfo: any = null;
    let botName = 'AI助手';
    if (appId) {
      appInfo = await this.getAppInfo(appId);
      botName = appInfo?.name || botName;
    }

    // 3. 构建星尘API扩展配置
    const appConfigForXingchen = appId
      ? {
          botName,
          userId,
          appId,
          enableRealTime: options?.enableRealTime ?? appInfo?.enableRealTime,
          enableLongTermMemory: options?.enableLongTermMemory ?? appInfo?.enableLongTermMemory,
          enableKnowledgeBase: options?.enableKnowledgeBase ?? appInfo?.enableKnowledgeBase,
          knowledgeBaseIds: options?.knowledgeBaseIds ?? appInfo?.knowledgeBaseIds,
          dialogueExamples: options?.dialogueExamples ?? appInfo?.dialogueExamples,
          openingRemark: options?.openingRemark ?? appInfo?.openingRemark,
        }
      : undefined;

    Logger.debug(
      `[VoiceCallService] 星尘API配置: userId=${userId}, appId=${appId}, botName=${botName}`,
      'VoiceCallService',
    );

    // 4. 调用星尘API
    try {
      const result = await this.openAIChatService.chatFree(
        userInput,
        rolePrompt,
        options?.messagesHistory || [],
        options?.imageUrl,
        {
          onProgress: options?.onProgress,
          abortSignal: options?.abortSignal,
        },
        appConfigForXingchen,
      );

      return result;
    } catch (error: any) {
      Logger.error(
        `[VoiceCallService] LLM调用失败: ${error?.message}`,
        error?.stack,
        'VoiceCallService',
      );
      throw error;
    }
  }

  /**
   * 识别情绪并选择音色
   */
  async detectEmotionAndVoice(
    text: string,
    appId: number | null,
  ): Promise<{ emotion: string; voiceId: string; method: string } | null> {
    try {
      const result = await this.chatService.detectEmotionForVoiceCall(text, appId);
      if (result) {
        Logger.debug(
          `[VoiceCallService] 情绪识别成功: emotion=${result.emotion}, voiceId=${result.voiceId}, method=${result.method}`,
          'VoiceCallService',
        );
      }
      return result;
    } catch (error: any) {
      Logger.error(
        `[VoiceCallService] 情绪识别失败: ${error?.message}`,
        error?.stack,
        'VoiceCallService',
      );
      return null;
    }
  }

  /**
   * 获取应用的默认音色
   * 复用 AppService 的方法
   */
  async getDefaultVoiceId(appId: number | null): Promise<string | null> {
    return this.appService.getDefaultVoiceId(appId);
  }

  /**
   * 移除括号内容，得到实际要朗读的文本
   */
  removeBracketedContent(text: string): string {
    return this.chatService.removeBracketedContent(text);
  }
}
