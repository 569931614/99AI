import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Request } from 'express';
import * as pdf from 'pdf-parse';
import { In, Repository } from 'typeorm';
import { AppEntity } from '../app/app.entity';
import { ModelsService } from '../models/models.service';
import { AffectionService } from '../affection/affection.service';
import { ChatGroupEntity } from './chatGroup.entity';
import { CreateGroupDto } from './dto/createGroup.dto';
import { DelGroupDto } from './dto/delGroup.dto';

@Injectable()
export class ChatGroupService {
  constructor(
    @InjectRepository(ChatGroupEntity)
    private readonly chatGroupEntity: Repository<ChatGroupEntity>,
    @InjectRepository(AppEntity)
    private readonly appEntity: Repository<AppEntity>,
    private readonly modelsService: ModelsService,
    private readonly affectionService: AffectionService,
  ) {}

  async create(body: CreateGroupDto, req: Request) {
    const { id } = req.user; // 从请求中获取用户ID
    const { modelConfig: bodyModelConfig, params, title, description, ownerNickname, appId } = body; // 从请求体中提取参数

    // 尝试使用从请求体中提供的 modelConfig，否则获取默认配置
    let modelConfig = bodyModelConfig || (await this.modelsService.getBaseConfig());
    const modelDetail = await this.modelsService.getModelDetailByName(modelConfig.modelInfo.model);
    if (modelDetail) {
      modelConfig.modelInfo.modelName = modelDetail.modelName;
      modelConfig.modelInfo.deductType = modelDetail.deductType;
      modelConfig.modelInfo.deduct = modelDetail.deduct;
      modelConfig.modelInfo.isFileUpload = modelDetail.isFileUpload;
      modelConfig.modelInfo.isImageUpload = modelDetail.isImageUpload;
      modelConfig.modelInfo.isNetworkSearch = modelDetail.isNetworkSearch;
      modelConfig.modelInfo.deepThinkingType = modelDetail.deepThinkingType;
      modelConfig.modelInfo.isMcpTool = modelDetail.isMcpTool;
    }

    if (!modelConfig) {
      throw new HttpException(
        '管理员未配置任何AI模型、请先联系管理员开通聊天模型配置！',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 使用 JSON.parse(JSON.stringify(object)) 进行深拷贝以避免直接修改原对象
    modelConfig = JSON.parse(JSON.stringify(modelConfig));

    // 初始化创建对话组的参数
    const groupParams: any = {
      title: title || '新对话',
      userId: id,
      params,
      description,
      ownerNickname,
      appId: appId || 0, // 保存应用ID（角色ID）
    };
    // const params = { title: 'New chat', userId: id };

    // 创建新的聊天组并保存
    const newGroup = await this.chatGroupEntity.save({
      ...groupParams,
      config: JSON.stringify(modelConfig), // 将 modelConfig 对象转换为 JSON 字符串进行保存
    });

    return newGroup; // 返回新创建的聊天组
  }

  async query(req: Request) {
    try {
      const { id } = req.user;
      const params = { userId: id, isDelete: false };
      const res = await this.chatGroupEntity.find({
        where: params,
        order: { isSticky: 'DESC', updatedAt: 'DESC' },
      });
      const appIds = res.filter(t => t.appId).map(t => t.appId);
      let mapped = res as any[];
      if (appIds.length) {
        const appInfos = await this.appEntity.find({ where: { id: In(appIds) } });
        mapped = res.map((item: any) => {
          item.appLogo = appInfos.find(t => t.id === item.appId)?.coverImg;
          return item;
        });
      }
      return mapped;
    } catch (error) {
      console.log('error: ', error);
    }
  }

  async update(body: any, req: Request) {
    // Logger.debug(`body: ${JSON.stringify(body)}`);
    const { title, groupId, description, ownerNickname } = body;
    const { id } = req.user;
    const g = await this.chatGroupEntity.findOne({
      where: { id: groupId, userId: id },
    });
    if (!g) {
      throw new HttpException('请先选择一个对话或者新加一个对话再操作！', HttpStatus.BAD_REQUEST);
    }
    const { appId, config } = g;
    if (appId && !title) {
      try {
        const parseData = JSON.parse(config);
        if (Number(parseData.keyType) !== 1) {
          throw new HttpException('应用对话名称不能修改哟！', HttpStatus.BAD_REQUEST);
        }
      } catch (error) {
        // ignore
      }
    }
    const data = {};
    title && (data['title'] = title);
    typeof description !== 'undefined' && (data['description'] = description);
    typeof ownerNickname !== 'undefined' && (data['ownerNickname'] = ownerNickname);
    const u = await this.chatGroupEntity.update({ id: groupId }, data);
    if (u.affected) {
      // // 如果 fileUrl 不为空，异步处理 PDF 内容读取
      // if (fileUrl) {
      //   this.handlePdfExtraction(fileUrl, groupId);
      // }
      return true;
    } else {
      throw new HttpException('更新对话失败！', HttpStatus.BAD_REQUEST);
    }
  }

  // 从 PDF 文件 URL 中提取文本内容
  private async extractPdfText(fileUrl: string): Promise<string> {
    try {
      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
      });
      const dataBuffer = Buffer.from(response.data);
      const pdfData = await pdf(dataBuffer);
      return pdfData.text;
    } catch (error) {
      console.error('PDF 解析失败:', error);
      throw new Error('PDF 解析失败');
    }
  }

