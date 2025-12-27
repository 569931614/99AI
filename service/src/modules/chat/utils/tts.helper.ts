import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { VoiceService } from '../../voice/voice.service';
import { ModelsService } from '../../models/models.service';
import { UserBalanceService } from '../../userBalance/userBalance.service';
import { ChatLogService } from '../../chatLog/chatLog.service';
import { AppVoiceEntity } from '../../app/appVoice.entity';
import { VoiceEntity } from '../../voice/voice.entity';
import { EmotionHelper } from './emotion.helper';
import {
  applyMinimaxEmotionPreset,
  mapEmotionToTtsParams,
  MINIMAX_SUPPORTED_EMOTIONS,
  normalizeMinimaxEmotion,
  resolveMinimaxVoiceContext,
} from './emotion.helper';
import { cleanTextForTTS, extractPsychologicalDescription } from './text.utils';

type VoiceProvider = 'dashscope' | 'gpt-sovits' | 'minimax';

export class TtsHelper {
  constructor(
    private readonly deps: {
      voiceService: VoiceService;
      modelsService: ModelsService;
      userBalanceService: UserBalanceService;
      chatLogService: ChatLogService;
      appVoiceRepo: Repository<AppVoiceEntity>;
      voiceRepo: Repository<VoiceEntity>;
      emotionHelper: EmotionHelper;
      logDebug: (message: any, context?: string) => void;
    },
  ) {}

