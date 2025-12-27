import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ChatLogService } from './chatLog.service';

@ApiTags('open-chatLog')
@Controller('open/chatLog')
export class OpenChatLogController {
  constructor(private readonly chatLogService: ChatLogService) {}

  @Get('chatList')
  @ApiOperation({ summary: '【开放】查询我的问答记录(无鉴权,需显式 userId)' })
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: true,
    description: '用户ID(系统内有效用户)',
  })
  @ApiQuery({ name: 'groupId', type: Number, required: false, description: '会话分组ID(可选)' })
  @ApiQuery({ name: 'page', type: Number, required: false, description: '页码，默认 1' })
  @ApiQuery({ name: 'pageSize', type: Number, required: false, description: '每页数量，默认 20' })
  chatList(
    @Query('userId') userId: number,
    @Query('groupId') groupId?: number,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    if (!userId) throw new Error('userId 必填');
    const fakeReq: any = {
      user: {
        id: Number(userId),
        username: '',
        email: '',
        client: '',
        role: 'user',
      },
    } as Request;
    return this.chatLogService.chatList(fakeReq, {
      groupId,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    } as any);
  }

  @Get('querySingleChat')
  @ApiOperation({ summary: '【开放】查询单条消息的状态和内容（无鉴权，需显式 userId）' })
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: true,
    description: '用户ID（系统内有效用户）',
  })
  @ApiQuery({ name: 'chatId', type: Number, required: true, description: '消息ID' })
  querySingleChat(@Query('userId') userId: number, @Query('chatId') chatId: number) {
    if (!userId) throw new Error('userId 必填');
    if (!chatId) throw new Error('chatId 必填');
    const fakeReq: any = {
      user: {
        id: Number(userId),
        username: '',
        email: '',
        client: '',
        role: 'user',
      },
    } as Request;
    return this.chatLogService.querySingleChat(fakeReq, { chatId } as any);
  }

  @Get('byAppId')
  @ApiOperation({ summary: '【开放】查询某个应用的问答记录（无鉴权,需显式 userId）' })
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: true,
    description: '用户ID（系统内有效用户）',
  })
  @ApiQuery({ name: 'appId', type: Number, required: true, description: '角色(App) ID' })
  @ApiQuery({ name: 'page', type: Number, required: false, description: '页码，默认 1' })
  @ApiQuery({ name: 'size', type: Number, required: false, description: '每页数量，默认 10' })
  byAppId(
    @Query('userId') userId: number,
    @Query('appId') appId: number,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    if (!userId) throw new Error('userId 必填');
    if (!appId) throw new Error('appId 必填');
    const fakeReq: any = {
      user: {
        id: Number(userId),
        username: '',
        email: '',
        client: '',
        role: 'user',
      },
    } as Request;
    return this.chatLogService.byAppId(fakeReq, {
      appId: Number(appId),
      page: page && Number(page),
      size: size && Number(size),
    } as any);
  }

  @Post('del')
  @ApiOperation({ summary: '【开放】删除我的问答记录（无鉴权，需显式 userId）' })
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: true,
    description: '用户ID（系统内有效用户）',
  })
  del(@Query('userId') userId: number, @Body() body: { id: number }) {
    if (!userId) throw new Error('userId 必填');
    if (!body.id) throw new Error('消息 id 必填');
    const fakeReq: any = {
      user: {
        id: Number(userId),
        username: '',
        email: '',
        client: '',
        role: 'user',
      },
    } as Request;
    return this.chatLogService.deleteChatLog(fakeReq, body as any);
  }

  @Post('updateTranslation')
  @ApiOperation({ summary: '【开放】更新消息的翻译内容（无鉴权，需显式 userId）' })
  async updateTranslation(
    @Body() body: { userId: number; chatId: number; translatedContent: string },
  ) {
    const { userId, chatId, translatedContent } = body;
    if (!userId) throw new Error('userId 必填');
    if (!chatId) throw new Error('chatId 必填');
    if (translatedContent === undefined) throw new Error('translatedContent 必填');
    return this.chatLogService.updateTranslation(userId, chatId, translatedContent);
  }

  @Post('save')
  @ApiOperation({ summary: '【开放】保存聊天记录（无鉴权，需显式 userId）' })
  async saveChatLog(
    @Body()
    body: {
      userId: number;
      groupId: number;
      appId?: number;
      role: 'user' | 'assistant';
      content: string;
      transferAmount?: string;
      transferDesc?: string;
      transferStatus?: string;
    },
  ) {
    const { userId, groupId, appId, role, content, transferAmount, transferDesc, transferStatus } =
      body;
    if (!userId) throw new Error('userId 必填');
    if (!groupId) throw new Error('groupId 必填');
    if (!role) throw new Error('role 必填');
    if (!content) throw new Error('content 必填');

    const logInfo = {
      text: content,
      content: content,
      role,
      groupId: groupId,
      conversationOptions: JSON.stringify({ groupId }),
      userId,
      appId: appId || null,
      transferAmount,
      transferDesc,
      transferStatus,
    };

    const savedLog = await this.chatLogService.saveChatLog(logInfo);
    return {
      success: true,
      data: {
        id: savedLog.id,
        chatId: savedLog.id,
      },
    };
  }

  @Post('transferAction')
  @ApiOperation({ summary: '【开放】处理转账操作（领取/退还）' })
  async transferAction(
    @Body() body: { userId: number; chatId: number; action: 'received' | 'returned' },
  ) {
    const { userId, chatId, action } = body;
    if (!userId) throw new Error('userId 必填');
    if (!chatId) throw new Error('chatId 必填');
    if (!action) throw new Error('action 必填');
    if (!['received', 'returned'].includes(action)) {
      throw new Error('action 必须是 received 或 returned');
    }
    return this.chatLogService.handleTransferAction(userId, chatId, action);
  }

  @Get('transferDetail')
  @ApiOperation({ summary: '【开放】获取转账详情' })
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: true,
    description: '用户ID（系统内有效用户）',
  })
  @ApiQuery({ name: 'chatId', type: Number, required: true, description: '消息ID' })
  async getTransferDetail(@Query('userId') userId: number, @Query('chatId') chatId: number) {
    if (!userId) throw new Error('userId 必填');
    if (!chatId) throw new Error('chatId 必填');
    return this.chatLogService.getTransferDetail(Number(userId), Number(chatId));
  }
}
