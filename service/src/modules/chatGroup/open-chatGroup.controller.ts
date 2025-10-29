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
        title: { type: 'string', description: '群聊名称（可选，不传则默认为"新对话"）' },
        description: { type: 'string', description: '群聊描述信息（可选）' },
        ownerNickname: { type: 'string', description: '群主在群内的昵称（可选）' },
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
      withGroupInfo: {
        summary: '创建带群信息的对话组',
        value: {
          userId: 1001,
          title: '技术交流群',
          description: '这是一个关于前端技术交流的群聊',
          ownerNickname: '张三',
        },
      },
    },
  })
  async create(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { userId, modelConfig, params, title, description, ownerNickname } = body || {};
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

      const result = await this.chatGroupService.create(
        { modelConfig, params, title, description, ownerNickname },
        fakeReq,
      );
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

  @Post('update')
  @ApiOperation({ summary: '【开放】更新对话组（无鉴权，需显式传 userId）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID（任意数字即可，用于区分不同用户会话）' },
        groupId: { type: 'number', description: '对话分组ID' },
        title: { type: 'string', description: '对话组标题（可选）' },
        description: { type: 'string', description: '群聊描述信息（可选）' },
        ownerNickname: { type: 'string', description: '群主在群内的昵称（可选）' },
      },
      required: ['userId', 'groupId'],
    },
    examples: {
      updateTitle: {
        summary: '更新对话组标题',
        value: {
          userId: 1001,
          groupId: 123,
          title: '新标题',
        },
      },
      updateGroupInfo: {
        summary: '更新群组信息',
        value: {
          userId: 1001,
          groupId: 123,
          description: '这是一个技术交流群',
          ownerNickname: '张三',
        },
      },
    },
  })
  async update(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { userId, groupId, title, description, ownerNickname } = body || {};
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

      const result = await this.chatGroupService.update(
        { groupId, title, description, ownerNickname },
        fakeReq,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '更新对话组失败';
      return res.status(status).json({ success: false, message });
    }
  }

  // ==== 群组成员管理 ====
  @Post('members/add')
  @ApiOperation({ summary: '【开放】批量新增群组成员（无鉴权，需显式传 userId）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID（任意数字即可，用于区分不同用户会话）' },
        groupId: { type: 'number', description: '对话分组ID' },
        members: {
          type: 'array',
          description: '成员列表（数组），一次可添加多个成员',
          items: {
            type: 'object',
            properties: {
              appId: { type: 'number', description: '角色应用ID（必填，将作为成员标识）' },
              order: { type: 'number', description: '发言顺序（必填，数字越小越靠前）' },
              role: { type: 'string', description: '成员角色（必填，如 member, leader 等）' },
              taskDetail: { type: 'string', description: '任务描述（可选，如：完成需求分析文档）' },
              openingRemark: {
                type: 'string',
                description: '该成员的开场白（可选，不传则使用应用默认开场白）',
              },
            },
            required: ['appId', 'order', 'role'],
          },
        },
      },
      required: ['userId', 'groupId', 'members'],
    },
    examples: {
      basic: {
        summary: '批量添加成员（不带任务）',
        value: {
          userId: 1001,
          groupId: 123,
          members: [
            {
              appId: 456,
              order: 1,
              role: 'leader',
            },
            {
              appId: 457,
              order: 2,
              role: 'member',
            },
          ],
        },
      },
      withTasks: {
        summary: '批量添加成员（带任务）',
        value: {
          userId: 1001,
          groupId: 123,
          members: [
            {
              appId: 456,
              order: 1,
              role: 'leader',
              taskDetail: '完成需求分析文档',
            },
            {
              appId: 457,
              order: 2,
              role: 'member',
              taskDetail: '设计系统架构',
            },
            {
              appId: 458,
              order: 3,
              role: 'member',
              taskDetail: '实现核心功能',
            },
          ],
        },
      },
      withOpeningRemarks: {
        summary: '批量添加成员（带开场白）',
        value: {
          userId: 1001,
          groupId: 123,
          members: [
            {
              appId: 456,
              order: 1,
              role: 'leader',
              taskDetail: '完成需求分析文档',
              openingRemark: '大家好，我是产品经理，负责需求分析。',
            },
            {
              appId: 457,
              order: 2,
              role: 'member',
              taskDetail: '设计系统架构',
              openingRemark: '你好，我是架构师，负责系统设计。',
            },
            {
              appId: 458,
              order: 3,
              role: 'member',
              taskDetail: '实现核心功能',
              openingRemark: '嗨，我是开发工程师，负责功能实现。',
            },
          ],
        },
      },
    },
  })
  async addMembers(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { userId, groupId, members } = body || {};
      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);
      if (!groupId) throw new HttpException('groupId 必填', HttpStatus.BAD_REQUEST);
      if (!members || !Array.isArray(members) || members.length === 0) {
        throw new HttpException('members 必填且不能为空数组', HttpStatus.BAD_REQUEST);
      }

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      const result = await this.chatGroupService.addMembers({ groupId, members }, fakeReq);
      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '添加成员失败';
      return res.status(status).json({ success: false, message });
    }
  }

  @Post('members/remove')
  @ApiOperation({ summary: '【开放】群组移除成员（无鉴权，需显式传 userId）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID（任意数字即可，用于区分不同用户会话）' },
        groupId: { type: 'number', description: '对话分组ID' },
        memberId: { type: 'number', description: '要移除的成员ID' },
      },
      required: ['userId', 'groupId', 'memberId'],
    },
    examples: {
      basic: {
        summary: '移除成员',
        value: {
          userId: 1001,
          groupId: 123,
          memberId: 456,
        },
      },
    },
  })
  async removeMember(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { userId, groupId, memberId } = body || {};
      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);
      if (!groupId) throw new HttpException('groupId 必填', HttpStatus.BAD_REQUEST);
      if (!memberId) throw new HttpException('memberId 必填', HttpStatus.BAD_REQUEST);

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      const result = await this.chatGroupService.removeMember(
        { groupId, userId: memberId },
        fakeReq,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '移除成员失败';
      return res.status(status).json({ success: false, message });
    }
  }

  @Post('members/list')
  @ApiOperation({ summary: '【开放】群组成员列表（无鉴权，需显式传 userId）' })
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
        summary: '获取成员列表',
        value: {
          userId: 1001,
          groupId: 123,
        },
      },
    },
  })
  async listMembers(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
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

      const result = await this.chatGroupService.listMembers({ groupId }, fakeReq);
      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '获取成员列表失败';
      return res.status(status).json({ success: false, message });
    }
  }

  @Post('members/update')
  @ApiOperation({ summary: '【开放】更新群员信息（无鉴权，需显式传 userId）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID（任意数字即可，用于区分不同用户会话）' },
        groupId: { type: 'number', description: '对话分组ID' },
        memberId: { type: 'number', description: '要更新的成员ID' },
        name: { type: 'string', description: '成员昵称（可选）' },
        role: { type: 'string', description: '成员角色（可选）' },
        order: { type: 'number', description: '成员排序（可选）' },
        appId: { type: 'number', description: '关联的应用ID（可选）' },
        appName: { type: 'string', description: '应用名称（可选）' },
        openingRemark: { type: 'string', description: '成员开场白（可选）' },
      },
      required: ['userId', 'groupId', 'memberId'],
    },
    examples: {
      basic: {
        summary: '更新成员信息',
        value: {
          userId: 1001,
          groupId: 123,
          memberId: 456,
          name: '新昵称',
          role: 'leader',
          order: 1,
        },
      },
      updateOpeningRemark: {
        summary: '更新成员开场白',
        value: {
          userId: 1001,
          groupId: 123,
          memberId: 456,
          openingRemark: '大家好，我是产品经理，负责需求分析。',
        },
      },
    },
  })
  async updateMember(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { userId, groupId, memberId, name, role, order, appId, appName, openingRemark } =
        body || {};
      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);
      if (!groupId) throw new HttpException('groupId 必填', HttpStatus.BAD_REQUEST);
      if (!memberId) throw new HttpException('memberId 必填', HttpStatus.BAD_REQUEST);

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      const result = await this.chatGroupService.updateMember(
        { groupId, userId: memberId, name, role, order, appId, appName, openingRemark },
        fakeReq,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '更新成员信息失败';
      return res.status(status).json({ success: false, message });
    }
  }

  // ==== 任务管理 ====
  @Post('task/assign')
  @ApiOperation({ summary: '【开放】为成员分配任务（无鉴权，需显式传 userId）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID（任意数字即可，用于区分不同用户会话）' },
        groupId: { type: 'number', description: '对话分组ID' },
        memberId: { type: 'number', description: '成员ID' },
        title: { type: 'string', description: '任务标题' },
        detail: { type: 'string', description: '任务详情（可选）' },
        status: { type: 'string', description: '任务状态（可选，如 todo, doing, done）' },
      },
      required: ['userId', 'groupId', 'memberId', 'title'],
    },
    examples: {
      basic: {
        summary: '分配任务',
        value: {
          userId: 1001,
          groupId: 123,
          memberId: 456,
          title: '完成需求分析',
          detail: '分析用户需求并输出文档',
          status: 'todo',
        },
      },
    },
  })
  async assignTask(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { userId, groupId, memberId, title, detail, status } = body || {};
      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);
      if (!groupId) throw new HttpException('groupId 必填', HttpStatus.BAD_REQUEST);
      if (!memberId) throw new HttpException('memberId 必填', HttpStatus.BAD_REQUEST);
      if (!title) throw new HttpException('title 必填', HttpStatus.BAD_REQUEST);

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      const result = await this.chatGroupService.assignTask(
        { groupId, userId: memberId, title, detail, status },
        fakeReq,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '分配任务失败';
      return res.status(status).json({ success: false, message });
    }
  }

  @Post('task/update')
  @ApiOperation({ summary: '【开放】更新成员任务（无鉴权，需显式传 userId）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID（任意数字即可，用于区分不同用户会话）' },
        groupId: { type: 'number', description: '对话分组ID' },
        memberId: { type: 'number', description: '成员ID' },
        taskId: { type: 'string', description: '任务ID' },
        title: { type: 'string', description: '任务标题（可选）' },
        detail: { type: 'string', description: '任务详情（可选）' },
        status: { type: 'string', description: '任务状态（可选）' },
      },
      required: ['userId', 'groupId', 'memberId', 'taskId'],
    },
    examples: {
      basic: {
        summary: '更新任务状态',
        value: {
          userId: 1001,
          groupId: 123,
          memberId: 456,
          taskId: '1234567890_abc123',
          status: 'done',
        },
      },
    },
  })
  async updateTask(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { userId, groupId, memberId, taskId, title, detail, status } = body || {};
      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);
      if (!groupId) throw new HttpException('groupId 必填', HttpStatus.BAD_REQUEST);
      if (!memberId) throw new HttpException('memberId 必填', HttpStatus.BAD_REQUEST);
      if (!taskId) throw new HttpException('taskId 必填', HttpStatus.BAD_REQUEST);

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      const result = await this.chatGroupService.updateTask(
        { groupId, userId: memberId, taskId, title, detail, status },
        fakeReq,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '更新任务失败';
      return res.status(status).json({ success: false, message });
    }
  }
}
