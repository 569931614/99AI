import {
  convertUrlToBase64,
  correctApiBaseUrl,
  formatUrl,
  getClientIp,
  getTokenCount,
  removeThinkTags,
} from '@/common/utils';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request, Response } from 'express';
import { OpenAI } from 'openai';
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
import { GlobalConfigService } from '../globalConfig/globalConfig.service';
import { ModelsService } from '../models/models.service';
import { PluginEntity } from '../plugin/plugin.entity';
import { UploadService } from '../upload/upload.service';
import { UserEntity } from '../user/user.entity';
import { UserService } from '../user/user.service';
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
    @InjectRepository(AppEmotionVoiceEntity)
    private readonly appEmotionVoiceRepo: Repository<AppEmotionVoiceEntity>,
    @InjectRepository(RoleEmotionEntity)
    private readonly roleEmotionRepo: Repository<RoleEmotionEntity>,
  ) {}

  // 情绪标准化：将中英文/同义词映射为统一标签
  private normalizeEmotionLabel(raw?: string | null): string | null {
    if (!raw) return null;
    const s = String(raw).toLowerCase().trim();
    if (!s) return null;
    const table: Record<string, string[]> = {
      happy: [
        'happy',
        'joy',
        'cheer',
        'delight',
        'excited',
        '积极',
        '开心',
        '高兴',
        '喜悦',
        '愉快',
        '欢快',
        '喜欢',
        '太棒',
        '棒极了',
        '兴奋',
        '激动',
      ],
      sad: ['sad', 'depress', 'blue', 'down', '伤心', '难过', '悲伤', '低落', '沮丧', '忧郁', '哭'],
      angry: ['angry', 'mad', 'furious', 'rage', '生气', '愤怒', '恼火', '气愤', '火大', '气死'],
      calm: ['calm', 'neutral', 'plain', '平静', '冷静', '沉着', '镇定', '中性', '自然', '平稳'],
      gentle: ['gentle', 'soft', '温柔', '柔和', '亲切', '体贴', '暖', '治愈'],
      serious: ['serious', 'formal', 'authority', '严肃', '正式', '权威', '庄重', '成熟', '稳重'],
      cute: ['cute', 'lovely', '萌', '可爱', '萝莉', '甜美', 'sweet'],
      energetic: ['energetic', 'lively', 'vivid', '元气', '活力', '朝气', '热情', '激情'],
      narrative: [
        'narrative',
        'announcer',
        'commentator',
        '旁白',
        '解说',
        '播音',
        '主持',
        '讲述',
        '讲解',
      ],
      friendly: ['friendly', 'kind', '友好', '亲和'],
      cold: ['cold', 'cool', '冷淡', '冷酷', '疏离'],
    };
    // 优先直接命中键
    if (table[s]) return s;
    // 包含匹配
    for (const [label, arr] of Object.entries(table)) {
      if (arr.some(k => s.includes(k))) return label;
    }
    return null;
  }

  // 基于文本的轻量情绪推断（关键词/标点启发式）
  private detectEmotionFromText(text?: string | null): string | null {
    if (!text) return null;
    const s = String(text).toLowerCase();
    const hit = (arr: string[]) => arr.some(k => s.includes(k));
    const exclamations = (s.match(/[!！]{1,}/g) || []).length;
    const questionMarks = (s.match(/[?？]{1,}/g) || []).length;
    const hasShout = /大喊|大叫|怒吼|吼道|喊道/.test(s);
    if (
      hit(['太棒', '喜欢', 'great', 'awesome', '真好', '开心', '高兴', 'excited', '兴奋']) ||
      (exclamations >= 2 && !hit(['伤心', '难过', '愤怒', '生气', '沮丧']))
    )
      return 'happy';
    if (hit(['伤心', '难过', '悲伤', '哭', '失望', '遗憾', '沮丧'])) return 'sad';
    if (hit(['生气', '愤怒', '太过分', '气死', '恼火', '怒']) || hasShout) return 'angry';
    if (hit(['严肃', '郑重', '正式', '注意', '请注意'])) return 'serious';
    if (hit(['温柔', '轻声', '放松', '别担心', '安慰', '暖'])) return 'gentle';
    if (hit(['旁白', '解说', '播音', '主持', '讲述', '讲解'])) return 'narrative';
    if (hit(['元气', '活力', '激情', '热情'])) return 'energetic';
    if (hit(['可爱', '萌', '甜美'])) return 'cute';
    if (hit(['冷静', '平静', '理性', '中性'])) return 'calm';
    if (questionMarks >= 2 && !exclamations) return 'calm';
    return null;
  }

  /**
   * 从文本中提取括号内的心理描述
   * 支持多种括号：()、（）、[]、【】、{}、「」、『』
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
      /「([^」]+)」/g, // 日文引号
      /『([^』]+)』/g, // 日文双引号
    ];

    const matches: string[] = [];
    for (const pattern of bracketPatterns) {
      const found = text.match(pattern);
      if (found) {
        // 提取括号内的内容（去除括号本身）
        found.forEach(match => {
          const content = match.replace(/^[(\（\[【\{「『]/, '').replace(/[)\）\]】\}」』]$/, '');
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
   */
  private removeBracketedContent(text?: string | null): string {
    if (!text) return '';
    let result = text;

    // 移除各种括号及其内容
    const bracketPatterns = [
      /\([^)]*\)/g, // 英文圆括号
      /（[^）]*）/g, // 中文圆括号
      /\[[^\]]*\]/g, // 英文方括号
      /【[^】]*】/g, // 中文方括号
      /\{[^}]*\}/g, // 英文花括号
      /「[^」]*」/g, // 日文引号
      /『[^』]*』/g, // 日文双引号
    ];

    for (const pattern of bracketPatterns) {
      result = result.replace(pattern, '');
    }

    // 清理多余的空格
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  // 读取应用级 情绪→音色 映射（仅限 App 级；不再使用全局映射作为选择依据）
  private async resolveEmotionVoiceId(
    appId: number | null,
    emotion?: string | null,
  ): Promise<string | null> {
    const label = this.normalizeEmotionLabel(emotion || '');
    if (!label) return null;

    // App 级映射（app_emotion_voices）
    try {
      if (appId) {
        const rec = await this.appEmotionVoiceRepo.findOne({
          where: { appId: Number(appId), emotion: label, status: 1 },
        });
        if (rec?.voiceId) return rec.voiceId;
      }
    } catch {}
    return null;
  }

  // 将情绪映射为 TTS 合成参数（在已保存参数基础上作轻量偏移）
  private mapEmotionToTtsParams(emotion?: string | null): {
    rate?: number;
    pitch?: number;
    volume?: number;
  } {
    const label = this.normalizeEmotionLabel(emotion || '');
    if (!label) return {};
    const table: Record<string, { rate?: number; pitch?: number; volume?: number }> = {
      happy: { rate: 1.1, pitch: 1.05, volume: 55 },
      energetic: { rate: 1.15, pitch: 1.05, volume: 58 },
      cute: { rate: 1.1, pitch: 1.1, volume: 52 },
      angry: { rate: 1.05, pitch: 0.98, volume: 60 },
      sad: { rate: 0.92, pitch: 0.95, volume: 48 },
      gentle: { rate: 0.95, pitch: 1.02, volume: 50 },
      serious: { rate: 0.98, pitch: 0.98, volume: 50 },
      narrative: { rate: 0.97, pitch: 1.0, volume: 50 },
      calm: { rate: 0.97, pitch: 1.0, volume: 49 },
      friendly: { rate: 1.02, pitch: 1.03, volume: 52 },
      cold: { rate: 0.98, pitch: 0.97, volume: 49 },
    };
    return table[label] || {};
  }

  // 统一情绪白名单：优先 App 级（app_emotion_voices.status=1），否则全局（role_emotions.status=1），最终退回内置集合
  private async getAllowedEmotions(appId: number | null): Promise<string[]> {
    const uniq = (arr: string[]) => Array.from(new Set(arr));
    const canonical = [
      'happy',
      'sad',
      'angry',
      'calm',
      'gentle',
      'serious',
      'cute',
      'energetic',
      'narrative',
      'friendly',
      'cold',
    ];
    try {
      if (appId) {
        const rows = await this.appEmotionVoiceRepo.find({
          where: { appId: Number(appId), status: 1 },
        });
        const list = rows
          .map(r => this.normalizeEmotionLabel(r.emotion))
          .filter((e): e is string => !!e);
        if (list.length) return uniq(list);
      }
    } catch {}

    try {
      const rows = await this.roleEmotionRepo.find({ where: { status: 1 } });
      const list = rows
        .map(r => this.normalizeEmotionLabel(r.emotion))
        .filter((e): e is string => !!e);
      if (list.length) return uniq(list);
    } catch {}

    return canonical;
  }

  // 默认情绪：优先 app 级配置，再全局配置；若无配置则 calm 或白名单首项
  private async getDefaultEmotion(appId: number | null, allowed: string[]): Promise<string> {
    const tryRead = async (key: string): Promise<string | null> => {
      try {
        const raw: any = await this.globalConfigService.getConfigs([key]);
        const val = typeof raw === 'string' ? raw : raw?.[key] || raw?.defaultEmotion;
        const normalized = this.normalizeEmotionLabel(val || '');
        return normalized && allowed.includes(normalized) ? normalized : null;
      } catch {
        return null;
      }
    };

    if (appId) {
      const v = await tryRead(`defaultEmotion:app:${appId}`);
      if (v) return v;
    }
    const g = await tryRead('defaultEmotion:global');
    if (g) return g;

    if (allowed.includes('calm')) return 'calm';
    return allowed[0] || 'calm';
  }

  // 应用情绪选项：仅取“本应用已绑定音色且启用”的情绪列表
  private async getAppEmotionOptions(appId: number | null): Promise<string[]> {
    if (!appId) return [];
    try {
      const rows = await this.appEmotionVoiceRepo.find({
        where: { appId: Number(appId), status: 1 },
      });
      const list = rows
        .filter(r => !!r.voiceId)
        .map(r => this.normalizeEmotionLabel(r.emotion))
        .filter((e): e is string => !!e);
      return Array.from(new Set(list));
    } catch {
      return [];
    }
  }

  // 应用情绪-音色对（仅启用且有voiceId）
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
        if (!r.voiceId) continue;
        const emo = this.normalizeEmotionLabel(r.emotion);
        if (!emo) continue;
        // 若同一情绪重复，以第一条为准
        if (pairs.find(p => p.emotion === emo)) continue;
        pairs.push({ emotion: emo, voiceId: r.voiceId });
      }
    } catch {}
    return pairs;
  }

  // 应用默认情绪：优先“应用默认音色”所对应的情绪；否则读取 app 默认情绪配置；再回退 calm/首项
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
          const emo = this.normalizeEmotionLabel(rec?.emotion || '');
          if (emo && options.includes(emo)) return emo;
        }
      } catch {}
    }

    // 配置项默认情绪（仅限app级；必须在options中）
    try {
      const key = `defaultEmotion:app:${appId}`;
      const raw: any = await this.globalConfigService.getConfigs([key]);
      const val = typeof raw === 'string' ? raw : raw?.[key] || raw?.defaultEmotion;
      const emo = this.normalizeEmotionLabel(val || '');
      if (emo && options.includes(emo)) return emo;
    } catch {}

    if (options.includes('calm')) return 'calm';
    return options[0] || 'calm';
  }

  // 关键词表（用于从备选项中打分选择）
  private getEmotionKeywords(): Record<string, string[]> {
    return {
      happy: [
        '哈哈',
        '开心',
        '高兴',
        '喜悦',
        '愉快',
        '兴奋',
        '太棒',
        '真好',
        '开怀',
        '欢快',
        '爽朗',
        '欢笑',
        '!',
        '！',
      ],
      energetic: ['元气', '活力', '热情', '激情', '振奋', '昂扬', '斗志', '精神抖擞', '!', '！'],
      cute: ['可爱', '萌', '甜美', '软糯'],
      angry: ['生气', '愤怒', '恼火', '气愤', '怒', '怒吼', '大喊', '大叫', '气死', '太过分'],
      sad: ['伤心', '难过', '悲伤', '沮丧', '遗憾', '哭', '心酸', '落寞'],
      gentle: ['温柔', '轻声', '安慰', '别担心', '放松', '柔和', '暖'],
      serious: ['严肃', '郑重', '认真', '庄重', '正式', '注意'],
      narrative: ['旁白', '解说', '播音', '主持', '讲述', '讲解'],
      calm: ['冷静', '平静', '理性', '镇定', '中性', '自然'],
      friendly: ['友好', '亲和', '亲切', '和蔼'],
      cold: ['冷淡', '冷酷', '疏离', '冷漠'],
    };
  }

  // 从选项中选择最匹配情绪：若 initial 在选项中则直接用，否则按关键词打分选择最高分
  private chooseEmotionFromOptions(
    psychologicalDesc: string | null,
    fullText: string,
    options: string[],
    initial?: string | null,
  ): { emotion: string; scores: Record<string, number> } | null {
    if (!options || options.length === 0) return null;
    const normInitial = this.normalizeEmotionLabel(initial || '');
    if (normInitial && options.includes(normInitial)) {
      return { emotion: normInitial, scores: { [normInitial]: 1 } };
    }

    const text = `${psychologicalDesc || ''} ${fullText || ''}`.toLowerCase();
    const keywords = this.getEmotionKeywords();
    const scores: Record<string, number> = {};

    const exclamations = (text.match(/[!！]/g) || []).length;
    const questions = (text.match(/[?？]/g) || []).length;
    const hasShout = /大喊|大叫|怒吼|吼道|喊道/.test(text);

    for (const emo of options) {
      const ks = keywords[emo] || [];
      let score = 0;
      for (const k of ks) {
        const count = (text.match(new RegExp(this.escapeRegex(k), 'g')) || []).length;
        score += count;
      }
      // 通用加权
      if (emo === 'happy' || emo === 'energetic') score += Math.max(0, exclamations - 0); // 感叹号偏向积极
      if (emo === 'angry' && hasShout) score += 2;
      if (emo === 'calm' && questions >= 2 && exclamations === 0) score += 1;
      scores[emo] = score;
    }

    // 选择最高分
    let best: string | null = null;
    let bestScore = -Infinity;
    for (const emo of options) {
      const s = scores[emo] ?? 0;
      if (s > bestScore) {
        bestScore = s;
        best = emo;
      }
    }

    if (!best) return null;
    // 若所有分数为0，则放弃，交给默认情绪
    const allZero = Object.values(scores).every(v => (v ?? 0) <= 0);
    if (allZero) return null;
    return { emotion: best, scores };
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async chatProcess(body: any, req?: Request, res?: Response) {
    await this.userBalanceService.checkUserCertification(req.user.id);
    /* 获取对话参数 */
    const {
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

    // 解析 appId：优先使用 body.appId；若缺失且存在 groupId，则尝试从群组信息推断
    let appId = body?.appId ?? null;
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

    const { groupId, usingNetwork, usingDeepThinking, usingMcpTool } = options;

    // 判断是否为真正的群聊模式（需要检查 isGroupChat 字段）
    let isGroupChat = false;
    if (groupId) {
      try {
        const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
        isGroupChat =
          groupInfo?.isGroupChat === true || (groupInfo?.isGroupChat as any) === 1 || false;
        Logger.debug(
          `群聊检测 - groupId: ${groupId}, isGroupChat字段: ${groupInfo?.isGroupChat}, 判定结果: ${isGroupChat}`,
          'ChatService',
        );
      } catch (error) {
        Logger.warn(`获取群组信息失败: ${error.message}，默认为单聊模式`, 'ChatService');
        isGroupChat = false;
      }
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
    const useModeName = modelName;
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

    // 群聊模式：获取真实用户的名称（用于添加说话人前缀）
    let realUserName = '用户';
    if (isGroupChat && groupId) {
      try {
        // 从数据库获取用户信息
        const user = await this.userEntity.findOne({ where: { id: req.user.id } });
        if (user) {
          realUserName = user.username || user.nickname || `用户${user.id}`;
        }
        Logger.debug(`[群聊] 真实用户名称: ${realUserName}`, 'ChatService');
      } catch (error) {
        Logger.debug(`获取真实用户名称失败: ${error.message}`, 'ChatService');
      }
    }

    // 群聊模式下，检查是否已经保存过用户消息（避免重复保存）
    let userSaveLog;
    let userLogId;

    if (isGroupChat && groupId) {
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
        Logger.debug(`[群聊] 使用已存在的用户消息，id=${userLogId}, appId=${appId}`, 'ChatService');
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
      // 普通模式，正常保存
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
        modelName: '我',
        role: 'user',
        groupId: groupId ? groupId : null,
      });
      userLogId = userSaveLog.id;
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
              `应用${currentMember.appId || currentMember.userId}`;
          }
        }
      } catch (error) {
        Logger.debug(`获取群聊助手名称失败: ${error.message}`, 'ChatService');
      }
    }

    const assistantSaveLog = await this.chatLogService.saveChatLog({
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
    const assistantLogId = assistantSaveLog.id;

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
        await this.chatLogService.updateChatLog(assistantLogId, {
          content: autoReplyRes.answer,
        });
        return;
      } else {
        setSystemMessage = setSystemMessage + autoReplyRes.answer;
      }
    }

    /* 获取历史消息 */
    const { messagesHistory } = await this.buildMessageFromParentMessageId(
      {
        groupId,
        appId: appId,
        systemMessage: setSystemMessage,
        maxModelTokens,
        maxRounds: maxRounds,
        isConvertToBase64: isConvertToBase64,
        fileUrl: fileUrl,
        imageUrl: imageUrl,
        model: useModel,
        isFileUpload,
        isImageUpload,
        prompt: prompt, // 传入当前用户提问
        userId: req?.user?.id, // 传入当前用户ID
      },
      this.chatLogService,
    );

    // 群聊模式：添加说话人标识 + 角色注入
    // 参考：https://help.aliyun.com/document_detail/2861866.html
    try {
      if (isGroupChat && groupId) {
        // 获取群组成员信息（只获取一次）
        const groupInfo: any = await this.chatGroupService.getGroupInfoFromId(groupId);
        const members = JSON.parse(groupInfo?.members || '[]') || [];

        // 注意：根据星尘API文档，群聊模式下：
        // 1. 真实用户的消息不需要添加说话人前缀，role为user即可
        // 2. AI角色之间的消息才需要添加说话人标识
        // 3. 消息历史的构建已经在 buildMessageFromParentMessageId 中完成
        // 因此这里不再需要为消息添加说话人前缀

        // 步骤2：构建群聊角色系统提示
        if (Array.isArray(members) && members.length) {
          members.sort(
            (a, b) =>
              Number(a.order || 999999) - Number(b.order || 999999) ||
              Number(a.userId) - Number(b.userId),
          );
          const roleLines = members.map((m: any, idx: number) => {
            const role = m.role || 'member';
            const name = m.name || m.appName || `用户${m.userId}`;
            const app = m.appName ? `（应用：${m.appName}）` : '';
            // 汇总任务（仅展示前2个）
            const tasks = Array.isArray(m.tasks) ? m.tasks : [];
            const taskBrief = tasks
              .slice(0, 2)
              .map((t: any) => `${t.title}${t.status ? `(${t.status})` : ''}`)
              .join('；');
            const suffix = taskBrief ? ` ｜ 任务：${taskBrief}` : '';
            return `${idx + 1}. ${name}${app} —— 角色: ${role}${suffix}`;
          });
          // 计算下一位发言者：以历史 assistant 消息数量为基准取模
          const assistantCount = (messagesHistory || []).filter(
            (m: any) => m.role === 'assistant',
          ).length;
          const speakerIdx = assistantCount % members.length;
          const nextSpeaker = members[speakerIdx];
          const nextName =
            nextSpeaker?.name || nextSpeaker?.appName || `用户${nextSpeaker?.userId}`;
          // 当前说话者的首个未完成任务
          const pending = Array.isArray(nextSpeaker?.tasks)
            ? (nextSpeaker.tasks as any[]).find(t => (t?.status || 'todo') !== 'done')
            : null;
          const taskGuide = pending
            ? `请围绕“${pending.title}”完成回应（当前任务状态：${pending.status || 'todo'}）。`
            : '若无任务，请围绕用户提问作答。';
          const systemRolePrompt = `\n【群聊角色与发言顺序】\n${roleLines.join(
            '\n',
          )}\n\n【回合规则】\n- 按顺序从当前应发言的角色开始依次发言。\n- 单次响应中，允许从当前应发言者起按顺序输出所有角色各1次发言；每位内容不限长度，前缀以[角色名]开头以便区分。\n- 绝不输出多余流程说明，不要描述轮换，仅给出发言内容。\n\n【本轮起始发言者】${
            speakerIdx + 1
          }. ${nextName}。${taskGuide}`;
          // 将角色设定拼接到系统消息最前
          if (messagesHistory.length && messagesHistory[0].role === 'system') {
            messagesHistory[0].content = `${messagesHistory[0].content || ''}${systemRolePrompt}`;
          } else {
            messagesHistory.unshift({ role: 'system', content: systemRolePrompt });
          }
        }
      }
    } catch (e) {
      // 静默失败以不影响对话
    }

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
                openingRemark: appInfo.openingRemark,
              }
            : undefined;

          const xingchenText = await this.openAIChatService.chatFree(
            prompt || '',
            setSystemMessage,
            messagesHistory,
            imageUrl,
            {
              onProgress: (delta: string) => {
                if (!isGroupChat && delta) {
                  accumulatedText += delta;
                  const payload = { content: [{ type: 'text', text: accumulatedText }] };
                  try {
                    res.write(`\n${JSON.stringify(payload)}`);
                  } catch {}
                }
              },
              abortSignal: abortController.signal,
            },
            appConfigForXingchen,
          );
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

          let totalText = '';
          messagesHistory.forEach(messagesHistory => {
            totalText += messagesHistory.content + ' ';
          });
          const promptTokens = await getTokenCount(totalText);
          const completionTokens = await getTokenCount(
            response.full_reasoning_content + response.full_content,
          );

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

          // 如果检测到敏感词，替换为 ***
          // gpt回答 - 使用替换后的内容存入数据库
          await this.chatLogService.updateChatLog(assistantLogId, {
            // imageUrl: response?.imageUrl,
            content: sanitizedAnswer, // 使用替换后的内容
            reasoning_content: response.full_reasoning_content,
            tool_calls: response.tool_calls,
            promptTokens: promptTokens,
            completionTokens: completionTokens,
            totalTokens: promptTokens + completionTokens,
            status: 3,
          });

          try {
            if (isGeneratePromptReference === '1') {
              promptReference = await this.openAIChatService.chatFree(
                `根据用户提问{${prompt}}以及AI的回答{${response.full_content}}，生成三个更进入一步的问题来向AI提问，用{}包裹每个问题，不需要分行，不需要其他任何内容，单个提问不超过30个字`,
                setSystemMessage,
                messagesHistory,
              );
              await this.chatLogService.updateChatLog(assistantLogId, {
                promptReference: promptReference,
              });
              Logger.debug(`生成了相关问题推荐`, 'ChatService');
            }
          } catch (error) {
            Logger.debug(`生成相关问题推荐失败: ${error}`);
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
            if (appId && !isGroupChat) {
              await this.affectionService.increment(req.user.id, Number(appId));
            } else if (!appId) {
              Logger.debug('Skipping affection increment due to missing appId', 'ChatService');
            } else if (isGroupChat) {
              Logger.debug('Skipping affection increment in group chat mode', 'ChatService');
            }
          } catch (e) {
            Logger.warn(`Affection increment failed: ${e?.message || e}`, 'ChatService');
          }

          return res.write(`\n${JSON.stringify(response)}`);
        } catch (error) {
          // 在这里处理错误，例如打印错误消息到控制台或向用户发送错误响应
          Logger.error('处理请求出错:', error);
          // 根据你的应用需求，你可能想要在这里设置response为一个错误消息或执行其他错误处理逻辑
          await this.chatLogService.updateChatLog(assistantLogId, {
            status: 5,
          });
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
        try {
          chatTitle = await this.openAIChatService.chatFree(
            `根据用户提问{${prompt}}，给这个对话取一个名字，不超过10个字，只需要返回标题，不需要其他任何内容。`,
            undefined,
            undefined,
          );
          if (chatTitle.length > 15) {
            chatTitle = chatTitle.slice(0, 15);
          }
          Logger.debug(`已生成对话标题: ${chatTitle}`);
        } catch (error) {
          Logger.debug(`标题生成失败，使用提问片段作为标题`);
          chatTitle = prompt.slice(0, 10);
        }
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
          const currentMemberName =
            currentMember.appName ||
            currentMember.name ||
            `应用${currentMember.appId || currentMember.userId}`;

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

        // 群聊消息构建 - 按照星尘文档规范
        if (systemMessage) {
          messages.push({ role: 'system', content: systemMessage });
        }

        // 获取群聊成员信息
        let groupMembers = [];
        if (groupId) {
          const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
          if (groupInfo?.members) {
            groupMembers = JSON.parse(groupInfo.members).sort(
              (a, b) => (a.order || 0) - (b.order || 0),
            );
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
    if (prompt) {
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
        const currentUserMessage: any = {
          role: 'user',
          content: userPrompt,
        };

        // 如果有图片，添加图片内容
        if (imageUrl) {
          currentUserMessage.content = [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ];
        }

        messages.push(currentUserMessage);
        Logger.debug(
          `[群聊历史] 添加当前用户提问: ${
            typeof userPrompt === 'string' ? userPrompt.substring(0, 50) : '[复杂内容]'
          }`,
          'ChatService',
        );
      }
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
            const roleName =
              currentMember.appName ||
              currentMember.name ||
              `角色${currentMember.appId || currentMember.userId}`;
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
    const { chatId, prompt, emotion } = body;

    Logger.debug(
      `开始TTS处理: ${String(prompt || '').substring(0, 50)}${
        (prompt || '').length > 50 ? '...' : ''
      }`,
      'TTSService',
    );

    // 1. 提取括号内的心理描述（用于情绪识别）
    const psychologicalDesc = this.extractPsychologicalDescription(prompt);
    Logger.debug(`提取心理描述: ${psychologicalDesc || '无'}`, 'TTSService');

    // 2. 移除括号内容，得到实际要朗读的文本
    const textToSpeak = this.removeBracketedContent(prompt);
    Logger.debug(
      `移除括号后的文本: ${textToSpeak.substring(0, 50)}${textToSpeak.length > 50 ? '...' : ''}`,
      'TTSService',
    );

    // 如果移除括号后文本为空，返回错误
    if (!textToSpeak || textToSpeak.trim().length === 0) {
      Logger.warn('移除括号后文本为空，无法进行TTS', 'TTSService');
      return res.status(400).send({ error: '文本内容为空，无法进行语音合成' });
    }

    // 小工具：使用指定 voiceId 进行合成 + 记录 + 尝试扣费
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
      const { url } = await this.voiceService.preview(previewPayload);
      try {
        const detailKeyInfo = await this.modelsService.getCurrentModelKeyInfo('tts-1');
        const { deduct, deductType } = detailKeyInfo;
        await this.userBalanceService.validateBalance(req, deductType, deduct);
        await this.userBalanceService.deductFromBalance(req.user.id, deductType, deduct);
      } catch (e: any) {
        Logger.warn(
          `[TTSService] 扣费配置缺失或校验失败，已跳过扣费: ${e?.message || e}`,
          'TTSService',
        );
      }
      await this.chatLogService.updateChatLog(chatId, { ttsUrl: url });
      return res.status(200).send({ ttsUrl: url });
    };

    // 3) 读取聊天所属 appId，并优先根据 情绪→音色 映射选择音色
    try {
      const chatLog = await this.chatLogService.findOneChatLog(chatId);
      const appId = (chatLog as any)?.appId ?? null;

      // 从完整文本（包括括号内容）识别情绪，用于选择音色
      let detectedEmotion: string | null = null;

      // 优先级1: 使用入参 emotion
      if (emotion) {
        detectedEmotion = emotion;
        Logger.debug(`使用入参情绪: ${detectedEmotion}`, 'TTSService');
      }

      // 优先级2: 从心理描述优先推断
      if (!detectedEmotion && psychologicalDesc) {
        detectedEmotion = this.detectEmotionFromText(psychologicalDesc);
      }

      // 优先级3: 从完整文本（包括括号内容）推断情绪
      if (!detectedEmotion) {
        detectedEmotion = this.detectEmotionFromText(prompt);
        if (detectedEmotion) {
          Logger.debug(
            `从完整文本推断情绪: ${detectedEmotion} (文本: ${prompt.substring(0, 50)}...)`,
            'TTSService',
          );
        }
      }

      // 基础选项：仅限“应用绑定了音色的情绪 + 应用默认情绪”；并取出情绪-音色对
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
      // 从选项中择优选择情绪：优先用检测值命中，否则按关键词打分；若无命中则回退默认
      let normalizedEmotion = this.normalizeEmotionLabel(detectedEmotion || '');
      let chosen = this.chooseEmotionFromOptions(
        psychologicalDesc,
        prompt,
        options,
        normalizedEmotion,
      );
      if (!chosen) {
        const fallback = await this.getAppDefaultEmotion(appId, options);
        chosen = { emotion: fallback, scores: {} };
        Logger.debug(`未从内容中命中候选情绪，使用应用默认情绪: ${fallback}`, 'TTSService');
      }
      normalizedEmotion = chosen.emotion;
      try {
        Logger.debug(
          `最终情绪: ${normalizedEmotion}，打分: ${JSON.stringify(chosen.scores || {})}`,
          'TTSService',
        );
      } catch {}

      if (normalizedEmotion) {
        // 直接从 app_emotion_voices 的对中找 voiceId
        const mappedVoice = pairs.find(p => p.emotion === normalizedEmotion)?.voiceId || null;
        if (mappedVoice) {
          Logger.debug(
            `命中情绪映射: emotion=${normalizedEmotion}, voice=${mappedVoice} (appId=${
              appId ?? 'global'
            })`,
            'TTSService',
          );
          const ttsParams = this.mapEmotionToTtsParams(normalizedEmotion);
          try {
            Logger.debug(`情绪合成参数: ${JSON.stringify(ttsParams)}`, 'TTSService');
          } catch {}
          return await doTtsWithVoice(mappedVoice, ttsParams);
        }
        Logger.debug(
          `未找到情绪映射: emotion=${normalizedEmotion}, appId=${
            appId ?? 'null'
          }，尝试应用默认音色`,
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
            const ttsParams = this.mapEmotionToTtsParams(normalizedEmotion);
            try {
              Logger.debug(`默认音色合成参数: ${JSON.stringify(ttsParams)}`, 'TTSService');
            } catch {}
            return await doTtsWithVoice(voiceId, ttsParams);
          }
        } catch (e: any) {
          Logger.warn(`[TTSService] 读取应用默认音色失败: ${e?.message || e}`, 'TTSService');
        }
      }
    } catch (e: any) {
      Logger.warn(`[TTSService] 情绪/角色音色路径检查失败: ${e?.message || e}`, 'TTSService');
    }

    // 3) 最终回退：OpenAI TTS
    try {
      const detailKeyInfo = await this.modelsService.getCurrentModelKeyInfo('tts-1');
      const { key, proxyUrl, deduct, deductType, timeout } = detailKeyInfo;
      const { openaiBaseUrl, openaiBaseKey, openaiVoice } =
        await this.globalConfigService.getConfigs([
          'openaiBaseUrl',
          'openaiBaseKey',
          'openaiVoice',
        ]);
      const useKey = key || openaiBaseKey;
      const useTimeout = timeout * 1000;

      // 用户余额检测（仅在走 OpenAI TTS 时强制校验）
      await this.userBalanceService.validateBalance(req, deductType, deduct);

      const formattedUrl = formatUrl(proxyUrl || openaiBaseUrl);
      const correctedProxyUrl = await correctApiBaseUrl(formattedUrl);
      const openai = new OpenAI({
        apiKey: useKey,
        baseURL: correctedProxyUrl,
        timeout: useTimeout,
      });

      const response = await openai.audio.speech.create({
        model: 'tts-1',
        // 使用移除括号后的文本，避免朗读心理描述/舞台指令
        input: textToSpeak,
        voice: openaiVoice || 'onyx',
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      Logger.debug('TTS音频数据生成成功', 'TTSService');

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const currentDate = `${year}${month}/${day}`;

      const ttsUrl = await this.uploadService.uploadFile(
        { buffer, mimetype: 'audio/mpeg' },
        `audio/openai/${currentDate}`,
      );

      await Promise.all([
        this.chatLogService.updateChatLog(chatId, { ttsUrl }),
        this.userBalanceService.deductFromBalance(req.user.id, deductType, deduct),
      ]);

      return res.status(200).send({ ttsUrl });
    } catch (error) {
      Logger.error('TTS处理失败', error, 'TTSService');
      return res.status(500).send({ message: error?.message || '语音合成请求处理失败' });
    }
  }
}
