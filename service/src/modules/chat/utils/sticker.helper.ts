import { getClientIp } from '@/common/utils';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ChatLogService } from '../../chatLog/chatLog.service';
import { StickerService } from '../../sticker/sticker.service';

type StickerLogPayload = Record<string, any>;

export class StickerMessageHelper {
  constructor(
    private readonly stickerService: StickerService,
    private readonly chatLogService: ChatLogService,
    private readonly logDebug: (message: any, context?: string) => void = () => {},
  ) {}

  async maybeCreateStickerMessage(options: {
    basePayload?: StickerLogPayload | null;
    referenceText?: string | null;
  }): Promise<{ chatId: number; message: any } | null> {
    const { basePayload, referenceText } = options;
    if (!basePayload) {
      return null;
    }

    try {
      const result = await this.stickerService.pickStickerByText(referenceText?.trim() || '');
      if (!result?.sticker?.imageUrl) {
        this.logDebug('[Sticker] 未找到匹配的表情包，跳过', 'ChatService');
        return null;
      }

      const { sticker, isScenarioSticker } = result;
      const transferText = isScenarioSticker ? sticker.name || '' : '';
      const extraParam = {
        type: 'sticker',
        stickerId: sticker.id,
        tags: sticker.tags,
        scenario: sticker.scenario,
        source: 'global',
        isScenarioSticker: isScenarioSticker,
        transferText: transferText || undefined,
      };
      const stickerLog = await this.chatLogService.saveChatLog({
        ...basePayload,
        content: transferText,
        imageUrl: sticker.imageUrl,
        extraParam: JSON.stringify(extraParam),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });

      return {
        chatId: stickerLog.id,
        message: {
          chatId: stickerLog.id,
          message_type: 'sticker',
          content: transferText,
          content_image: sticker.imageUrl,
          sticker_id: sticker.id,
        },
      };
    } catch (error: any) {
      Logger.warn(`[Sticker] 自动挑选表情包失败: ${error?.message || error}`, 'ChatService');
      return null;
    }
  }

  async createStickerMessageFromContent(options: {
    userId: number;
    content: string;
    appId?: number | null;
    groupId?: number | null;
    req?: Request;
  }): Promise<{
    chatId: number;
    imageUrl: string;
    stickerId: number;
    scenario: string | null;
    isScenarioSticker: boolean;
  }> {
    const { userId, content, appId, groupId, req } = options;
    const trimmedContent = content?.trim();
    if (!trimmedContent) {
      throw new HttpException('content 不能为空', HttpStatus.BAD_REQUEST);
    }

    const result = await this.stickerService.pickStickerByText(trimmedContent);
    if (!result) {
      throw new HttpException('暂时没有匹配的表情包', HttpStatus.NOT_FOUND);
    }

    const { sticker, isScenarioSticker } = result;
    const curIp = req ? getClientIp(req) : null;
    const transferText = isScenarioSticker ? sticker.name || '' : '';
    const extraParam = {
      type: 'sticker',
      stickerId: sticker.id,
      tags: sticker.tags,
      scenario: sticker.scenario,
      source: 'external',
      isScenarioSticker: isScenarioSticker,
      originalContent: trimmedContent,
      transferText: transferText || undefined,
    };

    const stickerLog = await this.chatLogService.saveChatLog({
      appId: appId ?? null,
      curIp,
      userId,
      type: 1,
      progress: '100%',
      model: 'sticker-generator',
      modelName: 'Sticker',
      role: 'assistant',
      groupId: groupId ?? null,
      status: 3,
      content: transferText,
      imageUrl: sticker.imageUrl,
      extraParam: JSON.stringify(extraParam),
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });

    return {
      chatId: stickerLog.id,
      imageUrl: sticker.imageUrl,
      stickerId: sticker.id,
      scenario: sticker.scenario || null,
      isScenarioSticker: isScenarioSticker,
    };
  }

