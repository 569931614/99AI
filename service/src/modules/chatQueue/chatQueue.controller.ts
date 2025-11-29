import { getClientIp } from '@/common/utils';
import { MaobingAuthUtil } from '@/common/utils/maobing-auth.util';
import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ChatQueueService } from './chatQueue.service';

@ApiTags('chat-queue')
@Controller('open/chat')
export class ChatQueueController {
  constructor(private readonly chatQueueService: ChatQueueService) {}

  @Post('chat-process-async')
  @ApiOperation({ summary: '【开放】异步聊天对话（立即返回任务ID，后台处理）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Maobing平台用户token（可选，传入则会验证并获取userId）',
        },
        maobingBaseUrl: {
          type: 'string',
          description: 'Maobing基础域名（可选，默认 https://admin.maobingai.com ）',
        },
        userId: { type: 'number', description: '用户ID（可选，优先使用token验证获取的userId）' },
        prompt: { type: 'string', description: '用户提问内容；若传 audioUrl 将自动识别为文本' },
        options: {
          type: 'object',
          description: '对话附加选项（可选）',
          properties: {
            parentMessageId: { type: 'string', description: '上一条消息ID，用于连续对话' },
            groupId: { type: 'number', description: '会话组ID' },
            isFirstMember: {
              type: 'boolean',
              description: '是否为第一个成员（群聊模式专用）',
            },
            skipPromptInHistory: {
              type: 'boolean',
              description: '是否跳过将prompt添加到历史（群聊自动对话模式专用）',
            },
            skipSaveToDatabase: {
              type: 'boolean',
              description: '是否跳过保存到数据库',
            },
          },
        },
        audioUrl: { type: 'string', description: '音频URL，自动进行ASR识别为文本（可选）' },
        imageUrl: { type: 'string', description: '图片URL（可选）' },
        fileUrl: { type: 'string', description: '文件URL（可选）' },
        appId: { type: 'number', description: '角色(App) ID（可选）' },
        speakerId: {
          type: 'number',
          description: '发言者ID（可选，群聊场景中指定哪个成员发言，等同于appId）',
        },
        model: { type: 'string', description: '使用的模型标识（可选）' },
        modelName: { type: 'string', description: '模型名称（可选）' },
        modelType: { type: 'number', description: '模型类型（可选）' },
        modelAvatar: { type: 'string', description: '模型头像URL（可选）' },
        extraParam: { type: 'object', description: '扩展参数（可选）' },
        usingPluginId: { type: 'number', description: '插件ID（可选）' },
      },
      required: ['prompt'],
    },
    examples: {
      basic: {
        summary: '基础异步对话',
        value: {
          token: '2bd79433-74c1-4ccb-a44c-a5b0dfa82f19',
          prompt: '你好，请介绍一下你自己',
        },
      },
      withApp: {
        summary: '使用特定角色',
        value: {
          token: '2bd79433-74c1-4ccb-a44c-a5b0dfa82f19',
          prompt: '你好',
          appId: 123,
        },
      },
    },
  })
  async chatProcessAsync(@Body() body: any, @Req() req: Request) {
    try {
      const { token, userId: originalUserId, maobingBaseUrl } = body || {};

      // 如果传了token，则验证并获取userId
      let userId = originalUserId ? Number(originalUserId) : null;
      if (token) {
        const validatedUserId = await MaobingAuthUtil.validateTokenAndGetUserId(
          token,
          maobingBaseUrl,
        );
        if (!validatedUserId) {
          throw new HttpException('token 无效或已过期', HttpStatus.UNAUTHORIZED);
        }
        userId = validatedUserId;
      }
      if (!userId) {
        throw new HttpException('请提供 token 或 userId', HttpStatus.BAD_REQUEST);
      }
      body.userId = userId;

      // 支持 speakerId 作为 appId 的别名（群聊场景中指定发言者）
      if (body?.speakerId && !body?.appId) {
        body.appId = body.speakerId;
      }

      // 添加任务到队列
      const result = await this.chatQueueService.addChatTask({
        userId,
        body,
        headers: req.headers,
        ip: getClientIp(req),
      });

      return result;
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '添加任务失败';
      throw new HttpException(message, status);
    }
  }

  @Get('task-status/:taskId')
  @ApiOperation({ summary: '【开放】查询异步任务状态和结果' })
  @ApiParam({
    name: 'taskId',
    description: '任务ID（由 chat-process-async 接口返回）',
    type: String,
  })
  async getTaskStatus(@Param('taskId') taskId: string) {
    const result = await this.chatQueueService.getTaskStatus(taskId);

    if (!result) {
      throw new HttpException('任务不存在或已过期', HttpStatus.NOT_FOUND);
    }

    return result;
  }

  @Get('queue-stats')
  @ApiOperation({ summary: '【开放】获取队列统计信息（用于监控）' })
  @ApiQuery({
    name: 'token',
    type: String,
    required: false,
    description: 'Maobing平台管理员token（可选，用于鉴权）',
  })
  async getQueueStats(@Query('token') token?: string) {
    // 这里可以添加管理员权限验证
    // if (token) {
    //   const userId = await MaobingAuthUtil.validateTokenAndGetUserId(token);
    //   // 验证是否为管理员...
    // }

    const stats = await this.chatQueueService.getQueueStats();
    return {
      success: true,
      data: stats,
    };
  }
}
