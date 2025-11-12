import {
  convertUrlToBase64,
  formatUrl,
  getClientIp,
  getTokenCount,
  removeThinkTags,
} from '@/common/utils';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request, Response } from 'express';
import { In, Repository } from 'typeorm';
import { AffectionService } from '../affection/affection.service';
import { OpenAIChatService } from '../aiTool/chat/chat.service';
import { AppEntity } from '../app/app.entity';
import { AppService } from '../app/app.service';
import { AppEmotionVoiceEntity } from '../app/appEmotionVoice.entity';
import { AppVoiceEntity } from '../app/appVoice.entity';
import { RoleEmotionEntity } from '../app/roleEmotion.entity';
import { AutoReplyService } from '../autoReply/autoReply.service';
import { BadWordsService } from '../badWords/badWords.service';
import { ChatGroupService } from '../chatGroup/chatGroup.service';
import { ChatLogService } from '../chatLog/chatLog.service';
import { ConversationSummaryService } from '../conversationSummary/conversationSummary.service';
import { GlobalConfigService } from '../globalConfig/globalConfig.service';
import { ModelsService } from '../models/models.service';
import { PluginEntity } from '../plugin/plugin.entity';
import { UploadService } from '../upload/upload.service';
import { StickerService } from '../sticker/sticker.service';
import { UserEntity } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { UserAppSettingsService } from '../userAppSettings/userAppSettings.service';
import { UserBalanceService } from '../userBalance/userBalance.service';
import { VoiceService } from '../voice/voice.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(AppEntity)
    private readonly appEntity: Repository<AppEntity>,
    @InjectRepository(AppVoiceEntity)
    private readonly appVoiceRepo: Repository<AppVoiceEntity>,
    @InjectRepository(PluginEntity)
    private readonly pluginEntity: Repository<PluginEntity>,
    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,
    private readonly openAIChatService: OpenAIChatService,
    private readonly chatLogService: ChatLogService,
    private readonly userBalanceService: UserBalanceService,
    private readonly userService: UserService,
    private readonly uploadService: UploadService,
    private readonly badWordsService: BadWordsService,
    private readonly autoReplyService: AutoReplyService,
    private readonly globalConfigService: GlobalConfigService,
    private readonly chatGroupService: ChatGroupService,
    private readonly modelsService: ModelsService,
    private readonly appService: AppService,
    private readonly voiceService: VoiceService,
    private readonly affectionService: AffectionService,
    private readonly userAppSettingsService: UserAppSettingsService,
    private readonly conversationSummaryService: ConversationSummaryService,
    private readonly stickerService: StickerService,
    @InjectRepository(AppEmotionVoiceEntity)
    private readonly appEmotionVoiceRepo: Repository<AppEmotionVoiceEntity>,
    @InjectRepository(RoleEmotionEntity)
    private readonly roleEmotionRepo: Repository<RoleEmotionEntity>,
  ) {}

  /**
   * 从文本中提取括号内的心理描述
   * 支持多种括号：()、（）、[]、【】、{}
   * 注：不包括「」和『』，因为它们主要用作引号
   */
  private extractPsychologicalDescription(text?: string | null): string | null {
    if (!text) return null;
    // 匹配各种括号内的内容
    const bracketPatterns = [
      /\(([^)]+)\)/g, // 英文圆括号
      /（([^）]+)）/g, // 中文圆括号
      /\[([^\]]+)\]/g, // 英文方括号
      /【([^】]+)】/g, // 中文方括号
      /\{([^}]+)\}/g, // 英文花括号
    ];

    const matches: string[] = [];
    for (const pattern of bracketPatterns) {
      const found = text.match(pattern);
      if (found) {
        // 提取括号内的内容（去除括号本身）
        found.forEach(match => {
          const content = match.replace(/^[(\（\[【\{]/, '').replace(/[)\）\]】\}]$/, '');
          if (content.trim()) {
            matches.push(content.trim());
          }
        });
      }
    }

    // 返回所有括号内容的组合，用空格分隔
    return matches.length > 0 ? matches.join(' ') : null;
  }

  /**
   * 移除文本中的括号及其内容
   * 用于TTS时只朗读实际对话内容
   * 注：不移除「」和『』，因为它们主要用作引号，移除后会破坏对话内容
   */
  removeBracketedContent(text?: string | null): string {
    if (!text) return '';
    let result = text;

    // 移除各种括号及其内容
    const bracketPatterns = [
      /\([^)]*\)/g, // 英文圆括号
      /（[^）]*）/g, // 中文圆括号
      /\[[^\]]*\]/g, // 英文方括号
      /【[^】]*】/g, // 中文方括号
      /\{[^}]*\}/g, // 英文花括号
    ];

    for (const pattern of bracketPatterns) {
      result = result.replace(pattern, '');
    }

    // 移除日文引号「」和『』本身，但保留其内容
    result = result.replace(/[「」『』]/g, '');

    // 清理多余的空格
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  /**
   * 为TTS优化文本内容，清理会导致朗读不顺畅的内容
   * 包括：Markdown语法、代码块、特殊符号、emoji等
   */
  cleanTextForTTS(text?: string | null): string {
    if (!text) return '';
    let result = text;

    // 1. 先移除括号内容（心理活动、动作描写等）
    result = this.removeBracketedContent(result);

    // 2. 清理Markdown语法
    // 2.1 移除代码块（三个反引号）
    result = result.replace(/```[\s\S]*?```/g, '');
    // 2.2 移除行内代码（单个反引号）
    result = result.replace(/`([^`]+)`/g, '$1');
    // 2.3 移除Markdown链接，保留链接文本
    result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // 2.4 移除图片语法
    result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
    // 2.5 移除粗体和斜体标记，保留文本内容
    result = result.replace(/(\*\*|__)(.*?)\1/g, '$2'); // 粗体
    result = result.replace(/(\*|_)(.*?)\1/g, '$2'); // 斜体
    // 2.6 移除删除线
    result = result.replace(/~~(.*?)~~/g, '$1');
    // 2.7 移除标题标记
    result = result.replace(/^#+\s+/gm, '');
    // 2.8 移除引用标记
    result = result.replace(/^>\s+/gm, '');
    // 2.9 移除水平分割线
    result = result.replace(/^([-*_]){3,}$/gm, '');

    // 3. 清理HTML标签（如果有）
    result = result.replace(/<[^>]+>/g, '');

    // 4. 清理特殊符号和emoji
    // 4.1 移除emoji（保留基本标点和中文字符）
    // Unicode emoji范围: U+1F300–U+1F9FF
    result = result.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
    // 其他emoji和符号范围
    result = result.replace(/[\u{2600}-\u{26FF}]/gu, ''); // 杂项符号
    result = result.replace(/[\u{2700}-\u{27BF}]/gu, ''); // 装饰符号
    result = result.replace(/[\u{1F000}-\u{1F02F}]/gu, ''); // 麻将牌
    result = result.replace(/[\u{1F0A0}-\u{1F0FF}]/gu, ''); // 扑克牌
    result = result.replace(/[\u{1F100}-\u{1F64F}]/gu, ''); // 符号和象形文字
    result = result.replace(/[\u{1F680}-\u{1F6FF}]/gu, ''); // 交通和地图符号
    result = result.replace(/[\u{1F900}-\u{1F9FF}]/gu, ''); // 补充符号和象形文字

    // 5. 规范化标点符号
    // 5.1 将多个连续的标点符号简化
    result = result.replace(/[!！]{2,}/g, '！'); // 多个感叹号
    result = result.replace(/[?？]{2,}/g, '？'); // 多个问号
    result = result.replace(/[.。]{2,}/g, '。'); // 多个句号
    result = result.replace(/[,，]{2,}/g, '，'); // 多个逗号
    result = result.replace(/[~～]{2,}/g, '～'); // 多个波浪号
    // 5.2 将英文标点统一为中文标点（可选，根据需要调整）
    // result = result.replace(/,/g, '，');
    // result = result.replace(/\./g, '。');
    // result = result.replace(/!/g, '！');
    // result = result.replace(/\?/g, '？');

    // 6. 清理特殊空白字符和控制字符
    result = result.replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // 控制字符
    result = result.replace(/\u200B/g, ''); // 零宽空格
    result = result.replace(/\uFEFF/g, ''); // BOM标记

    // 7. 清理多余的换行和空格
    result = result.replace(/\n{3,}/g, '\n\n'); // 最多保留两个连续换行
    result = result.replace(/\s+/g, ' '); // 将所有空白字符（包括换行）转为单个空格
    result = result.trim();

    // 8. 处理特殊情况：如果文本过短或为空，返回提示
    if (!result || result.length < 1) {
      return '';
    }

    return result;
  }

  /**
   * 将长文本按自然语句边界分割，用于流式TTS
   * 在句号、问号、感叹号等位置分割，确保朗读自然流畅
   * @param text 要分割的文本
   * @param maxChunkLength 每个片段的最大长度（可选，默认不限制）
   * @returns 分割后的句子数组
   */
  splitTextForTTS(text: string, maxChunkLength?: number): string[] {
    if (!text || text.trim().length === 0) return [];

    const chunks: string[] = [];

    // 主要句子分隔符（强停顿）
    const sentenceBreaks = /([。！？\.\!\?]+)/g;

    // 按主要标点符号分割
    const segments = text.split(sentenceBreaks);

    let currentChunk = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (!segment) continue;

      // 如果是标点符号，附加到当前块
      if (sentenceBreaks.test(segment)) {
        currentChunk += segment;

        // 到达句子边界，保存当前块
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
      } else {
        // 如果设置了最大长度限制，且当前段落过长
        if (maxChunkLength && segment.length > maxChunkLength) {
          // 在次要分隔符处分割（逗号、顿号等）
          const subSegments = segment.split(/([，,、；;])/);

          for (let j = 0; j < subSegments.length; j++) {
            const subSegment = subSegments[j];
            if (!subSegment) continue;

            // 如果加上这个子片段会超过最大长度，先保存当前块
            if (
              maxChunkLength &&
              currentChunk.length + subSegment.length > maxChunkLength &&
              currentChunk.trim()
            ) {
              chunks.push(currentChunk.trim());
              currentChunk = '';
            }

            currentChunk += subSegment;
          }
        } else {
          currentChunk += segment;
        }
      }
    }

    // 保存剩余的内容
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // 过滤掉空片段
    return chunks.filter(chunk => chunk && chunk.trim().length > 0);
  }

  private clampReplyCount(value?: number | null, fallback = 1): number {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return Math.max(1, Math.min(5, Math.floor(num)));
    }
    return Math.max(1, Math.min(5, Math.floor(fallback)));
  }

  private splitAssistantReplies(text?: string | null, maxReplies?: number | null): string[] {
    if (!text) return [];
    const normalizedMax = this.clampReplyCount(maxReplies ?? 1);
    const segments = text
      .split(/\n\s*\n+/g)
      .map(segment => segment.trim())
      .filter(segment => segment.length > 0);
    if (!segments.length) {
      return [text.trim()];
    }
    if (segments.length > normalizedMax) {
      return segments.slice(0, normalizedMax);
    }
    return segments;
  }

  private parseStickerIds(raw?: string | null): number[] {
    if (!raw) return [];
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(id => Number(id)).filter(num => Number.isFinite(num) && num > 0);
        }
      }
    } catch {
      // 如果不是有效的JSON，回退到逗号分隔解析
    }
    return trimmed
      .split(',')
      .map(id => Number(id.trim()))
      .filter(num => Number.isFinite(num) && num > 0);
  }

  private shouldSendSticker(probability?: number | null): boolean {
    const num = Number(probability);
    if (!Number.isFinite(num) || num <= 0) return false;
    const normalized = Math.max(0, Math.min(100, num));
    return Math.random() * 100 < normalized;
  }

  private buildAssistantLogBasePayload(context: {
    appId: number | null;
    action?: string | null;
    curIp?: string | null;
    userId: number;
    modelType?: number | null;
    model: string;
    modelName: string;
    groupId?: number | null;
    modelAvatar?: string | null;
    pluginParam?: string | null;
  }) {
    return {
      appId: context.appId,
      action: context.action ?? null,
      curIp: context.curIp ?? null,
      userId: context.userId,
      type: context.modelType ?? 1,
      progress: '100%',
      model: context.model,
      modelName: context.modelName,
      role: 'assistant',
      groupId: context.groupId ?? null,
      status: 3,
      modelAvatar: context.modelAvatar ?? '',
      pluginParam: context.pluginParam ?? null,
    };
  }

  private async saveAdditionalAssistantReplies(
    replies: string[],
    basePayload: Record<string, any>,
  ): Promise<Array<{ chatId: number; content: string }>> {
    const saved: Array<{ chatId: number; content: string }> = [];
    if (!replies?.length) {
      return saved;
    }
    for (const reply of replies) {
      if (!reply || !reply.trim()) continue;
      const extraLog = await this.chatLogService.saveChatLog({
        ...basePayload,
        content: reply,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
      saved.push({ chatId: extraLog.id, content: reply });
    }
    return saved;
  }

  private async maybeCreateStickerMessage(options: {
    allowEmoji: boolean;
    basePayload?: Record<string, any> | null;
  }): Promise<{ chatId: number; message: any } | null> {
    const { allowEmoji, basePayload } = options;
    if (!allowEmoji || !basePayload) {
      return null;
    }

    // TODO: 从表情包列表表获取可用的表情包
    // 这里需要根据实际的表情包列表表逻辑来实现
    // 暂时返回null，表示不发送表情包
    Logger.debug('[Sticker] 表情包功能需要对接专门的表情包列表', 'ChatService');
    return null;
  }

  /* 原有逻辑保留作为参考 - 已废弃
  private async maybeCreateStickerMessage_old(options: {
    allowEmoji: boolean;
    stickerIds?: string | null;
    stickerProbability?: number;
    basePayload?: Record<string, any> | null;
  }): Promise<{ chatId: number; message: any } | null> {
    const { allowEmoji, stickerIds, stickerProbability, basePayload } = options;
    if (!allowEmoji || !basePayload) {
      return null;
    }
    const parsedStickerIds = this.parseStickerIds(stickerIds);
    if (!parsedStickerIds.length) {
      return null;
    }
    if (!this.shouldSendSticker(stickerProbability ?? 30)) {
      return null;
    }
    const selectedId = parsedStickerIds[Math.floor(Math.random() * parsedStickerIds.length)];
    try {
      const sticker = await this.stickerService.detail(selectedId);
      if (!sticker?.imageUrl) {
        Logger.warn(`[Sticker] 选中的表情包缺少图片，id=${selectedId}`, 'ChatService');
        return null;
      }
      const extraParam = {
        type: 'sticker',
        stickerId: sticker.id,
        stickerName: sticker.name,
        emotion: sticker.emotion,
        tags: sticker.tags,
        scenario: sticker.scenario,
      };
      const stickerLog = await this.chatLogService.saveChatLog({
        ...basePayload,
        content: sticker.name || '',
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
          content: sticker.name || '',
          content_image: sticker.imageUrl,
          sticker_id: sticker.id,
          sticker_name: sticker.name,
        },
      };
    } catch (error: any) {
      Logger.warn(
        `[Sticker] 自动发送表情包失败: ${error?.message || error}`,
        'ChatService',
      );
      return null;
    }
  }
  */

  private async generateVoiceReplyForMessage(options: {
    text: string;
    chatId: number | null;
    appId: number | null;
    req: Request;
  }): Promise<{ ttsUrl: string; duration: number } | null> {
    const { text, chatId, appId, req } = options;
    try {
      const textToSpeak = this.cleanTextForTTS(text);
      if (!textToSpeak) {
        return null;
      }
      let selectedVoiceId: string | null = null;
      let finalEmotion: string | null = null;
      const emotionOptions = await this.getAppEmotionOptions(appId);
      const emotionPairs = await this.getAppEmotionPairs(appId);
      const psychologicalDesc = this.extractPsychologicalDescription(text);

      if (emotionOptions.length) {
        const chosen = await this.chooseEmotionFromOptions(psychologicalDesc, text, emotionOptions);
        if (chosen?.emotion) {
          finalEmotion = chosen.emotion;
          selectedVoiceId =
            emotionPairs.find(pair => pair.emotion === finalEmotion)?.voiceId || null;
        }
        if (!selectedVoiceId) {
          finalEmotion = await this.getAppDefaultEmotion(appId, emotionOptions);
          selectedVoiceId =
            emotionPairs.find(pair => pair.emotion === finalEmotion)?.voiceId || null;
        }
      }

      if (!selectedVoiceId && appId) {
        const defaultVoice = await this.appVoiceRepo.findOne({
          where: { appId: Number(appId), isDefault: 1 },
        });
        selectedVoiceId = defaultVoice?.voiceId || null;
      }

      if (!selectedVoiceId) {
        Logger.debug('[TTSService] 未找到可用音色，跳过语音回复', 'ChatService');
        return null;
      }

      const previewPayload: any = { voice_id: selectedVoiceId, text: textToSpeak };
      const ttsParams = this.mapEmotionToTtsParams(finalEmotion);
      if (ttsParams.rate !== undefined) previewPayload.rate = ttsParams.rate;
      if (ttsParams.pitch !== undefined) previewPayload.pitch = ttsParams.pitch;
      if (ttsParams.volume !== undefined) previewPayload.volume = ttsParams.volume;

      const { url, duration } = await this.voiceService.preview(previewPayload);
      const durationInt = Math.round(duration);

      try {
        const detailKeyInfo = await this.modelsService.getCurrentModelKeyInfo('tts-1');
        if (detailKeyInfo) {
          const { deduct, deductType } = detailKeyInfo;
          await this.userBalanceService.validateBalance(req, deductType, deduct);
          await this.userBalanceService.deductFromBalance(
            req.user.id,
            deductType,
            deduct,
            0,
            req.user.role,
          );
        } else {
          Logger.warn('[TTSService] 未找到tts-1模型配置，跳过扣费', 'ChatService');
        }
      } catch (chargeError: any) {
        Logger.warn(
          `[TTSService] 扣费失败或配置缺失，已跳过扣费: ${chargeError?.message || chargeError}`,
          'ChatService',
        );
      }

      if (chatId) {
        await this.chatLogService.updateChatLog(chatId, {
          ttsUrl: url,
          ttsDuration: durationInt,
        });
      }

      return { ttsUrl: url, duration: durationInt };
    } catch (error: any) {
      Logger.warn(`[TTSService] 自动语音生成失败: ${error?.message || error}`, 'ChatService');
      return null;
    }
  }

  // 将情绪映射为 TTS 合成参数（基于标准情绪名称）
  private mapEmotionToTtsParams(emotion?: string | null): {
    rate?: number;
    pitch?: number;
    volume?: number;
  } {
    if (!emotion) return {};
    const label = String(emotion).toLowerCase().trim();
    const table: Record<string, { rate?: number; pitch?: number; volume?: number }> = {
      happy: { rate: 1.08, pitch: 1.05, volume: 55 },
      energetic: { rate: 1.12, pitch: 1.05, volume: 58 },
      cute: { rate: 1.05, pitch: 1.1, volume: 52 },
      angry: { rate: 1.02, pitch: 0.98, volume: 60 },
      sad: { rate: 0.9, pitch: 0.95, volume: 48 },
      gentle: { rate: 0.93, pitch: 1.02, volume: 50 },
      serious: { rate: 0.96, pitch: 0.98, volume: 50 },
      narrative: { rate: 0.95, pitch: 1.0, volume: 50 },
      calm: { rate: 0.95, pitch: 1.0, volume: 49 },
      friendly: { rate: 1.0, pitch: 1.03, volume: 52 },
      cold: { rate: 0.98, pitch: 0.97, volume: 49 },
    };
    return table[label] || {};
  }

  // 应用情绪选项：仅取"本应用已绑定音色且启用"的情绪列表（直接使用数据库中的标准情绪名称）
  private async getAppEmotionOptions(appId: number | null): Promise<string[]> {
    if (!appId) return [];
    try {
      const rows = await this.appEmotionVoiceRepo.find({
        where: { appId: Number(appId), status: 1 },
      });
      const list = rows
        .filter(r => !!r.voiceId && !!r.emotion)
        .map(r => r.emotion.toLowerCase().trim())
        .filter(e => !!e);
      return Array.from(new Set(list));
    } catch {
      return [];
    }
  }

  // 应用情绪-音色对（仅启用且有voiceId，直接使用数据库中的标准情绪名称）
  private async getAppEmotionPairs(
    appId: number | null,
  ): Promise<Array<{ emotion: string; voiceId: string }>> {
    const pairs: Array<{ emotion: string; voiceId: string }> = [];
    if (!appId) return pairs;
    try {
      const rows = await this.appEmotionVoiceRepo.find({
        where: { appId: Number(appId), status: 1 },
      });
      for (const r of rows) {
        if (!r.voiceId || !r.emotion) continue;
        const emo = r.emotion.toLowerCase().trim();
        if (!emo) continue;
        // 若同一情绪重复，以第一条为准
        if (pairs.find(p => p.emotion === emo)) continue;
        pairs.push({ emotion: emo, voiceId: r.voiceId });
      }
    } catch {}
    return pairs;
  }

  // 应用默认情绪：优先"应用默认音色"所对应的情绪；否则读取 app 默认情绪配置；再回退 calm/首项
  private async getAppDefaultEmotion(appId: number | null, options: string[]): Promise<string> {
    if (appId) {
      try {
        const def = await this.appVoiceRepo.findOne({
          where: { appId: Number(appId), isDefault: 1 },
        });
        const defVoice = def?.voiceId || '';
        if (defVoice) {
          const rec = await this.appEmotionVoiceRepo.findOne({
            where: { appId: Number(appId), voiceId: defVoice, status: 1 },
          });
          const emo = rec?.emotion?.toLowerCase().trim() || '';
          if (emo && options.includes(emo)) return emo;
        }
      } catch {}
    }

    // 配置项默认情绪（仅限app级；必须在options中）
    try {
      const key = `defaultEmotion:app:${appId}`;
      const raw: any = await this.globalConfigService.getConfigs([key]);
      const val = typeof raw === 'string' ? raw : raw?.[key] || raw?.defaultEmotion;
      const emo = String(val || '')
        .toLowerCase()
        .trim();
      if (emo && options.includes(emo)) return emo;
    } catch {}

    if (options.includes('calm')) return 'calm';
    return options[0] || 'calm';
  }

  // 从选项中选择最匹配情绪：若 initial 在选项中则直接用，否则按关键词打分选择最高分
  /**
   * 使用AI识别情绪
   */
  private async detectEmotionByAI(
    text: string,
    options: string[],
    psychologicalDesc: string | null,
  ): Promise<string | null> {
    if (!text || !options || options.length === 0) return null;

    try {
      const dashscopeApiKey =
        (await this.globalConfigService.getConfigs(['dashscopeApiKey'])) ||
        process.env.DASHSCOPE_API_KEY;

      if (!dashscopeApiKey) {
        Logger.warn('[AI情绪识别] 未配置DashScope API Key，跳过AI识别', 'ChatService');
        return null;
      }

      const analysisText = psychologicalDesc
        ? `心理描述：${psychologicalDesc}\n对话内容：${text}`
        : text;

      Logger.debug(
        `[AI情绪识别] 开始分析 - 文本: ${text.substring(0, 50)}..., 候选数: ${options.length}`,
        'ChatService',
      );
      Logger.debug(`[AI情绪识别] 候选情绪: ${options.join(' | ')}`, 'ChatService');

      const numberedOptions = options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n');
      const prompt = `你是一个专业的语音情绪分析专家。请分析角色说话时的语气情绪，从给定的候选情绪中选择最合适的音色。

