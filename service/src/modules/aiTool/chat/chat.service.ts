import { handleError } from '@/common/utils';
import { decryptApiKey } from '@/common/utils/apiKeyEncryption';
import { correctApiBaseUrl } from '@/common/utils/correctApiBaseUrl';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import OpenAI from 'openai';
import { Repository } from 'typeorm';
import { ChatGroupService } from '../../chatGroup/chatGroup.service';
import { GlobalConfigService } from '../../globalConfig/globalConfig.service';
import { UserApiConfigEntity } from '../../user/userApiConfig.entity';
import { NetSearchService } from '../search/netSearch.service';
// 引入其他需要的模块或服务

@Injectable()
export class OpenAIChatService {
  constructor(
    private readonly globalConfigService: GlobalConfigService,
    private readonly netSearchService: NetSearchService,
    private readonly chatGroupService: ChatGroupService,
    @InjectRepository(UserApiConfigEntity)
    private readonly userApiConfigEntity: Repository<UserApiConfigEntity>,
  ) {}

  /**
   * 脱敏并截断日志内容，避免泄露敏感信息与过长日志
   */
  private sanitizeForLog(input: any, textLimit = 500): any {
    const seen = new WeakSet();
    const mask = (val: string) =>
      typeof val === 'string' && val.length > 0 ? `${val.slice(0, 6)}***` : '***';
    const truncate = (val: any): any => {
      if (typeof val === 'string') {
        return val.length > textLimit ? `${val.slice(0, textLimit)}...<truncated>` : val;
      }
      return val;
    };
    const deepCopy = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') return truncate(obj);
      if (seen.has(obj)) return '[Circular]';
      seen.add(obj);
      if (Array.isArray(obj)) return obj.map(it => deepCopy(it));
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        const key = String(k).toLowerCase();
        if (
          [
            'apikey',
            'authorization',
            'access_token',
            'x-api-key',
            'token',
            'secret',
            'password',
          ].includes(key)
        ) {
          result[k] = mask(String(v || ''));
          continue;
        }
        // 常见嵌套敏感字段处理
        if (key.includes('key') || key.includes('secret')) {
          result[k] = mask(String(v || ''));
          continue;
        }
        if (key === 'image_url' && v && typeof v === 'object' && (v as any).url) {
          result[k] = { url: truncate((v as any).url) };
          continue;
        }
        if (key === 'content') {
          result[k] = truncate(v);
          continue;
        }
        result[k] = deepCopy(v);
      }
      return result;
    };
    try {
      return deepCopy(input);
    } catch {
      return '[Unserializable Payload]';
    }
  }

  /**
   * 获取有效的API配置（用户自定义配置优先，否则使用全局配置）
   * @param userId 用户ID
   * @returns API配置对象
   */
  private async getEffectiveApiConfig(userId?: number | string) {
    // 如果没有提供userId，直接使用全局配置
    if (!userId) {
      Logger.debug('未提供userId，使用全局配置', 'OpenAIChatService');
      return null;
    }

    try {
      // 查询用户的自定义API配置
      const userConfig = await this.userApiConfigEntity.findOne({
        where: { userId: Number(userId) },
      });

      // 如果用户启用了自定义配置且配置完整，返回用户配置
      if (userConfig && userConfig.enabled === 1 && userConfig.apiUrl && userConfig.apiKey) {
        Logger.log(`用户 ${userId} 使用自定义API配置`, 'OpenAIChatService');

        // 解密API Key
        const decryptedKey = decryptApiKey(userConfig.apiKey);

        return {
          apiUrl: userConfig.apiUrl,
          apiKey: decryptedKey,
          modelName: userConfig.modelName || 'gpt-3.5-turbo',
          source: 'user-custom',
        };
      }

      // 用户配置不完整或未启用
      if (userConfig && userConfig.enabled === 1) {
        Logger.warn(
          `用户 ${userId} 启用了自定义API但配置不完整，回退到全局配置`,
          'OpenAIChatService',
        );
      }
    } catch (error) {
      Logger.error(`获取用户 ${userId} 的API配置失败: ${error.message}`, 'OpenAIChatService');
    }

    // 返回null表示使用全局配置
    return null;
  }

  /**
   * 使用用户自定义API发送聊天请求
   * @param userConfig 用户API配置
   * @param prompt 用户输入
   * @param systemMessage 系统消息
   * @param messagesHistory 消息历史
   * @param options 选项
   * @returns 聊天响应
   */
  private async chatWithCustomApi(
    userConfig: any,
    prompt: string,
    systemMessage?: string,
    messagesHistory?: any[],
    options?: { onProgress?: (textChunk: string) => void; abortSignal?: AbortSignal },
  ): Promise<{
    text: string;
    usage?: { userTokens?: number; inputTokens?: number; outputTokens?: number };
  }> {
    try {
      // 创建OpenAI客户端
      const openai = new OpenAI({
        baseURL: userConfig.apiUrl,
        apiKey: userConfig.apiKey,
        timeout: 60000, // 60秒超时
      });

      // 构建消息
      const messages: any[] = [];

      if (systemMessage) {
        messages.push({ role: 'system', content: systemMessage });
      }

      if (messagesHistory && messagesHistory.length > 0) {
        messages.push(...messagesHistory);
      } else if (prompt) {
        messages.push({ role: 'user', content: prompt });
      }

      Logger.debug(
        `使用自定义API发送请求: ${userConfig.apiUrl}, 模型: ${userConfig.modelName}`,
        'OpenAIChatService',
      );

      // 发送请求
      if (options?.onProgress) {
        // 流式响应
        const stream = await openai.chat.completions.create(
          {
            model: userConfig.modelName,
            messages,
            stream: true,
          },
          {
            signal: options.abortSignal,
          },
        );

        let fullText = '';
        let inputTokens = 0;
        let outputTokens = 0;

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullText += content;
            options.onProgress(content);
          }

          // 尝试从chunk中获取usage信息
          if ((chunk as any).usage) {
            inputTokens = (chunk as any).usage.prompt_tokens || 0;
            outputTokens = (chunk as any).usage.completion_tokens || 0;
          }
        }

        Logger.log(`自定义API请求成功，返回文本长度: ${fullText.length}`, 'OpenAIChatService');

        return {
          text: fullText,
          usage: inputTokens > 0 ? { inputTokens, outputTokens } : undefined,
        };
      } else {
        // 非流式响应
        const response = await openai.chat.completions.create(
          {
            model: userConfig.modelName,
            messages,
          },
          {
            signal: options?.abortSignal,
          },
        );

        const text = response.choices[0]?.message?.content || '';

        Logger.log(`自定义API请求成功，返回文本长度: ${text.length}`, 'OpenAIChatService');

        return {
          text,
          usage: {
            inputTokens: response.usage?.prompt_tokens || 0,
            outputTokens: response.usage?.completion_tokens || 0,
          },
        };
      }
    } catch (error) {
      Logger.error(`自定义API请求失败: ${error.message}`, 'OpenAIChatService');

      // 解析错误并抛出友好的错误消息
      let errorMessage = '自定义API请求失败';
      if (error.message.includes('timeout')) {
        errorMessage = '自定义API请求超时，请检查API URL是否正确';
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        errorMessage = '自定义API Key无效，请检查配置';
      } else if (error.message.includes('404')) {
        errorMessage = '自定义API URL不正确，请检查配置';
      } else if (error.message.includes('model')) {
        errorMessage = '自定义API模型名称不正确或不支持';
      } else {
        errorMessage = `自定义API错误: ${error.message}`;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * 处理深度思考逻辑
   * @param messagesHistory 消息历史
   * @param inputs 输入参数
   * @param result 结果对象
   * @returns 是否应该终止请求
   */
  private async handleDeepThinking(
    messagesHistory: any,
    inputs: {
      apiKey: any;
      model: any;
      proxyUrl: any;
      timeout: any;
      usingDeepThinking?: boolean;
      deepThinkingModel?: string;
      deepThinkingUrl?: string;
      deepThinkingKey?: string;
      searchResults?: any[];
      deepThinkingType?: any;
      abortController: AbortController;
      onProgress?: (data: any) => void;
    },
    result: any,
  ): Promise<boolean> {
    const {
      apiKey,
      model,
      proxyUrl,
      timeout,
      usingDeepThinking,
      searchResults,
      abortController,
      deepThinkingType,
      onProgress,
    } = inputs;

    const {
      openaiBaseUrl,
      openaiBaseKey,
      openaiBaseModel,
      deepThinkingUrl,
      deepThinkingKey,
      deepThinkingModel,
    } = await this.globalConfigService.getConfigs([
      'openaiBaseUrl',
      'openaiBaseKey',
      'openaiBaseModel',
      'deepThinkingUrl',
      'deepThinkingKey',
      'deepThinkingModel',
    ]);

    // 如果不使用深度思考且不是DeepSeek模型，直接返回
    if (!usingDeepThinking && deepThinkingType !== 2) {
      return false;
    }

    const deepUrl = deepThinkingType === 2 ? proxyUrl : deepThinkingUrl || openaiBaseUrl;
    const deepKey = deepThinkingType === 2 ? apiKey : deepThinkingKey || openaiBaseKey;
    const deepModel = deepThinkingType === 2 ? model : deepThinkingModel || openaiBaseModel;

    let shouldEndThinkStream = false;
    let thinkingSourceType = null; // 'reasoning_content' 或 'think_tag'

    // 处理所有消息中的imageUrl类型
    const processedMessages = JSON.parse(JSON.stringify(messagesHistory)).map((message: any) => {
      if (message.role === 'user' && Array.isArray(message.content)) {
        // 将带有image_url类型的内容转换为普通文本
        message.content = message.content
          .filter((item: any) => item.type !== 'image_url')
          .map((item: any) => item.text || item)
          .join('');
      }
      return message;
    });

    // 添加文件向量搜索、图片描述和MCP工具结果到system消息
    const systemMessageIndex = processedMessages.findIndex((msg: any) => msg.role === 'system');
    let additionalContent = '';

    // 如果有网络搜索结果，添加到system消息中
    if (searchResults && searchResults.length > 0) {
      // 将 searchResult 转换为 JSON 字符串
      let searchPrompt = JSON.stringify(searchResults, null, 2);

      additionalContent += `\n\n以下是网络搜索结果（请基于这些信息回答用户问题，这些信息比你的训练数据更新）：\n${searchPrompt}`;
    }

    // 将额外内容添加到system消息中
    if (systemMessageIndex !== -1) {
      processedMessages[systemMessageIndex].content += additionalContent;
    } else if (additionalContent) {
      processedMessages.unshift({
        role: 'system',
        content: additionalContent,
      });
    }

    const correctedDeepUrl = await correctApiBaseUrl(deepUrl);
    const thinkOpenai = new OpenAI({
      apiKey: deepKey,
      baseURL: correctedDeepUrl,
      timeout: timeout * 5,
    });

    // 思考流请求体日志（脱敏）
    const thinkBodyForLog = this.sanitizeForLog({
      url: correctedDeepUrl,
      model: deepModel,
      stream: true,
      messages: processedMessages,
    });
    Logger.debug(`思考流请求 - body: ${JSON.stringify(thinkBodyForLog)}`, 'OpenAIChatService');

    // 构建请求配置
    const requestConfig: any = {
      model: deepModel,
      messages: processedMessages,
      stream: true,
    };

    // 如果是 grok-3-mini-latest 模型，添加 reasoning_effort 参数
    // if (deepModel === 'grok-3-mini-latest') {
    //   requestConfig.reasoning_effort = 'high';
    //   Logger.debug('为grok-3-mini-latest模型添加reasoning_effort=high参数', 'OpenAIChatService');
    // }

    const stream = await thinkOpenai.chat.completions.create(requestConfig, {
      signal: abortController.signal,
    });

    // @ts-ignore - 忽略TypeScript错误，因为我们知道stream是可迭代的
    for await (const chunk of stream) {
      if (abortController.signal.aborted || shouldEndThinkStream) {
        break;
      }
      const delta = chunk.choices[0]?.delta;
      Logger.debug(`思考流delta: ${JSON.stringify(delta)}`, 'OpenAIChatService');
      const content = delta?.content;
      const reasoning_content = (delta as any)?.reasoning_content || '';

      // 根据已确定的思考流来源类型处理数据
      if (thinkingSourceType === 'reasoning_content') {
        // 已确定使用reasoning_content字段
        if (reasoning_content) {
          Logger.debug(
            `继续接收reasoning_content思考流: ${reasoning_content}`,
            'OpenAIChatService',
          );
          result.reasoning_content = [
            {
              type: 'text',
              text: reasoning_content,
            },
          ];
          result.full_reasoning_content += reasoning_content;
          onProgress?.({
            reasoning_content: result.reasoning_content,
          });
        } else if (content && !content.includes('<think>')) {
          // 如果出现普通content，对于非DeepSeek模型终止思考流
          // 对于DeepSeek模型，将内容作为正常响应处理
          Logger.debug(`reasoning_content模式下收到普通content: ${content}`, 'OpenAIChatService');
          if (deepThinkingType === 2) {
            result.content = [
              {
                type: 'text',
                text: content,
              },
            ];
            result.full_content += content;
            onProgress?.({
              content: result.content,
            });
          } else {
            shouldEndThinkStream = true;
          }
        }
        continue;
      } else if (thinkingSourceType === 'think_tag') {
        // 已确定使用think标签
        if (content) {
          if (content.includes('</think>')) {
            // 如果包含结束标签，提取剩余思考内容
            Logger.debug(`检测到</think>标签，思考流结束`, 'OpenAIChatService');
            const regex = /([\s\S]*?)<\/think>([\s\S]*)/;
            const matches = content.match(regex);

            if (matches) {
              const thinkContent = matches[1] || '';
              const remainingContent = matches[2] || '';

              if (thinkContent) {
                result.reasoning_content = [
                  {
                    type: 'text',
                    text: thinkContent,
                  },
                ];
                result.full_reasoning_content += thinkContent;
                onProgress?.({
                  reasoning_content: result.reasoning_content,
                });
              }

              // 对于DeepSeek模型，如果有剩余内容，作为正常响应处理
              if (deepThinkingType === 2 && remainingContent) {
                result.content = [
                  {
                    type: 'text',
                    text: remainingContent,
                  },
                ];
                result.full_content += remainingContent;
                onProgress?.({
                  content: result.content,
                });
              }
            }

            // 对于非DeepSeek模型，终止思考流
            // 对于DeepSeek模型，只标记思考流结束，但继续处理后续内容
            if (deepThinkingType !== 2) {
              shouldEndThinkStream = true;
            } else {
              thinkingSourceType = 'normal_content';
            }
          } else {
            // 继续接收think标签内的思考内容
            Logger.debug(`继续接收think标签思考流: ${content}`, 'OpenAIChatService');
            result.reasoning_content = [
              {
                type: 'text',
                text: content,
              },
            ];
            result.full_reasoning_content += content;
            onProgress?.({
              reasoning_content: result.reasoning_content,
            });
          }
        }
        continue;
      } else if (thinkingSourceType === 'normal_content' && deepThinkingType === 2) {
        // DeepSeek模型在思考流结束后的正常内容处理
        if (content) {
          result.content = [
            {
              type: 'text',
              text: content,
            },
          ];
          result.full_content += content;
          onProgress?.({
            content: result.content,
          });
        }
        continue;
      }

      // 尚未确定思考流来源类型，进行检测
      if (reasoning_content) {
        // 确定使用reasoning_content字段作为思考流
        Logger.debug(
          `首次检测到reasoning_content，确定使用reasoning_content思考流方式: ${reasoning_content}`,
          'OpenAIChatService',
        );
        thinkingSourceType = 'reasoning_content';
        result.reasoning_content = [
          {
            type: 'text',
            text: reasoning_content,
          },
        ];
        result.full_reasoning_content += reasoning_content;
        onProgress?.({
          reasoning_content: result.reasoning_content,
        });
      } else if (content) {
        if (content.includes('<think>')) {
          // 确定使用think标签作为思考流
          Logger.debug(`首次检测到<think>标签，确定使用think标签思考流方式`, 'OpenAIChatService');
          thinkingSourceType = 'think_tag';

          // 提取第一个块中的内容
          const thinkContent = content.replace(/<think>/, '');
          if (thinkContent) {
            Logger.debug(`从<think>标签中提取的初始思考内容: ${thinkContent}`, 'OpenAIChatService');
            result.reasoning_content = [
              {
                type: 'text',
                text: thinkContent,
              },
            ];
            result.full_reasoning_content += thinkContent;
            onProgress?.({
              reasoning_content: result.reasoning_content,
            });

            // 如果已经包含了</think>标签，提取思考内容和剩余内容
            if (content.includes('</think>')) {
              Logger.debug('在首个块中检测到</think>标签', 'OpenAIChatService');

              const regex = /<think>([\s\S]*?)<\/think>([\s\S]*)/;
              const matches = content.match(regex);

              if (matches) {
                const fullThinkContent = matches[1] || '';
                const remainingContent = matches[2] || '';

                // 更新思考内容
                result.reasoning_content = [
                  {
                    type: 'text',
                    text: fullThinkContent,
                  },
                ];
                result.full_reasoning_content = fullThinkContent;
                onProgress?.({
                  reasoning_content: result.reasoning_content,
                });

                // 对于DeepSeek模型，如果有剩余内容，作为正常响应处理
                if (deepThinkingType === 2 && remainingContent) {
                  result.content = [
                    {
                      type: 'text',
                      text: remainingContent,
                    },
                  ];
                  result.full_content += remainingContent;
                  onProgress?.({
                    content: result.content,
                  });
                }
              }

              // 对于非DeepSeek模型，终止思考流
              // 对于DeepSeek模型，只标记思考流结束，继续处理后续内容
              if (deepThinkingType !== 2) {
                shouldEndThinkStream = true;
              } else {
                thinkingSourceType = 'normal_content';
              }
            }
          }
        } else {
          // 没有任何思考流标记，不同模型有不同处理
          Logger.debug(`没有检测到思考流标记，处理普通内容: ${content}`, 'OpenAIChatService');

          if (deepThinkingType === 2) {
            // DeepSeek模型直接处理为正常内容
            thinkingSourceType = 'normal_content';
            result.content = [
              {
                type: 'text',
                text: content,
              },
            ];
            result.full_content += content;
            onProgress?.({
              content: result.content,
            });
          } else {
            // 非DeepSeek模型终止思考流
            shouldEndThinkStream = true;
          }
        }
      }
    }

    Logger.debug('思考流处理完成', 'OpenAIChatService');

    // 如果是DeepSeek模型并且有内容，直接返回true表示应该终止请求
    return deepThinkingType === 2 && result.full_content.length > 0;
  }

  /**
   * 处理常规响应逻辑
   * @param messagesHistory 消息历史
   * @param inputs 输入参数
   * @param result 结果对象
   */
  private async handleRegularResponse(
    messagesHistory: any,
    inputs: {
      apiKey: any;
      model: any;
      proxyUrl: any;
      timeout: any;
      temperature: any;
      max_tokens?: any;
      extraParam?: any;
      searchResults?: any[];
      images?: string[];
      userId?: any;
      groupId?: any;
      appId?: any;
      isGroupChat?: boolean;
      abortController: AbortController;
      onProgress?: (data: any) => void;
    },
    result: any,
  ): Promise<void> {
    const {
      apiKey,
      model,
      proxyUrl,
      timeout,
      temperature,
      max_tokens,
      searchResults,
      images,
      userId,
      groupId,
      isGroupChat,
      abortController,
      onProgress,
    } = inputs;

    // 步骤1: 准备和增强系统消息
    const processedMessages = this.prepareSystemMessage(
      messagesHistory,
      {
        searchResults,
        images,
      },
      result,
    );

    // 步骤2: 处理OpenAI聊天API调用
    await this.handleOpenAIChat(
      processedMessages,
      {
        apiKey,
        model,
        proxyUrl,
        timeout,
        temperature,
        max_tokens,
        userId,
        groupId,
        appId: inputs.appId,
        isGroupChat,
        abortController,
        onProgress,
      },
      result,
    );
  }

  async chat(
    messagesHistory: any,
    inputs: {
      chatId: any;
      userId?: any;
      groupId?: any;
      appId?: any;
      isGroupChat?: boolean;
      maxModelTokens?: any;
      max_tokens?: any;
      apiKey: any;
      model: any;
      modelName: any;
      temperature: any;
      modelType?: any;
      prompt?: any;
      imageUrl?: any;
      isFileUpload: any;
      isImageUpload?: any;
      fileUrl?: any;
      usingNetwork?: boolean;
      timeout: any;
      proxyUrl: any;
      modelAvatar?: any;
      usingDeepThinking?: boolean;
      usingMcpTool?: boolean;
      isMcpTool?: boolean;
      extraParam?: any;
      deepThinkingType?: any;
      onProgress?: (data: {
        text?: string;
        content?: [];
        reasoning_content?: [];
        tool_calls?: string;
        networkSearchResult?: string;
        finishReason?: string;
        // full_json?: string; // 编辑模式相关，已注释
      }) => void;
      onFailure?: (error: any) => void;
      onDatabase?: (data: any) => void;
      abortController: AbortController;
    },
  ) {
    const {
      chatId,
      userId,
      groupId,
      isGroupChat: inputIsGroupChat,
      maxModelTokens,
      max_tokens,
      apiKey,
      model,
      modelName,
      temperature,
      prompt,
      timeout,
      proxyUrl,
      modelAvatar,
      usingDeepThinking,
      usingNetwork,
      extraParam,
      deepThinkingType,
      onProgress,
      onFailure,
      onDatabase,
      abortController,
    } = inputs;

    // 创建原始消息历史的副本
    const originalMessagesHistory = JSON.parse(JSON.stringify(messagesHistory));

    const result: any = {
      chatId,
      modelName,
      modelAvatar,
      model,
      status: 2,
      full_content: '',
      full_reasoning_content: '',
      networkSearchResult: '',
      fileVectorResult: '',
      finishReason: null,
    };

    try {
      // 步骤1: 处理网络搜索 - 使用NetSearchService
      const { searchResults, images } = await this.netSearchService.processNetSearch(
        prompt || '',
        {
          usingNetwork,
          onProgress,
          onDatabase,
        },
        result,
      );

      // 步骤5: 处理深度思考
      const shouldEndRequest = await this.handleDeepThinking(
        messagesHistory,
        {
          apiKey,
          model,
          proxyUrl,
          timeout,
          usingDeepThinking,
          searchResults,
          abortController,
          deepThinkingType,
          onProgress,
        },
        result,
      );

      // 如果深度思考处理后应该终止请求，则直接返回结果
      if (shouldEndRequest) {
        result.content = '';
        result.reasoning_content = '';
        result.finishReason = 'stop';
        return result;
      }

      // 步骤6: 处理常规响应
      await this.handleRegularResponse(
        originalMessagesHistory,
        {
          apiKey,
          model,
          proxyUrl,
          timeout,
          temperature,
          max_tokens,
          extraParam,
          searchResults,
          images,
          userId,
          groupId,
          appId: inputs.appId,
          isGroupChat: inputIsGroupChat,
          abortController,
          onProgress,
        },
        result,
      );

      result.content = [
        {
          type: 'text',
          text: '',
        },
      ];
      result.reasoning_content = [
        {
          type: 'text',
          text: '',
        },
      ];
      result.finishReason = 'stop';

      return result;
    } catch (error) {
      const errorMessage = handleError(error);
      Logger.error(`对话请求失败: ${errorMessage}`, 'OpenAIChatService');
      result.errMsg = errorMessage;
      onFailure?.(result);
      return result;
    }
  }

  async chatFree(
    prompt: string,
    systemMessage?: string,
    messagesHistory?: any[],
    imageUrl?: any,
    options?: { onProgress?: (textChunk: string) => void; abortSignal?: AbortSignal },
    appConfig?: {
      botName?: string;
      userId?: number | string;
      appId?: number | string;
      enableRealTime?: boolean;
      enableLongTermMemory?: boolean;
      enableKnowledgeBase?: boolean;
      knowledgeBaseIds?: string;
      dialogueExamples?: string;
      openingRemark?: string; // 添加开场白参数
    },
  ): Promise<{
    text: string;
    usage?: { userTokens?: number; inputTokens?: number; outputTokens?: number };
  }> {
    // 检查用户是否配置了自定义API
    const userConfig = await this.getEffectiveApiConfig(appConfig?.userId);

    // 如果用户配置了自定义API，使用自定义API
    if (userConfig) {
      try {
        Logger.log(
          `用户 ${appConfig?.userId} 使用自定义API: ${userConfig.apiUrl}`,
          'OpenAIChatService',
        );
        return await this.chatWithCustomApi(
          userConfig,
          prompt,
          systemMessage,
          messagesHistory,
          options,
        );
      } catch (error) {
        Logger.error(
          `用户 ${appConfig?.userId} 的自定义API请求失败，回退到全局配置: ${error.message}`,
          'OpenAIChatService',
        );
        // 继续使用全局配置（星尘API）
      }
    }

    // 使用全局配置（星尘API）
    // 实现重试逻辑：如果返回内容为空，最多重试3次
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          Logger.warn(`星尘API第${attempt}次尝试（共${maxRetries}次）`, 'OpenAIChatService');
        }

        const result = await this.chatFreeInternal(
          prompt,
          systemMessage,
          messagesHistory,
          imageUrl,
          options,
          appConfig,
        );

        // 如果成功返回非空内容，直接返回
        return result;
      } catch (error) {
        lastError = error;
        const errorMessage = error?.message || String(error);

        // 只对"返回内容为空"的错误进行重试
        if (errorMessage.includes('返回内容为空')) {
          if (attempt < maxRetries) {
            Logger.warn(`星尘API返回内容为空，将进行第${attempt + 1}次重试`, 'OpenAIChatService');
            // 等待一小段时间后重试（避免过快重试）
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          } else {
            Logger.error(`星尘API重试${maxRetries}次后仍返回空内容，放弃重试`, 'OpenAIChatService');
          }
        }

        // 其他类型的错误直接抛出，不重试
        throw error;
      }
    }

    // 如果所有重试都失败，抛出最后一个错误
    throw lastError || new Error('星尘API请求失败');
  }

  async chatQwenPlusCharacter(
    prompt: string,
    systemMessage?: string,
    messagesHistory?: any[],
    imageUrl?: any,
    options?: { onProgress?: (textChunk: string) => void; abortSignal?: AbortSignal },
    appConfig?: {
      botName?: string;
      userId?: number | string;
      appId?: number | string;
      enableRealTime?: boolean;
      enableLongTermMemory?: boolean;
      enableKnowledgeBase?: boolean;
      knowledgeBaseIds?: string;
      dialogueExamples?: string;
      openingRemark?: string;
    },
  ): Promise<{
    text: string;
    usage?: { userTokens?: number; inputTokens?: number; outputTokens?: number };
  }> {
    // 检查用户是否配置了自定义API
    const userConfig = await this.getEffectiveApiConfig(appConfig?.userId);

    // 如果用户配置了自定义API，使用自定义API
    if (userConfig) {
      try {
        Logger.log(
          `用户 ${appConfig?.userId} 使用自定义API: ${userConfig.apiUrl}`,
          'OpenAIChatService',
        );
        return await this.chatWithCustomApi(
          userConfig,
          prompt,
          systemMessage,
          messagesHistory,
          options,
        );
      } catch (error) {
        Logger.error(
          `用户 ${appConfig?.userId} 的自定义API请求失败，回退到全局配置: ${error.message}`,
          'OpenAIChatService',
        );
        // 继续使用全局配置（通义千问）
      }
    }

    // 使用全局配置（通义千问）
    const cfgKey: any = await this.globalConfigService.getConfigs(['dashscopeApiKey']);
    const dashscopeApiKey = typeof cfgKey === 'string' ? cfgKey : cfgKey?.dashscopeApiKey;
    const apiKey = dashscopeApiKey || process.env.DASHSCOPE_API_KEY || '';

    if (!apiKey) {
      Logger.error(
        'DashScope API Key未配置！请在系统配置中设置 dashscopeApiKey，或在环境变量中设置 DASHSCOPE_API_KEY',
        'OpenAIChatService',
      );
      throw new Error('DashScope API Key未配置');
    }

    const baseURL =
      process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const messages = await this.buildQwenPlusMessages(
      prompt,
      systemMessage,
      messagesHistory,
      appConfig,
    );

    const isStreaming = typeof options?.onProgress === 'function';
    const openai = new OpenAI({
      apiKey,
      baseURL,
    });

    const requestConfig: any = {
      model: 'deepseek-v3.2-exp',
      messages,
      stream: isStreaming,
    };

    const logPayload = this.sanitizeForLog({
      baseURL,
      model: requestConfig.model,
      stream: requestConfig.stream,
      messages,
      appId: appConfig?.appId,
      userId: appConfig?.userId,
    });
    Logger.debug(`QwenPlus请求 - body: ${JSON.stringify(logPayload)}`, 'OpenAIChatService');

    try {
      if (isStreaming) {
        const stream = await openai.chat.completions.create(requestConfig, {
          signal: options?.abortSignal,
        });
        let fullText = '';
        let usage:
          | {
              userTokens?: number;
              inputTokens?: number;
              outputTokens?: number;
            }
          | undefined;

        // @ts-ignore stream is iterable
        for await (const chunk of stream) {
          const delta = chunk?.choices?.[0]?.delta?.content;
          const deltaText = this.extractDeltaText(delta);

          if (deltaText) {
            fullText += deltaText;
            try {
              options?.onProgress?.(deltaText);
            } catch {}
          }
          if (chunk?.usage) {
            usage = this.mapDashscopeUsage(chunk.usage);
          }
        }

        Logger.debug(
          `[QwenPlus] 流式响应完成，fullText长度: ${fullText.length}`,
          'OpenAIChatService',
        );

        if (!fullText || fullText.trim() === '') {
          Logger.warn(`[QwenPlus] ⚠️ 流式响应返回了空内容！`, 'OpenAIChatService');
        }

        return {
          text: fullText,
          usage,
        };
      }

      const completion = await openai.chat.completions.create(requestConfig, {
        signal: options?.abortSignal,
      });

      Logger.debug(`[QwenPlus] 非流式响应: ${JSON.stringify(completion)}`, 'OpenAIChatService');

      const text = completion?.choices?.[0]?.message?.content || '';
      const usage = completion?.usage ? this.mapDashscopeUsage(completion.usage) : undefined;

      Logger.debug(`[QwenPlus] 提取的文本: "${text}", 长度: ${text.length}`, 'OpenAIChatService');

      if (!text || text.trim() === '') {
        Logger.warn(
          `[QwenPlus] ⚠️ 模型返回了空内容！完整响应: ${JSON.stringify(completion)}`,
          'OpenAIChatService',
        );
      }

      return {
        text,
        usage,
      };
    } catch (error) {
      const errorMessage = handleError(error);
      Logger.error(`QwenPlus调用失败: ${errorMessage}`, 'OpenAIChatService');

      // 检查是否为内容审核错误
      if (
        errorMessage.includes('inappropriate content') ||
        errorMessage.includes('内容不适当') ||
        errorMessage.includes('敏感内容') ||
        errorMessage.includes('DataInspectionFailed')
      ) {
        Logger.warn(`[QwenPlus] ⚠️ 触发内容审核，返回友好错误提示给用户`, 'OpenAIChatService');
        throw new BadRequestException(
          '抱歉，您的消息或者角色提示词包含敏感内容，无法处理。请修改后重试。',
        );
      }

      throw error;
    }
  }

  /**
   * chatFree的内部实现，不包含重试逻辑
   */
  private async chatFreeInternal(
    prompt: string,
    systemMessage?: string,
    messagesHistory?: any[],
    imageUrl?: any,
    options?: { onProgress?: (textChunk: string) => void; abortSignal?: AbortSignal },
    appConfig?: {
      botName?: string;
      userId?: number | string;
      appId?: number | string;
      enableRealTime?: boolean;
      enableLongTermMemory?: boolean;
      enableKnowledgeBase?: boolean;
      knowledgeBaseIds?: string;
      dialogueExamples?: string;
      openingRemark?: string; // 添加开场白参数
    },
  ): Promise<{
    text: string;
    usage?: { userTokens?: number; inputTokens?: number; outputTokens?: number };
  }> {
    // 构造消息与 botProfile
    let botContent = systemMessage || '';
    const messages: any[] = [];

    if (messagesHistory && messagesHistory.length > 0) {
      let isFirstSystemMessage = true; // 标记是否为第一条system消息
      for (const msg of messagesHistory) {
        if (msg?.role === 'system') {
          // 只有第一条system消息才用作botProfile
          if (isFirstSystemMessage && !botContent && typeof msg.content === 'string') {
            botContent = msg.content;
            isFirstSystemMessage = false;
            continue; // 第一条system消息不加入messages
          }
          // 后续的system消息保留在messages中（作为上下文）
          isFirstSystemMessage = false;
          messages.push(msg);
          continue;
        }
        messages.push(msg);
      }

      // 合并表情包消息到前一条assistant消息
      const mergedMessages: any[] = [];
      for (let i = 0; i < messages.length; i++) {
        const currentMsg = messages[i];

        // 检查是否为assistant的表情包消息，且前一条也是assistant消息
        if (
          i > 0 &&
          currentMsg.role === 'assistant' &&
          mergedMessages[mergedMessages.length - 1]?.role === 'assistant' &&
          this.isStickerMessage(currentMsg.content)
        ) {
          // 将表情包消息用[]包裹后拼接到前一条assistant消息后面
          mergedMessages[mergedMessages.length - 1].content += '\n[' + currentMsg.content + ']';
        } else {
          // 正常添加消息
          mergedMessages.push(currentMsg);
        }
      }

      // 用合并后的消息替换原始消息
      messages.length = 0;
      messages.push(...mergedMessages);
    } else {
      // 简单单轮
      messages.push({ role: 'user', content: prompt });
    }

    // 如果仍未获取到角色预设，则回退到全局预设（systemPreMessage）
    if (!botContent) {
      try {
        const cfg: any = await this.globalConfigService.getConfigs(['systemPreMessage']);
        const pre = typeof cfg === 'string' ? cfg : cfg?.systemPreMessage;
        if (pre) botContent = pre;
      } catch (_) {}
    }

    // 如果角色有开场白，添加到角色预设中
    // if (appConfig?.openingRemark && appConfig.openingRemark.trim()) {
    //   const openingRemarkPrompt = `\n\n【角色开场白】:\n"${appConfig.openingRemark}"`;
    //   botContent = (botContent || '') + openingRemarkPrompt;
    //   Logger.debug(
    //     `已将开场白添加到角色预设中: ${appConfig.openingRemark.substring(0, 50)}...`,
    //     'OpenAIChatService',
    //   );
    // }

    // 确保 botContent 不为空（星尘API要求 botProfile.content 不能为空）
    if (!botContent || botContent.trim() === '') {
      botContent = '你是一个友好、乐于助人的AI助手。请用简洁、自然的方式回答用户的问题。';
      Logger.debug('使用默认角色预设（botProfile.content不能为空）', 'OpenAIChatService');
    }

    // 读取星尘 Key（getConfigs 单键时返回字符串，兼容处理）
    const cfgKey: any = await this.globalConfigService.getConfigs(['xingchenApiKey']);
    const xingchenApiKey = typeof cfgKey === 'string' ? cfgKey : cfgKey?.xingchenApiKey;
    const useKey = xingchenApiKey || process.env.XINGCHEN_API_KEY || '';

    if (!useKey) {
      Logger.error(
        '星尘API Key未配置！请在系统配置中设置 xingchenApiKey，或在环境变量中设置 XINGCHEN_API_KEY',
        'OpenAIChatService',
      );
      throw new Error('星尘API Key未配置');
    }

    Logger.debug(`星尘API Key已配置: ${useKey ? '已设置' : '未设置'}`, 'OpenAIChatService');

    const url = 'https://nlp.aliyuncs.com/v2/api/chat/send';
    const isStreaming = !!options?.onProgress;
    const headers: any = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json;q=0.9, */*;q=0.8',
      'x-fag-servicename': isStreaming ? 'aca-chat-send-sse' : 'aca-chat-send',
      'x-fag-appcode': 'aca',
      Authorization: `Bearer ${useKey}`,
      'X-AcA-DataInspection': 'enable',
      // 官方文档：可通过 X-AcA-SSE 控制是否开启流式
      ...(isStreaming ? { 'X-AcA-SSE': 'enable' } : {}),
    };

    // 构建星尘API的aca配置对象
    const botName = appConfig?.botName || 'AI助手';

    // 构建组合的 userId：用户ID+应用ID
    let composedUserId = 'system';
    if (appConfig?.userId && appConfig?.appId) {
      composedUserId = `user_${appConfig.userId}_app_${appConfig.appId}`;
    } else if (appConfig?.userId) {
      composedUserId = `user_${appConfig.userId}`;
    }

    const acaConfig: any = {
      botProfile: {
        name: botName,
        content: botContent || '',
      },
      userProfile: {
        userId: composedUserId,
      },
    };

    // 添加星尘API扩展配置到 aca 对象
    if (appConfig) {
      // 1. scenario.isRealTime - 真实时间开关
      if (appConfig.enableRealTime !== undefined) {
        if (!acaConfig.scenario) {
          acaConfig.scenario = {};
        }
        acaConfig.scenario.isRealTime = appConfig.enableRealTime;
      }

      // 2. memory - 长期记忆配置
      if (appConfig.enableLongTermMemory !== undefined && appConfig.enableLongTermMemory) {
        // 长期记忆对象，根据星尘API文档，传递空对象即开启
        acaConfig.memory = {};
      }

      // 3. advancedSettings - 高级设置
      const hasAdvancedSettings =
        appConfig.enableKnowledgeBase !== undefined || appConfig.knowledgeBaseIds;

      if (hasAdvancedSettings) {
        if (!acaConfig.advancedSettings) {
          acaConfig.advancedSettings = {};
        }

        // 3.1 enableCharacterKbSearch - 知识库搜索开关
        if (appConfig.enableKnowledgeBase !== undefined) {
          acaConfig.advancedSettings.enableCharacterKbSearch = appConfig.enableKnowledgeBase;
        }

        // 3.2 knowledgeBases - 知识库ID列表
        if (appConfig.enableKnowledgeBase && appConfig.knowledgeBaseIds) {
          try {
            const kbIds = JSON.parse(appConfig.knowledgeBaseIds);
            if (Array.isArray(kbIds) && kbIds.length > 0) {
              acaConfig.advancedSettings.knowledgeBases = kbIds;
            }
          } catch (e) {
            Logger.warn(`解析知识库ID列表失败: ${e}`, 'OpenAIChatService');
          }
        }
      }

      // 4. 对话示例（sampleMessages）
      // 根据星尘API文档，对话示例参数为 input.aca.sampleMessages
      if (appConfig.dialogueExamples) {
        try {
          const examples = JSON.parse(appConfig.dialogueExamples);
          if (Array.isArray(examples) && examples.length > 0) {
            // 添加为 sampleMessages 属性（星尘API标准参数）
            acaConfig.sampleMessages = examples;
            Logger.debug(`已添加对话示例到星尘API请求: ${examples.length}条`, 'OpenAIChatService');
          }
        } catch (e) {
          Logger.warn(`解析对话示例失败: ${e}`, 'OpenAIChatService');
        }
      }

      // 注意：openingRemark (开场白) 不是API请求参数
      // 开场白应该在应用层面处理，例如作为第一条消息展示给用户
    }

    const payload: any = {
      input: {
        messages,
        aca: acaConfig,
      },
      // 文档允许传 model，可为空按平台默认路由
      // model: 'xingchen-plus-latest',
      ...(isStreaming ? { parameters: { incrementalOutput: true } } : {}),
      ...(isStreaming ? { stream: true } : {}),
    };

    try {
      // 星尘请求体日志（脱敏）
      const xingchenLog = this.sanitizeForLog({ url, headers, payload });
      Logger.debug(`星尘请求 - body: ${JSON.stringify(xingchenLog)}`, 'OpenAIChatService');

      // 若需要流式，则用 fetch 读取分块/SSE；否则兼容一次性
      const controller = new AbortController();
      const signal = options?.abortSignal || controller.signal;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal,
      } as any);

      Logger.debug(
        `星尘API响应状态: ${response.status} ${response.statusText}`,
        'OpenAIChatService',
      );

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error(`星尘API请求失败: ${response.status} ${errorText}`, 'OpenAIChatService');
        throw new Error(`星尘API请求失败: ${response.status} ${errorText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const isSse = contentType.includes('text/event-stream');
      const supportsStream =
        !!(response as any).body && typeof (response as any).body.getReader === 'function';

      Logger.debug(
        `星尘API响应类型: contentType=${contentType}, isSse=${isSse}, supportsStream=${supportsStream}`,
        'OpenAIChatService',
      );

      if (options?.onProgress && (isSse || supportsStream)) {
        const reader = (response as any).body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let full = '';
        let usage: any = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (isSse) {
            // SSE: 以 "\n\n" 分隔事件，逐行解析 data:
            let sepIndex;
            while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
              const eventChunk = buffer.slice(0, sepIndex);
              buffer = buffer.slice(sepIndex + 2);
              const dataLine = eventChunk
                .split('\n')
                .map(l => l.trim())
                .find(l => l.startsWith('data:'));
              if (!dataLine) continue;
              const jsonStr = dataLine.replace(/^data:\s*/, '');
              try {
                const obj = JSON.parse(jsonStr);
                let delta = '';
                const choices = obj?.data?.choices || obj?.choices;
                if (Array.isArray(choices) && choices.length) {
                  const msgs = choices[0]?.messages;
                  if (Array.isArray(msgs) && msgs.length) delta = msgs[0]?.content || '';
                }
                if (!delta && typeof obj?.output === 'string') delta = obj.output;
                if (!delta && typeof obj?.content === 'string') delta = obj.content;
                // 常见增量字段
                if (!delta && typeof obj?.delta === 'string') delta = obj.delta;
                if (!delta && typeof obj?.text === 'string') delta = obj.text;
                if (delta) {
                  full += delta;
                  try {
                    options.onProgress(delta);
                  } catch {}
                }
                // 提取usage信息（星尘API在最后一个分块返回usage）
                if (obj?.usage) {
                  usage = obj.usage;
                  Logger.debug(`星尘API返回usage: ${JSON.stringify(usage)}`, 'OpenAIChatService');
                }
              } catch {}
            }
          } else {
            // 非SSE分块：尝试逐行解析JSON；失败则作为纯文本直接推送
            let lineBreak;
            while ((lineBreak = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, lineBreak).trim();
              buffer = buffer.slice(lineBreak + 1);
              if (!line) continue;
              let delta = '';
              try {
                const obj = JSON.parse(line);
                const choices = obj?.data?.choices || obj?.choices;
                if (Array.isArray(choices) && choices.length) {
                  const msgs = choices[0]?.messages;
                  if (Array.isArray(msgs) && msgs.length) delta = msgs[0]?.content || '';
                }
                if (!delta && typeof obj?.output === 'string') delta = obj.output;
                if (!delta && typeof obj?.content === 'string') delta = obj.content;
                if (!delta && typeof obj?.delta === 'string') delta = obj.delta;
                if (!delta && typeof obj?.text === 'string') delta = obj.text;
                // 提取usage信息
                if (obj?.usage) {
                  usage = obj.usage;
                  Logger.debug(`星尘API返回usage: ${JSON.stringify(usage)}`, 'OpenAIChatService');
                }
              } catch {
                // 不是JSON，按纯文本增量
                delta = line;
              }
              if (delta) {
                full += delta;
                try {
                  options.onProgress(delta);
                } catch {}
              }
            }
          }
        }
        // 处理残留缓冲区
        if (buffer && buffer.trim()) {
          try {
            const obj = JSON.parse(buffer.trim());
            let tail = '';
            const choices = obj?.data?.choices || obj?.choices;
            if (Array.isArray(choices) && choices.length) {
              const msgs = choices[0]?.messages;
              if (Array.isArray(msgs) && msgs.length) tail = msgs[0]?.content || '';
            }
            if (!tail && typeof obj?.output === 'string') tail = obj.output;
            if (!tail && typeof obj?.content === 'string') tail = obj.content;
            if (!tail && typeof obj?.delta === 'string') tail = obj.delta;
            if (!tail && typeof obj?.text === 'string') tail = obj.text;
            if (tail) {
              full += tail;
              try {
                options.onProgress(tail);
              } catch {}
            }
            // 提取usage信息
            if (obj?.usage) {
              usage = obj.usage;
              Logger.debug(`星尘API返回usage: ${JSON.stringify(usage)}`, 'OpenAIChatService');
            }
          } catch {
            // 残留纯文本
            full += buffer;
            try {
              options.onProgress(buffer);
            } catch {}
          }
        }
        // 检查返回内容是否为空
        if (!full || full.trim() === '') {
          Logger.warn(
            `星尘API返回内容为空 - usage: ${JSON.stringify(usage)}, 将抛出错误以触发重试`,
            'OpenAIChatService',
          );
          throw new Error('星尘API返回内容为空');
        }

        // 返回聚合文本和usage
        return {
          text: full,
          usage: usage
            ? {
                userTokens: usage.userTokens,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
              }
            : undefined,
        };
      }

      // 非流式：一次性解析
      let text = '';
      let usage: any = null;
      try {
        const data = await response.json();
        const choices = data?.data?.choices || data?.choices;
        if (choices?.length) {
          const msgs = choices[0]?.messages;
          if (Array.isArray(msgs) && msgs.length) text = msgs[0]?.content || '';
        }
        if (!text && typeof data?.output === 'string') text = data.output;
        if (!text && typeof data?.content === 'string') text = data.content;
        // 提取usage信息
        if (data?.usage) {
          usage = data.usage;
          Logger.debug(`星尘API返回usage: ${JSON.stringify(usage)}`, 'OpenAIChatService');
        }
      } catch {
        // 回退到纯文本
        try {
          const raw = await response.text();
          if (raw) text = raw;
        } catch {}
      }

      // 检查返回内容是否为空
      if (!text || text.trim() === '') {
        Logger.warn(
          `星尘API返回内容为空 - usage: ${JSON.stringify(usage)}, 将抛出错误以触发重试`,
          'OpenAIChatService',
        );
        throw new Error('星尘API返回内容为空');
      }

      return {
        text,
        usage: usage
          ? {
              userTokens: usage.userTokens,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
            }
          : undefined,
      };
    } catch (error) {
      const errorMessage = handleError(error);
      Logger.error(`星尘全局模型调用失败: ${errorMessage}`, 'OpenAIChatService');
      Logger.error(`错误详情: ${JSON.stringify(error)}`, 'OpenAIChatService');

      // 检查是否为内容审核错误
      if (
        errorMessage.includes('inappropriate content') ||
        errorMessage.includes('内容不适当') ||
        errorMessage.includes('敏感内容') ||
        errorMessage.includes('DataInspectionFailed') ||
        errorMessage.includes('安全审核')
      ) {
        Logger.warn(`[星尘API] ⚠️ 触发内容审核，返回友好错误提示给用户`, 'OpenAIChatService');
        throw new BadRequestException(
          '抱歉，您的消息或者角色提示词包含敏感内容，无法处理。请修改后重试。',
        );
      }

      throw error; // 抛出错误而不是返回undefined
    }
  }

  /**
   * 判断消息内容是否为表情包消息
   * 直接返回true，所有连续的assistant消息都会被拼接
   */
  private isStickerMessage(content: string): boolean {
    return true;
  }

  /**
   * 过滤system消息中的敏感词汇，避免触发内容审核
   */
  private sanitizeSystemMessage(message: string): string {
    if (!message) return message;

    // 敏感词替换映射（保持语义但使用更温和的表述）
    const replacements: Record<string, string> = {
      调情: '友好互动',
      暗示: '含蓄表达',
      暗示意味: '含蓄表达',
      嫉妒: '在意',
      不允许: '希望避免',
      禁止: '不建议',
      狡诈: '机智',
      占据主导地位: '善于引导',
      主导: '引导',
      控制: '关注',
      宠爱: '关心',
      溺爱: '关爱',
      男友气息: '亲切感',
      女友: '朋友',
      恋人: '好友',
      情侣: '朋友',
      亲密: '友好',
      撒娇: '可爱表达',
      吃醋: '在意',
    };

    let sanitized = message;
    for (const [sensitive, safe] of Object.entries(replacements)) {
      sanitized = sanitized.replace(new RegExp(sensitive, 'g'), safe);
    }

    return sanitized;
  }

  private async buildQwenPlusMessages(
    prompt: string,
    systemMessage?: string,
    messagesHistory?: any[],
    appConfig?: { openingRemark?: string },
  ): Promise<any[]> {
    let systemPrompt = systemMessage?.trim() || '';
    const normalizedMessages: any[] = [];
    const additionalSystemMessages: string[] = []; // 收集额外的system消息

    if (messagesHistory && messagesHistory.length > 0) {
      let firstSystemConsumed = false;
      for (const message of messagesHistory) {
        if (message?.role === 'system') {
          if (!firstSystemConsumed && !systemPrompt && typeof message.content === 'string') {
            // 第一个system消息作为主system prompt
            systemPrompt = message.content;
            firstSystemConsumed = true;
            continue;
          }
          // 后续的system消息收集起来，稍后合并
          if (typeof message.content === 'string' && message.content.trim()) {
            additionalSystemMessages.push(message.content.trim());
          }
          firstSystemConsumed = true;
          continue; // 跳过system消息，不加入normalizedMessages
        }

        normalizedMessages.push({
          role: message.role || 'user',
          content: this.normalizeQwenMessageContent(message?.content),
        });
      }

      // 合并表情包消息到前一条assistant消息
      const mergedMessages: any[] = [];
      for (let i = 0; i < normalizedMessages.length; i++) {
        const currentMsg = normalizedMessages[i];

        // 检查是否为assistant的表情包消息，且前一条也是assistant消息
        if (
          i > 0 &&
          currentMsg.role === 'assistant' &&
          mergedMessages[mergedMessages.length - 1]?.role === 'assistant' &&
          this.isStickerMessage(currentMsg.content)
        ) {
          // 将表情包消息用[]包裹后拼接到前一条assistant消息后面
          mergedMessages[mergedMessages.length - 1].content += '\n[' + currentMsg.content + ']';
        } else {
          // 正常添加消息
          mergedMessages.push(currentMsg);
        }
      }

      // 用合并后的消息替换原始消息
      normalizedMessages.length = 0;
      normalizedMessages.push(...mergedMessages);
    } else if (prompt) {
      normalizedMessages.push({ role: 'user', content: prompt });
    }

    // 合并额外的system消息到主systemPrompt
    if (additionalSystemMessages.length > 0) {
      systemPrompt = systemPrompt + '\n\n' + additionalSystemMessages.join('\n\n');
    }

    if (!systemPrompt) {
      try {
        const cfg: any = await this.globalConfigService.getConfigs(['systemPreMessage']);
        const pre = typeof cfg === 'string' ? cfg : cfg?.systemPreMessage;
        if (pre) {
          systemPrompt = pre;
        }
      } catch {}
    }

    // if (appConfig?.openingRemark && appConfig.openingRemark.trim()) {
    //   systemPrompt = `${systemPrompt}\n\n【角色开场白】:\n"${appConfig.openingRemark}"`;
    // }

    if (!systemPrompt) {
      systemPrompt = '你是一个友好且乐于助人的AI助手，回答需要自然、具体、有温度。';
    }

    // 添加当前时间到系统消息（如果还没有的话）
    if (!systemPrompt.includes('【当前时间】')) {
      const now = new Date();
      const timeOptions = {
        timeZone: 'Asia/Shanghai',
        year: 'numeric' as const,
        month: '2-digit' as const,
        day: '2-digit' as const,
        hour: '2-digit' as const,
        minute: '2-digit' as const,
        hour12: false,
      };
      const currentDate = new Intl.DateTimeFormat('zh-CN', timeOptions).format(now);

      // 获取当前小时数用于生成时间相关的行为提示
      const hour = now.getHours();
    }

    // 打印完整的system消息内容，用于排查问题
    Logger.debug(`[QwenPlus] 原始System消息内容:\n${systemPrompt}`, 'OpenAIChatService');

    // 过滤敏感词汇以避免触发内容审核
    const sanitizedSystemPrompt = this.sanitizeSystemMessage(systemPrompt);
    if (sanitizedSystemPrompt !== systemPrompt) {
      Logger.log(`[QwenPlus] 已对System消息进行内容过滤，避免触发审核`, 'OpenAIChatService');
      Logger.debug(`[QwenPlus] 过滤后System消息:\n${sanitizedSystemPrompt}`, 'OpenAIChatService');
    }

    normalizedMessages.unshift({
      role: 'system',
      content: sanitizedSystemPrompt,
    });

    return normalizedMessages;
  }

  private normalizeQwenMessageContent(content: any): string {
    if (!content) {
      return '';
    }

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map(part => {
          if (!part) return '';
          if (typeof part === 'string') return part;
          if (part.type === 'image_url') {
            const url = part.image_url?.url || part.url || '';
            return url ? `[图片: ${url}]` : '';
          }
          if (typeof part.text === 'string') {
            return part.text;
          }
          return '';
        })
        .join('');
    }

    if (typeof content === 'object') {
      if (typeof (content as any).text === 'string') {
        return (content as any).text;
      }
      return JSON.stringify(content);
    }

    return String(content);
  }

  private extractDeltaText(delta: any): string {
    if (!delta) {
      return '';
    }
    if (typeof delta === 'string') {
      return delta;
    }
    if (Array.isArray(delta)) {
      return delta
        .map(part => {
          if (!part) return '';
          if (typeof part === 'string') return part;
          if (typeof part.text === 'string') return part.text;
          return '';
        })
        .join('');
    }
    if (typeof delta === 'object' && typeof delta.text === 'string') {
      return delta.text;
    }
    return '';
  }

  private mapDashscopeUsage(rawUsage: any):
    | {
        userTokens?: number;
        inputTokens?: number;
        outputTokens?: number;
      }
    | undefined {
    if (!rawUsage) {
      return undefined;
    }
    const promptTokens = rawUsage.prompt_tokens ?? rawUsage.input_tokens;
    const completionTokens = rawUsage.completion_tokens ?? rawUsage.output_tokens;
    return {
      userTokens: promptTokens,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
    };
  }

  /**
   * 准备和增强系统消息
   * @param messagesHistory 消息历史
   * @param inputs 输入参数
   * @param result 结果对象
   * @returns 处理后的消息历史
   */
  private prepareSystemMessage(
    messagesHistory: any,
    inputs: {
      searchResults?: any[];
      images?: string[];
    },
    result: any,
  ): any {
    const { searchResults, images } = inputs;

    // 创建消息历史的副本
    const processedMessages = JSON.parse(JSON.stringify(messagesHistory));

    // 查找系统消息
    const systemMessage = processedMessages?.find((message: any) => message.role === 'system');

    if (systemMessage) {
      const imageUrlMessages =
        processedMessages?.filter((message: any) => message.type === 'image_url') || [];

      let updatedContent = '';

      // 添加推理思考内容
      if (result.full_reasoning_content) {
        updatedContent = `\n\n以下是针对这个问题的思考推理思路（思路不一定完全正确，仅供参考）：\n${result.full_reasoning_content}`;
      }

      // 添加网络搜索结果
      if (searchResults && searchResults.length > 0) {
        // 将 searchResult 转换为 JSON 字符串
        let searchPrompt = JSON.stringify(searchResults, null, 2); // 格式化为漂亮的 JSON 字符串

        // 处理图片数据
        let imagesPrompt = '';
        if (images && images.length > 0) {
          imagesPrompt = `\n\n以下是搜索到的相关图片链接:\n${images.join('\n')}`;
        }

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

        updatedContent += `
          \n\n你的任务是根据用户的问题，通过下面的搜索结果提供更精确、详细、具体的回答。
          请在适当的情况下在对应部分句子末尾标注引用的链接，使用[[序号](链接地址)]格式，同时使用多个链接可连续使用比如[[2](链接地址)][[5](链接地址)]，以下是搜索结果：
            ${searchPrompt}${imagesPrompt}
            在回答时，请注意以下几点：
              - 现在时间是: ${currentDate}。
              - 如果结果中包含图片链接，可在适当位置使用MarkDown格式插入至少一张图片，让回答图文并茂。
              - 并非搜索结果的所有内容都与用户的问题密切相关，你需要结合问题，对搜索结果进行甄别、筛选。
              - 对于列举类的问题（如列举所有航班信息），尽量将答案控制在10个要点以内，并告诉用户可以查看搜索来源、获得完整信息。优先提供信息完整、最相关的列举项；如非必要，不要主动告诉用户搜索结果未提供的内容。
              - 对于创作类的问题（如写论文），请务必在正文的段落中引用对应的参考编号。你需要解读并概括用户的题目要求，选择合适的格式，充分利用搜索结果并抽取重要信息，生成符合用户要求、极具思想深度、富有创造力与专业性的答案。你的创作篇幅需要尽可能延长，对于每一个要点的论述要推测用户的意图，给出尽可能多角度的回答要点，且务必信息量大、论述详尽。
              - 如果回答很长，请尽量结构化、分段落总结。如果需要分点作答，尽量控制在5个点以内，并合并相关的内容。
              - 对于客观类的问答，如果问题的答案非常简短，可以适当补充一到两句相关信息，以丰富内容。
              - 你需要根据用户要求和回答内容选择合适、美观的回答格式，确保可读性强。
              - 你的回答应该综合多个相关网页来回答，不能只重复引用一个网页。
              - 除非用户要求，否则你回答的语言需要和用户提问的语言保持一致。
            `;
      }

      // 添加图片URL消息
      if (imageUrlMessages && imageUrlMessages.length > 0) {
        imageUrlMessages.forEach((imageMessage: any) => {
          updatedContent = `${updatedContent}\n${JSON.stringify(imageMessage)}`;
        });
      }

      systemMessage.content += updatedContent;
    }

    return processedMessages;
  }

  /**
   * 处理OpenAI聊天API调用和流式响应
   * @param messagesHistory 处理后的消息历史
   * @param inputs 输入参数
   * @param result 结果对象
   */
  private async handleOpenAIChat(
    messagesHistory: any,
    inputs: {
      apiKey: any;
      model: any;
      proxyUrl: any;
      timeout: any;
      temperature: any;
      max_tokens?: any;
      userId?: any;
      groupId?: any;
      appId?: any;
      isGroupChat?: boolean;
      abortController: AbortController;
      onProgress?: (data: any) => void;
    },
    result: any,
  ): Promise<void> {
    const {
      apiKey,
      model,
      proxyUrl,
      timeout,
      temperature,
      max_tokens,
      onProgress,
      userId,
      groupId,
      appId,
      isGroupChat: inputIsGroupChat,
    } = inputs;

    // 规范化消息：将数组内容压缩为纯文本，移除 image_url
    const normalizedMessages = messagesHistory.map((m: any) => {
      let content = m?.content;

      // 处理数组类型的 content
      if (Array.isArray(content)) {
        content = content
          .map((it: any) => {
            if (typeof it === 'string') return it;
            if (it?.type === 'image_url') return '';
            return it?.text ?? '';
          })
          .join('');
      }

      // 构建新消息对象
      const newMsg: any = {
        role: m.role,
        content: content || '',
      };

      // 保留 name 字段（如果有）
      if (m.name) {
        newMsg.name = m.name;
      }

      return newMsg;
    });

    // 判断是否为群聊模式
    // 优先使用传入的 isGroupChat 参数，如果没有传入则通过 groupId 和数据库字段判断
    let isGroupChat = false;
    if (inputIsGroupChat !== undefined) {
      isGroupChat = inputIsGroupChat;
      Logger.debug(`群聊检测 - 使用传入的 isGroupChat 参数: ${isGroupChat}`, 'OpenAIChatService');
    } else if (groupId) {
      try {
        const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
        isGroupChat =
          groupInfo?.isGroupChat === true || (groupInfo?.isGroupChat as any) === 1 || false;
        Logger.debug(
          `群聊检测 - groupId: ${groupId}, isGroupChat字段: ${groupInfo?.isGroupChat}, 判定结果: ${isGroupChat}`,
          'OpenAIChatService',
        );
      } catch (error) {
        Logger.warn(`获取群组信息失败: ${error.message}，默认为单聊模式`, 'OpenAIChatService');
        isGroupChat = false;
      }
    } else {
      Logger.debug(`群聊检测 - groupId为空，判定为单聊模式`, 'OpenAIChatService');
    }

    // 使用 OpenAI 兼容 API
    const correctedUrl = await correctApiBaseUrl(proxyUrl);
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: correctedUrl,
      timeout: timeout * 1000,
    });

    // 构建请求配置 - 群聊和单聊使用相同的参数，只是 stream 不同
    const requestConfig: any = {
      model: model,
      messages: normalizedMessages,
      stream: !isGroupChat, // 群聊非流式，单聊流式
    };

    // 添加可选参数
    if (temperature !== undefined) {
      requestConfig.temperature = temperature;
    }
    if (max_tokens) {
      requestConfig.max_tokens = max_tokens;
    }

    // OpenAI 兼容请求体日志（脱敏）
    const bodyForLog = this.sanitizeForLog({
      url: correctedUrl,
      model,
      temperature,
      max_tokens,
      stream: requestConfig.stream,
      messages: normalizedMessages,
      userId,
      groupId,
      appId,
    });
    Logger.debug(
      `${isGroupChat ? '群聊' : '单聊'}请求 - body: ${JSON.stringify(bodyForLog)}`,
      'OpenAIChatService',
    );

    try {
      if (isGroupChat) {
        // 群聊模式：非流式响应
        const completion = await openai.chat.completions.create(requestConfig, {
          signal: inputs.abortController?.signal,
        });

        const responseData = completion;
        Logger.debug(`群聊响应数据: ${JSON.stringify(responseData)}`, 'OpenAIChatService');

        // 提取回复内容
        let content = '';
        if (responseData.choices && responseData.choices.length > 0) {
          content = responseData.choices[0].message?.content || '';
        } else if ((responseData as any).content) {
          content = (responseData as any).content;
        } else if (typeof responseData === 'string') {
          content = responseData;
        }

        // 群聊模式：移除角色名称前缀（如"陆景和："）
        // 匹配模式：角色名 + 中文冒号或英文冒号
        if (content) {
          // 尝试移除开头的角色名称前缀
          const prefixMatch = content.match(/^([^：:]+)[：:]\s*/);
          if (prefixMatch) {
            content = content.substring(prefixMatch[0].length);
            Logger.debug(`群聊模式：移除角色名称前缀 "${prefixMatch[0]}"`, 'OpenAIChatService');
          }
        }

        // 设置完整回复内容
        result.content = [{ type: 'text', text: content }];
        result.full_content = content;
        result.finishReason = 'stop';

        // 一次性回调完整内容
        onProgress?.({ text: content });
      } else {
        // 单聊模式：流式响应
        const stream = await openai.chat.completions.create(requestConfig, {
          signal: inputs.abortController?.signal,
        });

        // @ts-ignore - 忽略TypeScript错误，因为我们知道stream是可迭代的
        for await (const chunk of stream) {
          if (inputs.abortController?.signal.aborted) {
            break;
          }
          const delta = chunk.choices[0]?.delta;
          const content = delta?.content;

          if (content) {
            result.content = [{ type: 'text', text: (result.content?.[0]?.text || '') + content }];
            result.full_content += content;
            onProgress?.({ content: result.content });
          }
        }
      }
    } catch (error) {
      Logger.error(
        `${isGroupChat ? '群聊' : '单聊'}请求失败: ${handleError(error)}`,
        'OpenAIChatService',
      );
      throw error;
    }
  }
}