  async updateTime(groupId: number) {
    await this.chatGroupEntity.update(groupId, {
      updatedAt: new Date(),
    });
  }

  async del(body: DelGroupDto, req: Request) {
    const { groupId } = body;
    const { id } = req.user;
    const g = await this.chatGroupEntity.findOne({
      where: { id: groupId, userId: id },
    });
    if (!g) {
      throw new HttpException('非法操作、您在删除一个非法资源！', HttpStatus.BAD_REQUEST);
    }
    const r = await this.chatGroupEntity.update({ id: groupId }, { isDelete: true });
    if (r.affected) {
      // 删除对话时清空该角色的好感度
      if (g.appId) {
        await this.affectionService.clearUserAffection(id, g.appId);
      }
      return '删除成功';
    } else {
      throw new HttpException('删除失败！', HttpStatus.BAD_REQUEST);
    }
  }

  /* 删除非置顶开启的所有对话记录 */
  async delAll(req: Request) {
    const { id } = req.user;
    // 先查询所有要删除的对话组，提取appId
    const groups = await this.chatGroupEntity.find({
      where: { userId: id, isSticky: false, isDelete: false },
    });
    const r = await this.chatGroupEntity.update(
      { userId: id, isSticky: false, isDelete: false },
      { isDelete: true },
    );
    if (r.affected) {
      // 删除所有对话时，清空所有涉及角色的好感度
      const appIds = [...new Set(groups.filter(g => g.appId).map(g => g.appId))];
      for (const appId of appIds) {
        await this.affectionService.clearUserAffection(id, appId);
      }
      return '删除成功';
    } else {
      throw new HttpException('删除失败！', HttpStatus.BAD_REQUEST);
    }
  }

  /* 通过groupId查询当前对话组的详细信息 */
  async getGroupInfoFromId(id) {
    if (!id) return;
    const groupInfo = await this.chatGroupEntity.findOne({ where: { id } });
    if (groupInfo) {
      const { pdfTextContent, ...rest } = groupInfo;
      return rest;
    }
  }

  async getGroupPdfText(groupId: number) {
    const groupInfo = await this.chatGroupEntity.findOne({
      where: { id: groupId },
    });
    if (groupInfo) {
      return groupInfo.pdfTextContent;
    }
  }

