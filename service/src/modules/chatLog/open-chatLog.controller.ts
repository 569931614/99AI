import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ChatLogService } from './chatLog.service';

@ApiTags('open-chatLog')
@Controller('open/chatLog')
export class OpenChatLogController {
  constructor(private readonly chatLogService: ChatLogService) {}

  @Get('chatList')
  @ApiOperation({ summary: '【开放】查询我的问答记录（无鉴权，需显式 userId）' })
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: true,
    description: '用户ID（系统内有效用户）',
  })
  @ApiQuery({ name: 'groupId', type: Number, required: false, description: '会话分组ID（可选）' })
  chatList(@Query('userId') userId: number, @Query('groupId') groupId?: number) {
    if (!userId) throw new Error('userId 必填');
    const fakeReq: any = { user: { id: Number(userId) } } as Request;
    return this.chatLogService.chatList(fakeReq, { groupId } as any);
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
    const fakeReq: any = { user: { id: Number(userId) } } as Request;
    return this.chatLogService.querySingleChat(fakeReq, { chatId } as any);
  }

  @Get('byAppId')
  @ApiOperation({ summary: '【开放】查询某个应用的问答记录（无鉴权，需显式 userId）' })
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
    const fakeReq: any = { user: { id: Number(userId) } } as Request;
    return this.chatLogService.byAppId(fakeReq, {
      appId: Number(appId),
      page: page && Number(page),
      size: size && Number(size),
    } as any);
  }
}