文本内容：
${analysisText}

候选情绪列表：
${numberedOptions}
0. 无合适情绪（如果候选列表中都不匹配）

重要说明：
- 你的任务是为角色的**说话内容**选择合适的音色
- 应该根据**对话内容的语气**来判断，而不是角色的内心情绪
- 如果文本包含"心理描述"和"对话内容"，请**只根据对话内容的语气**来判断说话时应该用什么音色
- 例如：角色内心紧张害羞，但说话时装作冷静，那么应该选择"冷静"而不是"紧张"
- 心理描述仅供参考背景，不应直接决定说话的音色

要求：
1. 仔细分析对话内容的语气，如果候选列表中有匹配的，返回对应的编号（如：1）或完整的情绪名称
2. 如果候选列表中的情绪都不合适，返回 0 或"无合适情绪"
3. 注意：有些情绪名称可能包含顿号（、），表示组合情绪，请完整匹配
4. 只返回编号或名称，不要任何解释

示例：
- 对话内容"太开心了！"，候选有"开心"，返回：1
- 对话内容"没关系的..."（内心生气，但说话时装作平静），候选有"平静、生气"，返回：1（平静）
- 对话内容"该死的混蛋！"，候选只有"开心、温柔"，返回：0

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
      Logger.debug(`[AI情绪识别] AI原始返回: "${result}"`, 'ChatService');

      // 检查是否为"无合适"
      if (
        result === '0' ||
        result.toLowerCase().includes('无合适') ||
        result.toLowerCase().includes('不合适') ||
        result.toLowerCase().includes('无匹配') ||
        result.toLowerCase().includes('none') ||
        result.toLowerCase().includes('no match')
      ) {
        Logger.debug(`[AI情绪识别] ⚠ AI判断候选中无合适情绪，将使用默认音色`, 'ChatService');
        return null;
      }

      // 尝试解析编号
      const numberMatch = result.match(/^(\d+)/);
      if (numberMatch) {
        const index = parseInt(numberMatch[1]) - 1;
        if (index >= 0 && index < options.length) {
          const matchedEmotion = options[index];
          Logger.debug(`[AI情绪识别] ✓ 通过编号匹配成功: ${matchedEmotion}`, 'ChatService');
          return matchedEmotion;
        }
      }

      // 尝试直接匹配名称
      for (const opt of options) {
        if (result.includes(opt)) {
          Logger.debug(`[AI情绪识别] ✓ 通过名称匹配成功: ${opt}`, 'ChatService');
          return opt;
        }
      }

      Logger.warn(
        `[AI情绪识别] ✗ 未能匹配 - AI返回: "${result}", 候选: [${options.join(' | ')}]`,
        'ChatService',
      );
      return null;
    } catch (error: any) {
      Logger.error(
        `[AI情绪识别] ✗ 调用失败: ${error?.message || error}`,
        error?.stack || '',
        'ChatService',
      );
      return null;
    }
  }

  /**
   * 公开方法：为语音通话识别情绪并选择音色
   * @param text 完整文本（包括括号）
   * @param appId 应用ID
   * @returns { emotion, voiceId } 或 null
   */
  async detectEmotionForVoiceCall(
    text: string,
    appId: number | null,
  ): Promise<{ emotion: string; voiceId: string; method: string } | null> {
    try {
      // 1. 提取心理描述
      const psychologicalDesc = this.extractPsychologicalDescription(text);
      if (psychologicalDesc) {
        Logger.debug(`[VoiceCall情绪识别] 提取到心理描述: ${psychologicalDesc}`, 'ChatService');
      }

      // 2. 获取应用的情绪选项和映射（使用原始情绪名称，不标准化）
      const options = await this.getAppEmotionOptionsRaw(appId);
      const pairs = await this.getAppEmotionPairsRaw(appId);

      Logger.debug(
        `[VoiceCall情绪识别] 应用情绪选项: ${options.join(', ') || '无'}`,
        'ChatService',
      );

      if (options.length === 0) {
        Logger.warn(`[VoiceCall情绪识别] 应用未配置情绪，使用默认`, 'ChatService');
        return null;
      }

      // 3. 使用AI从选项中选择情绪（不标准化）
      const chosen = await this.chooseEmotionFromOptionsRaw(psychologicalDesc, text, options);

      if (!chosen) {
        // 回退到默认情绪
        const fallback = await this.getAppDefaultEmotionRaw(appId, options);
        Logger.debug(`[VoiceCall情绪识别] 使用默认情绪: ${fallback}`, 'ChatService');
        const mappedVoice = pairs.find(p => p.emotion === fallback)?.voiceId;
        if (mappedVoice) {
          return { emotion: fallback, voiceId: mappedVoice, method: 'default' };
        }
        return null;
      }

      // 4. 从映射中获取音色
      const mappedVoice = pairs.find(p => p.emotion === chosen.emotion)?.voiceId;
      if (!mappedVoice) {
        Logger.warn(`[VoiceCall情绪识别] 情绪"${chosen.emotion}"未配置音色`, 'ChatService');
        return null;
      }

      Logger.debug(
        `[VoiceCall情绪识别] ✓ 识别成功: emotion=${chosen.emotion}, voiceId=${mappedVoice}, method=${chosen.method}`,
        'ChatService',
      );

      return {
        emotion: chosen.emotion,
        voiceId: mappedVoice,
        method: chosen.method,
      };
    } catch (error: any) {
      Logger.error(
        `[VoiceCall情绪识别] 识别失败: ${error?.message}`,
        error?.stack || '',
        'ChatService',
      );
      return null;
    }
  }

  // 获取应用情绪选项（原始版本，不标准化）- 用于语音通话
  private async getAppEmotionOptionsRaw(appId: number | null): Promise<string[]> {
    if (!appId) return [];
    try {
      const rows = await this.appEmotionVoiceRepo.find({
        where: { appId: Number(appId), status: 1 },
      });
      const list = rows
        .filter(r => !!r.voiceId && !!r.emotion)
        .map(r => r.emotion.trim())
        .filter(e => !!e);
      return Array.from(new Set(list));
    } catch {
      return [];
    }
  }

  // 获取应用情绪-音色对（原始版本，不标准化）- 用于语音通话
  private async getAppEmotionPairsRaw(
    appId: number | null,
  ): Promise<Array<{ emotion: string; voiceId: string }>> {
    const pairs: Array<{ emotion: string; voiceId: string }> = [];
    if (!appId) return pairs;
    try {
      const rows = await this.appEmotionVoiceRepo.find({
        where: { appId: Number(appId), status: 1 },
      });
      for (const r of rows) {
        if (!r.voiceId || !r.emotion) continue;
        const emo = r.emotion.trim();
        if (!emo) continue;
        // 若同一情绪重复，以第一条为准
        if (pairs.find(p => p.emotion === emo)) continue;
        pairs.push({ emotion: emo, voiceId: r.voiceId });
      }
    } catch {}
    return pairs;
  }

  // 获取应用默认情绪（原始版本，不标准化）- 用于语音通话
  private async getAppDefaultEmotionRaw(appId: number | null, options: string[]): Promise<string> {
    if (appId) {
      try {
        const def = await this.appVoiceRepo.findOne({
          where: { appId: Number(appId), isDefault: 1 },
        });
        const defVoice = def?.voiceId || '';
        if (defVoice) {
          const rec = await this.appEmotionVoiceRepo.findOne({
            where: { appId: Number(appId), voiceId: defVoice, status: 1 },
          });
          const emo = rec?.emotion?.trim() || '';
          if (emo && options.includes(emo)) return emo;
        }
      } catch {}
    }
    return options[0] || '默认';
  }

  // 使用AI从选项中选择情绪（原始版本，不标准化）- 用于语音通话
  private async chooseEmotionFromOptionsRaw(
    psychologicalDesc: string | null,
    fullText: string,
    options: string[],
  ): Promise<{ emotion: string; method: string } | null> {
    if (!options || options.length === 0) {
      Logger.warn(`[情绪选择Raw] 候选情绪列表为空`, 'ChatService');
      return null;
    }

    Logger.debug(`[情绪选择Raw] 开始AI识别 - 候选数: ${options.length}`, 'ChatService');

    // 使用AI识别
    try {
      const aiEmotion = await this.detectEmotionByAI(fullText, options, psychologicalDesc);

      if (aiEmotion && options.includes(aiEmotion)) {
        Logger.debug(`[情绪选择Raw] ✓ AI识别成功: ${aiEmotion}`, 'ChatService');
        return { emotion: aiEmotion, method: 'ai' };
      } else if (aiEmotion) {
        Logger.warn(`[情绪选择Raw] AI返回的情绪"${aiEmotion}"不在候选列表中`, 'ChatService');
      }
    } catch (error: any) {
      Logger.error(`[情绪选择Raw] AI识别异常: ${error?.message}`, 'ChatService');
    }

    return null;
  }

  /**
   * 使用AI从候选情绪列表中选择最合适的情绪
   */
  private async chooseEmotionFromOptions(
    psychologicalDesc: string | null,
    fullText: string,
    options: string[],
  ): Promise<{ emotion: string; method: string } | null> {
    if (!options || options.length === 0) {
      Logger.warn(`[情绪选择] 候选情绪列表为空`, 'ChatService');
      return null;
    }

    Logger.debug(`[情绪选择] 开始AI识别 - 候选数: ${options.length}`, 'ChatService');

    // 使用AI识别
    try {
      const aiEmotion = await this.detectEmotionByAI(fullText, options, psychologicalDesc);

      if (aiEmotion && options.includes(aiEmotion)) {
        Logger.debug(`[情绪选择] ✓ AI识别成功: ${aiEmotion}`, 'ChatService');
        return { emotion: aiEmotion, method: 'ai' };
      } else if (aiEmotion) {
        Logger.warn(
          `[情绪选择] AI返回的情绪"${aiEmotion}"不在候选列表中，将使用默认情绪`,
          'ChatService',
        );
        return null;
      } else {
        Logger.debug(`[情绪选择] ⚠ AI判断候选中无合适情绪，将使用默认音色`, 'ChatService');
        return null;
      }
    } catch (error: any) {
      Logger.error(`[情绪选择] AI识别异常: ${error?.message}，将使用默认情绪`, 'ChatService');
      return null;
    }
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 使用通义千问识别图片内容
   */
  private async recognizeImageWithQwen(imageUrl: string): Promise<string | null> {
    try {
      const dashscopeApiKey =
        (await this.globalConfigService.getConfigs(['dashscopeApiKey'])) ||
        process.env.DASHSCOPE_API_KEY;

      if (!dashscopeApiKey) {
        Logger.warn('[图片识别] 未配置通义千问API Key，跳过图片识别', 'ChatService');
        return null;
      }

      Logger.debug(`[图片识别] 开始识别图片: ${imageUrl}`, 'ChatService');

      const axios = require('axios');
      const response = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
        {
          model: 'qwen-vl-plus',
          input: {
            messages: [
              {
                role: 'user',
                content: [
                  {
                    image: imageUrl,
                  },
                  {
                    text: '请详细描述这张图片的内容，包括图片中的物体、场景、人物、文字等信息。',
                  },
                ],
              },
            ],
          },
          parameters: {},
        },
        {
          headers: {
            Authorization: `Bearer ${dashscopeApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const result = response.data?.output?.choices?.[0]?.message?.content?.[0]?.text || '';
      Logger.debug(`[图片识别] 识别结果: ${result}`, 'ChatService');

      return result || null;
    } catch (error: any) {
      Logger.error(
        `[图片识别] 识别失败: ${error?.message || error}`,
        error?.stack || '',
        'ChatService',
      );
      return null;
    }
  }

  async chatProcess(body: any, req?: Request, res?: Response) {
    await this.userBalanceService.checkUserCertification(req.user.id);
    /* 获取对话参数 */
    let {
      options = {},
      usingPluginId,
      prompt,
      fileUrl,
      imageUrl,
      extraParam,
      model,
      action,
      modelName,
      modelAvatar,
    } = body;

    Logger.debug(`body: ${JSON.stringify(body)}`, 'ChatService');

    // 图片识别逻辑：当用户只发送图片时，先调用通义千问识别图片
    if (imageUrl && (!prompt || prompt.trim().length === 0)) {
      Logger.debug('[图片识别] 检测到用户只发送图片，开始识别...', 'ChatService');
      const imageDescription = await this.recognizeImageWithQwen(imageUrl);
      if (imageDescription) {
        prompt = `[这是一张图片，内容如下]\n${imageDescription}\n\n请根据图片内容进行回复。`;
        Logger.debug(`[图片识别] 已将识别结果设置为prompt: ${prompt}`, 'ChatService');
      } else {
        Logger.warn('[图片识别] 图片识别失败，使用默认提示', 'ChatService');
        prompt = '请看这张图片，这是什么？';
      }
    }

    // 解析 appId：优先使用 body.appId；若缺失且存在 groupId，则尝试从群组信息推断
    let appId = body?.appId ?? null;
    Logger.debug(
      `[好感度调试] 初始 appId=${appId}, body.appId=${body?.appId}, groupId=${
        (options as any)?.groupId
      }`,
      'ChatService',
    );
    if (!appId && (options as any)?.groupId) {
      try {
        const groupInfo = await this.chatGroupService.getGroupInfoFromId((options as any).groupId);
        const gAppId = Number(groupInfo?.appId || 0);
        if (gAppId > 0) {
          appId = gAppId;
          Logger.debug(`从 groupId=${(options as any).groupId} 推断 appId=${appId}`, 'ChatService');
        }
      } catch (e: any) {
        Logger.warn(`无法从群组推断 appId: ${e?.message || e}`, 'ChatService');
      }
    }
    Logger.debug(`[好感度调试] 最终 appId=${appId}`, 'ChatService');

    // 获取应用信息
    let appInfo;
    if (appId) {
      Logger.debug(`正在使用应用ID: ${appId}`);
      appInfo = await this.appEntity.findOne({
        where: { id: appId, status: In([1, 3, 4, 5]) },
      });

      if (!appInfo) {
        throw new HttpException(
          '你当前使用的应用已被下架、请删除当前对话开启新的对话吧！',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 检查应用是否为会员专属
      const isAppMemberOnly = await this.appService.checkAppIsMemberOnly(Number(appId));
      if (isAppMemberOnly) {
        Logger.debug(`检测到会员专属应用: ${isAppMemberOnly}`);
        const userCatIds = await this.userBalanceService.getUserApps(req.user.id);
        Logger.debug(`用户权限分类: ${userCatIds.join(',')}`);

        // 获取应用所属的分类ID列表
        const appCatIds = appInfo.catId.split(',').map(id => id.trim());
        Logger.debug(`应用所属分类: ${appCatIds.join(',')}`);

        const hasMatchingCategory = appCatIds.some(catId => userCatIds.includes(catId));

        if (!hasMatchingCategory) {
          throw new HttpException(
            '你当前使用的应用为会员专属应用，请先开通会员！',
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
      }
    }

    const { groupId, usingNetwork, usingDeepThinking, usingMcpTool, isFirstMember } = options || {};

    // 判断是否为真正的群聊模式（需要检查 isGroupChat 字段）
    let isGroupChat = false;
    if (groupId) {
      try {
        const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
        isGroupChat =
          groupInfo?.isGroupChat === true || (groupInfo?.isGroupChat as any) === 1 || false;
        Logger.debug(
          `[好感度调试] groupId=${groupId}, groupInfo.isGroupChat=${groupInfo?.isGroupChat}, 最终isGroupChat=${isGroupChat}`,
          'ChatService',
        );
      } catch (error) {
        Logger.warn(`获取群组信息失败: ${error.message}，默认为单聊模式`, 'ChatService');
        isGroupChat = false;
      }
    }

    // 提前获取真实用户名称（用于后续替换任务信息中的"我"）
    let realUserName = modelName || '用户';
    if (isGroupChat && groupId && !modelName) {
      try {
        const user = await this.userEntity.findOne({ where: { id: req.user.id } });
        if (user) {
          realUserName = user.username || user.nickname || `用户${user.id}`;
        }
        Logger.debug(`[用户名称] 真实用户名称: ${realUserName}`, 'ChatService');
      } catch (error) {
        Logger.debug(`获取真实用户名称失败: ${error.message}`, 'ChatService');
      }
    } else if (modelName) {
      Logger.debug(`[用户名称] 使用传入的用户名称: ${realUserName}`, 'ChatService');
    }

    const {
      openaiBaseUrl,
      openaiBaseKey,
      systemPreMessage,
      openaiTemperature,
      openaiBaseModel,
      isGeneratePromptReference,
      isConvertToBase64,
      isSensitiveWordFilter,
    } = await this.globalConfigService.getConfigs([
      'openaiBaseUrl',
      'openaiBaseKey',
      'systemPreMessage',
      'openaiTemperature',
      'openaiBaseModel',
      'isGeneratePromptReference',
      'isConvertToBase64',
      'isSensitiveWordFilter',
    ]);

    /* 检测用户状态 */
    await this.userService.checkUserStatus(req.user);

    /* 敏感词检测 */
    res && res.setHeader('Content-type', 'application/octet-stream; charset=utf-8');
    // 检查敏感词汇
    if (isSensitiveWordFilter === '1') {
      const triggeredWords = await this.badWordsService.checkBadWords(prompt, req.user.id);
      if (triggeredWords.length > 0) {
        // 如果返回的数组不为空
        const tips = `您提交的信息中包含违规的内容，我们已对您的账户进行标记，请合规使用！`;
        throw new HttpException(tips, HttpStatus.BAD_REQUEST);
      }
    }

    /* 自动回复 */
    const autoReplyRes = await this.autoReplyService.checkAutoReply(prompt);
    Logger.debug(`自动回复检查结果: ${JSON.stringify(autoReplyRes)}`, 'ChatService');

    /* 设置对话变量 */
    let currentRequestModelKey = null;
    let appName = '';
    let setSystemMessage = '';
    res && res.status(200);
    const curIp = getClientIp(req);
    let useModelAvatar = '';
    let usingPlugin;

    if (usingPluginId) {
      Logger.debug(`使用插件ID: ${usingPluginId}`, 'ChatService');
      if (usingPluginId === 999) {
        usingPlugin = {
          parameters: 'mermaid',
        };
      }
    }

    /* 获取模型配置及预设设置 */
    if (appInfo) {
      const { isGPTs, gizmoID, name, isFixedModel, appModel, coverImg } = appInfo;
      useModelAvatar = coverImg;
      appName = name;
      if (isGPTs) {
        currentRequestModelKey = await this.modelsService.getCurrentModelKeyInfo('gpts');
        currentRequestModelKey.model = `gpt-4-gizmo-${gizmoID}`;
      } else if (!isGPTs && isFixedModel && appModel) {
        appInfo.preset && (setSystemMessage = appInfo.preset);
        currentRequestModelKey = await this.modelsService.getCurrentModelKeyInfo(appModel);
        currentRequestModelKey.model = appModel;
        Logger.debug(`使用固定模型和应用预设`, 'ChatService');
      } else {
        // 使用应用预设
        appInfo.preset && (setSystemMessage = appInfo.preset);
        currentRequestModelKey = await this.modelsService.getCurrentModelKeyInfo(model);
        Logger.debug(`使用应用预设模式`, 'ChatService');
      }

      // 将当前角色的任务信息添加到预设中（支持群聊和单聊）
      if (groupId && appId) {
        try {
          const groupInfo: any = await this.chatGroupService.getGroupInfoFromId(groupId);
          const members = JSON.parse(groupInfo?.members || '[]') || [];

          Logger.debug(
            `[角色任务] 尝试获取任务信息，isGroupChat=${isGroupChat}, groupId=${groupId}, appId=${appId}, members数量=${members.length}`,
            'ChatService',
          );

          const currentMember = members.find((m: any) => Number(m.appId) === Number(appId));

          if (currentMember) {
            Logger.debug(
              `[角色任务] 找到当前成员，appId=${appId}, taskDetail=${
                currentMember.taskDetail
              }, tasks=${JSON.stringify(currentMember.tasks)}`,
              'ChatService',
            );

            let taskTitle = '';
            let taskStatus = 'todo';

            // 支持两种格式：1. taskDetail字段 2. tasks数组
            if (currentMember.taskDetail && currentMember.taskDetail.trim()) {
              // 如果有taskDetail字段，直接使用
              taskTitle = currentMember.taskDetail.trim();
              Logger.debug(`[角色任务] 从taskDetail获取任务: ${taskTitle}`, 'ChatService');
            } else if (Array.isArray(currentMember.tasks) && currentMember.tasks.length > 0) {
              // 如果有tasks数组，找第一个未完成的任务
              const pendingTask = currentMember.tasks.find(
                (t: any) => (t?.status || 'todo') !== 'done',
              );
              if (pendingTask) {
                taskTitle = pendingTask.title || '';
                taskStatus = pendingTask.status || 'todo';
                Logger.debug(`[角色任务] 从tasks数组获取任务: ${taskTitle}`, 'ChatService');
              }
            }

            if (taskTitle) {
              // 将任务标题中的"我"替换为用户名
              if (realUserName && realUserName !== '用户' && realUserName !== '我') {
                taskTitle = taskTitle.replace(
                  /(?<![^\s，。！？；：、])我(?![^\s，。！？；：、])/g,
                  realUserName,
                );
              }

              const taskInfo = `\n\n【你的当前任务】\n任务：${taskTitle}\n状态：${taskStatus}\n请在对话中围绕这个任务进行回应。`;
              setSystemMessage = setSystemMessage + taskInfo;
              Logger.debug(
                `[角色任务] 已将角色任务添加到预设中，appId=${appId}, 任务="${taskTitle}"`,
                'ChatService',
              );
            } else {
              Logger.debug(`[角色任务] 当前成员没有任务信息`, 'ChatService');
            }
          } else {
            Logger.debug(`[角色任务] 未找到appId=${appId}的成员`, 'ChatService');
          }
        } catch (error) {
          Logger.warn(`[角色任务] 获取角色任务失败: ${error.message}`, 'ChatService');
        }
      } else {
        Logger.debug(`[角色任务] 跳过任务获取，groupId=${groupId}, appId=${appId}`, 'ChatService');
      }
    } else {
      if (usingPlugin?.parameters === 'mermaid') {
        setSystemMessage = `
{
"title": "Mermaid专业图表大师",
"description": "智能多类型Mermaid图表生成专家",

## 角色定位
你是一位精通Mermaid语法的专业图表设计师，具备将复杂信息转化为清晰可视化图表的卓越能力。你不仅掌握所有Mermaid图表类型，还能根据用户需求智能选择最优图表方案。

## 核心能力矩阵

### 流程与逻辑类
- **流程图(flowchart)**: 展示流程、决策和系统工作流
- **时序图(sequenceDiagram)**: 描述对象间的交互顺序
- **状态图(stateDiagram)**: 展示状态转换和生命周期
- **用户旅程图(journey)**: 可视化用户体验历程

### 结构与关系类
- **类图(classDiagram)**: UML类结构和继承关系
- **实体关系图(erDiagram)**: 数据库实体关系建模
- **C4图(C4Context等)**: 软件架构多层次视图
- **思维导图(mindmap)**: 思维结构和概念关联

### 时间与进度类
- **甘特图(gantt)**: 项目进度和时间规划
- **时间线图(timeline)**: 历史事件和里程碑
- **Gitgraph图(gitGraph)**: Git版本控制历史

### 数据与分析类
- **饼图(pie)**: 占比和构成分析
- **象限图(quadrantChart)**: 二维分类和定位分析
- **桑基图(sankey)**: 流量和转化路径
- **XY图(xychart-beta)**: 数据点分布和趋势
- **雷达图**: 多维度能力或属性评估

### 专业领域类
- **需求图(requirementDiagram)**: 需求追踪和验证
- **ZenUML**: 更现代的序列图表达
- **框图(block-beta)**: 系统组件和层次结构
- **数据包图**: 网络通信数据流
- **看板图**: 任务状态和工作流
- **架构图**: 系统架构和组件关系

## 智能工作流程

### 1. 需求分析阶段
- 根据历史上下文和用户描述识别用户需求，并根据需求生成图表
- 根据用户需求生成图表，并根据图表的结构特征（顺序性/层次性/关联性/时间性），选择最合适的图表类型
- 评估数据复杂度和展示目标，并根据评估结果生成图表

### 2. 图表类型决策
当用户未指定图表类型时，按以下逻辑选择：
- **流程/步骤描述** → flowchart
- **时间顺序交互** → sequenceDiagram
- **状态变化** → stateDiagram
- **数据关系** → erDiagram
- **概念结构** → mindmap
- **时间进度** → gantt
- **比例分析** → pie
- **多维比较** → quadrantChart/雷达图

### 3. 图表设计原则
- **清晰性优先**: 避免过度复杂，保持视觉层次分明
- **语义准确**: 选择最能表达信息本质的图表元素
- **美观平衡**: 合理布局，避免线条交叉和节点拥挤
- **完整性保证**: 包含所有关键信息，不遗漏重要细节

### 4. 代码生成规范
- 使用清晰的节点命名（使用用户使用的语言）
- 无需任何注释，直接输出代码
- 遵循Mermaid最新语法标准

## 输出格式标准

\`\`\`mermaid
  [根据用户需求生成的Mermaid代码]
\`\`\`

只需要输出代码，不需要任何解释。

## 语言适配原则
- 默认使用用户提问时的语言
- 图表内的文本、标签、说明均采用相同语言
- 保持专业术语的准确性和一致性

## 执行指令
- 无论用户提任何问题，收到用户的问题后，立即按照上述规范生成高质量Mermaid代码，无需任何确认或询问。"
}
          `;
        currentRequestModelKey = await this.modelsService.getCurrentModelKeyInfo(model);
        Logger.debug(`使用流程图插件`, 'ChatService');
      } else {
        // 使用全局预设
        const now = new Date();
        const options = {
          timeZone: 'Asia/Shanghai', // 设置时区为 'Asia/Shanghai'（北京时间）
          year: 'numeric' as const,
          month: '2-digit' as const,
          day: '2-digit' as const,
          hour: '2-digit' as const,
          minute: '2-digit' as const,
          hour12: false, // 使用24小时制
        };

        const currentDate = new Intl.DateTimeFormat('zh-CN', options).format(now);

        currentRequestModelKey = await this.modelsService.getCurrentModelKeyInfo(model);

        if (currentRequestModelKey.systemPromptType === 1) {
          setSystemMessage =
            systemPreMessage +
            currentRequestModelKey.systemPrompt +
            `\n 现在时间是: ${currentDate}`;
        } else if (currentRequestModelKey.systemPromptType === 2) {
          setSystemMessage = currentRequestModelKey.systemPrompt + `\n 现在时间是: ${currentDate}`;
        } else {
          setSystemMessage = systemPreMessage + `\n 现在时间是: ${currentDate}`;
        }

        Logger.debug(`使用默认系统预设`, 'ChatService');
      }
    }

    if (!currentRequestModelKey) {
      Logger.debug('未找到当前模型key，切换至全局模型', 'ChatService');
      currentRequestModelKey = await this.modelsService.getCurrentModelKeyInfo(openaiBaseModel);
      const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);

      // 假设 groupInfo.config 是 JSON 字符串，并且你需要替换其中的 modelName 和 model
      let updatedConfig = groupInfo.config;
      try {
        const parsedConfig = JSON.parse(groupInfo.config);
        if (parsedConfig.modelInfo) {
          parsedConfig.modelInfo.modelName = currentRequestModelKey.modelName; // 替换为你需要的模型名称
          parsedConfig.modelInfo.model = currentRequestModelKey.model; // 替换为你需要的模型
          updatedConfig = JSON.stringify(parsedConfig);
        }
      } catch (error) {
        Logger.error('模型配置解析失败', error);
        throw new HttpException('配置解析错误！', HttpStatus.BAD_REQUEST);
      }

      await this.chatGroupService.update(
        {
          groupId,
          title: groupInfo.title,
          isSticky: false,
          config: updatedConfig,
          fileUrl: fileUrl,
        },
        req,
      );
    }

    const {
      deduct,
      isTokenBased,
      tokenFeeRatio,
      deductType,
      key,
      id: keyId,
      maxRounds,
      proxyUrl,
      maxModelTokens,
      max_tokens,
      timeout,
      model: useModel,
      isFileUpload,
      isImageUpload,
      keyType: modelType,
      deductDeepThink = 1,
      isMcpTool,
      deepThinkingType,
      drawingType,
    } = currentRequestModelKey;

    // 群聊模式：跳过所有限制检查
    if (!isGroupChat) {
      // 非群聊模式：执行正常的限制检查
      if (await this.chatLogService.checkModelLimits(req.user, useModel)) {
        res.write(
          `\n${JSON.stringify({
            status: 3,
            content: '1 小时内对话次数过多，请切换模型或稍后再试！',
            modelType: modelType,
          })}`,
        );
        res.end();
        return;
      }

      // 检测用户余额
      await this.userBalanceService.validateBalance(
        req,
        deductType,
        deduct * (usingDeepThinking ? deductDeepThink : 1),
      );
    } else {
      Logger.debug(`群聊模式：跳过模型限制和余额检查`, 'ChatService');
    }

    // 整理对话参数
    // 如果有 appId 和 appInfo，但没有传入 modelName，则使用角色名称
    let useModeName = modelName;
    if (appId && appInfo && !modelName) {
      useModeName = appInfo.name;
      Logger.debug(`[模型名称] 从 appId=${appId} 获取角色名称: ${useModeName}`, 'ChatService');
    }
    const proxyResUrl = formatUrl(proxyUrl || openaiBaseUrl || 'https://api.openai.com');

    const modelKey = key || openaiBaseKey;
    const modelTimeout = (timeout || 300) * 1000;
    const temperature = Number(openaiTemperature) || 1;
    let promptReference = '';

    if (groupId) {
      const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
      this.updateChatTitle(groupId, groupInfo, modelType, prompt, req); // Call without await
      await this.chatGroupService.updateTime(groupId);
    }

    // 图片识别处理：如果模型不支持图片（isImageUpload === 0）且有图片，先识别图片内容
    // 先检查prompt中是否已经包含了图片识别结果（避免重复识别）
    const hasImageRecognitionResult =
      prompt && (prompt.includes('[这是一张图片，内容如下]') || prompt.includes('[图片内容:'));

    if (imageUrl && isImageUpload === 0 && !hasImageRecognitionResult) {
      Logger.debug('[图片识别] 模型不支持图片，开始识别...', 'ChatService');
      try {
        // 使用通义千问识别图片（识别第一张图片）
        const firstImageUrl = imageUrl.split(',')[0].trim();
        const imageDescription = await this.recognizeImageWithQwen(firstImageUrl);

        const hasUserText = prompt && prompt.trim().length > 0;

        if (imageDescription) {
          // 将识别结果添加到 prompt 中
          if (hasUserText) {
            // 有用户文字：图片内容 + 用户文字
            prompt = `[图片内容: ${imageDescription}]\n${prompt}`;
          } else {
            // 纯图片：图片内容 + 默认提示
            prompt = `[图片内容: ${imageDescription}]\n请根据图片内容进行回复`;
          }
          Logger.debug(
            `[图片识别] 识别成功，描述: ${imageDescription.substring(0, 50)}...`,
            'ChatService',
          );
        } else {
          Logger.warn('[图片识别] 识别失败', 'ChatService');
          if (hasUserText) {
            // 有用户文字：占位符 + 用户文字
            prompt = `[用户发送了一张图片]\n${prompt}`;
          } else {
            // 纯图片：占位符 + 默认提示
            prompt = `[用户发送了一张图片]\n请根据图片内容进行回复`;
          }
        }
      } catch (error) {
        Logger.error(`[图片识别] 识别出错: ${error.message}`, 'ChatService');
        const hasUserText = prompt && prompt.trim().length > 0;
        if (hasUserText) {
          prompt = `[用户发送了一张图片]\n${prompt}`;
        } else {
          prompt = `[用户发送了一张图片]\n请根据图片内容进行回复`;
        }
      }
    } else if (hasImageRecognitionResult) {
      Logger.debug('[图片识别] 检测到prompt中已包含图片识别结果，跳过重复识别', 'ChatService');
    }

    // 群聊模式下，检查是否已经保存过用户消息（避免重复保存）
    let userSaveLog;
    let userLogId;

    // 跳过用户消息保存：当 skipPromptInHistory 为 true 时不保存用户消息
    const skipPromptInHistory = options?.skipPromptInHistory === true;
    // 跳过保存到数据库模式：不保存但会添加到上下文
    const skipSave = options?.skipSaveToDatabase === true;

    if (isGroupChat && groupId && !skipPromptInHistory && !skipSave) {
      // 关键修复：只在第一个成员（isFirstMember=true）时才保存/查询用户消息
      if (isFirstMember) {
        // 查询最近10秒内是否有相同的用户消息
        const existingUserLog = await this.chatLogService.findRecentUserLogInGroup(
          groupId,
          prompt,
          10,
        );

        if (existingUserLog) {
          // 使用已存在的用户消息
          userLogId = existingUserLog.id;
          userSaveLog = existingUserLog;
          Logger.debug(
            `[群聊] 使用已存在的用户消息，id=${userLogId}, appId=${appId}`,
            'ChatService',
          );
        } else {
          // 第一次保存用户消息
          userSaveLog = await this.chatLogService.saveChatLog({
            appId: appId,
            curIp,
            userId: req.user.id,
            type: modelType ? modelType : 1,
            fileUrl: fileUrl ? fileUrl : null,
            imageUrl: imageUrl ? imageUrl : null,
            content: prompt,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            model: useModel,
            modelName: realUserName,
            role: 'user',
            groupId: groupId ? groupId : null,
          });
          userLogId = userSaveLog.id;
          Logger.debug(`[群聊] 保存新的用户消息，id=${userLogId}, appId=${appId}`, 'ChatService');
        }
      } else {
        // 非第一个成员，查询已保存的用户消息（应该由第一个成员保存了）
        const existingUserLog = await this.chatLogService.findRecentUserLogInGroup(
          groupId,
          prompt,
          30, // 扩大时间窗口到30秒，确保能找到第一个成员保存的消息
        );

        if (existingUserLog) {
          userLogId = existingUserLog.id;
          userSaveLog = existingUserLog;
          Logger.debug(
            `[群聊] 非第一成员，复用已有用户消息，id=${userLogId}, appId=${appId}`,
            'ChatService',
          );
        } else {
          // 理论上不应该走到这里，如果走到了说明第一个成员还没保存完
          Logger.warn(
            `[群聊] 非第一成员但未找到已有用户消息，可能是并发问题，appId=${appId}`,
            'ChatService',
          );

          // 多次重试，增加等待时间
          let foundUserLog = null;
          const maxRetries = 5;
          const retryDelay = 1000; // 1秒

          for (let i = 0; i < maxRetries; i++) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            foundUserLog = await this.chatLogService.findRecentUserLogInGroup(
              groupId,
              prompt,
              60, // 扩大时间窗口到60秒
            );
            if (foundUserLog) {
              Logger.debug(
                `[群聊] 第${i + 1}次重试后找到用户消息，id=${foundUserLog.id}`,
                'ChatService',
              );
              break;
            }
          }

          if (foundUserLog) {
            userLogId = foundUserLog.id;
            userSaveLog = foundUserLog;
          } else {
            // 多次重试后仍未找到，跳过用户消息（避免重复保存）
            Logger.error(
              `[群聊] 非第一成员经过${maxRetries}次重试后仍未找到用户消息，跳过用户消息保存，appId=${appId}`,
              'ChatService',
            );
            userLogId = null;
            userSaveLog = null;
          }
        }
      }
    } else if (!isGroupChat && !skipPromptInHistory && !skipSave) {
      // 普通模式，正常保存（skipPromptInHistory 和 skipSave 模式不保存）
      // 使用从body传来的modelName，如果没有则使用'我'
      const userDisplayName = modelName || '我';
      userSaveLog = await this.chatLogService.saveChatLog({
        appId: appId,
        curIp,
        userId: req.user.id,
        type: modelType ? modelType : 1,
        fileUrl: fileUrl ? fileUrl : null,
        imageUrl: imageUrl ? imageUrl : null,
        content: prompt,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: useModel,
        modelName: userDisplayName,
        role: 'user',
        groupId: groupId ? groupId : null,
      });
      userLogId = userSaveLog.id;
      Logger.debug(`[普通模式] 保存用户消息，modelName=${userDisplayName}`, 'ChatService');
    } else if (skipPromptInHistory) {
      // skipPromptInHistory 模式：不保存用户消息
      Logger.debug(
        `[skipPromptInHistory] 跳过用户消息保存，skipPromptInHistory=true`,
        'ChatService',
      );
      userLogId = null;
    } else if (skipSave) {
      // 跳过保存模式：不保存用户消息到数据库，但会添加到上下文
      Logger.debug(`[跳过保存] skipSaveToDatabase=true，不保存用户消息到数据库`, 'ChatService');
      userLogId = null;
    }

    // 群聊模式：根据appId设置助手消息的name字段
    let assistantName = useModeName;
    if (groupId && appId) {
      try {
        const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
        if (groupInfo?.members) {
          const members = JSON.parse(groupInfo.members);
          const currentMember = members.find(m => m.appId === appId || m.userId === appId);
          if (currentMember) {
            assistantName =
              currentMember.appName ||
              currentMember.name ||
              (appInfo ? appInfo.name : null) ||
              `应用${currentMember.appId || currentMember.userId}`;
          }
        }
      } catch (error) {
        Logger.debug(`获取群聊助手名称失败: ${error.message}`, 'ChatService');
      }
    }

    // 检查是否需要插入开场白（群聊模式下，检查每个角色的开场白状态）
    if (groupId && appId) {
      try {
        // 查询该角色在该群组中是否已有助手消息
        const assistantCountForApp = await this.chatLogService.getAssistantChatLogsCountByAppId(
          groupId,
          appId,
        );

        if (assistantCountForApp === 0) {
          // 该角色第一次发言，尝试获取该角色的开场白
          let openingRemark: string | null = null;

          // 从群组成员数据中获取该角色的开场白
          const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
          if (groupInfo?.members) {
            try {
              const members = JSON.parse(groupInfo.members);
              const currentMember = members.find(m => m.appId === appId || m.userId === appId);
              if (currentMember?.openingRemark) {
                openingRemark = currentMember.openingRemark;
              }
            } catch (error) {
              Logger.debug(`解析成员数据失败: ${error.message}`, 'ChatService');
            }
          }

          // 如果成员数据中没有开场白，且有 appId，则从应用信息中获取
          if (!openingRemark && appId) {
            const appInfo = await this.appEntity.findOne({ where: { id: appId } });
            if (appInfo?.openingRemark) {
              openingRemark = appInfo.openingRemark;
            }
          }

          // 如果有开场白，保存为该角色的第一条助手消息
          if (openingRemark) {
            await this.chatLogService.saveChatLog({
              appId: appId,
              curIp,
              userId: req.user.id,
              type: modelType ? modelType : 1,
              model: useModel,
              modelName: assistantName,
              role: 'assistant',
              groupId: groupId,
              content: openingRemark,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              status: 3, // 已完成
              modelAvatar: usingPlugin?.pluginImg || useModelAvatar || modelAvatar || '',
              isOpeningRemark: true, // 标记为开场白
            });
            Logger.debug(
              `[开场白] 已插入角色开场白到会话记录，groupId=${groupId}, appId=${appId}`,
              'ChatService',
            );
          }
        }
      } catch (error) {
        Logger.debug(`检查或插入角色开场白失败: ${error.message}`, 'ChatService');
      }
    }

    // 如果设置了 skipSaveToDatabase，则不保存 assistant 消息到数据库
    let assistantSaveLog;
    let assistantLogId;

    if (!skipSave) {
      assistantSaveLog = await this.chatLogService.saveChatLog({
        appId: appId ? appId : null,
        action: action ? action : null,
        curIp,
        userId: req.user.id,
        type: modelType ? modelType : 1,
        progress: '0%',
        model: useModel,
        modelName: assistantName,
        role: 'assistant',
        groupId: groupId ? groupId : null,
        status: 2,
        modelAvatar: usingPlugin?.pluginImg || useModelAvatar || modelAvatar || '',
        pluginParam: usingPlugin?.parameters
          ? usingPlugin.parameters
          : modelType === 2
          ? useModel
          : null,
      });
      assistantLogId = assistantSaveLog.id;
      Logger.debug(`[保存] 已保存 assistant 消息到数据库，id=${assistantLogId}`, 'ChatService');
    } else {
      // skipSaveToDatabase 模式：不保存 assistant 消息
      assistantLogId = null;
      Logger.debug(
        `[跳过保存] skipSaveToDatabase=true，不保存 assistant 消息到数据库`,
        'ChatService',
      );
    }

    if (autoReplyRes.answer && res) {
      if (autoReplyRes.isAIReplyEnabled === 0) {
        const chars = autoReplyRes.answer.split('');
        // 使用一个递归函数来逐个字符发送响应
        const sendCharByChar = index => {
          if (index < chars.length) {
            const msg = { text: chars[index] }; // 封装当前字符为对象
            res.write(`${JSON.stringify(msg)}\n`); // 发送当前字符
            setTimeout(() => sendCharByChar(index + 1), 10); // 设置定时器递归调用
          } else {
            res.end(); // 所有字符发送完毕，结束响应
          }
        };

        // 从第一个字符开始发送
        sendCharByChar(0);
        if (assistantLogId) {
          await this.chatLogService.updateChatLog(assistantLogId, {
            content: autoReplyRes.answer,
          });
        }
        return;
      } else {
        setSystemMessage = setSystemMessage + autoReplyRes.answer;
      }
    }

    // 心理描述开关逻辑
    // 优先使用会话组的 describingMental 配置，如果没有则使用用户级别配置
    let enablePsychologicalDesc = false; // 声明在外层，用于后续响应过滤
    let groupConversationMemoryCount = maxRounds; // 默认使用模型配置的maxRounds
    let groupVoiceReplyMode = 'text_only'; // 默认不发语音
    let groupAllowEmoji = false; // 默认不允许表情包
    let groupAllowTap = false; // 默认不允许拍一拍
    let groupMaxReplyCount = 5; // 默认最多回复5条

    if (appId && setSystemMessage && this.userAppSettingsService) {
      try {
        // 1. 优先检查会话组的配置（99AI使用）
        if (groupId) {
          try {
            const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
            if (groupInfo) {
              // 心理描述开关
              if (typeof groupInfo.describingMental === 'number') {
                enablePsychologicalDesc = groupInfo.describingMental === 1;
                Logger.debug(
                  `[心理描述] 使用会话组配置: groupId=${groupId}, describingMental=${groupInfo.describingMental}`,
                  'ChatService',
                );
              }

              // 对话记忆条数
              if (
                typeof groupInfo.conversationMemoryCount === 'number' &&
                groupInfo.conversationMemoryCount > 0
              ) {
                groupConversationMemoryCount = groupInfo.conversationMemoryCount;
                Logger.debug(
                  `[对话记忆] 使用会话组配置: groupId=${groupId}, conversationMemoryCount=${groupConversationMemoryCount}`,
                  'ChatService',
                );
              }

              // 语音回复模式
              if (groupInfo.voiceReplyMode) {
                groupVoiceReplyMode = groupInfo.voiceReplyMode;
                Logger.debug(
                  `[语音回复] 使用会话组配置: groupId=${groupId}, voiceReplyMode=${groupVoiceReplyMode}`,
                  'ChatService',
                );
              }

              // 表情包和拍一拍开关
              if (typeof groupInfo.allowEmoji === 'number') {
                groupAllowEmoji = groupInfo.allowEmoji === 1;
                Logger.debug(
                  `[表情包] 使用会话组配置: groupId=${groupId}, allowEmoji=${groupAllowEmoji}`,
                  'ChatService',
                );
              }

              if (typeof groupInfo.allowTap === 'number') {
                groupAllowTap = groupInfo.allowTap === 1;
                Logger.debug(
                  `[拍一拍] 使用会话组配置: groupId=${groupId}, allowTap=${groupAllowTap}`,
                  'ChatService',
                );
              }

              // 最多回复条数（群聊使用）
              if (typeof groupInfo.maxReplyCount === 'number' && groupInfo.maxReplyCount > 0) {
                groupMaxReplyCount = groupInfo.maxReplyCount;
                Logger.debug(
                  `[最多回复] 使用会话组配置: groupId=${groupId}, maxReplyCount=${groupMaxReplyCount}`,
                  'ChatService',
                );
              }
            }

            // 如果会话组没有配置心理描述，使用用户级别配置
            if (!groupInfo || typeof groupInfo.describingMental !== 'number') {
              enablePsychologicalDesc =
                await this.userAppSettingsService.getEnablePsychologicalDesc(req.user.id, appId);
              Logger.debug(
                `[心理描述] 使用用户级别配置: userId=${req.user.id}, appId=${appId}, enable=${enablePsychologicalDesc}`,
                'ChatService',
              );
            }
          } catch (e) {
            // 获取会话组配置失败，回退到用户级别配置
            enablePsychologicalDesc = await this.userAppSettingsService.getEnablePsychologicalDesc(
              req.user.id,
              appId,
            );
            Logger.debug(
              `[心理描述] 获取会话组配置失败，使用用户级别配置: enable=${enablePsychologicalDesc}`,
              'ChatService',
            );
          }
        } else {
          // 没有 groupId，使用用户级别配置
          enablePsychologicalDesc = await this.userAppSettingsService.getEnablePsychologicalDesc(
            req.user.id,
            appId,
          );
          Logger.debug(
            `[心理描述] 无groupId，使用用户级别配置: enable=${enablePsychologicalDesc}`,
            'ChatService',
          );
        }

        // 心理描述开关仅控制过滤，不再在预设中添加提示词
        Logger.debug(
          `[心理描述] 开关状态: ${enablePsychologicalDesc ? '开启' : '关闭'}（将在响应时处理）`,
          'ChatService',
        );
      } catch (error) {
        Logger.warn(`获取心理描述开关失败: ${error?.message || error}`, 'ChatService');
      }
    }

    // 对话总结：获取历史总结并添加到system message（角色预设之后）
    if (groupId) {
      try {
        const historySummary = await this.conversationSummaryService.getSummary(groupId);
        if (historySummary) {
          setSystemMessage = `${setSystemMessage}\n\n【对话历史总结】\n${historySummary}`;
          Logger.debug(
            `[对话总结] 已添加历史总结到system message，长度=${historySummary.length}字`,
            'ChatService',
          );
        }
      } catch (error: any) {
        Logger.warn(`[对话总结] 获取历史总结失败: ${error?.message || error}`, 'ChatService');
      }
    }

    /* 获取历史消息 */
    const { messagesHistory } = await this.buildMessageFromParentMessageId(
      {
        groupId,
        appId: appId,
        systemMessage: setSystemMessage,
        maxModelTokens,
        maxRounds: groupConversationMemoryCount, // 使用会话组配置的对话记忆条数
        isConvertToBase64: isConvertToBase64,
        fileUrl: fileUrl,
        imageUrl: imageUrl,
        model: useModel,
        isFileUpload,
        isImageUpload,
        prompt: prompt, // 传入当前用户提问
        userId: req?.user?.id, // 传入当前用户ID
        excludeLogId: userLogId, // 排除当前刚保存的用户消息
      },
      this.chatLogService,
    );

    // 群聊模式：不再添加【群聊角色与发言顺序】到messagesHistory
    // 角色任务信息将在下面的群组背景信息中统一处理

    /* 单独处理 MJ 积分的扣费 */
    let charge;
    if (action !== 'UPSCALE' && useModel === 'midjourney') {
      if (prompt.includes('--v 7')) {
        charge = deduct * 8;
      } else if (prompt.includes('--draft')) {
        charge = deduct * 2;
      } else {
        charge = deduct * 4;
      }
    } else {
      charge = deduct * (usingDeepThinking ? deductDeepThink : 1);
    }

    const abortController = new AbortController();
    /* 处理对话  */
    try {
      if (res) {
        res.on('close', () => {
          abortController.abort();
        });

        let response;
        try {
          let chatId = {
            chatId: assistantLogId,
          };

          res.write(`\n${JSON.stringify(chatId)}`);

          /* 强制走星尘通道 */
          let accumulatedText = '';

          // 构建星尘API扩展配置
          let openingRemarkForXingchen: string | undefined = undefined;

          // 群聊模式：从群组成员数据中获取当前角色的开场白
          if (isGroupChat && groupId && appId) {
            try {
              const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
              if (groupInfo?.members) {
                const members = JSON.parse(groupInfo.members);
                const currentMember = members.find(m => m.appId === appId || m.userId === appId);
                if (currentMember?.openingRemark) {
                  openingRemarkForXingchen = currentMember.openingRemark;
                  Logger.debug(
                    `[群聊] 从成员数据中获取开场白: appId=${appId}, openingRemark=${openingRemarkForXingchen.substring(
                      0,
                      50,
                    )}...`,
                    'ChatService',
                  );
                }
              }
            } catch (error) {
              Logger.debug(`获取群聊成员开场白失败: ${error.message}`, 'ChatService');
            }
          }
          // 单聊模式：从 chatlog 中获取开场白（标记为 isOpeningRemark: true 的记录）
          else if (!isGroupChat && groupId && appId) {
            try {
              const openingRemarkLog = await this.chatLogService.getOpeningRemark(groupId, appId);

              if (openingRemarkLog?.content) {
                openingRemarkForXingchen = openingRemarkLog.content;
                Logger.debug(
                  `[单聊] 从 chatlog 中获取开场白: appId=${appId}, openingRemark=${openingRemarkForXingchen.substring(
                    0,
                    50,
                  )}...`,
                  'ChatService',
                );
              } else {
                Logger.debug(
                  `[单聊] chatlog 中未找到开场白记录: groupId=${groupId}, appId=${appId}`,
                  'ChatService',
                );
              }
            } catch (error) {
              Logger.debug(`从 chatlog 获取开场白失败: ${error.message}`, 'ChatService');
            }
          }

          const appConfigForXingchen = appInfo
            ? {
                botName: appInfo.name,
                userId: req?.user?.id,
                appId: appInfo.id,
                enableRealTime: appInfo.enableRealTime,
                enableLongTermMemory: appInfo.enableLongTermMemory,
                enableKnowledgeBase: appInfo.enableKnowledgeBase,
                knowledgeBaseIds: appInfo.knowledgeBaseIds,
                dialogueExamples: appInfo.dialogueExamples,
                openingRemark: openingRemarkForXingchen, // 添加开场白到星尘API配置
              }
            : undefined;

          // 构建星尘API专用的messages（添加用户简介等上下文信息）
          let messagesForXingchen = [...messagesHistory]; // 复制一份，不影响原始messagesHistory

          // 获取用户信息（单聊和群聊都需要）
          let userBio = '';
          let userName = '';
          try {
            const user = await this.userEntity.findOne({ where: { id: req.user.id } });
            if (user) {
              userName = user.username || user.nickname || `用户${user.id}`;
              userBio = user.bio || '';
            }
          } catch (error) {
            Logger.warn(`[星尘API] 获取用户信息失败: ${error.message}`, 'ChatService');
          }

          // 构建用户简介文本（包含用户名字和简介）
          let userProfileText = '';
          if (userName && userBio) {
            userProfileText = `用户名：${userName}\n用户简介：${userBio}`;
          } else if (userName) {
            userProfileText = `用户名：${userName}`;
          } else if (userBio) {
            userProfileText = `用户简介：${userBio}`;
          }

          if (isGroupChat && groupId) {
            // 群聊模式：构建群组背景信息
            try {
              const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
              const groupInfoParts: string[] = [];

              if (groupInfo?.title) {
                groupInfoParts.push(`群名：${groupInfo.title}`);
              }

              if (groupInfo?.description) {
                groupInfoParts.push(`背景介绍：${groupInfo.description}`);
              }

              // 添加用户信息（包含用户名和简介）
              if (userProfileText) {
                groupInfoParts.push(`\n【用户信息】\n${userProfileText}`);
              }

              // 添加群组成员及其任务信息到群组背景信息
              if (groupInfo?.members) {
                try {
                  const members = JSON.parse(groupInfo.members);
                  if (Array.isArray(members) && members.length > 0) {
                    // 按order排序
                    members.sort(
                      (a, b) =>
                        Number(a.order || 999999) - Number(b.order || 999999) ||
                        Number(a.userId) - Number(b.userId),
                    );

                    groupInfoParts.push('\n人物信息：');

                    // 先批量获取所有需要的角色名称
                    for (const member of members) {
                      if (member.appId && !member.appName && !member.name) {
                        try {
                          const memberAppInfo = await this.appEntity.findOne({
                            where: { id: member.appId },
                          });
                          if (memberAppInfo?.name) {
                            member.appName = memberAppInfo.name;
                            Logger.debug(
                              `[群组背景信息] 从 appId=${member.appId} 获取角色名称: ${memberAppInfo.name}`,
                              'ChatService',
                            );
                          }
                        } catch (error) {
                          Logger.debug(
                            `[群组背景信息] 获取 appId=${member.appId} 的角色名称失败: ${error.message}`,
                            'ChatService',
                          );
                        }
                      }
                    }

                    members.forEach((m: any, idx: number) => {
                      const name =
                        m.appName || m.name || (m.userId ? `用户${m.userId}` : `成员${idx + 1}`);
                      let memberInfo = `${idx + 1}. ${name}`;

                      // 添加任务信息
                      const tasks = Array.isArray(m.tasks) ? m.tasks : [];
                      if (tasks.length > 0) {
                        const taskDetails = tasks
                          .map((t: any) => {
                            let taskTitle = t.title || '';
                            // 将任务标题中的"我"替换为用户名
                            if (
                              realUserName &&
                              realUserName !== '用户' &&
                              realUserName !== '我' &&
                              taskTitle
                            ) {
                              taskTitle = taskTitle.replace(
                                /(?<![^\s，。！？；：、])我(?![^\s，。！？；：、])/g,
                                realUserName,
                              );
                            }
                            return `${taskTitle}${t.status ? ` (${t.status})` : ''}`;
                          })
                          .join('；');
                        memberInfo += ` - 任务：${taskDetails}`;
                      } else if (m.taskDetail && m.taskDetail.trim()) {
                        // 兼容旧格式的taskDetail字段
                        let taskDetail = m.taskDetail.trim();
                        if (realUserName && realUserName !== '用户' && realUserName !== '我') {
                          taskDetail = taskDetail.replace(
                            /(?<![^\s，。！？；：、])我(?![^\s，。！？；：、])/g,
                            realUserName,
                          );
                        }
                        memberInfo += ` - 任务：${taskDetail}`;
                      }

                      groupInfoParts.push(memberInfo);
                    });
                  }
                } catch (error) {
                  Logger.warn(`[群聊] 解析群组成员信息失败: ${error.message}`, 'ChatService');
                }
              }

              // 如果有群组信息，插入到messages副本的第一位作为system消息（背景信息）
              if (groupInfoParts.length > 0) {
                // 添加行为约束（基于会话组配置）
                const behaviorConstraints: string[] = [];

                // 表情包控制
                if (groupAllowEmoji) {
                  behaviorConstraints.push('- 你可以在合适的时候发送emoji表情来增加趣味性');
                } else {
                  behaviorConstraints.push('- 请不要发送emoji表情');
                }

                // 拍一拍控制
                if (groupAllowTap) {
                  behaviorConstraints.push('- 你可以在合适的时候使用"拍一拍"进行亲密互动');
                } else {
                  behaviorConstraints.push('- 请不要使用"拍一拍"');
                }

                behaviorConstraints.push(
                  `- 你一次最多连续回复${groupMaxReplyCount}条消息，每条之间用一个空行分隔，并且每条都要表达完整意思`,
                );

                const groupBasicInfo = `【群组背景信息】\n${groupInfoParts.join(
                  '\n',
                )}\n\n【行为约束】\n${behaviorConstraints.join('\n')}`;
                // 使用system角色，星尘API会将非第一条system消息保留在messages中
                messagesForXingchen.unshift({ role: 'system', content: groupBasicInfo });
                Logger.debug(
                  `[群聊] 已将群组背景信息（含成员任务和行为约束）添加到星尘API请求的messages第一位（system角色）`,
                  'ChatService',
                );
              }
            } catch (error) {
              Logger.warn(`[群聊] 构建群组背景信息失败: ${error.message}`, 'ChatService');
            }
          } else if (!isGroupChat && groupId) {
            // 单聊模式：添加用户信息和行为约束到messages（如果有）
            try {
              const singleChatParts: string[] = [];

              if (userProfileText) {
                singleChatParts.push(`【用户信息】\n${userProfileText}`);
              }

              // 添加行为约束（单聊也需要）
              const behaviorConstraints: string[] = [];

              // 表情包控制
              if (groupAllowEmoji) {
                behaviorConstraints.push('- 你可以在合适的时候发送emoji表情来增加趣味性');
              } else {
                behaviorConstraints.push('- 请不要发送emoji表情');
              }

              // 拍一拍控制
              if (groupAllowTap) {
                behaviorConstraints.push('- 你可以在合适的时候使用"拍一拍"进行亲密互动');
              } else {
                behaviorConstraints.push('- 请不要使用"拍一拍"');
              }

              behaviorConstraints.push(
                `- 你一次最多连续回复${groupMaxReplyCount}条消息，消息之间使用空行，并保持语气自然`,
              );

              singleChatParts.push(`\n【行为约束】\n${behaviorConstraints.join('\n')}`);

              if (singleChatParts.length > 0) {
                const userProfileInfo = singleChatParts.join('\n');
                // 使用system角色，添加到messages第一位
                messagesForXingchen.unshift({ role: 'system', content: userProfileInfo });
                Logger.debug(
                  `[单聊] 已将用户信息和行为约束添加到星尘API请求的messages第一位（system角色）`,
                  'ChatService',
                );
              } else {
                Logger.debug(`[单聊] 用户未设置用户名和简介，仅添加行为约束`, 'ChatService');
              }
            } catch (error) {
              Logger.warn(`[单聊] 添加用户信息失败: ${error.message}`, 'ChatService');
            }
          }

          const xingchenResult = await this.openAIChatService.chatFree(
            prompt || '',
            setSystemMessage, // 使用原始systemMessage作为botProfile
            messagesForXingchen, // 使用包含群组背景信息的副本
            imageUrl,
            {
              onProgress: (delta: string) => {
                // 修改：群聊和单聊都应该发送流式数据
                if (delta) {
                  accumulatedText += delta;

                  // 心理描述过滤：如果开关关闭，发送前过滤括号内容
                  let textToSend = accumulatedText;
                  if (!enablePsychologicalDesc && appId) {
                    textToSend = this.removeBracketedContent(accumulatedText);
                  }

                  const payload = { content: [{ type: 'text', text: textToSend }] };
                  try {
                    res.write(`\n${JSON.stringify(payload)}`);
                  } catch {}
                }
              },
              abortSignal: abortController.signal,
            },
            appConfigForXingchen,
          );

          const xingchenText = xingchenResult.text || '';
          const xingchenUsage = xingchenResult.usage;

          // 使用API返回的token数据，如果没有则使用计算值
          let promptTokens = 0;
          let completionTokens = 0;
          if (xingchenUsage) {
            promptTokens = xingchenUsage.inputTokens || xingchenUsage.userTokens || 0;
            completionTokens = xingchenUsage.outputTokens || 0;
            Logger.debug(
              `使用星尘API返回的token数据 - promptTokens: ${promptTokens}, completionTokens: ${completionTokens}`,
              'ChatService',
            );
          } else {
            // 回退到计算值
            let totalText = '';
            messagesHistory.forEach(msg => {
              totalText += msg.content + ' ';
            });
            promptTokens = await getTokenCount(totalText);
            completionTokens = await getTokenCount(xingchenText);
            Logger.debug(
              `星尘API未返回token数据，使用计算值 - promptTokens: ${promptTokens}, completionTokens: ${completionTokens}`,
              'ChatService',
            );
          }

          response = {
            chatId: assistantLogId,
            modelName: useModeName,
            modelAvatar: '',
            model: useModel,
            status: 2,
            full_content: xingchenText || '',
            full_reasoning_content: '',
            networkSearchResult: '',
            fileVectorResult: '',
            finishReason: 'stop',
            promptTokens: promptTokens,
            completionTokens: completionTokens,
            totalTokens: promptTokens + completionTokens,
            content: [
              {
                type: 'text',
                text: '',
              },
            ],
            reasoning_content: [
              {
                type: 'text',
                text: '',
              },
            ],
          };

          Logger.debug(`JSON: ${JSON.stringify(response)}`, 'ChatService');

          if (response.errMsg) {
            Logger.error(
              `用户ID: ${req.user.id} 模型名称: ${useModeName} 模型: ${model} 回复出错，本次不扣除积分`,
              'ChatService',
            );
            return res.write(`\n${JSON.stringify(response)}`);
          }

          await this.chatLogService.updateChatLog(userLogId, {
            promptTokens: promptTokens,
            completionTokens: completionTokens,
            totalTokens: promptTokens + completionTokens,
          });

          let sanitizedAnswer = response.full_content;
          if (isSensitiveWordFilter === '1') {
            const triggeredWords = await this.badWordsService.checkBadWords(
              response.full_content,
              req.user.id,
            );

            if (triggeredWords.length > 0) {
              // 构造一个正则表达式来匹配所有敏感词
              const regex = new RegExp(triggeredWords.join('|'), 'gi'); // 忽略大小写替换

              // 使用回调函数替换敏感词，每个敏感词替换为相应长度的 *
              sanitizedAnswer = sanitizedAnswer.replace(regex, matched =>
                '*'.repeat(matched.length),
              );
              Logger.debug(`检测到敏感词，已进行屏蔽处理`, 'ChatService');
            }
          }

          // 心理描述过滤：如果开关关闭，移除括号内的心理描述内容
          if (!enablePsychologicalDesc && appId) {
            const originalLength = sanitizedAnswer.length;
            sanitizedAnswer = this.removeBracketedContent(sanitizedAnswer);
            if (sanitizedAnswer.length < originalLength) {
              Logger.debug(
                `[心理描述过滤] 已移除心理描述内容，原长度=${originalLength}，过滤后长度=${sanitizedAnswer.length}`,
                'ChatService',
              );
            }
          }

          const splitReplies = this.splitAssistantReplies(sanitizedAnswer, groupMaxReplyCount);
          const normalizedFullContent =
            splitReplies.length > 0 ? splitReplies.join('\n\n') : sanitizedAnswer;
          response.full_content = normalizedFullContent;

          const assistantMessagesPayload: any[] = [];
          const textReplies =
            splitReplies.length > 0 ? splitReplies : sanitizedAnswer ? [sanitizedAnswer] : [];
          const firstReply = textReplies[0] || '';

          if (assistantLogId) {
            const replyContent = firstReply || '';
            await this.chatLogService.updateChatLog(assistantLogId, {
              content: replyContent,
              reasoning_content: response.full_reasoning_content,
              tool_calls: response.tool_calls,
              promptTokens: promptTokens,
              completionTokens: completionTokens,
              totalTokens: promptTokens + completionTokens,
              status: 3,
            });

            assistantMessagesPayload.push({
              chatId: assistantLogId,
              message_type: 'text',
              content: replyContent,
            });

            const assistantLogBasePayload = this.buildAssistantLogBasePayload({
              appId: appId ? Number(appId) : null,
              action: action || null,
              curIp,
              userId: req.user.id,
              modelType,
              model: useModel,
              modelName: assistantName,
              groupId: groupId ? Number(groupId) : null,
              modelAvatar: usingPlugin?.pluginImg || useModelAvatar || modelAvatar || '',
              pluginParam:
                assistantSaveLog?.pluginParam ||
                (usingPlugin?.parameters
                  ? usingPlugin.parameters
                  : modelType === 2
                  ? useModel
                  : null),
            });

            if (textReplies.length > 1) {
              const extraLogs = await this.saveAdditionalAssistantReplies(
                textReplies.slice(1),
                assistantLogBasePayload,
              );
              extraLogs.forEach(item => {
                assistantMessagesPayload.push({
                  chatId: item.chatId,
                  message_type: 'text',
                  content: item.content,
                });
              });
            }

            // 语音回复逻辑：
            // - voice_only: 全部发语音（每次都生成）
            // - mixed: 偶尔发一次（按概率生成，文字:语音 = 5:2）
            let shouldGenerateVoice = false;
            if (groupVoiceReplyMode === 'voice_only') {
              shouldGenerateVoice = true;
              Logger.debug('[语音回复] voice_only 模式 - 生成语音', 'ChatService');
            } else if (groupVoiceReplyMode === 'mixed') {
              // 按照 5:2 的比例随机生成语音（约 28.6% 的概率）
              shouldGenerateVoice = Math.random() < 0.286;
              Logger.debug(
                `[语音回复] mixed 模式 - ${shouldGenerateVoice ? '生成语音' : '仅文字'}`,
                'ChatService',
              );
            }

            if (shouldGenerateVoice && replyContent) {
              const voiceReply = await this.generateVoiceReplyForMessage({
                text: replyContent,
                chatId: assistantLogId,
                appId: appId ? Number(appId) : null,
                req,
              });
              if (voiceReply) {
                response.ttsUrl = voiceReply.ttsUrl;
                response.audioUrl = voiceReply.ttsUrl;
                response.voiceDuration = voiceReply.duration;
                response.audioDuration = voiceReply.duration; // 添加audioDuration字段供cat_AI使用
                if (assistantMessagesPayload.length > 0) {
                  assistantMessagesPayload[0].content_voice = voiceReply.ttsUrl;
                  assistantMessagesPayload[0].voice_duration = voiceReply.duration;
                  assistantMessagesPayload[0].audioDuration = voiceReply.duration; // 添加audioDuration字段
                }
              }
            }

            if (assistantLogBasePayload) {
              const stickerMessage = await this.maybeCreateStickerMessage({
                allowEmoji: groupAllowEmoji,
                basePayload: assistantLogBasePayload,
              });
              if (stickerMessage?.message) {
                assistantMessagesPayload.push(stickerMessage.message);
              }
            }
          } else {
            textReplies.forEach(reply => {
              assistantMessagesPayload.push({
                chatId: null,
                message_type: 'text',
                content: reply,
              });
            });
          }

          response.messages = assistantMessagesPayload;

          try {
            if (isGeneratePromptReference === '1') {
              const promptRefResult = await this.openAIChatService.chatFree(
                `根据用户提问{${prompt}}以及AI的回答{${response.full_content}}，生成三个更进入一步的问题来向AI提问，用{}包裹每个问题，不需要分行，不需要其他任何内容，单个提问不超过30个字`,
                setSystemMessage,
                messagesHistory,
              );
              promptReference = promptRefResult.text || '';
              if (assistantLogId) {
                await this.chatLogService.updateChatLog(assistantLogId, {
                  promptReference: promptReference,
                });
              }
              Logger.debug(`生成了相关问题推荐`, 'ChatService');
            }
          } catch (error) {
            Logger.debug(`生成相关问题推荐失败: ${error}`);
          }

          // 对话总结：异步更新总结
          if (groupId) {
            try {
              const previousSummary = await this.conversationSummaryService.getSummary(groupId);
              const newMessages = [
                { role: 'user', content: prompt || '' },
                { role: 'assistant', content: response.full_content || '' },
              ];

              this.conversationSummaryService
                .summarizeConversationAsync(
                  groupId,
                  req?.user?.id,
                  appId,
                  previousSummary,
                  newMessages,
                )
                .catch(err => {
                  Logger.error(
                    `[对话总结] 异步总结任务异常: ${err?.message || err}`,
                    'ChatService',
                  );
                });

              Logger.debug(`[对话总结] 已触发异步总结任务 - groupId=${groupId}`, 'ChatService');
            } catch (error: any) {
              Logger.warn(`[对话总结] 触发异步总结失败: ${error?.message || error}`, 'ChatService');
            }
          }

          if (isTokenBased === true) {
            charge =
              deduct *
              Math.ceil((promptTokens + completionTokens) / tokenFeeRatio) *
              (usingDeepThinking ? deductDeepThink : 1);
          }

          await this.userBalanceService.deductFromBalance(
            req.user.id,
            deductType,
            charge,
            promptTokens + completionTokens,
            req.user.role,
          );
          /* 记录key的使用次数 和使用token */
          await this.modelsService.saveUseLog(keyId, promptTokens + completionTokens);

          Logger.log(
            `对话完成 - 用户: ${req.user.id}, 模型: ${useModeName}(${model}), Token: ${
              promptTokens + completionTokens
            }, 积分: ${charge}`,
            'ChatService',
          );
          const userBalance = await this.userBalanceService.queryUserBalance(req.user.id);
          response.userBalance = userBalance;
          response.chatId = assistantLogId;
          response.promptReference = promptReference;

          // Increase affection upon successful chat (skip in group chat)
          try {
            Logger.debug(
              `[好感度] 检查条件: appId=${appId}, isGroupChat=${isGroupChat}, userId=${req.user.id}`,
              'ChatService',
            );
            if (appId && !isGroupChat) {
              Logger.log(
                `[好感度] 开始增加好感度: userId=${req.user.id}, appId=${appId}`,
                'ChatService',
              );
              const result = await this.affectionService.increment(req.user.id, Number(appId));
              Logger.log(
                `[好感度] 增加成功: score=${result.score}, stage=${result.stage?.name}`,
                'ChatService',
              );
            } else if (!appId) {
              Logger.debug('[好感度] 跳过增加（缺少appId）', 'ChatService');
            } else if (isGroupChat) {
              Logger.debug('[好感度] 跳过增加（群聊模式）', 'ChatService');
            }
          } catch (e) {
            Logger.warn(`[好感度] 增加失败: ${e?.message || e}`, 'ChatService');
          }

          return res.write(`\n${JSON.stringify(response)}`);
        } catch (error) {
          // 在这里处理错误，例如打印错误消息到控制台或向用户发送错误响应
          Logger.error('处理请求出错:', error);
          // 根据你的应用需求，你可能想要在这里设置response为一个错误消息或执行其他错误处理逻辑
          if (assistantLogId) {
            await this.chatLogService.updateChatLog(assistantLogId, {
              status: 5,
            });
          }
          response = { error: '处理请求时发生错误' };
        }
      }
    } catch (error) {
      Logger.error('聊天处理全局错误', error);
      if (res) {
        return res.write('发生未知错误，请稍后再试');
      } else {
        throw new HttpException('发生未知错误，请稍后再试', HttpStatus.BAD_REQUEST);
      }
    } finally {
      res && res.end();
    }
  }

  async updateChatTitle(groupId, groupInfo, modelType, prompt, req) {
    if (groupInfo?.title === '新对话') {
      // '新对话' can be replaced with 'New chat' if needed
      let chatTitle: string;
      if (modelType === 1) {
        // 直接使用提问片段作为标题
        chatTitle = prompt.slice(0, 10);
        Logger.debug(`使用提问片段作为标题: ${chatTitle}`);
      } else {
        chatTitle = '创意 AI';
      }

      this.chatGroupService
        .update(
          {
            groupId,
            title: chatTitle,
          },
          req,
        )
        .then(() => Logger.debug(`更新对话标题: ${chatTitle}`))
        .catch(error => Logger.error(`更新对话标题失败`, error));
    }
  }

  async buildMessageFromParentMessageId(options: any, chatLogService) {
    const startTime = Date.now();

    let {
      systemMessage = '',
      maxRounds = 12,
      maxModelTokens = 64000,
      isFileUpload = 0,
      isImageUpload = 0,
      isConvertToBase64,
      groupId,
      appId,
      prompt = '', // 当前用户提问
      imageUrl = '', // 当前图片URL
      userId, // 当前用户ID
      excludeLogId, // 要排除的消息ID（当前刚保存的用户消息）
    } = options;

    // 判断是否为真正的群聊模式
    let isGroupChat = false;
    if (groupId) {
      try {
        const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
        isGroupChat =
          groupInfo?.isGroupChat === true || (groupInfo?.isGroupChat as any) === 1 || false;
      } catch (error) {
        isGroupChat = false;
      }
    }

    // 获取真实用户名称（用于群聊模式）
    let realUserName = '用户';
    if (isGroupChat && userId) {
      try {
        const user = await this.userEntity.findOne({ where: { id: userId } });
        if (user) {
          realUserName = user.username || user.nickname || `用户${user.id}`;
        }
      } catch (error) {
        Logger.debug(`获取用户名称失败: ${error.message}`, 'ChatService');
      }
    }

    // 群聊角色与发言顺序 - 根据appId设置对应角色预设
    if (groupId && appId) {
      const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
      if (groupInfo?.members) {
        const members = JSON.parse(groupInfo.members);
        // 根据appId找到对应的群聊成员
        const currentMember = members.find(m => m.appId === appId || m.userId === appId);

        if (currentMember) {
          let currentMemberName = currentMember.appName || currentMember.name;

          // 如果没有名称，尝试从数据库获取
          if (!currentMemberName && currentMember.appId) {
            try {
              const memberAppInfo = await this.appEntity.findOne({
                where: { id: currentMember.appId },
              });
              if (memberAppInfo?.name) {
                currentMemberName = memberAppInfo.name;
              }
            } catch (error) {
              Logger.debug(
                `获取 appId=${currentMember.appId} 的角色名称失败: ${error.message}`,
                'ChatService',
              );
            }
          }

          // 如果还是没有名称，使用默认值
          if (!currentMemberName) {
            currentMemberName = `应用${currentMember.appId || currentMember.userId}`;
          }

          // 当前角色任务引导
          let taskGuide = '';
          if (currentMember.tasks && currentMember.tasks.length > 0) {
            const unfinishedTasks = currentMember.tasks.filter(t => t.status !== 'done');
            if (unfinishedTasks.length > 0) {
              taskGuide = `本轮请优先围绕任务："${unfinishedTasks[0].title}"进行回复。`;
            }
          }

          // 构建当前角色的预设信息（只包含当前角色）
          systemMessage = systemMessage + `${taskGuide ? `，${taskGuide}` : ''}`;
        }
      }
    }

    // 确保 systemMessage 不超过 maxModelTokens
    // if (systemMessage.length > maxModelTokens) {
    //   Logger.debug(
    //     `系统消息过长(${systemMessage.length} > ${maxModelTokens})，进行截断处理`,
    //     'ChatService',
    //   );
    //   systemMessage = systemMessage.slice(0, maxModelTokens);
    // }

    const messages = [];
    // 查询历史对话列表
    if (groupId) {
      try {
        Logger.debug(
          `[群聊] 开始查询历史对话，groupId=${groupId}, maxRounds=${maxRounds}, appId=${appId}`,
          'ChatService',
        );
        const history = await chatLogService.chatHistory(groupId, maxRounds);
        Logger.debug(`[群聊] 查询到历史记录数=${history.length}`, 'ChatService');

        // 按时间顺序排序历史记录（如果需要）
        history.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        // 打印历史记录的详细信息
        history.forEach((record, index) => {
          Logger.debug(
            `[群聊历史] 记录${index}: role=${record.role}, appId=${record.appId}, content=${
              typeof record.content === 'string' ? record.content.substring(0, 30) : '[复杂内容]'
            }`,
            'ChatService',
          );
        });

        // 整理成对的user-assistant消息
        let userMessages = [];
        let assistantMessages = [];

        // 先分类所有消息
        for (const record of history) {
          try {
            // 跳过当前刚保存的用户消息（避免重复）
            if (excludeLogId && record.id === excludeLogId) {
              Logger.debug(`[群聊历史] 跳过当前用户消息，id=${record.id}`, 'ChatService');
              continue;
            }

            let content;

            // 单独处理图片和文件，允许同时存在

            // 初始化内容为原始内容或空字符串
            content = record.content || '';
            let hasSpecialFormat = false;

            // 1. 处理文件内容 - 逆向格式
            if (isFileUpload === 1 && record.fileUrl) {
              try {
                // 尝试解析JSON格式的fileUrl
                const filesInfo = JSON.parse(record.fileUrl);
                if (Array.isArray(filesInfo)) {
                  // 提取所有文件的URL并拼接
                  const fileUrls = filesInfo.map(file => file.url).join('\n');
                  content = fileUrls + '\n' + content;
                } else {
                  // 如果不是数组格式，按原来方式处理
                  content = record.fileUrl + '\n' + content;
                }
              } catch (error) {
                // 如果解析失败，说明可能是旧格式，直接拼接
                content = record.fileUrl + '\n' + content;
                Logger.debug(`解析fileUrl失败，使用原始格式: ${error.message}`, 'ChatService');
              }
            }

            // 2. 处理图片内容
            if (isImageUpload === 2 && record.imageUrl) {
              // GPT-Vision 格式处理 (特殊格式)
              hasSpecialFormat = true;
              const imageContent = await Promise.all(
                record.imageUrl.split(',').map(async url => ({
                  type: 'image_url',
                  image_url: {
                    url:
                      isConvertToBase64 === '1' ? await convertUrlToBase64(url.trim()) : url.trim(),
                  },
                })),
              );
              content = [{ type: 'text', text: content }, ...imageContent];
            }
            // 3. 逆向格式图片，直接添加到内容前面
            else if (isImageUpload === 1 && record.imageUrl) {
              content = record.imageUrl + '\n' + content;
            }

            // 处理assistant消息，移除think标签
            if (record.role === 'assistant') {
              content = removeThinkTags(content);

              // 跳过空的assistant消息
              if (typeof content === 'string' && !content.trim()) {
                continue;
              }

              assistantMessages.push({
                id: record.id,
                role: 'assistant',
                content: content,
                createdAt: record.createdAt,
                appId: record.appId, // 保存appId用于群聊判断
              });
            } else if (record.role === 'user') {
              userMessages.push({
                id: record.id,
                role: 'user',
                content: content,
                createdAt: record.createdAt,
                appId: record.appId, // 保存appId用于群聊判断
              });
            }
          } catch (error) {
            Logger.debug(`处理历史记录ID=${record.id}失败: ${error.message}`, 'ChatService');
          }
        }
        // 获取群聊成员信息
        let groupMembers = [];
        if (groupId) {
          const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
          if (groupInfo?.members) {
            groupMembers = JSON.parse(groupInfo.members).sort(
              (a, b) => (a.order || 0) - (b.order || 0),
            );

            // 批量获取成员的角色名称（如果 appName 或 name 为空）
            for (const member of groupMembers) {
              if (member.appId && !member.appName && !member.name) {
                try {
                  const memberAppInfo = await this.appEntity.findOne({
                    where: { id: member.appId },
                  });
                  if (memberAppInfo?.name) {
                    member.appName = memberAppInfo.name;
                    Logger.debug(
                      `[群聊成员] 从 appId=${member.appId} 获取角色名称: ${memberAppInfo.name}`,
                      'ChatService',
                    );
                  }
                } catch (error) {
                  Logger.debug(
                    `获取 appId=${member.appId} 的角色名称失败: ${error.message}`,
                    'ChatService',
                  );
                }
              }
            }
          }
        }

        // 获取所有用户和助手消息，并按时间排序
        userMessages.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        assistantMessages.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        // 群聊模式：按照星尘文档要求构建消息
        if (groupMembers.length > 0) {
          // 根据appId找到当前角色
          const currentMember = groupMembers.find(m => m.appId === appId || m.userId === appId);
          const currentAppId = currentMember ? currentMember.appId || currentMember.userId : appId;

          Logger.debug(
            `[群聊历史构建] 当前角色appId=${currentAppId}, 群组成员数=${groupMembers.length}`,
            'ChatService',
          );
          Logger.debug(
            `[群聊历史构建] 用户消息数=${userMessages.length}, AI消息数=${assistantMessages.length}`,
            'ChatService',
          );

          // 构建历史消息，按照星尘文档格式
          const allMessages = [...userMessages, ...assistantMessages].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

          Logger.debug(
            `[群聊历史构建] 总消息数=${allMessages.length}, 按时间排序完成`,
            'ChatService',
          );

          for (const msg of allMessages) {
            if (msg.role === 'user') {
              // 真实用户消息：role为user，需要添加用户名前缀
              let userContent = msg.content;

              // 检查是否已经有说话人前缀
              const hasSpeakerPrefix =
                typeof userContent === 'string' && /^[^：]+：/.test(userContent);

              if (!hasSpeakerPrefix && typeof userContent === 'string') {
                // 从数据库获取真实用户名称
                let userName = '用户';
                try {
                  if (msg.userId) {
                    const user = await this.userEntity.findOne({ where: { id: msg.userId } });
                    if (user) {
                      userName = user.username || user.nickname || `用户${user.id}`;
                    }
                  }
                } catch (error) {
                  Logger.debug(`获取用户名称失败: ${error.message}`, 'ChatService');
                }

                // 添加用户名前缀
                userContent = `${userName}：${userContent}`;
                Logger.debug(`[群聊历史] 为用户消息添加说话人标识: ${userName}`, 'ChatService');
              }

              messages.push({
                role: 'user',
                content: userContent,
              });
              Logger.debug(
                `[群聊历史] 用户消息: ${
                  typeof userContent === 'string' ? userContent.substring(0, 50) : '[复杂内容]'
                }`,
                'ChatService',
              );
            } else if (msg.role === 'assistant') {
              // AI角色消息：根据appId判断是否为当前角色
              // 如果是当前角色的历史回复，使用assistant；否则使用user（其他角色的回复）
              const msgAppId = (msg as any).appId;
              const isCurrentMember = msgAppId && msgAppId === currentAppId;
              const finalRole = isCurrentMember ? 'assistant' : 'user';

              let messageContent = msg.content;

              // 如果是其他角色的回复，需要确保内容已经包含说话人标识
              // 如果没有，则添加说话人标识以避免身份混淆
              if (!isCurrentMember && typeof messageContent === 'string') {
                // 检查消息是否已经有说话人前缀（格式：角色名：内容）
                const hasSpeakerPrefix = /^[^：]+：/.test(messageContent);

                if (!hasSpeakerPrefix) {
                  // 尝试从 groupMembers 中找到该角色的名称
                  const msgMember = groupMembers.find(m => (m.appId || m.userId) === msgAppId);
                  const speakerName = msgMember
                    ? msgMember.appName || msgMember.name || `角色${msgAppId}`
                    : `角色${msgAppId}`;

                  // 添加说话人前缀，明确这是其他角色的发言
                  messageContent = `${speakerName}：${messageContent}`;
                  Logger.debug(
                    `[群聊历史] 为其他角色消息添加说话人标识: ${speakerName}`,
                    'ChatService',
                  );
                }
              }

              messages.push({
                role: finalRole,
                content: messageContent,
              });
              Logger.debug(
                `[群聊历史] AI消息 (appId=${msgAppId}, 当前=${currentAppId}, role=${finalRole}): ${
                  typeof messageContent === 'string'
                    ? messageContent.substring(0, 50)
                    : '[复杂内容]'
                }`,
                'ChatService',
              );
            }
          }

          Logger.debug(`[群聊历史构建] 最终消息数组长度=${messages.length}`, 'ChatService');
        } else {
          // 普通对话模式：保持原有逻辑
          const pairCount = Math.min(userMessages.length, assistantMessages.length);

          // 按user-assistant对添加消息
          for (let i = 0; i < pairCount; i++) {
            messages.push({ role: 'user', content: userMessages[i].content });
            messages.push({ role: 'assistant', content: assistantMessages[i].content });
          }

          // 如果用户消息比助手消息多，添加最后一条用户消息
          if (userMessages.length > pairCount) {
            messages.push({ role: 'user', content: userMessages[userMessages.length - 1].content });
          }
        }
      } catch (error) {
        Logger.error(`获取聊天历史记录失败: ${error.message}`, 'ChatService');
      }
    }

    // 计算并限制token数量
    let totalTokens = await getTokenCount(messages);

    // 动态计算token限制
    const tokenLimit = maxModelTokens < 8000 ? 4000 : maxModelTokens - 4000;

    // 如果超出token限制，进行裁剪
    if (totalTokens > tokenLimit) {
      Logger.debug(`消息超出token限制(${totalTokens} > ${tokenLimit})，开始裁剪`, 'ChatService');

      // 优化的裁剪算法
      let trimIteration = 0;
      while (totalTokens > tokenLimit && messages.length > 2) {
        trimIteration++;

        // 检查是否只剩下系统消息和当前用户消息
        if (
          messages.length === 2 &&
          ((messages[0].role === 'system' && messages[1].role === 'user') ||
            (messages[0].role === 'user' && messages[1].role === 'user'))
        ) {
          break;
        }

        // 保留系统消息和最后一条用户消息
        const systemIndex = messages.findIndex(m => m.role === 'system');
        const lastUserIndex = messages.length - 1; // 最后一条始终是当前用户消息

        // 从前往后删除非系统消息，直到剩下系统消息和最新用户消息
        // 优先删除较早的消息对
        if (messages.length > 2) {
          // 跳过系统消息
          const startIndex = systemIndex === 0 ? 1 : 0;

          // 删除最早的user-assistant对或单条消息
          if (startIndex < lastUserIndex) {
            if (
              messages[startIndex].role === 'user' &&
              startIndex + 1 < lastUserIndex &&
              messages[startIndex + 1].role === 'assistant'
            ) {
              // 删除一对消息
              messages.splice(startIndex, 2);
            } else {
              // 删除单条消息
              messages.splice(startIndex, 1);
            }
          }
        }

        // 重新计算token
        const newTotalTokens = await getTokenCount(messages);
        if (newTotalTokens >= totalTokens) {
          // 如果token没有减少，说明无法继续优化，强制退出
          Logger.debug('Token裁剪无效，停止裁剪过程');
          break;
        }

        // 更新token计数
        totalTokens = newTotalTokens;
      }
    }

    // 修正消息顺序问题：确保消息是一个user一个assistant交替出现
    // 遍历所有非系统消息，如果发现连续相同角色的消息，则进行调整
    if (messages.length > 1) {
      const fixedMessages = [];
      // 保留系统消息
      if (messages[0].role === 'system') {
        fixedMessages.push(messages[0]);
        messages.shift();
      }

      // 按照严格的user-assistant交替顺序重新构建消息
      // 确保最后一条消息是user
      const userMessages = messages
        .filter(msg => msg.role === 'user')
        .sort(
          (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
        );

      const assistantMessages = messages
        .filter(msg => msg.role === 'assistant')
        .sort(
          (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
        );

      // 保证最多使用较少的那一组消息的数量
      const pairCount = Math.min(userMessages.length, assistantMessages.length);

      // 构建交替的消息对
      for (let i = 0; i < pairCount; i++) {
        fixedMessages.push(userMessages[i]);
        fixedMessages.push(assistantMessages[i]);
      }

      // 如果还有剩余的user消息，添加最后一条
      if (userMessages.length > pairCount) {
        fixedMessages.push(userMessages[userMessages.length - 1]);
      }

      // 替换原消息数组
      messages.length = 0;
      messages.push(...fixedMessages);
    }

    // 添加当前用户提问到消息历史
    // 如果 skipPromptInHistory 为 true（用于群聊自动对话），则跳过添加
    if (prompt && !options?.skipPromptInHistory) {
      // 检查最后一条消息是否已经是当前用户的提问
      const lastMessage = messages[messages.length - 1];
      const isLastMessageCurrentPrompt =
        lastMessage && lastMessage.role === 'user' && lastMessage.content === prompt;

      if (!isLastMessageCurrentPrompt) {
        // 群聊模式下，真实用户的消息也需要添加用户名前缀（根据星尘API文档）
        let userPrompt = prompt;

        // 如果是群聊模式，添加用户名前缀
        if (isGroupChat) {
          // 检查是否已经有说话人前缀
          const hasSpeakerPrefix = typeof userPrompt === 'string' && /^[^：]+：/.test(userPrompt);

          if (!hasSpeakerPrefix && typeof userPrompt === 'string') {
            // 使用之前获取的真实用户名称
            userPrompt = `${realUserName}：${userPrompt}`;
            Logger.debug(`[群聊历史] 为当前用户提问添加说话人标识: ${realUserName}`, 'ChatService');
          }
        }

        // 构建当前用户消息
        let currentUserContent = userPrompt;

        // 如果有图片，根据 isImageUpload 值选择处理方式（与历史消息保持一致）
        if (imageUrl) {
          if (isImageUpload === 2) {
            // GPT-Vision 格式处理（多模态格式）
            const imageUrls = imageUrl.split(',').map(url => url.trim());
            currentUserContent = [
              { type: 'text', text: userPrompt },
              ...imageUrls.map(url => ({
                type: 'image_url',
                image_url: { url: url },
              })),
            ];
          } else if (isImageUpload === 1) {
            // 逆向格式，直接添加到内容前面
            currentUserContent = imageUrl + '\n' + userPrompt;
          } else if (isImageUpload === 0) {
            // 模型不支持图片，检查是否已经包含图片识别结果
            const hasImageDescription =
              typeof userPrompt === 'string' && userPrompt.includes('[图片内容:');
            if (!hasImageDescription) {
              // 还没有图片识别结果，进行识别
              Logger.debug('[群聊图片识别] 检测到未处理的图片，开始识别...', 'ChatService');
              try {
                // 使用通义千问识别图片（识别第一张图片）
                const firstImageUrl = imageUrl.split(',')[0].trim();
                const imageDescription = await this.recognizeImageWithQwen(firstImageUrl);

                const hasUserText = userPrompt && userPrompt.trim().length > 0;

                if (imageDescription) {
                  if (hasUserText) {
                    // 有用户文字：图片内容 + 用户文字
                    currentUserContent = `[图片内容: ${imageDescription}]\n${userPrompt}`;
                  } else {
                    // 纯图片：图片内容 + 默认提示
                    currentUserContent = `[图片内容: ${imageDescription}]\n请根据图片内容进行回复`;
                  }
                  Logger.debug(
                    `[群聊图片识别] 识别成功，描述: ${imageDescription.substring(0, 50)}...`,
                    'ChatService',
                  );
                } else {
                  Logger.warn('[群聊图片识别] 识别失败', 'ChatService');
                  if (hasUserText) {
                    // 有用户文字：占位符 + 用户文字
                    currentUserContent = `[用户发送了一张图片]\n${userPrompt}`;
                  } else {
                    // 纯图片：占位符 + 默认提示
                    currentUserContent = `[用户发送了一张图片]\n请根据图片内容进行回复`;
                  }
                }
              } catch (error) {
                Logger.error(`[群聊图片识别] 识别出错: ${error.message}`, 'ChatService');
                const hasUserText = userPrompt && userPrompt.trim().length > 0;
                if (hasUserText) {
                  currentUserContent = `[用户发送了一张图片]\n${userPrompt}`;
                } else {
                  currentUserContent = `[用户发送了一张图片]\n请根据图片内容进行回复`;
                }
              }
            }
            // 如果已经包含图片识别结果，直接使用 userPrompt
          }
        }

        const currentUserMessage: any = {
          role: 'user',
          content: currentUserContent,
        };

        messages.push(currentUserMessage);
        Logger.debug(
          `[群聊历史] 添加当前用户提问: ${
            typeof userPrompt === 'string' ? userPrompt.substring(0, 50) : '[复杂内容]'
          }`,
          'ChatService',
        );
      }
    } else if (options?.skipPromptInHistory) {
      Logger.debug(
        `[群聊自动对话] skipPromptInHistory=true，跳过将 prompt 添加到历史`,
        'ChatService',
      );
    }

    // 群聊模式：添加prefill消息（根据星尘API文档）
    // 最后一条消息应该是 {"role": "assistant", "content": "角色名："}
    // 这样AI会自动以这个角色的身份继续回复
    if (isGroupChat && groupId && appId) {
      try {
        const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
        if (groupInfo?.members) {
          const members = JSON.parse(groupInfo.members);
          const currentMember = members.find(m => m.appId === appId || m.userId === appId);
          if (currentMember) {
            let roleName = currentMember.appName || currentMember.name;

            // 如果没有名称，尝试从数据库获取
            if (!roleName && currentMember.appId) {
              try {
                const memberAppInfo = await this.appEntity.findOne({
                  where: { id: currentMember.appId },
                });
                if (memberAppInfo?.name) {
                  roleName = memberAppInfo.name;
                }
              } catch (error) {
                Logger.debug(
                  `获取 appId=${currentMember.appId} 的角色名称失败: ${error.message}`,
                  'ChatService',
                );
              }
            }

            // 如果还是没有名称，使用默认值
            if (!roleName) {
              roleName = `角色${currentMember.appId || currentMember.userId}`;
            }

            // 添加prefill消息
            messages.push({
              role: 'assistant',
              content: `${roleName}：`,
            });
            Logger.debug(`[群聊] 添加prefill消息: ${roleName}：`, 'ChatService');
          }
        }
      } catch (error) {
        Logger.debug(`添加prefill消息失败: ${error.message}`, 'ChatService');
      }
    }

    Logger.debug(
      `构建消息历史完成: ${Math.floor(messages.length / 2)} 组对话, ${totalTokens} tokens, 耗时: ${
        Date.now() - startTime
      }ms`,
      'ChatService',
    );

    Logger.debug(`messages: ${JSON.stringify(messages)}`, 'ChatService');

    // throw new Error('test');
    return {
      messagesHistory: messages,
      round: messages.length,
    };
  }

  async ttsProcess(body: any, req: any, res?: any) {
    const { chatId, prompt, emotion, appId: bodyAppId } = body;

    Logger.debug(
      `开始TTS处理: ${String(prompt || '').substring(0, 50)}${
        (prompt || '').length > 50 ? '...' : ''
      }`,
      'TTSService',
    );

    // 1. 提取括号内的心理描述（用于情绪识别）
    const psychologicalDesc = this.extractPsychologicalDescription(prompt);
    Logger.debug(`提取心理描述: ${psychologicalDesc || '无'}`, 'TTSService');

    // 2. 清理文本用于TTS（移除括号、Markdown、emoji等）
    const textToSpeak = this.cleanTextForTTS(prompt);
    Logger.debug(
      `清理后的TTS文本: ${textToSpeak.substring(0, 50)}${textToSpeak.length > 50 ? '...' : ''}`,
      'TTSService',
    );

    // 如果清理后文本为空，返回错误
    if (!textToSpeak || textToSpeak.trim().length === 0) {
      Logger.warn('清理后文本为空，无法进行TTS', 'TTSService');
      return res.status(400).send({ error: '文本内容为空，无法进行语音合成' });
    }

    // 小工具:使用指定 voiceId 进行合成 + 记录 + 尝试扣费
    const doTtsWithVoice = async (
      voiceId: string,
      params?: { rate?: number; pitch?: number; volume?: number },
    ) => {
      // 使用移除括号后的文本进行TTS
      const previewPayload: any = { voice_id: voiceId, text: textToSpeak };
      if (params && (params.rate || params.pitch || params.volume)) {
        if (params.rate !== undefined) previewPayload.rate = params.rate;
        if (params.pitch !== undefined) previewPayload.pitch = params.pitch;
        if (params.volume !== undefined) previewPayload.volume = params.volume;
      }
      const { url, duration } = await this.voiceService.preview(previewPayload);
      // 将时长四舍五入为整数（秒）
      const durationInt = Math.round(duration);
      try {
        const detailKeyInfo = await this.modelsService.getCurrentModelKeyInfo('tts-1');
        if (detailKeyInfo) {
          const { deduct, deductType } = detailKeyInfo;
          await this.userBalanceService.validateBalance(req, deductType, deduct);
          await this.userBalanceService.deductFromBalance(
            req.user.id,
            deductType,
            deduct,
            0,
            req.user.role,
          );
        } else {
          Logger.warn(`[TTSService] 未找到 tts-1 模型配置，跳过扣费`, 'TTSService');
        }
      } catch (e: any) {
        Logger.warn(
          `[TTSService] 扣费配置缺失或校验失败，已跳过扣费: ${e?.message || e}`,
          'TTSService',
        );
      }
      await this.chatLogService.updateChatLog(chatId, { ttsUrl: url, ttsDuration: durationInt });
      return res.status(200).send({ ttsUrl: url, duration: durationInt });
    };

    // 3) 读取聊天所属 appId，优先使用传入的 appId，否则从 chatLog 获取
    try {
      let appId = bodyAppId;
      if (!appId) {
        const chatLog = await this.chatLogService.findOneChatLog(chatId);
        appId = (chatLog as any)?.appId ?? null;
      }
      Logger.debug(`[TTSService] 使用的appId: ${appId}`, 'TTSService');

      // 基础选项：仅限"应用绑定了音色的情绪 + 应用默认情绪"；并取出情绪-音色对
      const options = await this.getAppEmotionOptions(appId);
      const pairs = await this.getAppEmotionPairs(appId);
      try {
        Logger.debug(
          `应用情绪选项(${appId ?? 'null'}): ${options.join(', ') || '[]'}`,
          'TTSService',
        );
        Logger.debug(
          `应用情绪-音色对(${appId ?? 'null'}): ${
            pairs.map(p => p.emotion + '=>' + p.voiceId).join(', ') || '[]'
          }`,
          'TTSService',
        );
      } catch {}

      // 使用AI从选项中选择情绪
      let chosen = await this.chooseEmotionFromOptions(psychologicalDesc, prompt, options);
      if (!chosen) {
        const fallback = await this.getAppDefaultEmotion(appId, options);
        chosen = { emotion: fallback, method: 'default' };
        Logger.debug(`AI未识别到合适情绪，使用应用默认情绪: ${fallback}`, 'TTSService');
      }

      const finalEmotion = chosen.emotion;
      try {
        Logger.debug(
          `最终情绪: ${finalEmotion}，识别方法: ${chosen.method || 'unknown'}`,
          'TTSService',
        );
      } catch {}

      if (finalEmotion) {
        // 直接从 app_emotion_voices 的对中找 voiceId
        const mappedVoice = pairs.find(p => p.emotion === finalEmotion)?.voiceId || null;
        if (mappedVoice) {
          Logger.debug(
            `命中情绪映射: emotion=${finalEmotion}, voice=${mappedVoice} (appId=${
              appId ?? 'global'
            })`,
            'TTSService',
          );
          const ttsParams = this.mapEmotionToTtsParams(finalEmotion);
          try {
            Logger.debug(`情绪合成参数: ${JSON.stringify(ttsParams)}`, 'TTSService');
          } catch {}
          return await doTtsWithVoice(mappedVoice, ttsParams);
        }
        Logger.debug(
          `未找到情绪映射: emotion=${finalEmotion}, appId=${appId ?? 'null'}，尝试应用默认音色`,
          'TTSService',
        );
      }

      // 2) 若未命中情绪映射，则回退到应用绑定的默认音色
      if (appId) {
        try {
          const map = await this.appVoiceRepo.findOne({ where: { appId, isDefault: 1 } });
          const voiceId = map?.voiceId;
          if (voiceId) {
            Logger.debug(
              `检测到应用(${appId})绑定默认音色: ${voiceId}，使用角色音色进行TTS`,
              'TTSService',
            );
            const ttsParams = this.mapEmotionToTtsParams(finalEmotion);
            try {
              Logger.debug(`默认音色合成参数: ${JSON.stringify(ttsParams)}`, 'TTSService');
            } catch {}
            return await doTtsWithVoice(voiceId, ttsParams);
          }
        } catch (e: any) {
          Logger.warn(`[TTSService] 音色合成失败: ${e?.message || e}`, 'TTSService');
          // 音色合成失败，返回具体错误信息
          const errorMsg = e?.message || '音色合成失败';
          return res.status(500).send({
            message: `语音合成失败: ${errorMsg}`,
            detail: '请检查音色配置是否正确，或联系管理员',
          });
        }
      }
    } catch (e: any) {
      Logger.warn(`[TTSService] 情绪/角色音色路径检查失败: ${e?.message || e}`, 'TTSService');
    }

    // 3) 没有配置任何音色，返回错误提示
    Logger.error('[TTSService] 未配置任何音色，无法进行TTS', 'TTSService');
    return res.status(400).send({ message: '请先为角色配置音色后再进行语音合成' });
  }
}
