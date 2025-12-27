import {
  convertUrlToBase64,
  formatUrl,
  getClientIp,
  getTokenCount,
  removeThinkTags,
} from '@/common/utils';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
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
import { StickerService } from '../sticker/sticker.service';
import { UploadService } from '../upload/upload.service';
import { UserEntity } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { UserAppSettingsService } from '../userAppSettings/userAppSettings.service';
import { UserBalanceService } from '../userBalance/userBalance.service';
import { VoiceService } from '../voice/voice.service';
import { VoiceEntity } from '../voice/voice.entity';
import { MaobingCookieUtil } from '@/common/utils/maobing-cookie.util';
import {
  cleanTextForTTS as cleanTextForTTSUtil,
  deduplicateConsecutiveAssistantMessages as deduplicateConsecutiveAssistantMessagesUtil,
  extractPsychologicalDescription as extractPsychologicalDescriptionUtil,
  getTimeContextPrompt as getTimeContextPromptUtil,
  isRoleSignatureOnly as isRoleSignatureOnlyUtil,
  removeBracketedContent as removeBracketedContentUtil,
  removeRepeatedPhrases as removeRepeatedPhrasesUtil,
  removeRoleNamePrefix as removeRoleNamePrefixUtil,
  splitAssistantReplies as splitAssistantRepliesUtil,
  splitTextForTTS as splitTextForTTSUtil,
  clampReplyCount as clampReplyCountUtil,
} from './utils/text.utils';
import { StickerMessageHelper } from './utils/sticker.helper';
import { EmotionHelper } from './utils/emotion.helper';
import { TtsHelper } from './utils/tts.helper';

type VoiceProvider = 'dashscope' | 'gpt-sovits' | 'minimax';

