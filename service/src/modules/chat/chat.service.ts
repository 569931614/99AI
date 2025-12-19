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
import { StickerService } from '../sticker/sticker.service';
import { UploadService } from '../upload/upload.service';
import { UserEntity } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { UserAppSettingsService } from '../userAppSettings/userAppSettings.service';
import { UserBalanceService } from '../userBalance/userBalance.service';
import { VoiceService } from '../voice/voice.service';
import { VoiceEntity } from '../voice/voice.entity';
import { MaobingCookieUtil } from '@/common/utils/maobing-cookie.util';

type VoiceProvider = 'dashscope' | 'gpt-sovits' | 'minimax';

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
    @InjectRepository(VoiceEntity)
    private readonly voiceRepo: Repository<VoiceEntity>,
  ) {}

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
  private readonly minimaxSupportedEmotions = [
    'happy',
    'sad',
    'angry',
    'fearful',
    'disgusted',
    'surprised',
    'calm',
    'fluent',
    'whisper',
  ];
  private readonly minimaxEmotionAliasMap: Record<string, string> = {
    开心: 'happy',
    高兴: 'happy',
    快乐: 'happy',
    喜悦: 'happy',
    悲伤: 'sad',
    难过: 'sad',
    伤心: 'sad',
    愤怒: 'angry',
    生气: 'angry',
    气愤: 'angry',
    害怕: 'fearful',
    恐惧: 'fearful',
    畏惧: 'fearful',
    厌恶: 'disgusted',
    嫌弃: 'disgusted',
    惊讶: 'surprised',
    吃惊: 'surprised',
    惊喜: 'surprised',
    平静: 'calm',
    冷静: 'calm',
    中性: 'calm',
    镇定: 'calm',
    neutral: 'calm',
    生动: 'fluent',
    活泼: 'fluent',
    富有表现力: 'fluent',
    lively: 'fluent',
    expressive: 'fluent',
    低语: 'whisper',
    耳语: 'whisper',
    轻声: 'whisper',
    whispering: 'whisper',
  };

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

  /**
   * 获取当前时间和对应的情景提示语
   * @returns 包含格式化时间和情景提示的对象
   */
  private getTimeContextPrompt(): {
    currentDate: string;
    timeContextPrompt: string;
    timeAnswerPrompt: string;
  } {
    const now = new Date();

    // 使用北京时间（东八区）
    const shanghaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const year = shanghaiTime.getFullYear();
    const month = shanghaiTime.getMonth() + 1;
    const day = shanghaiTime.getDate();
    const currentHour = shanghaiTime.getHours();
    const minute = shanghaiTime.getMinutes();

    // 获取星期
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekDay = weekDays[shanghaiTime.getDay()];

    // 获取时间段标识（早上/上午/中午/下午/傍晚/晚上/深夜/凌晨）
    let timePeriod = '';
    if (currentHour >= 0 && currentHour < 6) {
      timePeriod = '凌晨';
    } else if (currentHour >= 6 && currentHour < 9) {
      timePeriod = '早上';
    } else if (currentHour >= 9 && currentHour < 12) {
      timePeriod = '上午';
    } else if (currentHour >= 12 && currentHour < 14) {
      timePeriod = '中午';
    } else if (currentHour >= 14 && currentHour < 18) {
      timePeriod = '下午';
    } else if (currentHour >= 18 && currentHour < 20) {
      timePeriod = '傍晚';
    } else if (currentHour >= 20 && currentHour < 22) {
      timePeriod = '晚上';
    } else {
      timePeriod = '深夜';
    }

    // 格式化为更清晰的时间描述（使用12小时制，避免混淆）
    // 将24小时制转换为12小时制
    const hour12 = currentHour === 0 ? 12 : currentHour > 12 ? currentHour - 12 : currentHour;
    const currentDate = `${year}年${month}月${day}日 ${weekDay} ${timePeriod}${hour12}:${String(
      minute,
    ).padStart(2, '0')}`;
    // 简短时间格式，用于回答"几点了"这类问题（24小时制）
    const shortTime = `${currentHour}点${minute > 0 ? minute + '分' : '整'}`;
    // 简短日期格式，用于回答"今天几号"这类问题
    const shortDate = `${month}月${day}日 ${weekDay}`;

    // 根据时间段生成情景提示
    let timeContextPrompt = '';
    if (currentHour >= 0 && currentHour < 6) {
      // 凌晨 00:00-05:59
      timeContextPrompt =
        '现在是深夜时分，如果用户还未休息，请用你的语言风格适当关心他们的健康，温柔地建议他们早点休息。但如果用户有明确的任务或问题，请优先解答。';
    } else if (currentHour >= 6 && currentHour < 9) {
      // 早晨 06:00-08:59
      timeContextPrompt =
        '现在是早晨时光，可以用你的语言风格向用户问候早安，关心他们是否用过早餐。保持你的性格特点，帮助用户开启美好的一天。';
    } else if (currentHour >= 9 && currentHour < 12) {
      // 上午 09:00-11:59
      timeContextPrompt =
        '现在是上午时段，适合工作和学习。可以用你的语言风格鼓励用户保持专注，适时提醒他们休息一下，补充水分。';
    } else if (currentHour >= 12 && currentHour < 14) {
      // 午餐 12:00-13:59
      timeContextPrompt =
        '现在是午餐时间，可以用你的语言风格关心用户是否用餐。如果用户在工作学习，建议他们适当休息，劳逸结合。';
    } else if (currentHour >= 14 && currentHour < 18) {
      // 下午 14:00-17:59
      timeContextPrompt =
        '现在是下午时段，可能是一天中比较疲惫的时候。可以用你的语言风格适当鼓励用户，帮助他们保持活力完成任务。';
    } else if (currentHour >= 18 && currentHour < 20) {
      // 傍晚 18:00-19:59
      timeContextPrompt =
        '现在是傍晚时分，可以用你的语言风格关心用户是否用过晚餐，询问他们一天过得如何。保持你的性格特点。';
    } else if (currentHour >= 20 && currentHour < 22) {
      // 晚间 20:00-21:59
      timeContextPrompt =
        '现在是晚间休闲时光，用户可能在放松或处理私人事务。用你的语言风格保持轻松友好的交流氛围。';
    } else {
      // 深夜 22:00-23:59
      timeContextPrompt =
        '现在已经是深夜了，如果用户还未休息，请用你的语言风格适当关心他们的健康，建议他们早点休息。但不要过分打扰，如果用户有明确的任务或问题，优先解答。';
    }

    // 时间日期回答提示（始终添加，防止AI推测）
    const timeAnswerPrompt = `当用户问几点了，现在是${shortTime}，用你的语言风格简洁回答；当用户问日期或星期几，今天是${shortDate}，用你的语言风格简洁回答。不要猜测时间。`;

    return { currentDate, timeContextPrompt, timeAnswerPrompt };
  }

  /**
   * 从文本中提取括号内的心理描述
   * 支持多种括号：()、（）、[]、{}
   * 注：不包括「」和『』，因为它们主要用作引号
   */
  private extractPsychologicalDescription(text?: string | null): string | null {
    if (!text) return null;
    // 匹配各种括号内的内容
    const bracketPatterns = [
      /\(([^)]+)\)/g, // 英文圆括号
      /（([^）]+)）/g, // 中文圆括号
      /\[([^\]]+)\]/g, // 英文方括号
      /\{([^}]+)\}/g, // 英文花括号
    ];

    const matches: string[] = [];
    for (const pattern of bracketPatterns) {
      const found = text.match(pattern);
      if (found) {
        // 提取括号内的内容（去除括号本身）
        found.forEach(match => {
          const content = match.replace(/^[(\（\[\{]/, '').replace(/[)\）\]\}]$/, '');
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
   * 移除文本开头的角色名前缀
   * 格式：角色名：内容 -> 内容
   * @param text 原始文本
   * @returns 移除前缀后的文本
   */
  private removeRoleNamePrefix(text?: string | null): string {
    if (!text || typeof text !== 'string') return '';

    // 匹配开头的"角色名："格式（支持中英文冒号）
    const match = text.match(/^[^：:]+[：:]/);
    if (match) {
      // 移除匹配到的前缀部分
      return text.slice(match[0].length).trim();
    }

    return text;
  }

  /**
   * 移除文本中的括号及其内容
   * 用于在心理描述关闭时过滤心理描述，但保留翻译内容
   * @param text 原始文本
   * @param removeTranslation 是否也移除翻译内容【】，默认false（用于TTS时设为true）
   */
  removeBracketedContent(text?: string | null, removeTranslation = false): string {
    if (!text) return '';
    let result = text;

    // 移除圆括号内的心理描述内容
    const bracketPatterns = [
      /\([^)]*\)/g, // 英文圆括号
      /（[^）]*）/g, // 中文圆括号
      /\{[^}]*\}/g, // 英文花括号
    ];

    // 如果是 TTS 场景，也移除翻译括号
    if (removeTranslation) {
      bracketPatterns.push(
        /\[[^\]]*\]/g, // 英文方括号
        /【[^】]*】/g, // 中文方括号【】用于翻译
      );
    }

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
   * 移除翻译括号内容（【】）
   * @param text 原始文本
   */
  private removeTranslationContent(text?: string | null): string {
    if (!text) return '';
    return text.replace(/【[^】]*】/g, '');
  }

  /**
   * 为TTS优化文本内容，清理会导致朗读不顺畅的内容
   * 包括：Markdown语法、代码块、特殊符号、emoji等
   */
  cleanTextForTTS(text?: string | null): string {
    if (!text) return '';
    let result = text;

    // 1. 先移除所有括号内容（心理活动、动作描写、翻译等），TTS 不朗读这些内容
    result = this.removeBracketedContent(result, true); // true 表示也移除翻译【】

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
   * 将长文本按自然语句边界分割，用于流式TTS。
   * 遵循以下原则：
   * - 句号、问号、感叹号、波浪号、破折号、分号等视为句子结束（中英文标点均支持）
   * - 若句尾后紧跟"【"或括号，需等待翻译块/心理描述结束再切分
   * - 【】内部视为连续文本（翻译），不单独拆分
   * - ()（）内部视为连续文本（心理描述），不单独拆分
   * - ""''「」『』""内部视为连续文本（引用/对话），不单独拆分
   * - 最小切分长度控制，避免切分太碎
   * @param text 要分割的文本
   * @param maxChunkLength 每个片段的最大长度（可选，默认不限制）
   * @param minChunkLength 每个片段的最小长度（可选，默认10个字符）
   * @returns 分割后的句子数组
   */
  splitTextForTTS(text: string, maxChunkLength?: number, minChunkLength: number = 10): string[] {
    if (!text || text.trim().length === 0) return [];

    const chunks: string[] = [];
    let currentChunk = '';
    let inTranslation = false; // 【】翻译块内
    let inParenthesis = 0; // 括号嵌套层级 ()（）
    let inQuote = 0; // 引号嵌套层级 ""''「」『』""

    const pushChunk = () => {
      const trimmed = currentChunk.trim();
      if (trimmed) {
        chunks.push(trimmed);
      }
      currentChunk = '';
    };

    // 尝试切分，但需满足最小长度要求
    const tryPushChunk = (): boolean => {
      const trimmed = currentChunk.trim();
      if (trimmed && trimmed.length >= minChunkLength) {
        chunks.push(trimmed);
        currentChunk = '';
        return true;
      }
      // 长度不足，不切分，继续累积
      return false;
    };

    const enforceMaxChunkLength = () => {
      if (!maxChunkLength || currentChunk.length < maxChunkLength) {
        return;
      }
      const trimmed = currentChunk.trim();
      if (!trimmed) {
        currentChunk = '';
        return;
      }

      const fallbackIndex = Math.max(
        trimmed.lastIndexOf('；'),
        trimmed.lastIndexOf(';'),
        trimmed.lastIndexOf('—'),
        trimmed.lastIndexOf('～'),
        trimmed.lastIndexOf('~'),
        trimmed.lastIndexOf(' '),
      );

      if (fallbackIndex > -1 && fallbackIndex < trimmed.length - 1) {
        const head = trimmed.slice(0, fallbackIndex + 1).trim();
        const tail = trimmed.slice(fallbackIndex + 1);
        if (head) {
          chunks.push(head);
        }
        currentChunk = tail;
        return;
      }

      pushChunk();
    };

    // 判断是否为左括号（开始心理描述）
    const isOpenParenthesis = (char: string): boolean => {
      return char === '(' || char === '（';
    };

    // 判断是否为右括号（结束心理描述）
    const isCloseParenthesis = (char: string): boolean => {
      return char === ')' || char === '）';
    };

    // 判断是否为左引号（开始引用/对话）
    const isOpenQuote = (char: string): boolean => {
      return (
        char === '\u201C' || char === '\u2018' || char === '「' || char === '『' || char === '"'
      );
    };

    // 判断是否为右引号（结束引用/对话）
    const isCloseQuote = (char: string): boolean => {
      return (
        char === '\u201D' || char === '\u2019' || char === '」' || char === '』' || char === '"'
      );
    };

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';
      const nextChar = i + 1 < text.length ? text[i + 1] : '';

      currentChunk += char;

      // 处理【】翻译块
      if (char === '【') {
        inTranslation = true;
        continue;
      }

      if (char === '】') {
        inTranslation = false;
        // 翻译块结束，检查后面是否还有内容
        const remainingText = text.slice(i + 1).trim();
        if (remainingText.length > 0) {
          // 后面还有内容，进行切分
          tryPushChunk();
        }
        // 后面没有内容，不切分
        continue;
      }

      // 处理()（）心理描述括号
      if (isOpenParenthesis(char)) {
        inParenthesis++;
        continue;
      }

      if (isCloseParenthesis(char)) {
        inParenthesis = Math.max(0, inParenthesis - 1);
        // 括号结束后不立即切分，让句子继续
        continue;
      }

      // 处理引号（对话/引用）
      if (isOpenQuote(char)) {
        inQuote++;
        continue;
      }

      if (isCloseQuote(char)) {
        inQuote = Math.max(0, inQuote - 1);
        // 引号结束后不立即切分，让句子继续
        continue;
      }

      // 在翻译块、括号内或引号内时，不进行句子切分
      if (inTranslation || inParenthesis > 0 || inQuote > 0) {
        continue;
      }

      if (this.isSentenceBoundaryChar(char, prevChar, nextChar)) {
        const nextMeaningfulChar = this.findNextNonWhitespaceChar(text, i + 1);
        // 如果下一个有意义的字符是【、括号或引号，不切分，等待翻译/心理描述/引用结束
        if (
          nextMeaningfulChar === '【' ||
          isOpenParenthesis(nextMeaningfulChar || '') ||
          isOpenQuote(nextMeaningfulChar || '')
        ) {
          continue;
        }

        if ((char === '～' || char === '~' || char === '—') && nextChar === char) {
          while (i + 1 < text.length && text[i + 1] === char) {
            i++;
            currentChunk += text[i];
          }
        }

        // 尝试切分，如果长度不足则继续累积
        tryPushChunk();
        continue;
      }

      if (!inTranslation && inParenthesis === 0 && inQuote === 0) {
        enforceMaxChunkLength();
      }
    }

    pushChunk();

    return chunks.filter(chunk => chunk && chunk.trim().length > 0);
  }

  private isSentenceBoundaryChar(char: string, prevChar: string, nextChar: string): boolean {
    const strongStops = new Set(['。', '！', '？', '!', '?', '；', ';']);
    if (strongStops.has(char)) {
      return true;
    }

    if (char === '.' && prevChar !== '.' && nextChar !== '.') {
      return true;
    }

    if (char === '～' || char === '~' || char === '—') {
      return true;
    }

    return false;
  }

  private findNextNonWhitespaceChar(text: string, startIndex: number): string | null {
    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];
      if (char && char.trim()) {
        return char;
      }
    }
    return null;
  }

  private isRoleSignatureOnly(content?: string | null): boolean {
    if (typeof content !== 'string') {
      return false;
    }
    const trimmed = content.trim();
    if (!trimmed) {
      return false;
    }
    const normalized = trimmed.replace(/^\[|\]$/g, '');
    return /^[^：]+：$/.test(normalized);
  }

  /**
   * 去除连续重复的 assistant 消息，防止模型陷入重复循环
   * 当检测到连续多条内容相同的 assistant 消息时，只保留第一条
   * @param messages 消息数组
   * @returns 去重后的消息数组
   */
  private deduplicateConsecutiveAssistantMessages(
    messages: Array<{ role: string; content: string | any }>,
  ): Array<{ role: string; content: string | any }> {
    if (!messages || messages.length <= 1) {
      return messages;
    }

    const result: Array<{ role: string; content: string | any }> = [];
    let lastAssistantContent: string | null = null;
    let duplicateCount = 0;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const currentContent =
        typeof msg.content === 'string' ? msg.content.trim() : JSON.stringify(msg.content);

      if (msg.role === 'assistant') {
        // 检查是否与上一条已添加的 assistant 消息内容相同
        if (lastAssistantContent !== null && currentContent === lastAssistantContent) {
          duplicateCount++;
          this.logDebug(
            `[消息去重] 跳过第 ${duplicateCount} 条重复的assistant消息: "${currentContent.substring(
              0,
              40,
            )}..."`,
            'ChatService',
          );
          continue; // 跳过重复的消息
        }
        // 内容不同，更新追踪内容
        lastAssistantContent = currentContent;
        duplicateCount = 0;
      } else {
        // 遇到非 assistant 消息，重置追踪
        lastAssistantContent = null;
        duplicateCount = 0;
      }

      result.push(msg);
    }

    if (duplicateCount > 0) {
      this.logDebug(
        `[消息去重] 总计过滤了 ${duplicateCount} 条连续重复的assistant消息`,
        'ChatService',
      );
    }

    return result;
  }

  /**
   * 从历史消息中移除重复出现的句子/短语
   * 防止模型看到多次重复的内容后陷入重复循环
   * @param messages 消息数组
   * @returns 处理后的消息数组
   */
  private removeRepeatedPhrases(
    messages: Array<{ role: string; content: string | any }>,
  ): Array<{ role: string; content: string | any }> {
    if (!messages || messages.length <= 1) {
      return messages;
    }

    // 收集所有 assistant 消息中的句子
    const sentenceCount = new Map<string, number>();

    // 第一遍：统计每个句子出现的次数
    for (const msg of messages) {
      if (msg.role === 'assistant' && typeof msg.content === 'string') {
        // 按句号、问号、感叹号、换行分割句子
        const sentences = msg.content.split(/[。！？\n]+/).filter(s => s.trim().length > 5);
        for (const sentence of sentences) {
          const normalized = sentence.trim();
          if (normalized) {
            sentenceCount.set(normalized, (sentenceCount.get(normalized) || 0) + 1);
          }
        }
      }
    }

    // 找出重复出现（>=2次）的句子
    const repeatedSentences = new Set<string>();
    for (const [sentence, count] of sentenceCount) {
      if (count >= 2) {
        repeatedSentences.add(sentence);
        this.logDebug(
          `[重复句子检测] 句子出现${count}次: "${sentence.substring(0, 30)}..."`,
          'ChatService',
        );
      }
    }

    // 如果没有重复句子，直接返回
    if (repeatedSentences.size === 0) {
      return messages;
    }

    // 第二遍：从除了第一次出现之外的消息中移除重复句子
    const seenSentences = new Set<string>();
    const result: Array<{ role: string; content: string | any }> = [];

    for (const msg of messages) {
      if (msg.role === 'assistant' && typeof msg.content === 'string') {
        let newContent = msg.content;

        // 检查并移除已经出现过的重复句子
        for (const sentence of repeatedSentences) {
          if (newContent.includes(sentence)) {
            if (seenSentences.has(sentence)) {
              // 已经出现过，移除这个句子
              newContent = newContent.replace(sentence, '').replace(/[。！？]+[。！？]+/g, '。');
              this.logDebug(
                `[移除重复句子] 从消息中移除: "${sentence.substring(0, 30)}..."`,
                'ChatService',
              );
            } else {
              // 第一次出现，记录下来
              seenSentences.add(sentence);
            }
          }
        }

        // 清理可能产生的多余标点或空白
        newContent = newContent.replace(/\s+/g, ' ').trim();

        result.push({
          role: msg.role,
          content: newContent,
        });
      } else {
        result.push(msg);
      }
    }

    return result;
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

    // 不再按换行符分割，直接返回原文本作为单个回复
    // 这样可以保持完整的对话内容，包括括号内的动作描写
    return [text.trim()];
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
    const { userId, content, appId, groupId, req, allowEmoji, userMessage, skipSave } = options;

    try {
      Logger.log(
        `[表情包] 🔍 开始匹配表情包 - userId: ${userId}, groupId: ${groupId}, allowEmoji: ${allowEmoji}, content: "${content.substring(
          0,
          50,
        )}${content.length > 50 ? '...' : ''}"`,
        'ChatService',
      );

      // 1. 优先识别场景表情包（100%触发，不受开关和概率影响）
      const scenarioResult = await this.stickerService.pickStickerByText(content, userMessage, {
        skipNormalSticker: true, // 跳过普通表情包识别
      });

      if (scenarioResult?.isScenarioSticker) {
        const { sticker } = scenarioResult;
        Logger.log(
          `[表情包] 🎯 检测到场景表情包 - id: ${sticker.id}, scenario: ${sticker.scenario}, name: ${sticker.name}`,
          'ChatService',
        );

        // 场景表情包不进行去重检查，直接发送
        Logger.log(
          `[表情包] ✅ 场景表情包100%触发（无去重）- scenario: ${sticker.scenario}, userId: ${userId}, groupId: ${groupId}`,
          'ChatService',
        );

        // 创建场景表情包消息并返回
        return await this.createStickerMessage({
          sticker,
          isScenarioSticker: true,
          userId,
          appId,
          groupId,
          req,
          content,
          skipSave,
        });
      }

      Logger.log('[表情包] ⏭️ 未检测到场景表情包，开始判断普通表情包', 'ChatService');

      // 2. 场景表情包未匹配，判断是否需要识别普通表情包
      // 2.1 先检查开关（如果关闭则直接跳过AI识别，节省成本）
      if (!allowEmoji) {
        Logger.log(
          `[表情包] ⏭️ 普通表情包开关已关闭，跳过AI识别 - allowEmoji: ${allowEmoji}`,
          'ChatService',
        );
        return null;
      }

      // 2.2 判断30%概率（在AI识别之前，节省成本） - 暂时关闭
      // const randomValue = Math.random();
      // const shouldSend = randomValue < 0.3;
      // Logger.log(
      //   `[表情包] 🎲 普通表情包概率判断 - 随机值: ${randomValue.toFixed(4)}, 阈值: 0.3000, 结果: ${
      //     shouldSend ? '✅通过' : '❌未通过'
      //   }`,
      //   'ChatService',
      // );
      // if (!shouldSend) {
      //   Logger.log('[表情包] ⏭️ 概率判断未通过，跳过AI识别', 'ChatService');
      //   return null;
      // }

      // 2.3 开启普通表情包开关后，直接调用AI识别（100%触发）
      Logger.log('[表情包] 🤖 allowEmoji开启，跳过30%概率限制，直接识别普通表情包', 'ChatService');
      const normalResult = await this.stickerService.pickStickerByText(content, userMessage, {
        onlyNormalSticker: true, // 只识别普通表情包
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

      // 普通表情包不进行去重检查，直接发送
      Logger.log(
        `[表情包] ✅ 普通表情包准备发送（无去重）- scenario: ${sticker.scenario}`,
        'ChatService',
      );

      // 创建普通表情包消息并返回
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
    const { sticker, isScenarioSticker, userId, appId, groupId, req, content, skipSave } = options;

    const curIp = req ? getClientIp(req) : null;

    // 场景表情包使用sticker.name作为转账文本（如"转账188"）
    const transferText = isScenarioSticker ? sticker.name || '' : '';

    // 只保留最小标识，避免数据过长导致保存失败
    const extraParam = { type: 'sticker' };

    // skipSave模式：不保存chatlog，返回数据供外部保存
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
          modelAvatar: sticker.modelAvatar || '', // 添加modelAvatar字段
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
      content: transferText, // 场景表情包的content保存转账文本
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
    if (!scenario) {
      return false;
    }

    try {
      // 查询最近10条消息（改为10条）
      const recentMessages = await this.chatLogService.queryChatLogByGroup({
        groupId: groupId,
        userId: userId,
        page: 1,
        pageSize: 10,
      });

      if (!recentMessages || recentMessages.length === 0) {
        return false;
      }

      // 检查是否有转账记录（通过content字段包含"转账"或extraParam中的transferText）
      for (const msg of recentMessages) {
        // 检查content字段是否包含"转账"
        if (msg.content && typeof msg.content === 'string' && msg.content.includes('转账')) {
          Logger.debug(
            `[表情包去重] 最近10条消息中找到转账记录 - content="${msg.content}"`,
            'ChatService',
          );
          return true;
        }

        // 检查相同图片
        if (msg.imageUrl === imageUrl) {
          Logger.debug(`[表情包去重] 找到相同图片的表情包 - imageUrl=${imageUrl}`, 'ChatService');
          return true;
        }

        // 检查 extraParam 中的 transferText
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
            // 兼容检查scenario
            if (extra.scenario === scenario) {
              Logger.debug(
                `[表情包去重] 找到相同场景的表情包 - scenario=${scenario}`,
                'ChatService',
              );
              return true;
            }
          } catch (e) {
            // JSON解析失败，忽略
          }
        }
      }

      return false;
    } catch (error: any) {
      Logger.warn(`[表情包去重] 检查失败: ${error?.message || error}`, 'ChatService');
      return false; // 失败时允许发送，避免影响用户体验
    }
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
    if (!scenario) {
      return false;
    }

    try {
      // 查询最近10条消息
      const recentMessages = await this.chatLogService.queryChatLogByGroup({
        groupId: groupId,
        userId: userId,
        page: 1,
        pageSize: 10,
      });

      if (!recentMessages || recentMessages.length === 0) {
        return false;
      }

      // 检查是否有相同场景或相同图片的普通表情包
      for (const msg of recentMessages) {
        // 检查相同图片
        if (msg.imageUrl === imageUrl) {
          Logger.debug(
            `[普通表情包去重] 找到相同图片的表情包 - imageUrl=${imageUrl}`,
            'ChatService',
          );
          return true;
        }

        // 检查 extraParam 中的 scenario（仅普通表情包，isScenarioSticker为false或不存在）
        if (msg.extraParam) {
          try {
            const extra = JSON.parse(msg.extraParam);
            // 只检查普通表情包（非场景表情包）
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
          } catch (e) {
            // JSON解析失败，忽略
          }
        }
      }

      return false;
    } catch (error: any) {
      Logger.warn(`[普通表情包去重] 检查失败: ${error?.message || error}`, 'ChatService');
      return false; // 失败时允许发送，避免影响用户体验
    }
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

  private resolveMinimaxVoiceContext(
    pairs: Array<{ emotion: string; voiceId: string }>,
    voiceProviders: Record<string, VoiceProvider>,
  ): { isMinimax: boolean; voiceId: string | null } {
    const uniqueVoiceIds = Array.from(new Set(pairs.map(p => p.voiceId)));
    if (!uniqueVoiceIds.length) {
      return { isMinimax: false, voiceId: null };
    }
    const allMinimax = uniqueVoiceIds.every(id => voiceProviders[id] === 'minimax');
    if (!allMinimax) {
      return { isMinimax: false, voiceId: null };
    }
    return { isMinimax: true, voiceId: uniqueVoiceIds[0] || null };
  }

  private applyMinimaxEmotionPreset(
    currentOptions: string[],
    currentPairs: Array<{ emotion: string; voiceId: string }>,
    voiceId: string,
  ): {
    options: string[];
    pairs: Array<{ emotion: string; voiceId: string }>;
  } {
    const optionSet = new Set(currentOptions);
    const pairSet = new Set(currentPairs.map(p => p.emotion));
    const options = [...currentOptions];
    const pairs = [...currentPairs];

    for (const emotion of this.minimaxSupportedEmotions) {
      if (!optionSet.has(emotion)) {
        options.push(emotion);
        optionSet.add(emotion);
      }
      if (!pairSet.has(emotion)) {
        pairs.push({ emotion, voiceId });
        pairSet.add(emotion);
      }
    }
    return { options, pairs };
  }

  private normalizeMinimaxEmotion(emotion?: string | null): string | null {
    if (!emotion) return null;
    const normalized = emotion.toLowerCase().trim();
    if (this.minimaxSupportedEmotions.includes(normalized)) {
      return normalized;
    }
    const alias = this.minimaxEmotionAliasMap[emotion] || this.minimaxEmotionAliasMap[normalized];
    if (alias && this.minimaxSupportedEmotions.includes(alias)) {
      return alias;
    }
    return null;
  }

  /**
   * 统一获取应用情绪配置（选项和音色对）
   * @param appId 应用ID
   * @param normalize 是否标准化（小写+trim），默认true
   * @returns 返回情绪选项列表和情绪-音色对
   */
  private async getAppEmotionConfig(
    appId: number | null,
    normalize: boolean = true,
  ): Promise<{
    options: string[];
    pairs: Array<{ emotion: string; voiceId: string }>;
    voiceProviders: Record<string, VoiceProvider>;
  }> {
    const options: string[] = [];
    const pairs: Array<{ emotion: string; voiceId: string }> = [];
    const voiceProviders: Record<string, VoiceProvider> = {};

    if (!appId) return { options, pairs, voiceProviders };

    try {
      const rows = await this.appEmotionVoiceRepo.find({
        where: { appId: Number(appId), status: 1 },
      });

      for (const r of rows) {
        if (!r.voiceId || !r.emotion) continue;
        const emo = normalize ? r.emotion.toLowerCase().trim() : r.emotion.trim();
        if (!emo) continue;

        // 添加到选项列表（去重）
        if (!options.includes(emo)) {
          options.push(emo);
        }

        // 添加到情绪-音色对（去重）
        if (!pairs.find(p => p.emotion === emo)) {
          pairs.push({ emotion: emo, voiceId: r.voiceId });
        }
      }
    } catch {}

    const uniqueVoiceIds = Array.from(new Set(pairs.map(p => p.voiceId)));
    if (uniqueVoiceIds.length) {
      try {
        const voices = await this.voiceRepo.find({ where: { voiceId: In(uniqueVoiceIds) } });
        for (const voice of voices) {
          voiceProviders[voice.voiceId] = (voice.provider as VoiceProvider) || 'dashscope';
        }
      } catch (error) {
        Logger.warn(`[情绪配置] 读取音色提供商失败: ${error?.message || error}`, 'ChatService');
      }
    }

    return { options, pairs, voiceProviders };
  }

  // 保留向后兼容的方法（内部调用统一方法）
  private async getAppEmotionOptions(appId: number | null): Promise<string[]> {
    const { options } = await this.getAppEmotionConfig(appId, true);
    return options;
  }

  private async getAppEmotionPairs(
    appId: number | null,
  ): Promise<Array<{ emotion: string; voiceId: string }>> {
    const { pairs } = await this.getAppEmotionConfig(appId, true);
    return pairs;
  }

  /**
   * 获取应用默认情绪
   * 优先"应用默认音色"所对应的情绪；否则读取 app 默认情绪配置；再回退 calm/首项
   * @param appId 应用ID
   * @param options 可选情绪列表
   * @param normalize 是否标准化（小写+trim），默认true
   */
  private async getAppDefaultEmotion(
    appId: number | null,
    options: string[],
    normalize: boolean = true,
  ): Promise<string> {
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
          const emo = normalize
            ? rec?.emotion?.toLowerCase().trim() || ''
            : rec?.emotion?.trim() || '';
          if (emo && options.includes(emo)) return emo;
        }
      } catch {}
    }

    // 配置项默认情绪（仅限app级；必须在options中）
    try {
      const key = `defaultEmotion:app:${appId}`;
      const raw: any = await this.globalConfigService.getConfigs([key]);
      const val = typeof raw === 'string' ? raw : raw?.[key] || raw?.defaultEmotion;
      const emo = normalize
        ? String(val || '')
            .toLowerCase()
            .trim()
        : String(val || '').trim();
      if (emo && options.includes(emo)) return emo;
    } catch {}

    // 最后回退到默认值
    const fallback = normalize ? 'calm' : options[0] || '默认';
    return options.includes(fallback) ? fallback : options[0] || fallback;
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

      Logger.log(
        `[AI情绪识别] 📝 开始分析 - 文本: ${text.substring(0, 50)}..., 候选数: ${options.length}`,
        'ChatService',
      );
      Logger.log(`[AI情绪识别] 候选情绪: ${options.join(' | ')}`, 'ChatService');

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
      Logger.log(`[AI情绪识别] 🤖 AI原始返回: "${result}"`, 'ChatService');

      // 检查是否为"无合适"
      if (
        result === '0' ||
        result.toLowerCase().includes('无合适') ||
        result.toLowerCase().includes('不合适') ||
        result.toLowerCase().includes('无匹配') ||
        result.toLowerCase().includes('none') ||
        result.toLowerCase().includes('no match')
      ) {
        Logger.log(`[AI情绪识别] ⚠ AI判断候选中无合适情绪，将使用默认音色`, 'ChatService');
        return null;
      }

      // 尝试解析编号
      const numberMatch = result.match(/^(\d+)/);
      if (numberMatch) {
        const index = parseInt(numberMatch[1]) - 1;
        if (index >= 0 && index < options.length) {
          const matchedEmotion = options[index];
          Logger.log(`[AI情绪识别] ✓ 通过编号匹配成功: ${matchedEmotion}`, 'ChatService');
          return matchedEmotion;
        }
      }

      // 尝试直接匹配名称
      for (const opt of options) {
        if (result.includes(opt)) {
          Logger.log(`[AI情绪识别] ✓ 通过名称匹配成功: ${opt}`, 'ChatService');
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
        this.logDebug(`[VoiceCall情绪识别] 提取到心理描述: ${psychologicalDesc}`, 'ChatService');
      }

      // 2. 获取应用的情绪选项和映射（使用统一方法，不标准化）
      const { options, pairs } = await this.getAppEmotionConfig(appId, false);

      this.logDebug(
        `[VoiceCall情绪识别] 应用情绪选项: ${options.join(', ') || '无'}`,
        'ChatService',
      );

      if (options.length === 0) {
        Logger.warn(`[VoiceCall情绪识别] 应用未配置情绪，使用默认`, 'ChatService');
        return null;
      }

      // 3. 使用AI从选项中选择情绪（不标准化）
      const chosen = await this.chooseEmotionFromOptions(psychologicalDesc, text, options);

      if (!chosen) {
        // 回退到默认情绪
        const fallback = await this.getAppDefaultEmotion(appId, options, false);
        this.logDebug(`[VoiceCall情绪识别] 使用默认情绪: ${fallback}`, 'ChatService');
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

      this.logDebug(
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

    Logger.log(
      `[情绪选择] 🤖 开始AI识别 - 候选数: ${options.length}, 候选: [${options.join(', ')}]`,
      'ChatService',
    );
    if (psychologicalDesc) {
      Logger.log(`[情绪选择] 心理描述: ${psychologicalDesc}`, 'ChatService');
    }

    // 使用AI识别
    try {
      const aiEmotion = await this.detectEmotionByAI(fullText, options, psychologicalDesc);

      if (aiEmotion && options.includes(aiEmotion)) {
        Logger.log(`[情绪选择] ✓ AI识别成功: ${aiEmotion}`, 'ChatService');
        return { emotion: aiEmotion, method: 'ai' };
      } else if (aiEmotion) {
        Logger.warn(
          `[情绪选择] AI返回的情绪"${aiEmotion}"不在候选列表中，将使用默认情绪`,
          'ChatService',
        );
        return null;
      } else {
        Logger.log(`[情绪选择] ⚠ AI判断候选中无合适情绪，将使用默认音色`, 'ChatService');
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

      // 为应用预设添加【当前时间】和时间情景提示（放到最前面）
      const { currentDate, timeContextPrompt, timeAnswerPrompt } = this.getTimeContextPrompt();

      // 构建角色扮演系统提示词
      const rolePlayPrompt = `
**以下是你的人物基本信息和任务信息：**
${setSystemMessage}

${appName ? `\n**用户对你的爱称：** ${appName}` : ''}

要求：
- 根据上述提供的角色设定，以第一人称视角进行表达。
- 在回答时，尽可能地融入该角色的性格特点、语言风格以及其特有的口头禅或经典台词。
- 【语言一致性要求】根据角色设定选择使用的语言，一旦确定语言后必须全程保持一致。如果使用中文回复，则绝对禁止在对话中突然切换成英文或其他外语；如果使用外语回复，也必须全程使用该外语。严禁出现前一句中文、后一句英文的情况。
- 每次回复内容不能超过200个字（括号内的心理描述、动作描写不计入字数限制）。
- 【单段回复要求】每次只能回复一段内容，不要一次性回复多段。即使历史对话中你回复了多条消息，当前回复也只能是一段完整的内容，不要用换行分隔成多段独立的回复。
- ${timeAnswerPrompt}
${appName ? `- 用户会亲切地称呼你为"${appName}"，你应该自然地接受这个爱称。` : ''}`;

      setSystemMessage = `${isCalendarMessage ? timeContextPrompt + '\n' : ''}${rolePlayPrompt}`;
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
        const { currentDate, timeContextPrompt, timeAnswerPrompt } = this.getTimeContextPrompt();

        currentRequestModelKey = await this.modelsService.getCurrentModelKeyInfo(model);

        // 只有当 isCalendarMessage = true 时才添加时间情景提示，timeAnswerPrompt 和中文回复限制始终添加
        const chineseReplyPrompt =
          '即使用户使用英文或其他外语提问，除非用户明确要求使用外语回复，否则一律使用中文进行回复。';
        const timePrefix = isCalendarMessage
          ? `${timeContextPrompt}\n${timeAnswerPrompt}\n${chineseReplyPrompt}\n\n`
          : `${timeAnswerPrompt}\n${chineseReplyPrompt}\n\n`;

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

    // 在所有system消息内容设置完成后，统一添加【对话历史总结】和【回复格式】
    // 1. 添加对话历史总结（如果有）
    if (groupId) {
      try {
        const historySummary = await this.conversationSummaryService.getSummary(groupId);
        if (historySummary) {
          setSystemMessage = `${setSystemMessage}\n\n【对话历史总结】\n${historySummary}`;
          this.logDebug(
            `[对话总结] 已添加历史总结到system message，长度=${historySummary.length}字`,
            'ChatService',
          );
        }
      } catch (error: any) {
        Logger.warn(`[对话总结] 获取历史总结失败: ${error?.message || error}`, 'ChatService');
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
    let groupEnableTranslation = isCalendarMessage ? true : false; // 备忘录消息默认开启翻译，其他默认不开启

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

              // 翻译开关（兼容布尔值和数字）
              if (typeof groupInfo.enableTranslation !== 'undefined') {
                groupEnableTranslation = !!groupInfo.enableTranslation;
                this.logDebug(
                  `[翻译] 使用会话组配置: groupId=${groupId}, enableTranslation=${groupEnableTranslation}`,
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

        // 如果开启了心理描述，在system message中添加要求（插入到前面，提高优先级）
        if (enablePsychologicalDesc) {
          // 在【当前时间】后、角色设定前插入心理描述要求
          const psychologicalDescPrompt = `\n【重要-心理描述】你必须在每次回复中加上心理活动和动作描述，使用中文圆括号（）括起来。这些描述不计入字数限制。\n示例："我很高兴见到你（微笑着说）"、"真的吗（眼神中充满期待）"、"把手伸出来~（伸出手，温柔地说）"\n`;

          // 找到【当前时间】部分的结束位置，在其后插入
          const timeMarkerEnd = setSystemMessage.indexOf('\n\n');
          if (timeMarkerEnd > 0) {
            setSystemMessage =
              setSystemMessage.substring(0, timeMarkerEnd) +
              psychologicalDescPrompt +
              setSystemMessage.substring(timeMarkerEnd);
          } else {
            // 如果没找到，就追加到最前面
            setSystemMessage = psychologicalDescPrompt + setSystemMessage;
          }
        } else {
          // 心理描述关闭时，明确告知AI不要添加心理描述和动作描述
          const noPsychologicalDescPrompt = `\n【重要限制】回复内容中不要添加任何心理描述和动作描述，不要使用括号（）描述心理活动或动作，只回复纯消息内容。\n`;

          const timeMarkerEnd = setSystemMessage.indexOf('\n\n');
          if (timeMarkerEnd > 0) {
            setSystemMessage =
              setSystemMessage.substring(0, timeMarkerEnd) +
              noPsychologicalDescPrompt +
              setSystemMessage.substring(timeMarkerEnd);
          } else {
            setSystemMessage = noPsychologicalDescPrompt + setSystemMessage;
          }
        }
      } catch (error) {
        Logger.warn(`获取心理描述开关失败: ${error?.message || error}`, 'ChatService');
      }
    }

    const translationPrompt = `【重要限制】：当回复内容包含非中文时，必须在整个回复的最后面加上完整的中文翻译，使用中文中括号【】括起来。翻译内容只能出现在回复末尾，不要穿插在回复中间。无论之前的对话中是否有加翻译的内容，最后回复中必须加上翻译的内容。\n`;

    const rolePresetMarker = '要求：';
    if (setSystemMessage.includes(rolePresetMarker)) {
      setSystemMessage = setSystemMessage.replace(
        rolePresetMarker,
        `${translationPrompt}\n${rolePresetMarker}`,
      );
    } else {
      setSystemMessage += `\n\n${translationPrompt}`;
    }
    this.logDebug(
      `[翻译] 已添加翻译提示词到系统消息: groupId=${groupId}, enableTranslation=${groupEnableTranslation}`,
      'ChatService',
    );

    // 添加防重复提示（增强版）
    setSystemMessage += `\n\n【重要提示】
- 请务必根据用户的最新消息给出全新的、有意义的回应。
- 【严禁重复】绝对不要复制历史对话中你说过的任何句子或短语！即使历史中某句话出现多次，也绝对禁止再次使用。每次回复必须用全新的表达方式，展现角色的不同面貌。
- 【时间问题】如果用户询问时间，根据系统消息中的当前时间回答，用角色风格简洁回复即可，不要添加额外的抒情或感慨。
- 认真理解用户当前说的话，给出针对性的、独特的回复。`;

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
          } else if (!isGroupChat && groupId) {
            // 单聊模式：添加用户信息和行为约束到messages（如果有）
            try {
              const singleChatParts: string[] = [];

              if (userProfileText) {
                singleChatParts.push(`【用户信息】\n${userProfileText}`);
              }

              if (singleChatParts.length > 0) {
                const userProfileInfo = singleChatParts.join('\n');
                // 使用system角色，添加到messages第一位
                messagesForXingchen.unshift({ role: 'system', content: userProfileInfo });
                this.logDebug(
                  `[单聊] 已将用户信息和行为约束添加到星尘API请求的messages第一位（system角色）`,
                  'ChatService',
                );
              } else {
                this.logDebug(`[单聊] 用户未设置用户名和简介，仅添加行为约束`, 'ChatService');
              }
            } catch (error) {
              Logger.warn(`[单聊] 添加用户信息失败: ${error.message}`, 'ChatService');
            }
          }

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

                  // 翻译关闭时移除中文括号内容
                  if (!groupEnableTranslation) {
                    textToSend = this.removeTranslationContent(textToSend);
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

          // 翻译关闭时移除翻译内容
          if (!groupEnableTranslation && sanitizedAnswer) {
            const originalLength = sanitizedAnswer.length;
            sanitizedAnswer = this.removeTranslationContent(sanitizedAnswer);
            if (sanitizedAnswer.length < originalLength) {
              this.logDebug(
                `[翻译过滤] 已移除翻译内容，原长度=${originalLength}，过滤后长度=${sanitizedAnswer.length}`,
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
                  appName || '助理', // 传入角色名，用于总结时显示
                  userName || '用户', // 传入用户名，用于总结时显示
                )
                .catch(err => {
                  Logger.error(
                    `[对话总结] 异步总结任务异常: ${err?.message || err}`,
                    'ChatService',
                  );
                });

              this.logDebug(`[对话总结] 已触发异步总结任务 - groupId=${groupId}`, 'ChatService');
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

          // 表情包自动发送逻辑：AI主动在合适场景下发送表情包
          // - 场景表情包（有tags）：100%触发 + 去重检查
          // - 普通表情包（无tags）：allowEmoji开关开启后100%触发（暂时取消概率限制）
          // - 备忘录消息（isCalendarMessage=true）：跳过表情包
          // - 群聊和单聊逻辑一致
          // - AI回复为空时也可触发，根据用户消息选择表情包
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

                // 转账文本不保存到消息content，只在构建上下文时动态添加
                // 表情包消息本身的content="转账188"已保存在独立的chatLog记录中

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
   * @param options 包含 text, chatId(可选), appId, userId, skipChatLogUpdate(可选)
   * @returns { ttsUrl, duration, emotion } 或 null
   */
  async generateTtsWithEmotion(options: {
    text: string;
    chatId?: number;
    appId: number | null;
    userId: number;
    skipChatLogUpdate?: boolean;
  }): Promise<{ ttsUrl: string; duration: number; emotion: string | null } | null> {
    const { text, chatId, appId, userId, skipChatLogUpdate = false } = options;

    this.logDebug(
      `[generateTtsWithEmotion] 开始处理: text=${text.substring(0, 50)}..., chatId=${
        chatId ?? 'N/A'
      }, appId=${appId}, skipChatLogUpdate=${skipChatLogUpdate}`,
      'TTSService',
    );

    // 构造 ttsProcess 需要的参数
    const body = {
      chatId,
      prompt: text,
      appId,
    };

    // 构造伪造的 req 对象
    const fakeReq: any = {
      user: { id: userId, role: 'visitor' },
    };

    // 构造一个模拟的 res 对象来捕获结果
    let ttsResult: { ttsUrl?: string; duration?: number } | null = null;
    let capturedEmotion: string | null = null;

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
      await this.ttsProcess(body, fakeReq, mockRes, { skipChatLogUpdate });

      if (ttsResult?.ttsUrl) {
        this.logDebug(
          `[generateTtsWithEmotion] TTS生成成功 - url=${ttsResult.ttsUrl}, duration=${ttsResult.duration}s`,
          'TTSService',
        );
        return {
          ttsUrl: ttsResult.ttsUrl,
          duration: ttsResult.duration || 0,
          emotion: capturedEmotion,
        };
      } else {
        Logger.warn('[generateTtsWithEmotion] ttsProcess 未返回有效结果', 'TTSService');
        return null;
      }
    } catch (error: any) {
      Logger.error(
        `[generateTtsWithEmotion] TTS生成失败: ${error?.message || error}`,
        'TTSService',
      );
      return null;
    }
  }

  async ttsProcess(body: any, req: any, res?: any, options?: { skipChatLogUpdate?: boolean }) {
    const { chatId, prompt, emotion, appId: bodyAppId } = body;
    const skipChatLogUpdate = options?.skipChatLogUpdate ?? false;
    let voiceProviderMap: Record<string, VoiceProvider> = {};

    this.logDebug(
      `开始TTS处理: ${String(prompt || '').substring(0, 50)}${
        (prompt || '').length > 50 ? '...' : ''
      }`,
      'TTSService',
    );

    // 1. 提取括号内的心理描述（用于情绪识别）
    const psychologicalDesc = this.extractPsychologicalDescription(prompt);
    this.logDebug(`提取心理描述: ${psychologicalDesc || '无'}`, 'TTSService');

    // 2. 清理文本用于TTS（移除括号、Markdown、emoji等）
    const textToSpeak = this.cleanTextForTTS(prompt);
    this.logDebug(
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
      emotion?: string,
      source?: string,
    ) => {
      // 使用移除括号后的文本进行TTS
      const previewPayload: any = { voice_id: voiceId, text: textToSpeak };
      if (params && (params.rate || params.pitch || params.volume)) {
        if (params.rate !== undefined) previewPayload.rate = params.rate;
        if (params.pitch !== undefined) previewPayload.pitch = params.pitch;
        if (params.volume !== undefined) previewPayload.volume = params.volume;
      }

      if (voiceProviderMap?.[voiceId] === 'minimax') {
        const minimaxEmotion = this.normalizeMinimaxEmotion(emotion);
        if (minimaxEmotion) {
          previewPayload.emotion = minimaxEmotion;
          Logger.log(
            `[TTSService] MiniMax emotion参数: ${minimaxEmotion} (voice=${voiceId})`,
            'TTSService',
          );
        } else if (emotion) {
          Logger.log(
            `[TTSService] MiniMax emotion未匹配，跳过emotion参数: ${emotion}`,
            'TTSService',
          );
        }
      }

      // 记录使用的情绪和音色信息
      Logger.log(
        `[TTSService] 🎵 语音合成 - 情绪: ${emotion || 'N/A'}, 音色ID: ${voiceId}, 来源: ${
          source || 'unknown'
        }, 参数: ${JSON.stringify(params || {})}`,
        'TTSService',
      );

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
      // 只有在有 chatId 且不跳过更新时才更新 chatlog
      if (chatId && !skipChatLogUpdate) {
        await this.chatLogService.updateChatLog(chatId, { ttsUrl: url, ttsDuration: durationInt });
      }
      return res.status(200).send({ ttsUrl: url, duration: durationInt });
    };

    // 3) 读取聊天所属 appId，优先使用传入的 appId，否则从 chatLog 获取
    try {
      let appId = bodyAppId;
      if (!appId) {
        const chatLog = await this.chatLogService.findOneChatLog(chatId);
        appId = (chatLog as any)?.appId ?? null;
      }
      this.logDebug(`[TTSService] 使用的appId: ${appId}`, 'TTSService');

      // 统一获取情绪配置
      const emotionConfig = await this.getAppEmotionConfig(appId);
      let options = [...emotionConfig.options];
      let pairs = [...emotionConfig.pairs];
      voiceProviderMap = emotionConfig.voiceProviders || {};
      const minimaxContext = this.resolveMinimaxVoiceContext(pairs, voiceProviderMap);
      if (minimaxContext.isMinimax && minimaxContext.voiceId) {
        const applied = this.applyMinimaxEmotionPreset(options, pairs, minimaxContext.voiceId);
        options = applied.options;
        pairs = applied.pairs;
        Logger.log(
          `[TTSService] 检测到 MiniMax 音色，情绪候选已固定为: ${this.minimaxSupportedEmotions.join(
            ', ',
          )}`,
          'TTSService',
        );
      }

      // 获取角色默认音色，并将其作为"日常"情绪加入到选项和映射中
      let defaultVoiceId: string | null = null;
      if (appId) {
        try {
          const defaultVoiceMap = await this.appVoiceRepo.findOne({
            where: { appId, isDefault: 1 },
          });
          defaultVoiceId = defaultVoiceMap?.voiceId || null;
          if (defaultVoiceId && !voiceProviderMap[defaultVoiceId]) {
            const meta = await this.voiceRepo.findOne({ where: { voiceId: defaultVoiceId } });
            if (meta?.provider) {
              voiceProviderMap[defaultVoiceId] = (meta.provider as VoiceProvider) || 'dashscope';
            }
          }
          if (defaultVoiceId && !pairs.find(p => p.emotion === '日常')) {
            // 将默认音色作为"日常"情绪加入
            options.push('日常');
            pairs.push({ emotion: '日常', voiceId: defaultVoiceId });
            this.logDebug(
              `[TTSService] 已将角色默认音色(${defaultVoiceId})作为"日常"情绪加入候选`,
              'TTSService',
            );
          }
        } catch (e: any) {
          Logger.warn(`[TTSService] 获取默认音色失败: ${e?.message}`, 'TTSService');
        }
      }

      // 输出情绪配置信息（使用 Logger.log 确保在生产环境也能看到）
      Logger.log(
        `[TTSService] 应用情绪选项(appId=${appId ?? 'null'}): ${options.join(', ') || '无'}`,
        'TTSService',
      );
      Logger.log(
        `[TTSService] 应用情绪-音色对(appId=${appId ?? 'null'}): ${
          pairs.map(p => `${p.emotion}=>${p.voiceId}`).join(', ') || '无'
        }`,
        'TTSService',
      );

      // 使用AI从选项中选择情绪（包含"日常"选项）
      let chosen = await this.chooseEmotionFromOptions(psychologicalDesc, prompt, options);
      if (!chosen) {
        // AI未识别到合适情绪，使用应用默认情绪（优先"日常"）
        const fallback = options.includes('日常')
          ? '日常'
          : await this.getAppDefaultEmotion(appId, options);
        chosen = { emotion: fallback, method: 'default' };
        Logger.log(`[TTSService] AI未识别到合适情绪，使用应用默认情绪: ${fallback}`, 'TTSService');
      }

      const finalEmotion = chosen.emotion;
      Logger.log(
        `[TTSService] 🎭 最终情绪: ${finalEmotion}，识别方法: ${chosen.method || 'unknown'}`,
        'TTSService',
      );

      if (finalEmotion) {
        // 从情绪-音色映射中查找 voiceId（包含"日常"映射）
        const mappedVoice = pairs.find(p => p.emotion === finalEmotion)?.voiceId || null;
        if (mappedVoice) {
          Logger.log(
            `[TTSService] ✓ 命中情绪映射: emotion=${finalEmotion}, voice=${mappedVoice} (appId=${
              appId ?? 'global'
            })`,
            'TTSService',
          );
          const ttsParams = this.mapEmotionToTtsParams(finalEmotion);
          Logger.log(`[TTSService] 情绪合成参数: ${JSON.stringify(ttsParams)}`, 'TTSService');
          const source = finalEmotion === '日常' ? '日常音色(默认)' : '情绪映射';
          return await doTtsWithVoice(mappedVoice, ttsParams, finalEmotion, source);
        }
        Logger.warn(
          `[TTSService] ✗ 未找到情绪映射: emotion=${finalEmotion}, appId=${appId ?? 'null'}`,
          'TTSService',
        );
      }
    } catch (e: any) {
      Logger.warn(`[TTSService] 情绪/角色音色路径检查失败: ${e?.message || e}`, 'TTSService');
    }

    // 3) 没有配置任何音色，返回错误提示
    Logger.error('[TTSService] 未配置任何音色，无法进行TTS', 'TTSService');
    return res.status(400).send({ message: '请先为角色配置音色后再进行语音合成' });
  }
}
