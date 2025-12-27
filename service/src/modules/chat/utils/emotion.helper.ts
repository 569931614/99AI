import { Logger } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { AppEmotionVoiceEntity } from '../../app/appEmotionVoice.entity';
import { VoiceEntity } from '../../voice/voice.entity';
import { AppVoiceEntity } from '../../app/appVoice.entity';
import { GlobalConfigService } from '../../globalConfig/globalConfig.service';

export const MINIMAX_SUPPORTED_EMOTIONS = [
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

export const MINIMAX_EMOTION_ALIAS_MAP: Record<string, string> = {
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

export function mapEmotionToTtsParams(emotion?: string | null): {
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

export function resolveMinimaxVoiceContext(
  pairs: Array<{ emotion: string; voiceId: string }>,
  voiceProviders: Record<string, 'dashscope' | 'gpt-sovits' | 'minimax'>,
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

export function applyMinimaxEmotionPreset(
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

  for (const emotion of MINIMAX_SUPPORTED_EMOTIONS) {
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

export function normalizeMinimaxEmotion(emotion?: string | null): string | null {
  if (!emotion) return null;
  const normalized = emotion.toLowerCase().trim();
  if (MINIMAX_SUPPORTED_EMOTIONS.includes(normalized)) {
    return normalized;
  }
  const alias = MINIMAX_EMOTION_ALIAS_MAP[emotion] || MINIMAX_EMOTION_ALIAS_MAP[normalized];
  if (alias && MINIMAX_SUPPORTED_EMOTIONS.includes(alias)) {
    return alias;
  }
  return null;
}

type VoiceProvider = 'dashscope' | 'gpt-sovits' | 'minimax';

export class EmotionHelper {
  constructor(
    private readonly deps: {
      appEmotionVoiceRepo: Repository<AppEmotionVoiceEntity>;
      voiceRepo: Repository<VoiceEntity>;
      appVoiceRepo: Repository<AppVoiceEntity>;
      globalConfigService: GlobalConfigService;
      logDebug: (message: any, context?: string) => void;
    },
  ) {}

  async getAppEmotionConfig(
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
      const rows = await this.deps.appEmotionVoiceRepo.find({
        where: { appId: Number(appId), status: 1 },
      });

      for (const r of rows) {
        if (!r.voiceId || !r.emotion) continue;
        const emo = normalize ? r.emotion.toLowerCase().trim() : r.emotion.trim();
        if (!emo) continue;

        if (!options.includes(emo)) {
          options.push(emo);
        }

        if (!pairs.find(p => p.emotion === emo)) {
          pairs.push({ emotion: emo, voiceId: r.voiceId });
        }
      }
    } catch {}

    const uniqueVoiceIds = Array.from(new Set(pairs.map(p => p.voiceId)));
    if (uniqueVoiceIds.length) {
      try {
        const voices = await this.deps.voiceRepo.find({ where: { voiceId: In(uniqueVoiceIds) } });
        for (const voice of voices) {
          voiceProviders[voice.voiceId] = (voice.provider as VoiceProvider) || 'dashscope';
        }
      } catch (error) {
        Logger.warn(`[情绪配置] 读取音色提供商失败: ${error?.message || error}`, 'ChatService');
      }
    }

    return { options, pairs, voiceProviders };
  }

  async getAppEmotionOptions(appId: number | null): Promise<string[]> {
    const { options } = await this.getAppEmotionConfig(appId, true);
    return options;
  }

  async getAppEmotionPairs(
    appId: number | null,
  ): Promise<Array<{ emotion: string; voiceId: string }>> {
    const { pairs } = await this.getAppEmotionConfig(appId, true);
    return pairs;
  }

  async getAppDefaultEmotion(
    appId: number | null,
    options: string[],
    normalize: boolean = true,
  ): Promise<string> {
    if (appId) {
      try {
        const def = await this.deps.appVoiceRepo.findOne({
          where: { appId: Number(appId), isDefault: 1 },
        });
        const defVoice = def?.voiceId || '';
        if (defVoice) {
          const rec = await this.deps.appEmotionVoiceRepo.findOne({
            where: { appId: Number(appId), voiceId: defVoice, status: 1 },
          });
          const emo = normalize
            ? rec?.emotion?.toLowerCase().trim() || ''
            : rec?.emotion?.trim() || '';
          if (emo && options.includes(emo)) return emo;
        }
      } catch {}
    }

    try {
      const key = `defaultEmotion:app:${appId}`;
      const raw: any = await this.deps.globalConfigService.getConfigs([key]);
      const val = typeof raw === 'string' ? raw : raw?.[key] || raw?.defaultEmotion;
      const emo = normalize
        ? String(val || '')
            .toLowerCase()
            .trim()
        : String(val || '').trim();
      if (emo && options.includes(emo)) return emo;
    } catch {}

    const fallback = normalize ? 'calm' : options[0] || '默认';
    return options.includes(fallback) ? fallback : options[0] || fallback;
  }

  async detectEmotionByAI(
    text: string,
    options: string[],
    psychologicalDesc: string | null,
  ): Promise<string | null> {
    if (!text || !options || options.length === 0) return null;

    try {
      // 使用 DeepSeek 官网 API
      const deepseekApiKey = process.env.DEEPSEEK_API_KEY || '';

      if (!deepseekApiKey) {
        Logger.warn('[AI情绪识别] 未配置DeepSeek API Key，跳过AI识别', 'ChatService');
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

      const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
      const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

      const axios = require('axios');
      const response = await axios.post(
        `${baseURL}/chat/completions`,
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 30,
          temperature: 0.1,
        },
        {
          headers: {
            Authorization: `Bearer ${deepseekApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
        },
      );

      const result = response.data?.choices?.[0]?.message?.content?.trim() || '';
      Logger.log(`[AI情绪识别] 🤖 AI原始返回: "${result}"`, 'ChatService');

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

      const numberMatch = result.match(/^(\d+)/);
      if (numberMatch) {
        const index = parseInt(numberMatch[1]) - 1;
        if (index >= 0 && index < options.length) {
          const matchedEmotion = options[index];
          Logger.log(`[AI情绪识别] ✓ 通过编号匹配成功: ${matchedEmotion}`, 'ChatService');
          return matchedEmotion;
        }
      }

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

  async chooseEmotionFromOptions(
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

  async detectEmotionForVoiceCall(
    text: string,
    appId: number | null,
    extractPsychologicalDescription: (text: string) => string | null,
  ): Promise<{ emotion: string; voiceId: string; method: string } | null> {
    try {
      const psychologicalDesc = extractPsychologicalDescription(text);
      if (psychologicalDesc) {
        this.deps.logDebug(
          `[VoiceCall情绪识别] 提取到心理描述: ${psychologicalDesc}`,
          'ChatService',
        );
      }

      const { options, pairs } = await this.getAppEmotionConfig(appId, false);

      this.deps.logDebug(
        `[VoiceCall情绪识别] 应用情绪选项: ${options.join(', ') || '无'}`,
        'ChatService',
      );

      if (options.length === 0) {
        Logger.warn(`[VoiceCall情绪识别] 应用未配置情绪，使用默认`, 'ChatService');
        return null;
      }

      const chosen = await this.chooseEmotionFromOptions(psychologicalDesc, text, options);

      if (!chosen) {
        const fallback = await this.getAppDefaultEmotion(appId, options, false);
        this.deps.logDebug(`[VoiceCall情绪识别] 使用默认情绪: ${fallback}`, 'ChatService');
        const mappedVoice = pairs.find(p => p.emotion === fallback)?.voiceId;
        if (mappedVoice) {
          return { emotion: fallback, voiceId: mappedVoice, method: 'default' };
        }
        return null;
      }

      const mappedVoice = pairs.find(p => p.emotion === chosen.emotion)?.voiceId;
      if (!mappedVoice) {
        Logger.warn(`[VoiceCall情绪识别] 情绪"${chosen.emotion}"未配置音色`, 'ChatService');
        return null;
      }

      this.deps.logDebug(
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
}