  // ===== 群组成员与任务 =====
  private parseMembers(json?: string): any[] {
    if (!json) return [];
    try {
      const obj = JSON.parse(json);
      if (Array.isArray(obj)) return obj;
      return [];
    } catch {
      return [];
    }
  }

  private stringifyMembers(arr: any[]): string {
    return JSON.stringify(arr || []);
  }

  async ensureGroupOwned(groupId: number, req: Request) {
    const g = await this.chatGroupEntity.findOne({
      where: { id: groupId, userId: (req as any).user.id },
    });
    if (!g) throw new HttpException('非法操作、您无权限访问该对话组！', HttpStatus.BAD_REQUEST);
    return g;
  }

  async addMembers(
    body: {
      groupId: number;
      members: Array<{
        appId: number;
        order: number;
        role: string;
        taskDetail?: string;
        openingRemark?: string; // 添加开场白参数
      }>;
    },
    req: Request,
  ) {
    const { groupId, members: newMembers } = body;
    const g = await this.ensureGroupOwned(groupId, req);
    const existingMembers = this.parseMembers(g.members);

    // 批量添加成员
    for (const member of newMembers) {
      // 使用 appId 作为成员的 userId
      const memberId = member.appId;

      // 检查成员是否已存在
      if (existingMembers.some(m => Number(m.userId) === Number(memberId))) {
        continue; // 跳过已存在的成员
      }

      // 查询应用信息获取名称和开场白
      let appName = null;
      let finalOpeningRemark = member.openingRemark || null;
      try {
        const app = await this.appEntity.findOne({ where: { id: member.appId } });
        appName = app?.name || `角色_${member.appId}`;
        // 如果没有传入开场白，使用应用的默认开场白
        if (!finalOpeningRemark && app?.openingRemark) {
          finalOpeningRemark = app.openingRemark;
        }
      } catch {
        appName = `角色_${member.appId}`;
      }

      // 处理任务：如果传入了 taskDetail，自动生成任务
      let tasksList = [];
      if (member.taskDetail && member.taskDetail.trim()) {
        tasksList = [
          {
            taskId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            title: member.taskDetail,
            detail: '',
            status: 'todo',
            createdAt: new Date().toISOString(),
          },
        ];
      }

      existingMembers.push({
        userId: memberId,
        name: appName,
        role: member.role,
        order: member.order,
        appId: member.appId,
        appName: appName,
        tasks: tasksList,
        openingRemark: finalOpeningRemark, // 保存开场白到成员数据中
      });
    }

    // 添加成员时，自动设置为群聊
    await this.chatGroupEntity.update(
      { id: groupId },
      { members: this.stringifyMembers(existingMembers), isGroupChat: true },
    );
    return { success: true, count: newMembers.length };
  }

  // 添加单个成员（兼容旧接口）
  async addMember(
    body: {
      groupId: number;
      userId: number;
      name?: string;
      role?: string;
      order?: number;
      appId?: number;
      appName?: string;
    },
    req: Request,
  ) {
    const { groupId, userId, name, role, order, appId, appName } = body;

    // 将单个成员转换为数组格式，调用批量添加方法
    return this.addMembers(
      {
        groupId,
        members: [
          {
            appId: appId || userId, // 兼容：如果没有 appId，使用 userId
            order: order || 999,
            role: role || 'member',
            taskDetail: undefined,
          },
        ],
      },
      req,
    );
  }

  async removeMember(body: { groupId: number; userId: number }, req: Request) {
    const { groupId, userId } = body;
    const g = await this.ensureGroupOwned(groupId, req);
    const members = this.parseMembers(g.members).filter(m => Number(m.userId) !== Number(userId));
    // 如果移除成员后没有成员了，取消群聊状态
    const isGroupChat = members.length > 0;
    await this.chatGroupEntity.update(
      { id: groupId },
      { members: this.stringifyMembers(members), isGroupChat },
    );
    return true;
  }