  async generateTtsWithEmotion(options: {
    text: string;
    chatId?: number;
    appId: number | null;
    userId: number;
    skipChatLogUpdate?: boolean;
    reqRole?: string;
    preselectedEmotion?: string | null;
    preselectedVoiceId?: string | null;
  }): Promise<{ ttsUrl: string; duration: number; emotion: string | null } | null> {
    const {
      text,
      chatId,
      appId,
      userId,
      skipChatLogUpdate = false,
      reqRole = 'visitor',
      preselectedEmotion = null,
      preselectedVoiceId = null,
    } = options;

    this.deps.logDebug(
      `[generateTtsWithEmotion] 开始处理: text=${text.substring(0, 50)}..., chatId=${
        chatId ?? 'N/A'
      }, appId=${appId}, skipChatLogUpdate=${skipChatLogUpdate}, preselectedEmotion=${
        preselectedEmotion ?? 'N/A'
      }`,
      'TTSService',
    );

    const body = { chatId, prompt: text, appId };
    const fakeReq: any = { user: { id: userId, role: reqRole } };

    let ttsResult: { ttsUrl?: string; duration?: number; emotion?: string } | null = null;
    const mockRes: any = {
      status: () => mockRes,
      send: (data: any) => {
        if (data?.ttsUrl) {
          ttsResult = { ttsUrl: data.ttsUrl, duration: data.duration, emotion: data.emotion };
        }
        return mockRes;
      },
    };

    try {
      await this.ttsProcess(body, fakeReq, mockRes, {
        skipChatLogUpdate,
        preselectedEmotion,
        preselectedVoiceId,
      });

      if (ttsResult?.ttsUrl) {
        this.deps.logDebug(
          `[generateTtsWithEmotion] TTS生成成功 - url=${ttsResult.ttsUrl}, duration=${
            ttsResult.duration
          }s, emotion=${ttsResult.emotion ?? 'N/A'}`,
          'TTSService',
        );
        return {
          ttsUrl: ttsResult.ttsUrl,
          duration: ttsResult.duration || 0,
          emotion: ttsResult.emotion || preselectedEmotion || null,
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

  async ttsProcess(
    body: any,
    req: any,
    res?: any,
    options?: {
      skipChatLogUpdate?: boolean;
      preselectedEmotion?: string | null;
      preselectedVoiceId?: string | null;
    },
  ): Promise<any> {
    const { chatId, prompt, appId: bodyAppId } = body;
    const skipChatLogUpdate = options?.skipChatLogUpdate ?? false;
    const preselectedEmotion = options?.preselectedEmotion ?? null;
    const preselectedVoiceId = options?.preselectedVoiceId ?? null;
    let voiceProviderMap: Record<string, VoiceProvider> = {};

    this.deps.logDebug(
      `开始TTS处理: ${String(prompt || '').substring(0, 50)}${
        (prompt || '').length > 50 ? '...' : ''
      }`,
      'TTSService',
    );

    const psychologicalDesc = extractPsychologicalDescription(prompt);
    this.deps.logDebug(`提取心理描述: ${psychologicalDesc || '无'}`, 'TTSService');

    const textToSpeak = cleanTextForTTS(prompt);
    this.deps.logDebug(
      `清理后的TTS文本: ${textToSpeak.substring(0, 50)}${textToSpeak.length > 50 ? '...' : ''}`,
      'TTSService',
    );

    if (!textToSpeak || textToSpeak.trim().length === 0) {
      Logger.warn('清理后文本为空，无法进行TTS', 'TTSService');
      return res.status(400).send({ error: '文本内容为空，无法进行语音合成' });
    }

    const doTtsWithVoice = async (
      voiceId: string,
      params?: { rate?: number; pitch?: number; volume?: number },
      emotion?: string,
      source?: string,
    ) => {
      const previewPayload: any = { voice_id: voiceId, text: textToSpeak };
      if (params && (params.rate || params.pitch || params.volume)) {
        if (params.rate !== undefined) previewPayload.rate = params.rate;
        if (params.pitch !== undefined) previewPayload.pitch = params.pitch;
        if (params.volume !== undefined) previewPayload.volume = params.volume;
      }

      if (voiceProviderMap?.[voiceId] === 'minimax') {
        const minimaxEmotion = normalizeMinimaxEmotion(emotion);
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

      Logger.log(
        `[TTSService] 🎵 语音合成 - 情绪: ${emotion || 'N/A'}, 音色ID: ${voiceId}, 来源: ${
          source || 'unknown'
        }, 参数: ${JSON.stringify(params || {})}`,
        'TTSService',
      );

      const { url, duration } = await this.deps.voiceService.preview(previewPayload);
      const durationInt = Math.round(duration);
      try {
        const detailKeyInfo = await this.deps.modelsService.getCurrentModelKeyInfo('tts-1');
        if (detailKeyInfo) {
          const { deduct, deductType } = detailKeyInfo;
          await this.deps.userBalanceService.validateBalance(req, deductType, deduct);
          await this.deps.userBalanceService.deductFromBalance(
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
      if (chatId && !skipChatLogUpdate) {
        await this.deps.chatLogService.updateChatLog(chatId, {
          ttsUrl: url,
          ttsDuration: durationInt,
        });
      }
      return res.status(200).send({ ttsUrl: url, duration: durationInt, emotion });
    };

    try {
      let appId = bodyAppId;
      if (!appId) {
        const chatLog = await this.deps.chatLogService.findOneChatLog(chatId);
        appId = (chatLog as any)?.appId ?? null;
      }
      this.deps.logDebug(`[TTSService] 使用的appId: ${appId}`, 'TTSService');

      const emotionConfig = await this.deps.emotionHelper.getAppEmotionConfig(appId);
      let options = [...emotionConfig.options];
      let pairs = [...emotionConfig.pairs];
      voiceProviderMap = emotionConfig.voiceProviders || {};
      const minimaxContext = resolveMinimaxVoiceContext(pairs, voiceProviderMap);
      if (minimaxContext.isMinimax && minimaxContext.voiceId) {
        const applied = applyMinimaxEmotionPreset(options, pairs, minimaxContext.voiceId);
        options = applied.options;
        pairs = applied.pairs;
        Logger.log(
          `[TTSService] 检测到 MiniMax 音色，情绪候选已固定为: ${MINIMAX_SUPPORTED_EMOTIONS.join(
            ', ',
          )}`,
          'TTSService',
        );
      }

      let defaultVoiceId: string | null = null;
      if (appId) {
        try {
          const defaultVoiceMap = await this.deps.appVoiceRepo.findOne({
            where: { appId, isDefault: 1 },
          });
          defaultVoiceId = defaultVoiceMap?.voiceId || null;
          if (defaultVoiceId && !voiceProviderMap[defaultVoiceId]) {
            const meta = await this.deps.voiceRepo.findOne({ where: { voiceId: defaultVoiceId } });
            if (meta?.provider) {
              voiceProviderMap[defaultVoiceId] = (meta.provider as VoiceProvider) || 'dashscope';
            }
          }
          if (defaultVoiceId && !pairs.find(p => p.emotion === '日常')) {
            options.push('日常');
            pairs.push({ emotion: '日常', voiceId: defaultVoiceId });
            this.deps.logDebug(
              `[TTSService] 已将角色默认音色(${defaultVoiceId})作为"日常"情绪加入候选`,
              'TTSService',
            );
          }
        } catch (e: any) {
          Logger.warn(`[TTSService] 获取默认音色失败: ${e?.message}`, 'TTSService');
        }
      }

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

      // 如果有预选情绪和音色，直接使用，跳过AI判断
      if (preselectedEmotion && preselectedVoiceId) {
        Logger.log(
          `[TTSService] 🎭 使用预选情绪: ${preselectedEmotion}, 音色: ${preselectedVoiceId}`,
          'TTSService',
        );
        // 确保 voiceProviderMap 包含预选音色的提供商信息
        if (!voiceProviderMap[preselectedVoiceId]) {
          try {
            const voiceMeta = await this.deps.voiceRepo.findOne({
              where: { voiceId: preselectedVoiceId },
            });
            if (voiceMeta?.provider) {
              voiceProviderMap[preselectedVoiceId] =
                (voiceMeta.provider as VoiceProvider) || 'dashscope';
            }
          } catch (e: any) {
            Logger.warn(`[TTSService] 获取预选音色提供商失败: ${e?.message}`, 'TTSService');
          }
        }
        const ttsParams = mapEmotionToTtsParams(preselectedEmotion);
        return await doTtsWithVoice(
          preselectedVoiceId,
          ttsParams,
          preselectedEmotion,
          '预选情绪(统一)',
        );
      }

      let chosen = await this.deps.emotionHelper.chooseEmotionFromOptions(
        psychologicalDesc,
        prompt,
        options,
      );
      if (!chosen) {
        const fallback = options.includes('日常')
          ? '日常'
          : await this.deps.emotionHelper.getAppDefaultEmotion(appId, options);
        chosen = { emotion: fallback, method: 'default' };
        Logger.log(`[TTSService] AI未识别到合适情绪，使用应用默认情绪: ${fallback}`, 'TTSService');
      }

      const finalEmotion = chosen.emotion;
      Logger.log(
        `[TTSService] 🎭 最终情绪: ${finalEmotion}，识别方法: ${chosen.method || 'unknown'}`,
        'TTSService',
      );

      if (finalEmotion) {
        const mappedVoice = pairs.find(p => p.emotion === finalEmotion)?.voiceId || null;
        if (mappedVoice) {
          Logger.log(
            `[TTSService] ✓ 命中情绪映射: emotion=${finalEmotion}, voice=${mappedVoice} (appId=${
              appId ?? 'global'
            })`,
            'TTSService',
          );
          const ttsParams = mapEmotionToTtsParams(finalEmotion);
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

    Logger.error('[TTSService] 未配置任何音色，无法进行TTS', 'TTSService');
    return res.status(400).send({ message: '请先为角色配置音色后再进行语音合成' });
  }
}
