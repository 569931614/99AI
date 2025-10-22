import { Body, Controller, HttpException, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ChatGroupService } from './chatGroup.service';

@ApiTags('open-chatGroup')
@Controller('open/group')
export class OpenChatGroupController {
  constructor(private readonly chatGroupService: ChatGroupService) {}

  @Post('create')
  @ApiOperation({ summary: '【开放】创建对话组（无鉴权，需显式传 userId）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID（任意数字即可，用于区分不同用户会话）' },
        appId: { type: 'number', description: '应用ID（可选）' },
        modelConfig: {
          type: 'object',
          description: '对话模型配置项（可选，不传则使用默认配置）',
        },
        params: { type: 'string', description: '对话组参数序列化的字符串（可选）' },
      },
      required: ['userId'],
    },
    examples: {
      basic: {
        summary: '创建基础对话组',
        value: {
          userId: 1001,
        },
      },
      withApp: {
        summary: '创建带角色的对话组',
        value: {
          userId: 1001,
          appId: 123,
        },
      },
    },
  })
  async create(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { userId, appId, modelConfig, params } = body || {};
      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      const result = await this.chatGroupService.create({ appId, modelConfig, params }, fakeReq);
      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '创建对话组失败';
      return res.status(status).json({ success: false, message });
    }
  }

  @Post('query')
  @ApiOperation({ summary: '【开放】查询对话组列表（无鉴权，需显式传 userId）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID（任意数字即可，用于区分不同用户会话）' },
      },
      required: ['userId'],
    },
    examples: {
      basic: {
        summary: '查询对话组列表',
        value: {
          userId: 1001,
        },
      },
    },
  })
  async query(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { userId } = body || {};
      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      const result = await this.chatGroupService.query(fakeReq);
      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '查询对话组失败';
      return res.status(status).json({ success: false, message });
    }
  }

  @Post('del')
  @ApiOperation({ summary: '【开放】删除对话组（无鉴权，需显式传 userId）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID（任意数字即可，用于区分不同用户会话）' },
        groupId: { type: 'number', description: '对话分组ID' },
      },
      required: ['userId', 'groupId'],
    },
    examples: {
      basic: {
        summary: '删除对话组',
        value: {
          userId: 1001,
          groupId: 123,
        },
      },
    },
  })
  async del(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { userId, groupId } = body || {};
      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);
      if (!groupId) throw new HttpException('groupId 必填', HttpStatus.BAD_REQUEST);

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      const result = await this.chatGroupService.del({ groupId }, fakeReq);
      return res.status(200).json({ success: true, message: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '删除对话组失败';
      return res.status(status).json({ success: false, message });
    }
  }

  @Post('delAll')
  @ApiOperation({ summary: '【开放】删除所有非置顶对话组（无鉴权，需显式传 userId）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID（任意数字即可，用于区分不同用户会话）' },
      },
      required: ['userId'],
    },
    examples: {
      basic: {
        summary: '删除所有非置顶对话组',
        value: {
          userId: 1001,
        },
      },
    },
  })
  async delAll(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { userId } = body || {};
      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      const result = await this.chatGroupService.delAll(fakeReq);
      return res.status(200).json({ success: true, message: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '删除所有对话组失败';
      return res.status(status).json({ success: false, message });
    }
  }
}