@Injectable()
export class ChatService {
  private readonly stickerHelper: StickerMessageHelper;
  private readonly emotionHelper: EmotionHelper;
  private readonly ttsHelper: TtsHelper;

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
    @InjectRepository(VoiceEntity)
    private readonly voiceRepo: Repository<VoiceEntity>,
  ) {
    this.stickerHelper = new StickerMessageHelper(
      this.stickerService,
      this.chatLogService,
      this.logDebug.bind(this),
    );
    this.emotionHelper = new EmotionHelper({
      appEmotionVoiceRepo: this.appEmotionVoiceRepo,
      voiceRepo: this.voiceRepo,
      appVoiceRepo: this.appVoiceRepo,
      globalConfigService: this.globalConfigService,
      logDebug: this.logDebug.bind(this),
    });
    this.ttsHelper = new TtsHelper({
      voiceService: this.voiceService,
      modelsService: this.modelsService,
      userBalanceService: this.userBalanceService,
      chatLogService: this.chatLogService,
      appVoiceRepo: this.appVoiceRepo,
      voiceRepo: this.voiceRepo,
      emotionHelper: this.emotionHelper,
      logDebug: this.logDebug.bind(this),
    });
  }

  // Gate verbose chat logs to avoid flooding production unless explicitly enabled.
  private readonly enableVerboseChatLogs =
    process.env.CHAT_DEBUG_LOG_ENABLED === 'true' || process.env.NODE_ENV === 'development';
  private readonly responsePreviewLimit = (() => {
    const envLimit = Number(process.env.CHAT_RESPONSE_LOG_LIMIT);
    if (Number.isFinite(envLimit) && envLimit >= 30) {
      return Math.min(envLimit, 500);
    }
    return 180;
  })();

  private logDebug(message: any, context = ChatService.name) {
    if (!this.enableVerboseChatLogs) {
      return;
    }
    Logger.debug(message, context);
  }

  private buildResponsePreview(content?: string | null): string {
    if (!content) {
      return '[empty]';
    }
    const compact = content.replace(/\s+/g, ' ').trim();
    if (!compact) {
      return '[empty]';
    }
    if (compact.length <= this.responsePreviewLimit) {
      return compact;
    }
    return `${compact.slice(0, this.responsePreviewLimit)}...<truncated>`;
  }

  private logModelResponsePreview(modelLabel: string, content?: string | null) {
    const preview = this.buildResponsePreview(content);
    const label = modelLabel || 'LLM';
    Logger.log(`[${label}] 模型返回: ${content}`, ChatService.name);
  }

  private getTimeContextPrompt() {
    return getTimeContextPromptUtil();
  }

  private extractPsychologicalDescription(text?: string | null) {
    return extractPsychologicalDescriptionUtil(text);
  }

  private removeRoleNamePrefix(text?: string | null) {
    return removeRoleNamePrefixUtil(text);
  }
  removeBracketedContent(text?: string | null, removeTranslation = false): string {
    return removeBracketedContentUtil(text, removeTranslation);
  }

  cleanTextForTTS(text?: string | null): string {
    return cleanTextForTTSUtil(text);
  }

  splitTextForTTS(text: string, maxChunkLength?: number, minChunkLength: number = 10): string[] {
    return splitTextForTTSUtil(text, maxChunkLength, minChunkLength);
  }

  private isRoleSignatureOnly(content?: string | null): boolean {
    return isRoleSignatureOnlyUtil(content);
  }

  /**
   * 去除大模型返回内容中的重复部分
   * 检测并移除连续重复的内容（如 "ABCABC" -> "ABC"）
   *
   * @param text 大模型返回的文本
   * @returns 去重后的文本
   */
  private removeDuplicateContent(text: string): string {
    if (!text || text.length < 4) return text;

    const len = text.length;

    // 尝试不同长度的重复检测（从较长的开始，找到最长的重复模式）
    // 重复部分长度至少为总长度的1/4，最多为总长度的一半
    for (
      let patternLen = Math.floor(len / 2);
      patternLen >= Math.max(2, Math.floor(len / 4));
      patternLen--
    ) {
      const pattern = text.substring(0, patternLen);
      let repeatCount = 0;
      let pos = 0;

      // 计算pattern重复的次数
      while (pos + patternLen <= len && text.substring(pos, pos + patternLen) === pattern) {
        repeatCount++;
        pos += patternLen;
      }

      // 检查剩余部分是否是pattern的前缀（部分重复）
      const remaining = text.substring(pos);
      const isPartialMatch = remaining.length > 0 && pattern.startsWith(remaining);

      // 如果重复2次或以上，且剩余部分要么为空要么是部分匹配
      if (repeatCount >= 2 && (remaining.length === 0 || isPartialMatch)) {
        Logger.log(
          `[removeDuplicateContent] 检测到重复内容，重复${repeatCount}次，pattern长度=${patternLen}`,
          'ChatService',
        );
        return pattern;
      }
    }

    return text;
  }

  private deduplicateConsecutiveAssistantMessages(
    messages: Array<{ role: string; content: string | any }>,
  ): Array<{ role: string; content: string | any }> {
    return deduplicateConsecutiveAssistantMessagesUtil(messages, this.logDebug.bind(this));
  }

  private removeRepeatedPhrases(
    messages: Array<{ role: string; content: string | any }>,
  ): Array<{ role: string; content: string | any }> {
    return removeRepeatedPhrasesUtil(messages, this.logDebug.bind(this));
  }

  private clampReplyCount(value?: number | null, fallback = 1): number {
    return clampReplyCountUtil(value, fallback);
  }

  private splitAssistantReplies(text?: string | null, maxReplies?: number | null): string[] {
    return splitAssistantRepliesUtil(text, maxReplies);
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

  /**
   * 尝试创建表情包消息（基于场景识别）
   */
  private async maybeCreateStickerMessage(options: {
    basePayload?: Record<string, any> | null;
    referenceText?: string | null;
  }): Promise<{ chatId: number; message: any } | null> {
    return this.stickerHelper.maybeCreateStickerMessage(options);
  }

  /**
   * 创建表情包消息（基于场景识别）
   */
  public async createStickerMessageFromContent(options: {
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
    return this.stickerHelper.createStickerMessageFromContent(options);
  }

  /**
   * 尝试自动发送表情包（AI主动发送，带去重检查）
   * - 场景表情包（有tags）：100%触发 + 去重检查
   * - 普通表情包（无tags）：开启allowEmoji开关后100%触发（暂时关闭30%概率限制）→ 最后去重
   * @returns 表情包信息或 null（不发送）
   */
  private async tryAutoSendSticker(options: {
    userId: number;
    content: string;
    appId?: number | null;
    groupId?: number | null;
    req?: Request;
    allowEmoji?: boolean; // 表情包开关，仅影响普通表情包
    userMessage?: string | null; // 用户消息内容，用于更准确地判断场景
    skipSave?: boolean; // 跳过chatlog保存，由外部统一保存（chat-process-sync模式）
  }): Promise<{
    chatId: number | null;
    imageUrl: string;
    stickerId: number;
    scenario: string | null;
    isScenarioSticker: boolean;
    transferText?: string; // 转账文本，如"转账188"
    stickerData?: any; // skipSave模式下返回完整sticker数据供外部保存
  } | null> {
    return this.stickerHelper.tryAutoSendSticker(options);
  }

  /**
   * 创建表情包消息并保存到数据库
   * @private
   */
  private async createStickerMessage(options: {
    sticker: any;
    isScenarioSticker: boolean;
    userId: number;
    appId?: number | null;
    groupId?: number | null;
    req?: Request;
    content: string;
    skipSave?: boolean; // 跳过chatlog保存，由外部统一保存
  }): Promise<{
    chatId: number | null;
    imageUrl: string;
    stickerId: number;
    scenario: string | null;
    isScenarioSticker: boolean;
    transferText?: string;
    stickerData?: any; // skipSave模式下返回完整数据供外部保存
  }> {
    return this.stickerHelper.createStickerMessage(options);
  }

  /**
   * 检查最近10条消息内是否已发送过转账表情包（去重）
   * @param userId 用户ID
   * @param groupId 会话组ID
   * @param scenario 场景描述（暂时保留参数，但主要检查是否有转账记录）
   * @param imageUrl 表情包图片URL
   * @returns true=已发送过（应跳过），false=未发送过（可以发送）
   */
  private async checkIfScenarioStickerAlreadySent(
    userId: number,
    groupId: number | null,
    scenario: string,
    imageUrl: string,
  ): Promise<boolean> {
    return this.stickerHelper.checkIfScenarioStickerAlreadySent(
      userId,
      groupId,
      scenario,
      imageUrl,
    );
  }

  /**
   * 检查最近10条消息内是否已发送过相同场景/图片的普通表情包（去重）
   * 与场景表情包不同，普通表情包只检查相同场景或相同图片，不同场景可以发送
   * @param userId 用户ID
   * @param groupId 会话组ID
   * @param scenario 场景描述
   * @param imageUrl 表情包图片URL
   * @returns true=已发送过相同的（应跳过），false=未发送过（可以发送）
   */
  private async checkIfNormalStickerAlreadySent(
    userId: number,
    groupId: number | null,
    scenario: string,
    imageUrl: string,
  ): Promise<boolean> {
    return this.stickerHelper.checkIfNormalStickerAlreadySent(userId, groupId, scenario, imageUrl);
  }

  private async generateVoiceReplyForMessage(options: {
    text: string;
    chatId: number | null;
    appId: number | null;
    req: Request;
  }): Promise<{ ttsUrl: string; duration: number } | null> {
    const { text, chatId, appId, req } = options;

    Logger.log(
      `[generateVoiceReplyForMessage] 🎤 开始生成语音回复 - appId=${appId}, chatId=${chatId}，复用 ttsProcess 逻辑`,
      'ChatService',
    );

    // 构造 ttsProcess 需要的参数
    const body = {
      chatId,
      prompt: text,
      appId,
    };

    // 构造一个模拟的 res 对象来捕获结果
    let ttsResult: { ttsUrl?: string; duration?: number } | null = null;

    const mockRes: any = {
      status: () => mockRes,
      send: (data: any) => {
        if (data?.ttsUrl) {
          ttsResult = {
            ttsUrl: data.ttsUrl,
            duration: data.duration,
          };
        }
        return mockRes;
      },
    };

    try {
      // 直接调用 ttsProcess，复用其完整的情绪识别逻辑
      await this.ttsProcess(body, req, mockRes);

      if (ttsResult?.ttsUrl) {
        Logger.log(
          `[generateVoiceReplyForMessage] ✓ TTS生成成功 - url=${ttsResult.ttsUrl}, duration=${ttsResult.duration}s`,
          'ChatService',
        );
        return {
          ttsUrl: ttsResult.ttsUrl,
          duration: ttsResult.duration || 0,
        };
      } else {
        Logger.warn('[generateVoiceReplyForMessage] ttsProcess 未返回有效结果', 'ChatService');
        return null;
      }
    } catch (error: any) {
      Logger.warn(
        `[generateVoiceReplyForMessage] TTS生成失败: ${error?.message || error}`,
        'ChatService',
      );
      return null;
    }
  }

  // 将情绪映射为 TTS 合成参数（基于标准情绪名称）
  private getAppEmotionConfig(
    appId: number | null,
    normalize: boolean = true,
  ): Promise<{
    options: string[];
    pairs: Array<{ emotion: string; voiceId: string }>;
    voiceProviders: Record<string, VoiceProvider>;
  }> {
    return this.emotionHelper.getAppEmotionConfig(appId, normalize);
  }

  private getAppEmotionOptions(appId: number | null): Promise<string[]> {
    return this.emotionHelper.getAppEmotionOptions(appId);
  }

  private getAppEmotionPairs(
    appId: number | null,
  ): Promise<Array<{ emotion: string; voiceId: string }>> {
    return this.emotionHelper.getAppEmotionPairs(appId);
  }

  private getAppDefaultEmotion(
    appId: number | null,
    options: string[],
    normalize: boolean = true,
  ): Promise<string> {
    return this.emotionHelper.getAppDefaultEmotion(appId, options, normalize);
  }

  private detectEmotionByAI(
    text: string,
    options: string[],
    psychologicalDesc: string | null,
  ): Promise<string | null> {
    return this.emotionHelper.detectEmotionByAI(text, options, psychologicalDesc);
  }

  private chooseEmotionFromOptions(
    psychologicalDesc: string | null,
    fullText: string,
    options: string[],
  ): Promise<{ emotion: string; method: string } | null> {
    return this.emotionHelper.chooseEmotionFromOptions(psychologicalDesc, fullText, options);
  }

  async detectEmotionForVoiceCall(
    text: string,
    appId: number | null,
  ): Promise<{ emotion: string; voiceId: string; method: string } | null> {
    return this.emotionHelper.detectEmotionForVoiceCall(text, appId, t =>
      this.extractPsychologicalDescription(t),
    );
  }

  /**
   * 预先判断完整文本的情绪和对应音色
   * 用于 chat-process-sync 接口，在分段TTS生成前统一判断情绪
   * @param text 完整的回复文本
   * @param appId 应用ID
   * @returns { emotion, voiceId, method } 或 null
   */
  async preDetectEmotionForTts(
    text: string,
    appId: number | null,
  ): Promise<{ emotion: string; voiceId: string; method: string } | null> {
    return this.emotionHelper.detectEmotionForVoiceCall(text, appId, t =>
      this.extractPsychologicalDescription(t),
    );
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 获取用户信息（姓名和简介）
   * @param userId 用户ID
   * @returns 用户名称和简介
   */
  private async getUserInfo(userId: number): Promise<{
    userName: string;
    userBio: string;
  }> {
    try {
      const user = await this.userEntity.findOne({ where: { id: userId } });
      if (user) {
        return {
          userName: user.username || user.nickname || `用户${user.id}`,
          userBio: user.bio || '',
        };
      }
    } catch (error) {
      Logger.warn(`[用户信息] 获取失败: ${error?.message}`, 'ChatService');
    }
    return { userName: '用户', userBio: '' };
  }

  /**
   * 构建用户简介文本
   * @param userName 用户名
   * @param userBio 用户简介
   * @returns 格式化的用户简介文本
   */
  private buildUserProfileText(userName: string, userBio: string): string {
    if (userName && userBio) {
      return `用户名：${userName}\n用户简介：${userBio}`;
    } else if (userName) {
      return `用户名：${userName}`;
    } else if (userBio) {
      return `用户简介：${userBio}`;
    }
    return '';
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

      this.logDebug(`[图片识别] 开始识别图片: ${imageUrl}`, 'ChatService');

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
                    text: '用一句话简要描述这张图片的主要内容。',
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
      this.logDebug(`[图片识别] 识别结果: ${result}`, 'ChatService');

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
      audioUrl,
      voiceDuration,
      extraParam,
      model,
      action,
      modelName,
      modelAvatar,
      // 转账相关字段
      transferAmount,
      transferDesc,
      transferStatus,
    } = body;

    this.logDebug(`body: ${JSON.stringify(body)}`, 'ChatService');

    // 图片识别逻辑：当用户只发送图片时，先调用通义千问识别图片
    if (imageUrl && (!prompt || prompt.trim().length === 0)) {
      this.logDebug('[图片识别] 检测到用户只发送图片，开始识别...', 'ChatService');
      const imageDescription = await this.recognizeImageWithQwen(imageUrl);
      if (imageDescription) {
        prompt = `[这是一张图片，内容如下]\n${imageDescription}\n\n请根据图片内容进行回复。`;
        this.logDebug(`[图片识别] 已将识别结果设置为prompt: ${prompt}`, 'ChatService');
      } else {
        Logger.warn('[图片识别] 图片识别失败，使用默认提示', 'ChatService');
        prompt = '请看这张图片，这是什么？';
      }
    }

    // 解析 appId：优先使用 body.appId；若缺失且存在 groupId，则尝试从群组信息推断
    let appId = body?.appId ?? null;
    this.logDebug(
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
          this.logDebug(
            `从 groupId=${(options as any).groupId} 推断 appId=${appId}`,
            'ChatService',
          );
        }
      } catch (e: any) {
        Logger.warn(`无法从群组推断 appId: ${e?.message || e}`, 'ChatService');
      }
    }
    this.logDebug(`[好感度调试] 最终 appId=${appId}`, 'ChatService');

    // 获取应用信息
    let appInfo;
    if (appId) {
      this.logDebug(`正在使用应用ID: ${appId}`);
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
        this.logDebug(`检测到会员专属应用: ${isAppMemberOnly}`);
        const userCatIds = await this.userBalanceService.getUserApps(req.user.id);
        this.logDebug(`用户权限分类: ${userCatIds.join(',')}`);

        // 获取应用所属的分类ID列表
        const appCatIds = appInfo.catId.split(',').map(id => id.trim());
        this.logDebug(`应用所属分类: ${appCatIds.join(',')}`);

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
    const isCalendarMessage = body?.isCalendarMessage === true;

    // 判断是否为真正的群聊模式（需要检查 isGroupChat 字段）
    let isGroupChat = false;
    if (groupId) {
      try {
        const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
        isGroupChat =
          groupInfo?.isGroupChat === true || (groupInfo?.isGroupChat as any) === 1 || false;
        this.logDebug(
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
        const { userName } = await this.getUserInfo(req.user.id);
        realUserName = userName;
        this.logDebug(`[用户名称] 真实用户名称: ${realUserName}`, 'ChatService');
      } catch (error) {
        this.logDebug(`获取真实用户名称失败: ${error.message}`, 'ChatService');
      }
    } else if (modelName) {
      this.logDebug(`[用户名称] 使用传入的用户名称: ${realUserName}`, 'ChatService');
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
    this.logDebug(`自动回复检查结果: ${JSON.stringify(autoReplyRes)}`, 'ChatService');

    /* 设置对话变量 */
    let currentRequestModelKey = null;
    let appName = '';
    let setSystemMessage = '';
    res && res.status(200);
    const curIp = getClientIp(req);
    let useModelAvatar = '';
    const getResolvedModelAvatar = () =>
      usingPlugin?.pluginImg || useModelAvatar || modelAvatar || '';
    let usingPlugin;

    if (usingPluginId) {
      this.logDebug(`使用插件ID: ${usingPluginId}`, 'ChatService');
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
        this.logDebug(`使用固定模型和应用预设`, 'ChatService');
      } else {
        // 使用应用预设
        appInfo.preset && (setSystemMessage = appInfo.preset);
        currentRequestModelKey = await this.modelsService.getCurrentModelKeyInfo(model);
        this.logDebug(`使用应用预设模式`, 'ChatService');
      }

      // 将当前角色的任务信息添加到预设中（支持群聊和单聊）
      if (groupId && appId) {
        try {
          const groupInfo: any = await this.chatGroupService.getGroupInfoFromId(groupId);
          const members = JSON.parse(groupInfo?.members || '[]') || [];

          this.logDebug(
            `[角色任务] 尝试获取任务信息，isGroupChat=${isGroupChat}, groupId=${groupId}, appId=${appId}, members数量=${members.length}`,
            'ChatService',
          );

          const currentMember = members.find((m: any) => Number(m.appId) === Number(appId));

          if (currentMember) {
            this.logDebug(
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
              this.logDebug(`[角色任务] 从taskDetail获取任务: ${taskTitle}`, 'ChatService');
            } else if (Array.isArray(currentMember.tasks) && currentMember.tasks.length > 0) {
              // 如果有tasks数组，找第一个未完成的任务
              const pendingTask = currentMember.tasks.find(
                (t: any) => (t?.status || 'todo') !== 'done',
              );
              if (pendingTask) {
                taskTitle = pendingTask.title || '';
                taskStatus = pendingTask.status || 'todo';
                this.logDebug(`[角色任务] 从tasks数组获取任务: ${taskTitle}`, 'ChatService');
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
              this.logDebug(
                `[角色任务] 已将角色任务添加到预设中，appId=${appId}, 任务="${taskTitle}"`,
                'ChatService',
              );
            } else {
              this.logDebug(`[角色任务] 当前成员没有任务信息`, 'ChatService');
            }
          } else {
            this.logDebug(`[角色任务] 未找到appId=${appId}的成员`, 'ChatService');
          }
        } catch (error) {
          Logger.warn(`[角色任务] 获取角色任务失败: ${error.message}`, 'ChatService');
        }
      } else {
        this.logDebug(`[角色任务] 跳过任务获取，groupId=${groupId}, appId=${appId}`, 'ChatService');
      }

      // 获取时间相关提示（当前时间将在后面统一添加到末尾）
      const { timeAnswerPrompt } = this.getTimeContextPrompt();

      // 构建角色扮演系统提示词
      const rolePlayPrompt = `
**以下是你的人物基本信息和任务信息：**
${setSystemMessage}

${appName ? `\n**用户对你的爱称：** ${appName}` : ''}

要求：
- 根据上述提供的角色设定，以第一人称视角进行表达。
- 在回答时，尽可能地融入该角色的性格特点、语言风格以及其特有的口头禅或经典台词。
- 【语言一致性要求】根据角色设定选择使用的语言，一旦确定语言后必须全程保持一致。如果使用中文回复，则绝对禁止在对话中突然切换成英文或其他外语；如果使用外语回复，也必须全程使用该外语。严禁出现前一句中文、后一句英文的情况。
- 每次回复内容不能超过500个字（括号内的心理描述、动作描写不计入字数限制）。
- 【单段回复要求】每次只能回复一段内容，不要一次性回复多段。即使历史对话中你回复了多条消息，当前回复也只能是一段完整的内容，不要用换行分隔成多段独立的回复。
- ${timeAnswerPrompt}
${appName ? `- 用户会亲切地称呼你为"${appName}"，你应该自然地接受这个爱称。` : ''}`;

      setSystemMessage = rolePlayPrompt;
      // - 回复内容必须回复1个句子，并且用空行隔开，每个句子内容20字以内（如需添加心理描述，心理描述的括号内容不计入字数）。
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
        this.logDebug(`使用流程图插件`, 'ChatService');
      } else {
        // 使用全局预设
        const { timeAnswerPrompt } = this.getTimeContextPrompt();

        currentRequestModelKey = await this.modelsService.getCurrentModelKeyInfo(model);

        // timeAnswerPrompt 和中文回复限制始终添加，当前时间将在末尾统一添加
        const chineseReplyPrompt =
          '即使用户使用英文或其他外语提问，除非用户明确要求使用外语回复，否则一律使用中文进行回复。';
        const timePrefix = `${timeAnswerPrompt}\n${chineseReplyPrompt}\n\n`;

        if (currentRequestModelKey.systemPromptType === 1) {
          setSystemMessage = timePrefix + systemPreMessage + currentRequestModelKey.systemPrompt;
        } else if (currentRequestModelKey.systemPromptType === 2) {
          setSystemMessage = timePrefix + currentRequestModelKey.systemPrompt;
        } else {
          setSystemMessage = timePrefix + systemPreMessage;
        }

        this.logDebug(`使用默认系统预设`, 'ChatService');
      }
    }

    if (!currentRequestModelKey) {
      this.logDebug('未找到当前模型key，切换至全局模型', 'ChatService');
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
      this.logDebug(`群聊模式：跳过模型限制和余额检查`, 'ChatService');
    }

    // 整理对话参数
    // 如果有 appId 和 appInfo，但没有传入 modelName，则使用角色名称
    let useModeName = modelName;
    if (appId && appInfo && !modelName) {
      useModeName = appInfo.name;
      this.logDebug(`[模型名称] 从 appId=${appId} 获取角色名称: ${useModeName}`, 'ChatService');
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
      this.logDebug('[图片识别] 模型不支持图片，开始识别...', 'ChatService');
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
          this.logDebug(
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
      this.logDebug('[图片识别] 检测到prompt中已包含图片识别结果，跳过重复识别', 'ChatService');
    }

    // 群聊模式下，检查是否已经保存过用户消息（避免重复保存）
    let userSaveLog;
    let userLogId;

    // 跳过用户消息保存：当 skipPromptInHistory 为 true 时不保存用户消息
    const skipPromptInHistory = options?.skipPromptInHistory === true;
    // 跳过保存到数据库模式：不保存但会添加到上下文
    const skipSave = options?.skipSaveToDatabase === true;
    // chat-process-sync模式：跳过保存完整的assistant消息，但保存用户消息
    const isChatProcessSync = (body as any)?._isChatProcessSync === true;

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
          this.logDebug(
            `[群聊] 使用已存在的用户消息，id=${userLogId}, appId=${appId}`,
            'ChatService',
          );
        } else {
          // 获取真实用户名
          let realUserName = '用户';
          try {
            const user = await this.userEntity.findOne({ where: { id: req.user.id } });
            if (user) {
              realUserName = user.username || user.nickname || `用户${user.id}`;
            }
          } catch (error) {
            this.logDebug(`获取用户名称失败: ${error.message}`, 'ChatService');
          }

          // 第一次保存用户消息
          userSaveLog = await this.chatLogService.saveChatLog({
            appId: appId,
            curIp,
            userId: req.user.id,
            type: modelType ? modelType : 1,
            fileUrl: fileUrl ? fileUrl : null,
            imageUrl: imageUrl ? imageUrl : null,
            audioUrl: audioUrl ? audioUrl : null,
            ttsDuration: voiceDuration ? voiceDuration : null,
            content: prompt,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            model: useModel,
            modelName: realUserName, // 使用真实用户名
            role: 'user',
            groupId: groupId ? groupId : null,
            // 转账相关字段
            transferAmount: transferAmount ? transferAmount : null,
            transferDesc: transferDesc ? transferDesc : null,
            transferStatus: transferStatus ? transferStatus : null,
          });
          userLogId = userSaveLog.id;
          this.logDebug(
            `[群聊] 保存新的用户消息，id=${userLogId}, appId=${appId}, userName=${realUserName}`,
            'ChatService',
          );
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
          this.logDebug(
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
              this.logDebug(
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
      // 强制用户消息的展示名称为"我"，与角色名区分
      const userDisplayName = '我';
      userSaveLog = await this.chatLogService.saveChatLog({
        appId: appId,
        curIp,
        userId: req.user.id,
        type: modelType ? modelType : 1,
        fileUrl: fileUrl ? fileUrl : null,
        imageUrl: imageUrl ? imageUrl : null,
        audioUrl: audioUrl ? audioUrl : null,
        ttsDuration: voiceDuration ? voiceDuration : null,
        content: prompt,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        model: useModel,
        modelName: userDisplayName,
        role: 'user',
        groupId: groupId ? groupId : null,
        // 转账相关字段
        transferAmount: transferAmount ? transferAmount : null,
        transferDesc: transferDesc ? transferDesc : null,
        transferStatus: transferStatus ? transferStatus : null,
      });
      userLogId = userSaveLog.id;
      this.logDebug(`[普通模式] 保存用户消息，modelName=${userDisplayName}`, 'ChatService');
    } else if (skipPromptInHistory) {
      // skipPromptInHistory 模式：不保存用户消息
      this.logDebug(
        `[skipPromptInHistory] 跳过用户消息保存，skipPromptInHistory=true`,
        'ChatService',
      );
      userLogId = null;
    } else if (skipSave) {
      // 跳过保存模式：不保存用户消息到数据库，但会添加到上下文
      this.logDebug(`[跳过保存] skipSaveToDatabase=true，不保存用户消息到数据库`, 'ChatService');
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
        this.logDebug(`获取群聊助手名称失败: ${error.message}`, 'ChatService');
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
              this.logDebug(`解析成员数据失败: ${error.message}`, 'ChatService');
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
              modelAvatar: getResolvedModelAvatar(),
              isOpeningRemark: true, // 标记为开场白
            });
            this.logDebug(
              `[开场白] 已插入角色开场白到会话记录，groupId=${groupId}, appId=${appId}`,
              'ChatService',
            );
          }
        }
      } catch (error) {
        this.logDebug(`检查或插入角色开场白失败: ${error.message}`, 'ChatService');
      }
    }

    // 🔥 在保存 chatlog 之前执行饼干扣费（仅对开放接口调用）
    if (req.user.role === 'visitor' && (body as any)?._cookieChargeInfo) {
      const chargeInfo = (body as any)._cookieChargeInfo;
      const COOKIE_RULES = {
        text: { cost: 1, remark: '消耗饼干-角色文字回复' },
        voice: { cost: 1, remark: '消耗饼干-角色语音回复' },
        image: { cost: 1, remark: '消耗饼干-用户发送图片' },
      };
      const rule = COOKIE_RULES[chargeInfo.messageType] || COOKIE_RULES.text;

      const response = await MaobingCookieUtil.deductCookies({
        userId: chargeInfo.userId,
        amount: rule.cost,
        remark: rule.remark,
        maobingBaseUrl: chargeInfo.maobingBaseUrl,
        token: chargeInfo.token,
      });

      if (!response.success) {
        Logger.error(`[饼干扣费] 扣费失败: ${response.message}`, 'ChatService');
        throw new HttpException(
          response.message || '饼干不足，无法继续对话',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      Logger.log(
        `[饼干扣费] 扣费成功 - userId: ${chargeInfo.userId}, 消耗: ${rule.cost}个饼干, 类型: ${chargeInfo.messageType}`,
        'ChatService',
      );

      // 保存扣费凭证用于可能的返还
      (body as any)._cookieChargeReceipt = {
        userId: chargeInfo.userId,
        amount: rule.cost,
        type: chargeInfo.messageType,
        maobingBaseUrl: chargeInfo.maobingBaseUrl,
        token: chargeInfo.token,
      };
    }

    // 如果设置了 skipSaveToDatabase，则不保存 assistant 消息到数据库
    // 如果是 chat-process-sync 模式，也跳过保存（因为会逐句保存）
    let assistantSaveLog;
    let assistantLogId;

    const resolvedModelAvatar = getResolvedModelAvatar();
    (body as any)._resolvedModelAvatar = resolvedModelAvatar;

    if (!skipSave && !isChatProcessSync) {
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
        modelAvatar: resolvedModelAvatar,
        pluginParam: usingPlugin?.parameters
          ? usingPlugin.parameters
          : modelType === 2
          ? useModel
          : null,
      });
      assistantLogId = assistantSaveLog.id;
      this.logDebug(`[保存] 已保存 assistant 消息到数据库，id=${assistantLogId}`, 'ChatService');
    } else {
      // skipSaveToDatabase 模式或 chat-process-sync 模式：不保存 assistant 消息
      assistantLogId = null;
      if (isChatProcessSync) {
        this.logDebug(
          `[跳过保存] chat-process-sync模式，不保存完整 assistant 消息（将逐句保存）`,
          'ChatService',
        );
      } else {
        this.logDebug(
          `[跳过保存] skipSaveToDatabase=true，不保存 assistant 消息到数据库`,
          'ChatService',
        );
      }
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
              // 心理描述开关（兼容布尔值和数字）
              if (typeof groupInfo.describingMental !== 'undefined') {
                enablePsychologicalDesc = !!groupInfo.describingMental;
                this.logDebug(
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
                this.logDebug(
                  `[对话记忆] 使用会话组配置: groupId=${groupId}, conversationMemoryCount=${groupConversationMemoryCount}`,
                  'ChatService',
                );
              }

              // 语音回复模式
              if (groupInfo.voiceReplyMode) {
                groupVoiceReplyMode = groupInfo.voiceReplyMode;
                this.logDebug(
                  `[语音回复] 使用会话组配置: groupId=${groupId}, voiceReplyMode=${groupVoiceReplyMode}`,
                  'ChatService',
                );
              }

              // 表情包和拍一拍开关（兼容布尔值和数字）
              if (typeof groupInfo.allowEmoji !== 'undefined') {
                groupAllowEmoji = !!groupInfo.allowEmoji;
                this.logDebug(
                  `[表情包] 使用会话组配置: groupId=${groupId}, allowEmoji=${groupAllowEmoji}`,
                  'ChatService',
                );
              }

              if (typeof groupInfo.allowTap !== 'undefined') {
                groupAllowTap = !!groupInfo.allowTap;
                this.logDebug(
                  `[拍一拍] 使用会话组配置: groupId=${groupId}, allowTap=${groupAllowTap}`,
                  'ChatService',
                );
              }

              // 最多回复条数（群聊使用）
              if (typeof groupInfo.maxReplyCount === 'number' && groupInfo.maxReplyCount > 0) {
                groupMaxReplyCount = groupInfo.maxReplyCount;
                this.logDebug(
                  `[最多回复] 使用会话组配置: groupId=${groupId}, maxReplyCount=${groupMaxReplyCount}`,
                  'ChatService',
                );
              }
            }

            // 如果会话组没有配置心理描述，使用用户级别配置
            if (!groupInfo || typeof groupInfo.describingMental === 'undefined') {
              enablePsychologicalDesc =
                await this.userAppSettingsService.getEnablePsychologicalDesc(req.user.id, appId);
              this.logDebug(
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
            this.logDebug(
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
          this.logDebug(
            `[心理描述] 无groupId，使用用户级别配置: enable=${enablePsychologicalDesc}`,
            'ChatService',
          );
        }

        // 如果开启了心理描述，在system message中添加要求
        if (enablePsychologicalDesc) {
          const psychologicalDescPrompt = `\n\n【重要-心理描述】你必须在每次回复中加上心理活动和动作描述，使用中文圆括号（）括起来。这些描述不计入字数限制。\n示例："我很高兴见到你（微笑着说）"、"真的吗（眼神中充满期待）"、"把手伸出来~（伸出手，温柔地说）"`;
          setSystemMessage += psychologicalDescPrompt;
        } else {
          // 心理描述关闭时，明确告知AI不要添加心理描述和动作描述
          const noPsychologicalDescPrompt = `\n\n【重要限制】回复内容中不要添加任何心理描述和动作描述，不要使用括号（）描述心理活动或动作，只回复纯消息内容。`;
          setSystemMessage += noPsychologicalDescPrompt;
        }
      } catch (error) {
        Logger.warn(`获取心理描述开关失败: ${error?.message || error}`, 'ChatService');
      }
    }

    // 添加防重复提示（增强版）
    setSystemMessage += `\n\n【重要提示】
- 请务必根据用户的最新消息给出全新的、有意义的回应。
- 【严禁重复】绝对不要复制历史对话中你说过的任何句子或短语！即使历史中某句话出现多次，也绝对禁止再次使用。每次回复必须用全新的表达方式，展现角色的不同面貌。
- 【相似场景处理】当遇到与之前相似的场景时（如多次收到转账、多次收到礼物、多次被夸奖等），必须给出完全不同的回应。可以从不同角度回应：表达惊喜、开玩笑、调侃、撒娇、表达感动、关心对方等。绝对禁止使用相同的句式或相似的表达。
- 【时间问题】如果用户询问时间，根据系统消息中的当前时间回答，用角色风格简洁回复即可，不要添加额外的抒情或感慨。
- 认真理解用户当前说的话，给出针对性的、独特的回复。`;

    // ========== 以下为会变动的内容，统一放到提示词末尾 ==========

    // 1. 添加用户信息（放在历史总结之前）
    const { userName, userBio } = await this.getUserInfo(req.user.id);
    const userProfileText = this.buildUserProfileText(userName, userBio);
    if (userProfileText) {
      setSystemMessage += `\n\n【用户信息】\n${userProfileText}`;
    }

    // 2. 添加对话历史总结（如果有）
    // 注意：近10轮的历史对话会通过 messagesHistory 传给模型，这里只添加更早的总结
    if (groupId) {
      try {
        const historySummary = await this.conversationSummaryService.getSummary(groupId);
        if (historySummary) {
          setSystemMessage += `\n\n【更早的对话历史总结】\n${historySummary}\n（以上是之前对话的总结，近期对话详情见下方历史消息）`;
          this.logDebug(
            `[对话总结] 已添加历史总结到system message末尾，长度=${historySummary.length}字`,
            'ChatService',
          );
        }
      } catch (error: any) {
        Logger.warn(`[对话总结] 获取历史总结失败: ${error?.message || error}`, 'ChatService');
      }
    }

    // 3. 添加当前时间（放在最后，确保每次请求都是最新时间）
    const { currentDate, timeContextPrompt } = this.getTimeContextPrompt();
    // 只有备忘录消息才添加时间情景提示，普通对话只显示当前时间
    const isCalendarMsg = (body as any)?.isCalendarMessage === true;
    if (isCalendarMsg) {
      setSystemMessage += `\n\n【当前时间】${currentDate}\n${timeContextPrompt}`;
    } else {
      setSystemMessage += `\n\n【当前时间】${currentDate}`;
    }

    /* 获取历史消息 - 固定获取近10轮对话 */
    const RECENT_ROUNDS = 10; // 近10轮历史对话
    const { messagesHistory } = await this.buildMessageFromParentMessageId(
      {
        groupId,
        appId: appId,
        systemMessage: setSystemMessage,
        maxModelTokens,
        maxRounds: RECENT_ROUNDS, // 固定获取近10轮历史
        isConvertToBase64: isConvertToBase64,
        fileUrl: fileUrl,
        imageUrl: imageUrl,
        model: useModel,
        isFileUpload,
        isImageUpload,
        prompt: prompt, // 传入当前用户提问
        userId: req?.user?.id, // 传入当前用户ID
        excludeLogId: userLogId, // 排除当前刚保存的用户消息
        options: options, // 传入 options 参数（包含 skipPromptInHistory 等）
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
                  this.logDebug(
                    `[群聊] 从成员数据中获取开场白: appId=${appId}, openingRemark=${openingRemarkForXingchen.substring(
                      0,
                      50,
                    )}...`,
                    'ChatService',
                  );
                }
              }
            } catch (error) {
              this.logDebug(`获取群聊成员开场白失败: ${error.message}`, 'ChatService');
            }
          }
          // 单聊模式：从 chatlog 中获取开场白（标记为 isOpeningRemark: true 的记录）
          else if (!isGroupChat && groupId && appId) {
            try {
              const openingRemarkLog = await this.chatLogService.getOpeningRemark(groupId, appId);

              if (openingRemarkLog?.content) {
                openingRemarkForXingchen = openingRemarkLog.content;
                this.logDebug(
                  `[单聊] 从 chatlog 中获取开场白: appId=${appId}, openingRemark=${openingRemarkForXingchen.substring(
                    0,
                    50,
                  )}...`,
                  'ChatService',
                );
              } else {
                this.logDebug(
                  `[单聊] chatlog 中未找到开场白记录: groupId=${groupId}, appId=${appId}`,
                  'ChatService',
                );
              }
            } catch (error) {
              this.logDebug(`从 chatlog 获取开场白失败: ${error.message}`, 'ChatService');
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
          const { userName, userBio } = await this.getUserInfo(req.user.id);

          // 构建用户简介文本（包含用户名字和简介）
          const userProfileText = this.buildUserProfileText(userName, userBio);

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

              // 用户信息已在 setSystemMessage 中添加，此处不再重复添加

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
                            this.logDebug(
                              `[群组背景信息] 从 appId=${member.appId} 获取角色名称: ${memberAppInfo.name}`,
                              'ChatService',
                            );
                          }
                        } catch (error) {
                          this.logDebug(
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

              // 添加人物关系信息
              if (groupInfo?.memberRelationships) {
                try {
                  const relationshipsData = JSON.parse(groupInfo.memberRelationships);
                  const relationships = relationshipsData?.relationships || [];
                  if (Array.isArray(relationships) && relationships.length > 0) {
                    groupInfoParts.push('\n人物关系：');
                    for (const rel of relationships) {
                      // memberA 和 memberB 现在已经是名称了，直接使用
                      const nameA = rel.memberA || '未知成员';
                      const nameB = rel.memberB || '未知成员';
                      // 格式：A是B的[关系类型]
                      let relationDesc = `${nameA}是${nameB}的${rel.type}`;
                      if (rel.description) {
                        relationDesc += `（${rel.description}）`;
                      }
                      groupInfoParts.push(relationDesc);
                    }
                    this.logDebug(
                      `[群组背景信息] 已添加人物关系信息，共${relationships.length}条`,
                      'ChatService',
                    );
                  }
                } catch (error) {
                  Logger.warn(`[群聊] 解析人物关系信息失败: ${error.message}`, 'ChatService');
                }
              }

              // 如果有群组信息，插入到messages副本的第一位作为system消息（背景信息）
              if (groupInfoParts.length > 0) {
                const groupBasicInfo = `【群组背景信息】\n${groupInfoParts.join('\n')}}`;
                // 使用system角色，星尘API会将非第一条system消息保留在messages中
                messagesForXingchen.unshift({ role: 'system', content: groupBasicInfo });
                this.logDebug(
                  `[群聊] 已将群组背景信息（含成员任务和行为约束）添加到星尘API请求的messages第一位（system角色）`,
                  'ChatService',
                );
              }
            } catch (error) {
              Logger.warn(`[群聊] 构建群组背景信息失败: ${error.message}`, 'ChatService');
            }
          }
          // 用户信息已在 setSystemMessage 中添加，单聊模式不再单独添加到 messages

          Logger.log(
            `[LLM请求] 心理描述开关: ${enablePsychologicalDesc ? '开启' : '关闭'} | appId=${
              appId ?? 'null'
            } | groupId=${groupId ?? 'null'} | userId=${req?.user?.id ?? 'anonymous'}`,
            ChatService.name,
          );

          const qwenResult = await this.openAIChatService.chatQwenPlusCharacter(
            prompt || '',
            setSystemMessage, // 使用原始systemMessage作为botProfile
            messagesForXingchen, // 使用包含群组背景信息的副本
            imageUrl,
            {
              onProgress: (delta: string) => {
                // 修改：群聊和单聊都应该发送流式数据
                if (delta) {
                  accumulatedText += delta;

                  // 群聊模式：移除角色名前缀
                  let textToSend = accumulatedText;
                  if (isGroupChat) {
                    textToSend = this.removeRoleNamePrefix(accumulatedText);
                  }

                  // 心理描述过滤：如果开关关闭，发送前过滤括号内容
                  if (!enablePsychologicalDesc && appId) {
                    textToSend = this.removeBracketedContent(textToSend);
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

          const qwenText = qwenResult.text || '';
          const qwenUsage = qwenResult.usage;

          // 群聊模式：移除AI返回内容开头的角色名前缀
          let processedQwenText = qwenText;
          if (isGroupChat && qwenText) {
            processedQwenText = this.removeRoleNamePrefix(qwenText);
            this.logDebug(
              `[群聊] 移除角色名前缀 - 原文: "${qwenText.substring(
                0,
                50,
              )}..." -> 处理后: "${processedQwenText.substring(0, 50)}..."`,
              'ChatService',
            );
          }

          // 去除大模型返回内容中的重复部分
          const beforeDedup = processedQwenText;
          processedQwenText = this.removeDuplicateContent(processedQwenText);
          if (beforeDedup !== processedQwenText) {
            this.logDebug(
              `[去重] 原文长度=${beforeDedup.length}, 去重后长度=${processedQwenText.length}`,
              'ChatService',
            );
          }

          // 使用API返回的token数据，如果没有则使用计算值
          let promptTokens = 0;
          let completionTokens = 0;
          if (qwenUsage) {
            promptTokens = qwenUsage.inputTokens || qwenUsage.userTokens || 0;
            completionTokens = qwenUsage.outputTokens || 0;
            this.logDebug(
              `使用Qwen Character返回的token数据 - promptTokens: ${promptTokens}, completionTokens: ${completionTokens}`,
              'ChatService',
            );
          } else {
            // 回退到计算值
            let totalText = '';
            messagesHistory.forEach(msg => {
              totalText += msg.content + ' ';
            });
            promptTokens = await getTokenCount(totalText);
            completionTokens = await getTokenCount(processedQwenText);
            this.logDebug(
              `Qwen Character未返回token数据，使用计算值 - promptTokens: ${promptTokens}, completionTokens: ${completionTokens}`,
              'ChatService',
            );
          }

          response = {
            chatId: assistantLogId,
            userChatId: userLogId || null, // 用户消息的chatId
            modelName: useModeName,
            modelAvatar: '',
            model: useModel,
            status: 2,
            full_content: processedQwenText || '',
            full_reasoning_content: '',
            networkSearchResult: '',
            fileVectorResult: '',
            finishReason: 'stop',
            promptTokens: promptTokens,
            completionTokens: completionTokens,
            totalTokens: promptTokens + completionTokens,
            imageUrl: null,
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

          this.logDebug(`JSON: ${JSON.stringify(response)}`, 'ChatService');

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
              this.logDebug(`检测到敏感词，已进行屏蔽处理`, 'ChatService');
            }
          }

          // 心理描述过滤：如果开关关闭，移除括号内的心理描述内容
          if (!enablePsychologicalDesc && appId) {
            const originalLength = sanitizedAnswer.length;
            sanitizedAnswer = this.removeBracketedContent(sanitizedAnswer);
            if (sanitizedAnswer.length < originalLength) {
              this.logDebug(
                `[心理描述过滤] 已移除心理描述内容，原长度=${originalLength}，过滤后长度=${sanitizedAnswer.length}`,
                'ChatService',
              );
            }
          }

          const splitReplies = this.splitAssistantReplies(sanitizedAnswer, groupMaxReplyCount);
          const normalizedFullContent =
            splitReplies.length > 0 ? splitReplies.join('\n\n') : sanitizedAnswer;
          response.full_content = normalizedFullContent;
          this.logModelResponsePreview(useModeName || useModel, normalizedFullContent);

          const assistantMessagesPayload: any[] = [];
          let extraAssistantLogs: Array<{ chatId: number; content: string }> = [];
          let generatedVoiceUrl: string | null = null;
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
              modelAvatar: resolvedModelAvatar,
              pluginParam:
                assistantSaveLog?.pluginParam ||
                (usingPlugin?.parameters
                  ? usingPlugin.parameters
                  : modelType === 2
                  ? useModel
                  : null),
            });

            if (textReplies.length > 1) {
              extraAssistantLogs = await this.saveAdditionalAssistantReplies(
                textReplies.slice(1),
                assistantLogBasePayload,
              );
              extraAssistantLogs.forEach(item => {
                assistantMessagesPayload.push({
                  chatId: item.chatId,
                  message_type: 'text',
                  content: item.content,
                });
              });
            }

            // 语音回复判断函数：每条消息独立判断是否生成语音
            // - voice_only: 全部发语音（每次都生成）
            // - mixed: 偶尔发一次（按概率生成，文字:语音 = 5:2）
            // - text_only 或其他: 全部发文字
            const shouldGenerateVoiceForMessage = (messageIndex: number): boolean => {
              // 优先使用开放接口传入的语音回复决定（保证扣费和实际生成一致）
              if (extraParam?._voiceReplyDecision !== undefined) {
                this.logDebug(
                  `[语音回复] 消息${messageIndex} 使用开放接口预设决定 - ${
                    extraParam._voiceReplyDecision ? '生成语音' : '仅文字'
                  }`,
                  'ChatService',
                );
                return extraParam._voiceReplyDecision;
              }
              if (groupVoiceReplyMode === 'voice_only') {
                this.logDebug(
                  `[语音回复] 消息${messageIndex} voice_only 模式 - 生成语音`,
                  'ChatService',
                );
                return true;
              }
              if (groupVoiceReplyMode === 'mixed') {
                // 按照 5:2 的比例随机生成语音（约 28.6% 的概率）
                const shouldGenerate = Math.random() < 0.286;
                this.logDebug(
                  `[语音回复] 消息${messageIndex} mixed 模式 - ${
                    shouldGenerate ? '生成语音' : '仅文字'
                  }`,
                  'ChatService',
                );
                return shouldGenerate;
              }
              return false;
            };

            // 第一条消息的语音处理
            if (replyContent && shouldGenerateVoiceForMessage(0)) {
              const voiceReply = await this.generateVoiceReplyForMessage({
                text: replyContent,
                chatId: assistantLogId,
                appId: appId ? Number(appId) : null,
                req,
              });
              if (voiceReply) {
                generatedVoiceUrl = voiceReply.ttsUrl;
                response.ttsUrl = voiceReply.ttsUrl;
                response.audioUrl = voiceReply.ttsUrl;
                response.voiceDuration = voiceReply.duration;
                response.audioDuration = voiceReply.duration;
                if (assistantMessagesPayload.length > 0) {
                  assistantMessagesPayload[0].content_voice = voiceReply.ttsUrl;
                  assistantMessagesPayload[0].voice_duration = voiceReply.duration;
                  assistantMessagesPayload[0].audioDuration = voiceReply.duration;
                }
              }
            }

            // 为分段消息中的每条额外消息独立判断并生成语音
            if (extraAssistantLogs.length > 0) {
              for (let i = 0; i < extraAssistantLogs.length; i++) {
                const extraLog = extraAssistantLogs[i];
                const messageIndex = i + 1;

                if (!shouldGenerateVoiceForMessage(messageIndex)) {
                  continue;
                }

                const extraVoiceReply = await this.generateVoiceReplyForMessage({
                  text: extraLog.content,
                  chatId: extraLog.chatId,
                  appId: appId ? Number(appId) : null,
                  req,
                });
                if (extraVoiceReply) {
                  // 更新 assistantMessagesPayload 中对应的消息
                  const payloadIndex = i + 1; // 第一条消息在index 0，额外消息从index 1开始
                  if (assistantMessagesPayload[payloadIndex]) {
                    assistantMessagesPayload[payloadIndex].content_voice = extraVoiceReply.ttsUrl;
                    assistantMessagesPayload[payloadIndex].voice_duration =
                      extraVoiceReply.duration;
                    assistantMessagesPayload[payloadIndex].audioDuration = extraVoiceReply.duration;
                  }
                  this.logDebug(
                    `[语音回复] 分段消息 ${messageIndex} 语音生成成功 - chatId=${extraLog.chatId}`,
                    'ChatService',
                  );
                }
              }
            }

            // 移除99AI后端自动返回表情包的逻辑，改为cat_AI主动调用
            // if (assistantLogBasePayload) {
            //   const stickerMessage = await this.maybeCreateStickerMessage({
            //     allowEmoji: groupAllowEmoji,
            //     basePayload: assistantLogBasePayload,
            //     referenceText: replyContent,
            //   });
            //   if (stickerMessage?.message) {
            //     assistantMessagesPayload.push(stickerMessage.message);
            //   }
            // }

            if (!generatedVoiceUrl && textReplies.length > 0) {
              const updateTasks: Array<Promise<any>> = [
                this.chatLogService.updateChatLog(assistantLogId, { display_state: 1 }),
                ...extraAssistantLogs.map(log =>
                  this.chatLogService.updateChatLog(log.chatId, { display_state: 1 }),
                ),
              ];
              await Promise.all(updateTasks);
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

          // 移除sticker消息处理逻辑（已改为cat_AI主动调用）
          // const stickerPayload = assistantMessagesPayload.find(
          //   message => message?.message_type === 'sticker',
          // );
          // if (stickerPayload) {
          //   const stickerImageUrl =
          //     stickerPayload.content_image ||
          //     stickerPayload.imageUrl ||
          //     stickerPayload.image_url ||
          //     null;
          //   if (stickerImageUrl) {
          //     response.imageUrl = stickerImageUrl;
          //   }
          // }

          try {
            if (isGeneratePromptReference === '1') {
              const promptRefResult = await this.openAIChatService.chatQwenPlusCharacter(
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
              this.logDebug(`生成了相关问题推荐`, 'ChatService');
            }
          } catch (error) {
            this.logDebug(`生成相关问题推荐失败: ${error}`);
          }

          // 对话总结：每10轮触发一次总结
          if (groupId) {
            try {
              // 增加未总结计数，判断是否需要触发总结
              const shouldSummarize =
                await this.conversationSummaryService.incrementUnsummarizedCount(
                  groupId,
                  req?.user?.id,
                  appId,
                );

              if (shouldSummarize) {
                // 获取之前的总结
                const previousSummary = await this.conversationSummaryService.getSummary(groupId);

                // 将 messagesHistory 转换为总结需要的格式
                // messagesHistory 已经包含了近10轮的对话
                const recentMessages: Array<{ role: string; content: string }> = [];
                for (const msg of messagesHistory) {
                  if (msg.role === 'user' || msg.role === 'assistant') {
                    // 提取文本内容
                    let content = '';
                    if (typeof msg.content === 'string') {
                      content = msg.content;
                    } else if (Array.isArray(msg.content)) {
                      // 处理多模态消息，只提取文本部分
                      for (const part of msg.content) {
                        if (part.type === 'text') {
                          content += part.text || '';
                        }
                      }
                    }
                    if (content.trim()) {
                      recentMessages.push({ role: msg.role, content: content.trim() });
                    }
                  }
                }

                // 添加当前轮对话
                if (prompt) {
                  recentMessages.push({ role: 'user', content: prompt });
                }
                if (response.full_content) {
                  recentMessages.push({ role: 'assistant', content: response.full_content });
                }

                // 总结性记忆扣费：每10轮对话扣1个饼干（仅对开放接口调用）
                if (req.user.role === 'visitor' && (body as any)?._cookieChargeInfo) {
                  const chargeInfo = (body as any)._cookieChargeInfo;
                  try {
                    const summaryChargeResponse = await MaobingCookieUtil.deductCookies({
                      userId: chargeInfo.userId,
                      amount: 1,
                      remark: '消耗饼干-总结性记忆（10轮对话）',
                      maobingBaseUrl: chargeInfo.maobingBaseUrl,
                      token: chargeInfo.token,
                    });
                    if (summaryChargeResponse.success) {
                      Logger.log(
                        `[饼干扣费] 总结性记忆扣费成功 - userId: ${chargeInfo.userId}, 消耗: 1个饼干`,
                        'ChatService',
                      );
                    } else {
                      Logger.warn(
                        `[饼干扣费] 总结性记忆扣费失败但不影响总结: ${summaryChargeResponse.message}`,
                        'ChatService',
                      );
                    }
                  } catch (summaryChargeError: any) {
                    Logger.warn(
                      `[饼干扣费] 总结性记忆扣费异常但不影响总结: ${
                        summaryChargeError?.message || summaryChargeError
                      }`,
                      'ChatService',
                    );
                  }
                }

                this.conversationSummaryService
                  .summarizeConversationAsync(
                    groupId,
                    req?.user?.id,
                    appId,
                    previousSummary,
                    recentMessages,
                    appName || '助理',
                    userName || '用户',
                  )
                  .catch(err => {
                    Logger.error(
                      `[对话总结] 异步总结任务异常: ${err?.message || err}`,
                      'ChatService',
                    );
                  });

                this.logDebug(
                  `[对话总结] 已触发异步总结任务（每10轮）- groupId=${groupId}, 消息数=${recentMessages.length}`,
                  'ChatService',
                );
              }
            } catch (error: any) {
              Logger.warn(`[对话总结] 处理总结失败: ${error?.message || error}`, 'ChatService');
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
            this.logDebug(
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
              this.logDebug('[好感度] 跳过增加（缺少appId）', 'ChatService');
            } else if (isGroupChat) {
              this.logDebug('[好感度] 跳过增加（群聊模式）', 'ChatService');
            }
          } catch (e) {
            Logger.warn(`[好感度] 增加失败: ${e?.message || e}`, 'ChatService');
          }

          // 表情包自动发送逻辑（场景表情包已在 sticker.helper.ts 中禁用，仅保留普通表情包）
          // - 普通表情包（无tags）：allowEmoji开关开启后100%触发
          // - 备忘录消息（isCalendarMessage=true）：跳过表情包
          // - 群聊和单聊逻辑一致
          try {
            // 备忘录消息跳过表情包
            const isCalendarMessage = (body as any)?.isCalendarMessage === true;
            if (appId && !isCalendarMessage) {
              this.logDebug(
                `[表情包] 🔍 尝试自动发送表情包 - groupId: ${groupId}, allowEmoji: ${groupAllowEmoji}`,
                'ChatService',
              );
              // 优先使用AI回复内容，如果为空则使用用户消息
              const stickerMatchContent = response.full_content || prompt || '';
              const stickerResult = await this.tryAutoSendSticker({
                userId: req.user.id,
                content: stickerMatchContent,
                appId: appId,
                groupId: groupId || null,
                req,
                allowEmoji: groupAllowEmoji, // 传递开关状态，用于普通表情包判断
                userMessage: prompt, // 传入用户消息，用于更准确地判断场景
                skipSave: (body as any)?._skipStickerSave === true, // chat-process-sync模式跳过保存
              });

              if (stickerResult) {
                Logger.log(
                  `[表情包] ✅ AI主动发送表情包成功 - userId=${req.user.id}, scenario=${stickerResult.scenario}, isScenarioSticker=${stickerResult.isScenarioSticker}, imageUrl=${stickerResult.imageUrl}`,
                  'ChatService',
                );

                // 通过流式响应发送表情包事件
                const stickerEvent = {
                  event: 'sticker',
                  data: {
                    chatId: stickerResult.chatId,
                    imageUrl: stickerResult.imageUrl,
                    stickerId: stickerResult.stickerId,
                    scenario: stickerResult.scenario,
                    isScenarioSticker: stickerResult.isScenarioSticker,
                    transferText: stickerResult.transferText, // 添加转账文本到事件数据
                    isStickerImage: true, // 标记为表情包图片，前端不显示content文字
                    stickerData: stickerResult.stickerData, // skipSave模式下供外部保存chatlog
                  },
                };
                res.write(`\n${JSON.stringify(stickerEvent)}`);
              } else {
                this.logDebug('[表情包] 未匹配到合适的表情包或未通过检查', 'ChatService');
              }
            }
          } catch (stickerError) {
            Logger.warn(
              `[表情包] 自动发送表情包失败: ${stickerError?.message || stickerError}`,
              'ChatService',
            );
            // 表情包发送失败不影响主流程
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

          // 检查是否为内容审核错误（BadRequestException）
          const errorMessage = error?.message || '处理请求时发生错误';
          const isSensitiveContent =
            errorMessage.includes('敏感内容') ||
            errorMessage.includes('inappropriate content') ||
            error?.constructor?.name === 'BadRequestException';

          response = {
            error: errorMessage,
            code: isSensitiveContent ? 'SENSITIVE_CONTENT' : 'UNKNOWN_ERROR',
            message: errorMessage,
          };

          // 立即写入错误响应并返回，不再继续执行
          return res.write(`\n${JSON.stringify(response)}`);
        }
      }
    } catch (error) {
      Logger.error('聊天处理全局错误', error);

      // 检查是否为内容审核错误（BadRequestException）
      const errorMessage = error?.message || error?.response?.message || '发生未知错误，请稍后再试';
      const isSensitiveContent =
        errorMessage.includes('敏感内容') ||
        errorMessage.includes('inappropriate content') ||
        error?.constructor?.name === 'BadRequestException';

      if (res) {
        // 构造错误响应
        const errorResponse = {
          error: errorMessage,
          code: isSensitiveContent ? 'SENSITIVE_CONTENT' : 'UNKNOWN_ERROR',
          message: errorMessage,
        };
        return res.write(`\n${JSON.stringify(errorResponse)}`);
      } else {
        throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
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
        this.logDebug(`使用提问片段作为标题: ${chatTitle}`);
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
        .then(() => this.logDebug(`更新对话标题: ${chatTitle}`))
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
        this.logDebug(`获取用户名称失败: ${error.message}`, 'ChatService');
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
              this.logDebug(
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

    const messages = [];
    // 查询历史对话列表
    if (groupId) {
      try {
        this.logDebug(
          `[群聊] 开始查询历史对话，groupId=${groupId}, maxRounds=${maxRounds}, appId=${appId}`,
          'ChatService',
        );
        const history = await chatLogService.chatHistory(groupId, maxRounds);
        this.logDebug(`[群聊] 查询到历史记录数=${history.length}`, 'ChatService');

        // 按时间顺序排序历史记录（如果需要）
        history.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        // 打印历史记录的详细信息
        history.forEach((record, index) => {
          this.logDebug(
            `[群聊历史] 记录${index}: role=${record.role}, appId=${record.appId}, userId=${
              record.userId
            }, modelName=${record.modelName}, content=${
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
              this.logDebug(`[群聊历史] 跳过当前用户消息，id=${record.id}`, 'ChatService');
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
                this.logDebug(`解析fileUrl失败，使用原始格式: ${error.message}`, 'ChatService');
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

              // 🔥 新增：跳过转账表情包消息（它们不应该出现在LLM上下文中）
              let isTransferSticker = false;
              // 通过 model 和 content 判断是否是转账表情包
              if (record.model === 'sticker-generator' && record.content?.includes('转账')) {
                isTransferSticker = true;
                this.logDebug(
                  `[转账上下文] 检测到转账表情包消息 - id=${record.id}, content=${record.content}`,
                  'ChatService',
                );
              }

              if (isTransferSticker) {
                // 保存表情包消息到单独的数组，用于后续检测转账
                assistantMessages.push({
                  id: record.id,
                  role: 'sticker', // 标记为sticker类型，后续过滤时跳过
                  content: content,
                  createdAt: record.createdAt,
                  appId: record.appId,
                  modelName: record.modelName,
                  imageUrl: record.imageUrl,
                  extraParam: record.extraParam,
                });
                this.logDebug(
                  `[转账上下文] 将转账表情包标记为role=sticker - id=${record.id}`,
                  'ChatService',
                );
                continue;
              }

              assistantMessages.push({
                id: record.id,
                role: 'assistant',
                content: content,
                createdAt: record.createdAt,
                appId: record.appId, // 保存appId用于群聊判断
                modelName: record.modelName, // 保存modelName用于识别角色名
              });
            } else if (record.role === 'user') {
              userMessages.push({
                id: record.id,
                role: 'user',
                content: content,
                createdAt: record.createdAt,
                appId: record.appId, // 保存appId用于群聊判断
                userId: record.userId, // 保存userId用于查询用户名
                modelName: record.modelName, // 保存modelName（包含用户名）
              });
            }
          } catch (error) {
            this.logDebug(`处理历史记录ID=${record.id}失败: ${error.message}`, 'ChatService');
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
                    this.logDebug(
                      `[群聊成员] 从 appId=${member.appId} 获取角色名称: ${memberAppInfo.name}`,
                      'ChatService',
                    );
                  }
                } catch (error) {
                  this.logDebug(
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

          this.logDebug(
            `[群聊历史构建] 当前角色appId=${currentAppId}, 群组成员数=${groupMembers.length}`,
            'ChatService',
          );
          this.logDebug(
            `[群聊历史构建] 用户消息数=${userMessages.length}, AI消息数=${assistantMessages.length}`,
            'ChatService',
          );

          // 构建历史消息，按照星尘文档格式
          const allMessages = [...userMessages, ...assistantMessages].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

          this.logDebug(
            `[群聊历史构建] 总消息数=${allMessages.length}, 按时间排序完成`,
            'ChatService',
          );

          // 🔥 新增：检测转账表情包，为assistant消息添加转账标记
          this.logDebug(
            `[转账检测-群聊] 开始检测转账表情包，总消息数=${allMessages.length}`,
            'ChatService',
          );
          for (let i = 0; i < allMessages.length - 1; i++) {
            const currentMsg = allMessages[i];
            const nextMsg = allMessages[i + 1];

            this.logDebug(
              `[转账检测-群聊] 检查消息对 i=${i}: currentMsg.role=${currentMsg.role}, nextMsg.role=${nextMsg.role}`,
              'ChatService',
            );

            // 如果当前消息是assistant，下一条消息是转账表情包（role为'sticker'）
            if (currentMsg.role === 'assistant' && nextMsg.role === 'sticker') {
              try {
                // 检查下一条消息的extraParam是否包含transferText
                if (nextMsg.extraParam) {
                  const extraParam =
                    typeof nextMsg.extraParam === 'string'
                      ? JSON.parse(nextMsg.extraParam)
                      : nextMsg.extraParam;
                  if (extraParam.transferText) {
                    // 标记当前assistant消息需要追加转账文本
                    (currentMsg as any).transferText = extraParam.transferText;
                    this.logDebug(
                      `[转账上下文-群聊] 检测到转账表情包，为assistant消息添加标记: ${extraParam.transferText}`,
                      'ChatService',
                    );
                  }
                }
              } catch (e) {
                // JSON解析失败，忽略
              }
            }
          }

          // 遍历所有消息，先收集到临时数组
          const tempMessages: Array<{
            role: string;
            content: string;
            appId?: number;
            modelName?: string;
          }> = [];

          for (const msg of allMessages) {
            // 跳过转账表情包消息（role为'sticker'）
            if (msg.role === 'sticker') {
              continue;
            }

            if (msg.role === 'user') {
              // 当 skipPromptInHistory 为 true 时，跳过用户消息
              if (options?.skipPromptInHistory === true) {
                this.logDebug(`[群聊历史] skipPromptInHistory=true，跳过用户消息`, 'ChatService');
                continue;
              }

              // 真实用户消息：role为user，需要添加用户名前缀
              let userContent = msg.content;

              // 检查消息内容是否为空（只有空格、空字符串等）
              const hasActualContent =
                userContent && typeof userContent === 'string' && userContent.trim().length > 0;

              // 如果消息内容为空，跳过该用户消息
              if (!hasActualContent) {
                this.logDebug(`[群聊历史] 用户消息内容为空，跳过`, 'ChatService');
                continue;
              }

              // 检查是否已经有说话人前缀
              const hasSpeakerPrefix =
                typeof userContent === 'string' && /^[^：]+：/.test(userContent);

              if (!hasSpeakerPrefix && typeof userContent === 'string') {
                // 直接使用 modelName（保存时已包含真实用户名）
                const userName = msg.modelName || '用户';
                userContent = `${userName}：${userContent}`;
              }

              // 跳过空内容消息
              if (typeof userContent === 'string' && /^[^：]+：\s*$/.test(userContent)) {
                continue;
              }

              tempMessages.push({
                role: 'user',
                content: userContent,
              });
              this.logDebug(
                `[群聊历史] 用户消息(${msg.modelName || '用户'}): ${
                  typeof userContent === 'string' ? userContent.substring(0, 50) : '[复杂内容]'
                }`,
                'ChatService',
              );
            } else if (msg.role === 'assistant') {
              // AI角色消息：根据appId判断是否为当前角色
              const msgAppId = (msg as any).appId;
              const isCurrentMember = msgAppId && msgAppId === currentAppId;
              const finalRole = isCurrentMember ? 'assistant' : 'user';

              let messageContent = msg.content;

              // 添加角色名前缀（如果还没有）
              if (typeof messageContent === 'string' && !/^[^：]+：/.test(messageContent)) {
                const speakerName = msg.modelName || `角色${msgAppId}`;
                messageContent = `${speakerName}：${messageContent}`;
              }

              // 🔥 新增：如果有转账标记，追加转账文本到上下文（拼接到同一条消息）
              if ((msg as any).transferText) {
                messageContent = `${messageContent}\n${(msg as any).transferText}`;
                this.logDebug(
                  `[转账上下文] 为assistant消息追加转账文本: ${(msg as any).transferText}`,
                  'ChatService',
                );
              }

              tempMessages.push({
                role: finalRole,
                content: messageContent,
                appId: msgAppId,
                modelName: msg.modelName,
              });
              this.logDebug(
                `[群聊历史] AI消息(${msg.modelName || msgAppId}, ${finalRole}): ${
                  typeof messageContent === 'string'
                    ? messageContent.substring(0, 50)
                    : '[复杂内容]'
                }`,
                'ChatService',
              );
            }
          }

          // 合并连续的同角色assistant消息（逐句保存的情况）
          for (let i = 0; i < tempMessages.length; i++) {
            const currentMsg = tempMessages[i];
            const roleSignatureOnly = this.isRoleSignatureOnly(currentMsg.content);

            // 如果上一条消息和当前消息都是相同角色的assistant，且来自同一个appId，则合并
            if (
              messages.length > 0 &&
              messages[messages.length - 1].role === currentMsg.role &&
              currentMsg.role !== 'user' && // 不合并user消息
              i > 0 &&
              tempMessages[i - 1].appId === currentMsg.appId &&
              !roleSignatureOnly
            ) {
              // 合并到上一条消息（去掉重复的角色名前缀）
              const contentWithoutPrefix = currentMsg.content.replace(/^[^：]+：/, '');
              messages[messages.length - 1].content += contentWithoutPrefix;
              this.logDebug(
                `[群聊消息合并] 合并逐句assistant消息: ${contentWithoutPrefix.substring(0, 30)}...`,
                'ChatService',
              );
            } else {
              // 添加新消息
              messages.push({
                role: currentMsg.role,
                content: currentMsg.content,
              });
            }
          }

          // 🔥 新增：去除连续重复的 assistant 消息（防止模型陷入重复循环）
          const originalLength = messages.length;
          let deduplicatedMessages = this.deduplicateConsecutiveAssistantMessages(messages);
          // 🔥 新增：移除历史消息中重复出现的句子/短语
          deduplicatedMessages = this.removeRepeatedPhrases(deduplicatedMessages);
          if (deduplicatedMessages.length < originalLength) {
            this.logDebug(
              `[消息去重-群聊] 过滤了 ${
                originalLength - deduplicatedMessages.length
              } 条重复的assistant消息`,
              'ChatService',
            );
            // 替换 messages 数组的内容
            messages.length = 0;
            messages.push(...deduplicatedMessages);
          } else {
            // 即使消息数量没变，内容可能已经被修改（移除了重复句子）
            messages.length = 0;
            messages.push(...deduplicatedMessages);
          }

          this.logDebug(`[群聊历史构建] 最终消息数组长度=${messages.length}`, 'ChatService');
        } else {
          // 单聊模式：按时间顺序添加所有消息
          const allMessages = [...userMessages, ...assistantMessages].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

          // 🔥 新增：检测转账表情包，为assistant消息添加转账标记
          this.logDebug(
            `[转账检测-单聊] 开始检测转账表情包，总消息数=${allMessages.length}`,
            'ChatService',
          );
          for (let i = 0; i < allMessages.length - 1; i++) {
            const currentMsg = allMessages[i];
            const nextMsg = allMessages[i + 1];

            this.logDebug(
              `[转账检测-单聊] 检查消息对 i=${i}: currentMsg.role=${currentMsg.role}, nextMsg.role=${nextMsg.role}`,
              'ChatService',
            );

            // 如果当前消息是assistant，下一条消息是转账表情包（role为'sticker'）
            if (currentMsg.role === 'assistant' && nextMsg.role === 'sticker') {
              try {
                // 检查下一条消息的extraParam是否包含transferText
                if (nextMsg.extraParam) {
                  const extraParam =
                    typeof nextMsg.extraParam === 'string'
                      ? JSON.parse(nextMsg.extraParam)
                      : nextMsg.extraParam;
                  if (extraParam.transferText) {
                    // 标记当前assistant消息需要追加转账文本
                    (currentMsg as any).transferText = extraParam.transferText;
                    this.logDebug(
                      `[转账上下文-单聊] 检测到转账表情包，为assistant消息添加标记: ${extraParam.transferText}`,
                      'ChatService',
                    );
                  }
                }
              } catch (e) {
                // JSON解析失败，忽略
              }
            }
          }

          // 构建messages数组，过滤sticker消息并追加转账文本
          // 合并连续的assistant消息（逐句保存的情况）
          const mergedMessages: Array<{ role: string; content: string }> = [];
          const filteredMessages = allMessages.filter(m => m.role !== 'sticker'); // 过滤掉转账表情包消息

          for (let i = 0; i < filteredMessages.length; i++) {
            const m = filteredMessages[i];
            let content = m.content;
            const roleSignatureOnly = this.isRoleSignatureOnly(m.content);

            // 如果是assistant消息且有转账标记，追加转账文本（拼接到同一条消息）
            if (m.role === 'assistant' && (m as any).transferText) {
              content = `${content}\n${(m as any).transferText}`;
              this.logDebug(
                `[转账上下文] 为assistant消息追加转账文本: ${(m as any).transferText}`,
                'ChatService',
              );
            }

            // 如果上一条消息和当前消息都是assistant，且来自同一个appId，则合并
            if (
              mergedMessages.length > 0 &&
              mergedMessages[mergedMessages.length - 1].role === 'assistant' &&
              m.role === 'assistant' &&
              i > 0 &&
              filteredMessages[i - 1].appId === m.appId &&
              !roleSignatureOnly
            ) {
              // 合并到上一条消息
              mergedMessages[mergedMessages.length - 1].content += content;
              this.logDebug(
                `[消息合并] 合并逐句assistant消息: ${content.substring(0, 30)}...`,
                'ChatService',
              );
            } else {
              // 添加新消息
              mergedMessages.push({ role: m.role, content: content });
            }
          }

          // 🔥 新增：去除连续重复的 assistant 消息（防止模型陷入重复循环）
          let deduplicatedMessages = this.deduplicateConsecutiveAssistantMessages(mergedMessages);
          // 🔥 新增：移除历史消息中重复出现的句子/短语
          deduplicatedMessages = this.removeRepeatedPhrases(deduplicatedMessages);
          if (deduplicatedMessages.length < mergedMessages.length) {
            this.logDebug(
              `[消息去重-单聊] 过滤了 ${
                mergedMessages.length - deduplicatedMessages.length
              } 条重复的assistant消息`,
              'ChatService',
            );
          }
          messages.push(...deduplicatedMessages);
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
      this.logDebug(`消息超出token限制(${totalTokens} > ${tokenLimit})，开始裁剪`, 'ChatService');

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
          this.logDebug('Token裁剪无效，停止裁剪过程');
          break;
        }

        // 更新token计数
        totalTokens = newTotalTokens;
      }
    }

    // 添加当前用户提问到消息历史
    // 如果 skipPromptInHistory 为 true（用于群聊自动对话），则跳过添加
    if (!options?.skipPromptInHistory) {
      // 检查最后一条消息是否已经是当前用户的提问
      const lastMessage = messages[messages.length - 1];
      const isLastMessageCurrentPrompt =
        lastMessage && lastMessage.role === 'user' && lastMessage.content === (prompt || '');

      if (!isLastMessageCurrentPrompt) {
        // 群聊模式下，真实用户的消息也需要添加用户名前缀（根据星尘API文档）
        let userPrompt = prompt || ''; // 确保prompt至少为空字符串

        // 检查是否有实际内容（prompt不为空 或 有图片）
        const hasPromptContent = userPrompt && userPrompt.trim().length > 0;
        const hasImageContent = imageUrl && imageUrl.trim().length > 0;

        // 如果既没有prompt内容也没有图片，跳过添加用户消息
        if (!hasPromptContent && !hasImageContent) {
          this.logDebug(`[群聊历史] 当前用户消息为空（无prompt且无图片），跳过添加`, 'ChatService');
        } else {
          // 如果是群聊模式，添加用户名前缀
          if (isGroupChat) {
            // 检查是否已经有说话人前缀
            const hasSpeakerPrefix = typeof userPrompt === 'string' && /^[^：]+：/.test(userPrompt);

            if (!hasSpeakerPrefix && typeof userPrompt === 'string') {
              // 使用之前获取的真实用户名称
              userPrompt = `${realUserName}：${userPrompt}`;
              this.logDebug(
                `[群聊历史] 为当前用户提问添加说话人标识: ${realUserName}`,
                'ChatService',
              );
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
                this.logDebug('[群聊图片识别] 检测到未处理的图片，开始识别...', 'ChatService');
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
                    this.logDebug(
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
          this.logDebug(
            `[群聊历史] 添加当前用户提问: ${
              typeof userPrompt === 'string' ? userPrompt.substring(0, 50) : '[复杂内容]'
            }`,
            'ChatService',
          );
        }
      }
    } else if (options?.skipPromptInHistory) {
      this.logDebug(
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
                this.logDebug(
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
            this.logDebug(`[群聊] 添加prefill消息: ${roleName}：`, 'ChatService');
          }
        }
      } catch (error) {
        this.logDebug(`添加prefill消息失败: ${error.message}`, 'ChatService');
      }
    }

    this.logDebug(
      `构建消息历史完成: ${Math.floor(messages.length / 2)} 组对话, ${totalTokens} tokens, 耗时: ${
        Date.now() - startTime
      }ms`,
      'ChatService',
    );

    this.logDebug(`messages: ${JSON.stringify(messages)}`, 'ChatService');

    // throw new Error('test');
    return {
      messagesHistory: messages,
      round: messages.length,
    };
  }

  /**
   * 公开方法：为 chat-process-sync 生成带情绪识别的TTS
   * 直接复用 ttsProcess 的核心逻辑
   * @param options 包含 text, chatId(可选), appId, userId, skipChatLogUpdate(可选), preselectedEmotion(可选), preselectedVoiceId(可选)
   * @returns { ttsUrl, duration, emotion } 或 null
   */
  async generateTtsWithEmotion(options: {
    text: string;
    chatId?: number;
    appId: number | null;
    userId: number;
    skipChatLogUpdate?: boolean;
    preselectedEmotion?: string | null;
    preselectedVoiceId?: string | null;
  }): Promise<{ ttsUrl: string; duration: number; emotion: string | null } | null> {
    return this.ttsHelper.generateTtsWithEmotion(options);
  }

  async ttsProcess(body: any, req: any, res?: any, options?: { skipChatLogUpdate?: boolean }) {
    return this.ttsHelper.ttsProcess(body, req, res, options);
  }

  /**
   * AI决策转账是否领取或退回
   * @param body 转账决策参数
   * @param req 请求对象
   */
  async makeTransferDecision(
    body: {
      appId: number;
      groupId?: number;
      amount: string;
      description?: string;
    },
    req: Request,
  ): Promise<{
    success: boolean;
    decision: 'received' | 'returned';
    userChatId: number;
  }> {
    const { appId, groupId, amount, description } = body;
    const userId = req.user.id;

    try {
      // 获取角色信息
      const appInfo = await this.appEntity.findOne({
        where: { id: appId },
      });

      if (!appInfo) {
        throw new HttpException('角色不存在', HttpStatus.NOT_FOUND);
      }

      // 获取角色预设
      const systemPrompt = appInfo.preset || '';
      const roleName = appInfo.name || '角色';

      // 1. 先保存用户的转账消息（pending状态）
      const userTransferLog = await this.chatLogService.saveChatLog({
        appId: appId,
        userId: userId,
        groupId: groupId || null,
        role: 'user',
        content: `[用户发起了一笔${amount}元的转账${
          description ? '，转账说明：' + description : ''
        }]`,
        transferAmount: amount,
        transferDesc: description || null,
        transferStatus: 'pending',
      });

      const userChatId = userTransferLog?.id;
      Logger.log(`[转账决策] 已保存用户转账消息, userChatId=${userChatId}`, 'ChatService');

      // 构建决策提示词
      const decisionPrompt = `你是${roleName}，现在用户给你转账了${amount}元${
        description ? `，转账说明是：${description}` : ''
      }。

请根据你的角色设定和性格，决定是否接受这笔转账。

你的角色设定：
${systemPrompt}

请用JSON格式回复，只返回JSON，不要有其他内容：
{"decision": "received" 或 "returned", "reason": "简短的理由，不超过20字"}

注意：
- decision只能是 "received"（接受）或 "returned"（退回）
- reason是你作为角色给出的理由，要符合角色性格`;

      // 调用AI获取决策
      const { openaiBaseUrl, openaiBaseKey } = await this.globalConfigService.getConfigs([
        'openaiBaseUrl',
        'openaiBaseKey',
      ]);

      // 使用简单的模型进行决策
      const response = await axios.post(
        `${openaiBaseUrl}/v1/chat/completions`,
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: decisionPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 100,
        },
        {
          headers: {
            Authorization: `Bearer ${openaiBaseKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const aiResponse = response.data?.choices?.[0]?.message?.content || '';
      Logger.log(`[转账决策] AI响应: ${aiResponse}`, 'ChatService');

      // 解析AI响应，只需要 decision
      let decision: 'received' | 'returned' = 'received';

      try {
        // 尝试提取JSON
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.decision === 'returned' || parsed.decision === 'received') {
            decision = parsed.decision;
          }
        }
      } catch (parseError) {
        Logger.warn(`[转账决策] JSON解析失败，使用默认值: ${parseError.message}`, 'ChatService');
        // 如果解析失败，尝试简单匹配
        if (
          aiResponse.includes('returned') ||
          aiResponse.includes('退回') ||
          aiResponse.includes('退还')
        ) {
          decision = 'returned';
        }
      }

      // 2. 更新用户转账消息的状态（转账方视角：received=已被接收，returned=已被退还）
      // 传入 skipUserActionLog=true，因为这是AI决策场景，不需要创建额外的用户操作消息
      const userTransferStatus = decision === 'received' ? 'received' : 'returned';
      await this.chatLogService.handleTransferAction(userId, userChatId, userTransferStatus, true);

      // 注意：不在这里保存角色响应消息，前端会单独调用 chat-process-sync 生成角色回复

      Logger.log(
        `[转账决策] 完成 - userChatId=${userChatId}, decision=${decision}`,
        'ChatService',
      );

      return {
        success: true,
        decision,
        userChatId,
      };
    } catch (error) {
      Logger.error(`[转账决策] 失败: ${error.message}`, error.stack, 'ChatService');
      throw new HttpException(error.message || '转账决策失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