  async tryAutoSendSticker(options: {
    userId: number;
    content: string;
    appId?: number | null;
    groupId?: number | null;
    req?: Request;
    allowEmoji?: boolean;
    userMessage?: string | null;
    skipSave?: boolean;
  }): Promise<{
    chatId: number | null;
    imageUrl: string;
    stickerId: number;
    scenario: string | null;
    isScenarioSticker: boolean;
    transferText?: string;
    stickerData?: any;
  } | null> {
    const { userId, content, appId, groupId, req, allowEmoji, userMessage, skipSave } = options;

    try {
      Logger.log(
        `[表情包] 🔍 开始匹配表情包 - userId: ${userId}, groupId: ${groupId}, allowEmoji: ${allowEmoji}, content: "${content.substring(
          0,
          50,
        )}${content.length > 50 ? '...' : ''}"`,
        'ChatService',
      );

      // 【暂时注释】场景表情包（转账表情包）逻辑
      // const scenarioResult = await this.stickerService.pickStickerByText(content, userMessage, {
      //   skipNormalSticker: true,
      // });

      // if (scenarioResult?.isScenarioSticker) {
      //   const { sticker } = scenarioResult;
      //   Logger.log(
      //     `[表情包] 🎯 检测到场景表情包 - id: ${sticker.id}, scenario: ${sticker.scenario}, name: ${sticker.name}`,
      //     'ChatService',
      //   );

      //   Logger.log(
      //     `[表情包] ✅ 场景表情包100%触发（无去重）- scenario: ${sticker.scenario}, userId: ${userId}, groupId: ${groupId}`,
      //     'ChatService',
      //   );

      //   return await this.createStickerMessage({
      //     sticker,
      //     isScenarioSticker: true,
      //     userId,
      //     appId,
      //     groupId,
      //     req,
      //     content,
      //     skipSave,
      //   });
      // }

      Logger.log('[表情包] ⏭️ 场景表情包已禁用，开始判断普通表情包', 'ChatService');

      if (!allowEmoji) {
        Logger.log(
          `[表情包] ⏭️ 普通表情包开关已关闭，跳过AI识别 - allowEmoji: ${allowEmoji}`,
          'ChatService',
        );
        return null;
      }

      Logger.log('[表情包] 🤖 allowEmoji开启，跳过30%概率限制，直接识别普通表情包', 'ChatService');
      const normalResult = await this.stickerService.pickStickerByText(content, userMessage, {
        onlyNormalSticker: true,
      });

      if (!normalResult || normalResult.isScenarioSticker) {
        Logger.log(
          '[表情包] ❌ 数据库中没有可用的普通表情包（scenario不为空且tags为空）',
          'ChatService',
        );
        return null;
      }

      const { sticker } = normalResult;
      Logger.log(
        `[表情包] ✅ AI识别到普通表情包 - id: ${sticker.id}, scenario: ${sticker.scenario}, name: ${sticker.name}`,
        'ChatService',
      );

      Logger.log(
        `[表情包] ✅ 普通表情包准备发送（无去重）- scenario: ${sticker.scenario}`,
        'ChatService',
      );

      return await this.createStickerMessage({
        sticker,
        isScenarioSticker: false,
        userId,
        appId,
        groupId,
        req,
        content,
        skipSave,
      });
    } catch (error: any) {
      Logger.error(
        `[表情包] tryAutoSendSticker 失败: ${error?.message || error}`,
        error?.stack || '',
        'ChatService',
      );
      return null;
    }
  }