  async listMembers(body: { groupId: number }, req: Request) {
    const { groupId } = body;
    const g = await this.ensureGroupOwned(groupId, req);
    const members = this.parseMembers(g.members);

    // 获取所有成员的appId
    const appIds = members.filter(m => m.appId).map(m => m.appId);

    // 如果有appId，批量查询应用信息获取头像
    if (appIds.length > 0) {
      const appInfos = await this.appEntity.find({
        where: { id: In(appIds) },
      });

      // 为每个成员添加头像信息
      return members.map(member => {
        if (member.appId) {
          const appInfo = appInfos.find(app => app.id === member.appId);
          return {
            ...member,
            appAvatar: appInfo?.coverImg || null,
          };
        }
        return member;
      });
    }

    return members;
  }

  async assignTask(
    body: {
      groupId: number;
      userId: number;
      taskId?: string;
      title: string;
      detail?: string;
      status?: string;
    },
    req: Request,
  ) {
    const { groupId, userId, title, detail, status } = body;
    const g = await this.ensureGroupOwned(groupId, req);
    const members = this.parseMembers(g.members);
    const m = members.find(x => Number(x.userId) === Number(userId));
    if (!m) throw new HttpException('成员不存在', HttpStatus.BAD_REQUEST);
    const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const task = {
      taskId,
      title,
      detail: detail || '',
      status: status || 'todo',
      createdAt: new Date().toISOString(),
    };
    m.tasks = Array.isArray(m.tasks) ? m.tasks : [];
    m.tasks.push(task);
    await this.chatGroupEntity.update({ id: groupId }, { members: this.stringifyMembers(members) });
    return task;
  }

  async updateTask(
    body: {
      groupId: number;
      userId: number;
      taskId: string;
      title?: string;
      detail?: string;
      status?: string;
    },
    req: Request,
  ) {
    const { groupId, userId, taskId, title, detail, status } = body;
    const g = await this.ensureGroupOwned(groupId, req);
    const members = this.parseMembers(g.members);
    const m = members.find(x => Number(x.userId) === Number(userId));
    if (!m) throw new HttpException('成员不存在', HttpStatus.BAD_REQUEST);
    const t = (m.tasks || []).find((tt: any) => tt.taskId === taskId);
    if (!t) throw new HttpException('任务不存在', HttpStatus.BAD_REQUEST);
    if (typeof title !== 'undefined') t.title = title;
    if (typeof detail !== 'undefined') t.detail = detail;
    if (typeof status !== 'undefined') t.status = status;
    await this.chatGroupEntity.update({ id: groupId }, { members: this.stringifyMembers(members) });
    return true;
  }

  async updateMember(
    body: {
      groupId: number;
      userId: number;
      name?: string;
      role?: string;
      order?: number;
      appId?: number;
      appName?: string;
      openingRemark?: string;
    },
    req: Request,
  ) {
    const { groupId, userId, name, role, order, appId, appName, openingRemark } = body;
    const g = await this.ensureGroupOwned(groupId, req);
    const members = this.parseMembers(g.members);
    const m = members.find(x => Number(x.userId) === Number(userId));
    if (!m) throw new HttpException('成员不存在', HttpStatus.BAD_REQUEST);
    if (typeof name !== 'undefined') m.name = name;
    if (typeof role !== 'undefined') m.role = role;
    if (typeof order === 'number') m.order = order;
    if (typeof appId !== 'undefined') m.appId = appId;
    if (typeof appName !== 'undefined') m.appName = appName;
    if (typeof openingRemark !== 'undefined') m.openingRemark = openingRemark;
    // 按 order 排序，缺省放最后
    members.sort(
      (a, b) =>
        Number(a.order || 999999) - Number(b.order || 999999) ||
        Number(a.userId) - Number(b.userId),
    );
    await this.chatGroupEntity.update({ id: groupId }, { members: this.stringifyMembers(members) });
    return true;
  }
}
