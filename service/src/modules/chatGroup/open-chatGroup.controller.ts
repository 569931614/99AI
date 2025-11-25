import { Body, Controller, HttpException, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ChatGroupService } from './chatGroup.service';
import { MaobingAuthUtil } from '@/common/utils/maobing-auth.util';

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
        userAvatarUrl: { type: 'string', description: '用户头像URL（可选，用于生成群聊拼图头像）' },
        appId: { type: 'number', description: '应用ID（角色ID，可选）' },
        title: { type: 'string', description: '群聊名称（可选，不传则默认为"新对话"）' },
        description: { type: 'string', description: '群聊描述信息（可选）' },
        ownerNickname: { type: 'string', description: '群主在群内的昵称（可选）' },
        openingRemark: { type: 'string', description: '开场白（可选，会作为第一条消息保存）' },
        backgroundImage: { type: 'string', description: '群聊背景图片URL（可选）' },
        proactivelySend: { type: 'number', description: '是否主动发消息（0否 1是，可选）' },
        describingMental: { type: 'number', description: '是否开启心理动作描述（0否 1是，可选）' },
        realTime: { type: 'number', description: '是否开启真实时间（0否 1是，可选）' },
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
      const {
        userId,
        userAvatarUrl,
        appId,
        modelConfig,
        params,
        title,
        description,
        ownerNickname,
        openingRemark,
        backgroundImage,
        proactivelySend,
        describingMental,
        realTime,
        maxReplyCount,
      } = body || {};

      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        userAvatarUrl, // 传递用户头像URL
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      const result = await this.chatGroupService.create(
        {
          modelConfig,
          params,
          title,
          description,
          ownerNickname,
          appId,
          openingRemark,
          backgroundImage,
          proactivelySend,
          describingMental,
          realTime,
          maxReplyCount,
        },
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

  @Post('detail')
  @ApiOperation({ summary: '【开放】查询对话组详情（无鉴权，需显式传 userId 和 groupId）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID' },
        groupId: { type: 'number', description: '对话分组ID' },
      },
      required: ['userId', 'groupId'],
    },
    examples: {
      basic: {
        summary: '查询对话组详情',
        value: {
          userId: 1001,
          groupId: 123,
        },
      },
    },
  })
  async getDetail(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
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

      const result = await this.chatGroupService.getDetail(groupId, fakeReq);
      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '查询对话组详情失败';
      return res.status(status).json({ success: false, message });
    }
  }

  @Post('del')
  @ApiOperation({ summary: '【开放】删除对话组（可选token鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Maobing平台用户token（可选，传入则会验证并获取userId）',
        },
        userId: { type: 'number', description: '用户ID（可选，优先使用token验证获取的userId）' },
        groupId: { type: 'number', description: '对话分组ID' },
      },
      required: ['groupId'],
    },
    examples: {
      withToken: {
        summary: '使用token删除（推荐）',
        value: {
          token: 'your_maobing_token_here',
          groupId: 123,
        },
      },
      withUserId: {
        summary: '使用userId删除（兼容旧版）',
        value: {
          userId: 1001,
          groupId: 123,
        },
      },
    },
  })
  async del(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { token, userId: originalUserId, groupId, maobingBaseUrl } = body || {};

      // 如果传了token，则验证并获取userId
      let userId = originalUserId;
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
        throw new HttpException('必须提供 token 或 userId', HttpStatus.BAD_REQUEST);
      }
      if (!groupId) {
        throw new HttpException('groupId 必填', HttpStatus.BAD_REQUEST);
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
        userAvatarUrl: { type: 'string', description: '用户头像URL（可选，用于生成群聊拼图头像）' },
        groupId: { type: 'number', description: '对话分组ID' },
        title: { type: 'string', description: '对话组标题（可选）' },
        description: { type: 'string', description: '群聊描述信息（可选）' },
        ownerNickname: { type: 'string', description: '群主在群内的昵称（可选）' },
        backgroundImage: { type: 'string', description: '群聊背景图片URL（可选）' },
        characterRelationships: { type: 'string', description: '人物关系（可选）' },
        openingRemark: { type: 'string', description: '开场白（可选）' },
        proactivelySend: { type: 'number', description: '是否主动发消息（0否 1是，可选）' },
        describingMental: { type: 'number', description: '是否开启心理动作描述（0否 1是，可选）' },
        realTime: { type: 'number', description: '是否开启真实时间（0否 1是，可选）' },
        myName: { type: 'string', description: '对我的称呼（可选）' },
        myProfile: { type: 'string', description: '我的简介（可选）' },
        conversationMemoryCount: {
          type: 'number',
          description: '对话记忆条数（1-100，可选，默认10）',
        },
        autoSummaryEnabled: { type: 'boolean', description: '是否开启自动总结（可选）' },
        summaryPrompt: { type: 'string', description: '自动总结提示词（可选）' },
        chatSummary: { type: 'string', description: '当前对话总结内容（可选）' },
        voiceReplyMode: {
          type: 'string',
          description:
            '语音回复模式（可选）：voice_only=全部发语音 或 mixed=偶尔发一次（文字和语音5:2） 或 text_only=不要发语音',
          enum: ['voice_only', 'mixed', 'text_only'],
        },
        allowEmoji: { type: 'boolean', description: '是否允许发送表情包（可选）' },
        allowTap: { type: 'boolean', description: '是否允许拍一拍（可选）' },
        maxReplyCount: { type: 'number', description: '最多回复条数（1-5，可选，默认5）' },
        members: {
          type: 'array',
          description: '成员列表（可选，传入则完整替换现有成员列表）',
          items: {
            type: 'object',
            properties: {
              userId: { type: 'number', description: '成员ID' },
              name: { type: 'string', description: '成员昵称' },
              role: { type: 'string', description: '成员角色' },
              order: { type: 'number', description: '发言顺序' },
              appId: { type: 'number', description: '关联的应用ID' },
              appName: { type: 'string', description: '应用名称' },
              openingRemark: { type: 'string', description: '开场白' },
              tasks: {
                type: 'array',
                description: '任务列表',
                items: {
                  type: 'object',
                  properties: {
                    taskId: { type: 'string', description: '任务ID' },
                    title: { type: 'string', description: '任务标题' },
                    detail: { type: 'string', description: '任务详情' },
                    status: { type: 'string', description: '任务状态' },
                    createdAt: { type: 'string', description: '创建时间' },
                  },
                },
              },
            },
          },
        },
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
      updateWithMembers: {
        summary: '更新群组及成员信息',
        value: {
          userId: 1001,
          groupId: 123,
          title: '新标题',
          description: '这是一个技术交流群',
          ownerNickname: '张三',
          members: [
            {
              userId: 10116,
              name: '辣条',
              role: 'member',
              order: 0,
              appId: 10116,
              appName: '辣条',
              openingRemark: '你好，有什么可以帮助你的',
              tasks: [
                {
                  taskId: '1761822997341_3x0x95',
                  title: '讨论中午吃什么',
                  detail: '',
                  status: 'todo',
                  createdAt: '2025-10-30T11:16:37.341Z',
                },
              ],
            },
          ],
        },
      },
    },
  })
  async update(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const {
        userId,
        userAvatarUrl,
        groupId,
        title,
        description,
        ownerNickname,
        characterRelationships,
        openingRemark,
        proactivelySend,
        describingMental,
        realTime,
        myName,
        myProfile,
        conversationMemoryCount,
        autoSummaryEnabled,
        summaryPrompt,
        chatSummary,
        voiceReplyMode,
        allowEmoji,
        allowTap,
        maxReplyCount,
        members,
        backgroundImage,
      } = body || {};
      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);
      if (!groupId) throw new HttpException('groupId 必填', HttpStatus.BAD_REQUEST);

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        userAvatarUrl, // 传递用户头像URL
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      const result = await this.chatGroupService.update(
        {
          groupId,
          title,
          description,
          ownerNickname,
          characterRelationships,
          openingRemark,
          proactivelySend,
          describingMental,
          realTime,
          myName,
          myProfile,
          conversationMemoryCount,
          autoSummaryEnabled,
          summaryPrompt,
          chatSummary,
          voiceReplyMode,
          allowEmoji,
          allowTap,
          maxReplyCount,
          members,
          backgroundImage,
        },
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
        userAvatarUrl: { type: 'string', description: '用户头像URL（可选，用于生成群聊拼图头像）' },
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
      const { userId, userAvatarUrl, groupId, members } = body || {};
      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);
      if (!groupId) throw new HttpException('groupId 必填', HttpStatus.BAD_REQUEST);
      if (!members || !Array.isArray(members) || members.length === 0) {
        throw new HttpException('members 必填且不能为空数组', HttpStatus.BAD_REQUEST);
      }

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        userAvatarUrl, // 传递用户头像URL
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
        tasks: {
          type: 'array',
          description: '任务列表（可选，传入则完整替换该成员的所有任务）',
          items: {
            type: 'object',
            properties: {
              taskId: { type: 'string', description: '任务ID' },
              title: { type: 'string', description: '任务标题' },
              detail: { type: 'string', description: '任务详情' },
              status: { type: 'string', description: '任务状态（todo/doing/done）' },
              createdAt: { type: 'string', description: '创建时间（ISO格式）' },
            },
          },
        },
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
      updateWithTasks: {
        summary: '更新成员信息及任务',
        value: {
          userId: 1001,
          groupId: 123,
          memberId: 456,
          name: '辣条',
          openingRemark: '你好，有什么可以帮助你的',
          tasks: [
            {
              taskId: '1761822997341_3x0x95',
              title: '讨论中午吃什么',
              detail: '需要考虑大家的口味偏好',
              status: 'todo',
              createdAt: '2025-10-30T11:16:37.341Z',
            },
          ],
        },
      },
    },
  })
  async updateMember(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { userId, groupId, memberId, name, role, order, appId, appName, openingRemark, tasks } =
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
        { groupId, userId: memberId, name, role, order, appId, appName, openingRemark, tasks },
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
  @ApiOperation({ summary: '【开放】批量更新群员任务（无鉴权，需显式传 userId）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID（任意数字即可，用于区分不同用户会话）' },
        groupId: { type: 'number', description: '对话分组ID' },
        members: {
          type: 'array',
          description: '成员列表（数组），一次可更新多个成员的任务',
          items: {
            type: 'object',
            properties: {
              appId: { type: 'number', description: '角色应用ID（必填，用于定位成员）' },
              taskDetail: {
                type: 'string',
                description: '任务描述（可选，如：完成需求分析文档）。不传则不更新任务',
              },
              order: { type: 'number', description: '发言顺序（可选，数字越小越靠前）' },
              role: { type: 'string', description: '成员角色（可选，如 member, leader 等）' },
            },
            required: ['appId'],
          },
        },
      },
      required: ['userId', 'groupId', 'members'],
    },
    examples: {
      basic: {
        summary: '批量更新成员任务',
        value: {
          userId: 1001,
          groupId: 123,
          members: [
            {
              appId: 456,
              taskDetail: '完成需求分析文档（已更新）',
            },
            {
              appId: 457,
              taskDetail: '设计系统架构（已更新）',
            },
          ],
        },
      },
      withOrderAndRole: {
        summary: '更新任务并调整顺序和角色',
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
          ],
        },
      },
    },
  })
  async updateTask(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
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

      const result = await this.chatGroupService.updateTask({ groupId, members }, fakeReq);
      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '更新任务失败';
      return res.status(status).json({ success: false, message });
    }
  }

  @Post('query-single-chats')
  @ApiOperation({ summary: '【开放】查询单聊会话组列表（可选token鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Maobing平台用户token（可选，传入则会验证并获取userId）',
        },
        userId: { type: 'number', description: '用户ID（可选，优先使用token验证获取的userId）' },
        keyword: { type: 'string', description: '搜索关键词，用于按角色名称搜索（可选）' },
      },
    },
    examples: {
      withToken: {
        summary: '使用token查询（推荐）',
        value: {
          token: 'your_maobing_token_here',
          keyword: '小助手',
        },
      },
      withUserId: {
        summary: '使用userId查询（兼容旧版）',
        value: {
          userId: 1001,
          keyword: '小助手',
        },
      },
    },
  })
  async querySingleChats(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      console.log('[querySingleChats] ===== 收到请求 =====');
      console.log('[querySingleChats] body:', JSON.stringify(body));

      const { token, userId: originalUserId, keyword, maobingBaseUrl } = body || {};

      // 如果传了token，则验证并获取userId
      let userId = originalUserId;
      if (token) {
        const validatedUserId = await MaobingAuthUtil.validateTokenAndGetUserId(
          token,
          maobingBaseUrl,
        );
        if (!validatedUserId) {
          throw new HttpException('token 无效或已过期', HttpStatus.UNAUTHORIZED);
        }
        // 使用验证后的userId，覆盖body中的userId
        userId = validatedUserId;
      }

      if (!userId) {
        console.log('[querySingleChats] userId和token都为空，抛出异常');
        throw new HttpException('必须提供 token 或 userId', HttpStatus.BAD_REQUEST);
      }

      console.log('[querySingleChats] userId验证通过:', userId, 'keyword:', keyword);

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      console.log('[querySingleChats] 开始调用 chatGroupService.querySingleChats...');
      const result = await this.chatGroupService.querySingleChats(fakeReq, keyword);
      console.log('[querySingleChats] 查询成功，返回数据条数:', result?.length || 0);
      console.log('[querySingleChats] ===== 请求完成 =====');

      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      console.error('[querySingleChats] ===== 发生错误 =====');
      console.error('[querySingleChats] 错误消息:', e.message);
      console.error('[querySingleChats] 错误堆栈:', e.stack);
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '查询单聊会话组失败';
      return res.status(status).json({ success: false, message });
    }
  }

  @Post('query-group-chats')
  @ApiOperation({ summary: '【开放】查询群聊会话组列表（可选token鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Maobing平台用户token（可选，传入则会验证并获取userId）',
        },
        userId: { type: 'number', description: '用户ID（可选，优先使用token验证获取的userId）' },
        keyword: { type: 'string', description: '搜索关键词，用于按群组名称搜索（可选）' },
      },
    },
    examples: {
      withToken: {
        summary: '使用token查询（推荐）',
        value: {
          token: 'your_maobing_token_here',
          keyword: '工作群',
        },
      },
      withUserId: {
        summary: '使用userId查询（兼容旧版）',
        value: {
          userId: 1001,
          keyword: '工作群',
        },
      },
    },
  })
  async queryGroupChats(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      console.log('[queryGroupChats] ===== 收到请求 =====');
      console.log('[queryGroupChats] body:', JSON.stringify(body));

      const { token, userId: originalUserId, keyword, maobingBaseUrl } = body || {};

      // 如果传了token，则验证并获取userId
      let userId = originalUserId;
      if (token) {
        const validatedUserId = await MaobingAuthUtil.validateTokenAndGetUserId(
          token,
          maobingBaseUrl,
        );
        if (!validatedUserId) {
          throw new HttpException('token 无效或已过期', HttpStatus.UNAUTHORIZED);
        }
        // 使用验证后的userId，覆盖body中的userId
        userId = validatedUserId;
      }

      if (!userId) {
        console.log('[queryGroupChats] userId和token都为空，抛出异常');
        throw new HttpException('必须提供 token 或 userId', HttpStatus.BAD_REQUEST);
      }

      console.log('[queryGroupChats] userId验证通过:', userId, 'keyword:', keyword);

      // 构造伪造的 req 对象，使用 visitor 角色跳过用户验证
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      const result = await this.chatGroupService.queryGroupChats(fakeReq, keyword);
      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '查询群聊会话组失败';
      return res.status(status).json({ success: false, message });
    }
  }

  // ==== 人物关系管理 ====
  @Post('relationships/update')
  @ApiOperation({ summary: '【开放】更新群组人物关系配置（无鉴权，需显式传 userId）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID' },
        groupId: { type: 'number', description: '对话分组ID' },
        relationships: {
          type: 'array',
          description: '人物关系配置数组',
          items: {
            type: 'object',
            properties: {
              memberA: { type: 'string', description: '成员A的名称' },
              memberB: { type: 'string', description: '成员B的名称' },
              type: { type: 'string', description: '关系类型（如：朋友、同事、恋人、家人等）' },
              description: { type: 'string', description: '关系描述（可选）' },
            },
            required: ['memberA', 'memberB', 'type'],
          },
        },
      },
      required: ['userId', 'groupId', 'relationships'],
    },
    examples: {
      basic: {
        summary: '设置人物关系',
        value: {
          userId: 1001,
          groupId: 123,
          relationships: [
            {
              memberA: '张三',
              memberB: '李四',
              type: '朋友',
              description: '多年好友',
            },
            {
              memberA: '张三',
              memberB: '王五',
              type: '同事',
              description: '同公司同事',
            },
          ],
        },
      },
    },
  })
  async updateRelationships(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { userId, groupId, relationships } = body || {};
      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);
      if (!groupId) throw new HttpException('groupId 必填', HttpStatus.BAD_REQUEST);
      if (!relationships || !Array.isArray(relationships)) {
        throw new HttpException('relationships 必填且必须是数组', HttpStatus.BAD_REQUEST);
      }

      // 构造伪造的 req 对象
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      const result = await this.chatGroupService.updateRelationships(
        { groupId, relationships },
        fakeReq,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '更新人物关系失败';
      return res.status(status).json({ success: false, message });
    }
  }

  @Post('relationships/get')
  @ApiOperation({ summary: '【开放】获取群组人物关系配置（无鉴权，需显式传 userId）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID' },
        groupId: { type: 'number', description: '对话分组ID' },
      },
      required: ['userId', 'groupId'],
    },
    examples: {
      basic: {
        summary: '获取人物关系',
        value: {
          userId: 1001,
          groupId: 123,
        },
      },
    },
  })
  async getRelationships(@Body() body: any, @Req() _req: Request, @Res() res: Response) {
    try {
      const { userId, groupId } = body || {};
      if (!userId) throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);
      if (!groupId) throw new HttpException('groupId 必填', HttpStatus.BAD_REQUEST);

      // 构造伪造的 req 对象
      const fakeReq: any = {
        user: { id: userId, role: 'visitor' },
        header: (name: string) => _req.header(name),
        headers: _req.headers,
        connection: _req.connection,
        socket: _req.socket,
        ip: _req.ip,
      };

      const result = await this.chatGroupService.getRelationships({ groupId }, fakeReq);
      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '获取人物关系失败';
      return res.status(status).json({ success: false, message });
    }
  }
}