  async createStickerMessage(options: {
    sticker: any;
    isScenarioSticker: boolean;
    userId: number;
    appId?: number | null;
    groupId?: number | null;
    req?: Request;
    content: string;
    skipSave?: boolean;
  }): Promise<{
    chatId: number | null;
    imageUrl: string;
    stickerId: number;
    scenario: string | null;
    isScenarioSticker: boolean;
    transferText?: string;
    stickerData?: any;
  }> {
    const { sticker, isScenarioSticker, userId, appId, groupId, req, content, skipSave } = options;

    const curIp = req ? getClientIp(req) : null;
    const transferText = isScenarioSticker ? sticker.name || '' : '';
    const extraParam = { type: 'sticker' };

    if (skipSave) {
      return {
        chatId: null,
        imageUrl: sticker.imageUrl,
        stickerId: sticker.id,
        scenario: sticker.scenario || null,
        isScenarioSticker: isScenarioSticker,
        transferText: transferText || undefined,
        stickerData: {
          appId: appId ?? null,
          curIp,
          userId,
          groupId: groupId ?? null,
          imageUrl: sticker.imageUrl,
          extraParam: JSON.stringify(extraParam),
          transferText,
          modelAvatar: sticker.modelAvatar || '',
        },
      };
    }

    const stickerLog = await this.chatLogService.saveChatLog({
      appId: appId ?? null,
      curIp,
      userId,
      type: 1,
      progress: '100%',
      model: 'sticker-generator',
      modelName: 'Sticker',
      role: 'assistant',
      groupId: groupId ?? null,
      status: 3,
      content: transferText,
      imageUrl: sticker.imageUrl,
      extraParam: JSON.stringify(extraParam),
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });

    return {
      chatId: stickerLog.id,
      imageUrl: sticker.imageUrl,
      stickerId: sticker.id,
      scenario: sticker.scenario || null,
      isScenarioSticker: isScenarioSticker,
      transferText: transferText || undefined,
    };
  }

  async checkIfScenarioStickerAlreadySent(
    userId: number,
    groupId: number | null,
    scenario: string,
    imageUrl: string,
  ): Promise<boolean> {
    if (!scenario) {
      return false;
    }

    try {
      const recentMessages = await this.chatLogService.queryChatLogByGroup({
        groupId: groupId,
        userId: userId,
        page: 1,
        pageSize: 10,
      });

      if (!recentMessages || recentMessages.length === 0) {
        return false;
      }

      for (const msg of recentMessages) {
        if (msg.content && typeof msg.content === 'string' && msg.content.includes('转账')) {
          Logger.debug(
            `[表情包去重] 最近10条消息中找到转账记录 - content="${msg.content}"`,
            'ChatService',
          );
          return true;
        }

        if (msg.imageUrl === imageUrl) {
          Logger.debug(`[表情包去重] 找到相同图片的表情包 - imageUrl=${imageUrl}`, 'ChatService');
          return true;
        }

        if (msg.extraParam) {
          try {
            const extra = JSON.parse(msg.extraParam);
            if (extra.transferText) {
              Logger.debug(
                `[表情包去重] 最近10条消息中找到转账记录 - transferText="${extra.transferText}"`,
                'ChatService',
              );
              return true;
            }
            if (extra.scenario === scenario) {
              Logger.debug(
                `[表情包去重] 找到相同场景的表情包 - scenario=${scenario}`,
                'ChatService',
              );
              return true;
            }
          } catch {}
        }
      }

      return false;
    } catch (error: any) {
      Logger.warn(`[表情包去重] 检查失败: ${error?.message || error}`, 'ChatService');
      return false;
    }
  }

  async checkIfNormalStickerAlreadySent(
    userId: number,
    groupId: number | null,
    scenario: string,
    imageUrl: string,
  ): Promise<boolean> {
    if (!scenario) {
      return false;
    }

    try {
      const recentMessages = await this.chatLogService.queryChatLogByGroup({
        groupId: groupId,
        userId: userId,
        page: 1,
        pageSize: 10,
      });

      if (!recentMessages || recentMessages.length === 0) {
        return false;
      }

      for (const msg of recentMessages) {
        if (msg.imageUrl === imageUrl) {
          Logger.debug(
            `[普通表情包去重] 找到相同图片的表情包 - imageUrl=${imageUrl}`,
            'ChatService',
          );
          return true;
        }

        if (msg.extraParam) {
          try {
            const extra = JSON.parse(msg.extraParam);
            if (
              extra.type === 'sticker' &&
              !extra.isScenarioSticker &&
              extra.scenario === scenario
            ) {
              Logger.debug(
                `[普通表情包去重] 找到相同场景的普通表情包 - scenario=${scenario}`,
                'ChatService',
              );
              return true;
            }
          } catch {}
        }
      }

      return false;
    } catch (error: any) {
      Logger.warn(`[普通表情包去重] 检查失败: ${error?.message || error}`, 'ChatService');
      return false;
    }
  }
}
