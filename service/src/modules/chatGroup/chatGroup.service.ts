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
import { ChatLogEntity } from '../chatLog/chatLog.entity';
import { CreateGroupDto } from './dto/createGroup.dto';
import { DelGroupDto } from './dto/delGroup.dto';
import { UploadService } from '../upload/upload.service';
import { UserEntity } from '../user/user.entity';
import { compositeGroupAvatar } from '@/common/utils/avatarComposite';

@Injectable()
export class ChatGroupService {
  constructor(
    @InjectRepository(ChatGroupEntity)
    private readonly chatGroupEntity: Repository<ChatGroupEntity>,
    @InjectRepository(AppEntity)
    private readonly appEntity: Repository<AppEntity>,
    @InjectRepository(ChatLogEntity)
    private readonly chatLogEntity: Repository<ChatLogEntity>,
    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,
    private readonly modelsService: ModelsService,
    private readonly affectionService: AffectionService,
    private readonly uploadService: UploadService,
  ) {}

  async create(body: CreateGroupDto, req: Request) {
    const { id } = req.user; // 从请求中获取用户ID
    const {
      modelConfig: bodyModelConfig,
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
    } = body; // 从请求体中提取参数

    // 添加日志：检查openingRemark是否被接收
    console.log('=== chatGroup.create 接收到的参数 ===');
    console.log('userId:', id);
    console.log('appId:', appId);
    console.log('openingRemark:', openingRemark);
    console.log('openingRemark类型:', typeof openingRemark);
    console.log('openingRemark是否为空:', !openingRemark);
    console.log('proactivelySend:', proactivelySend);
    console.log('describingMental:', describingMental);
    console.log('realTime:', realTime);
    console.log('完整body:', JSON.stringify(body));

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
      openingRemark: openingRemark || '', // 保存开场白
      backgroundImage: backgroundImage || null, // 保存背景图片URL
      proactivelySend: proactivelySend ?? 0, // 是否主动发消息，默认0
      describingMental: describingMental ?? 0, // 是否开启心理动作描述，默认0
      realTime: realTime ?? 0, // 是否开启真实时间，默认0
    };
    // const params = { title: 'New chat', userId: id };

    // 创建新的聊天组并保存
    const newGroup = await this.chatGroupEntity.save({
      ...groupParams,
      config: JSON.stringify(modelConfig), // 将 modelConfig 对象转换为 JSON 字符串进行保存
    });

    console.log('=== 群组创建完成 ===');
    console.log('新群组ID:', newGroup.id);

    // 如果有角色ID（appId），初始化亲密度数据
    if (appId) {
      try {
        console.log('初始化亲密度数据，userId:', id, 'appId:', appId);
        await this.affectionService.getUserAffection(id, appId);
        console.log('✅ 亲密度数据初始化成功');
      } catch (error) {
        console.error('❌ 初始化亲密度数据失败:', error);
        // 不阻断创建流程，继续执行
      }
    }

    console.log('准备保存开场白到chatLog...');
    console.log('检查条件: openingRemark && openingRemark.trim()');
    console.log('openingRemark:', openingRemark);
    console.log('openingRemark.trim():', openingRemark ? openingRemark.trim() : 'null/undefined');
    console.log('条件结果:', openingRemark && openingRemark.trim());

    // 如果有开场白，保存为第一条聊天记录
    if (openingRemark && openingRemark.trim()) {
      console.log('✅ 开始保存开场白到chatLog');
      const openingChatLog = {
        userId: id,
        groupId: newGroup.id,
        appId: appId || 0,
        type: 1, // 文本类型
        role: 'assistant', // 角色发送
        prompt: '', // 用户输入为空
        answer: openingRemark, // AI回复为开场白
        content: openingRemark,
        status: 2, // 已完成
        model: null,
        modelName: null,
        isDelete: false,
        isOpeningRemark: true, // 标记为开场白
      };
      const savedLog = await this.chatLogEntity.save(openingChatLog);
      console.log('✅ 开场白已保存到chatLog, ID:', savedLog.id);
    } else {
      console.log('❌ 开场白未保存：条件不满足');
    }

    // 如果是群聊且有成员，生成群组拼图头像
    if (newGroup.isGroupChat && newGroup.members) {
      const members = this.parseMembers(newGroup.members);
      if (members && members.length > 0) {
        // 优先使用传递的 userAvatarUrl，否则从数据库获取用户头像
        let userAvatar = (req as any).userAvatarUrl || null;
        if (!userAvatar) {
          const user = await this.userEntity.findOne({ where: { id } });
          userAvatar = user?.avatar || null;
        }
        await this.generateGroupAvatar(newGroup.id, members, userAvatar);
        // 重新查询群组以获取生成的头像URL
        const updatedGroup = await this.chatGroupEntity.findOne({ where: { id: newGroup.id } });
        if (updatedGroup && updatedGroup.groupAvatar) {
          newGroup.groupAvatar = updatedGroup.groupAvatar;
        }
      }
    }

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
          const appInfo = appInfos.find(t => t.id === item.appId);
          item.appLogo = appInfo?.coverImg;
          item.appUserId = appInfo?.userId;
          return item;
        });
      }
      return mapped;
    } catch (error) {
      console.log('error: ', error);
    }
  }

  /* 查询对话组详情 */
  async getDetail(groupId: number, req: Request) {
    try {
      const { id } = req.user;
      const chatGroup = await this.chatGroupEntity.findOne({
        where: { id: groupId, userId: id, isDelete: false },
      });

      if (!chatGroup) {
        throw new HttpException('对话组不存在', HttpStatus.NOT_FOUND);
      }

      // 如果有关联的应用ID，获取应用信息
      if (chatGroup.appId) {
        const appInfo = await this.appEntity.findOne({ where: { id: chatGroup.appId } });
        if (appInfo) {
          (chatGroup as any).appLogo = appInfo.coverImg;
          (chatGroup as any).appName = appInfo.name;
          (chatGroup as any).appUserId = appInfo.userId;
        }
      }

      // 处理群组成员信息，补充每个成员的角色名和头像
      const members = this.parseMembers(chatGroup.members);
      if (members.length > 0) {
        const appIds = members.filter(m => m.appId).map(m => m.appId);
        if (appIds.length > 0) {
          const appInfos = await this.appEntity.find({
            where: { id: In(appIds) },
          });

          // 为每个成员补充角色信息
          const enrichedMembers = members.map(member => {
            if (member.appId) {
              const appInfo = appInfos.find(app => app.id === member.appId);
              return {
                ...member,
                name: appInfo?.name || member.name || null,
                appName: appInfo?.name || member.appName || null,
                appAvatar: appInfo?.coverImg || null,
              };
            }
            return member;
          });

          // 将处理后的成员列表重新赋值
          (chatGroup as any).members = enrichedMembers;
        }
      }

      return chatGroup;
    } catch (error) {
      console.error('getDetail error:', error);
      throw error;
    }
  }

  /* 查询单聊会话组列表 */
  async querySingleChats(req: Request, keyword?: string) {
    try {
      const { id } = req.user;
      const params = { userId: id, isDelete: false, isGroupChat: false };
      const res = await this.chatGroupEntity.find({
        where: params,
        order: { isSticky: 'DESC', updatedAt: 'DESC' },
      });

      const appIds = res.filter(t => t.appId).map(t => t.appId);
      let mapped = res as any[];

      // 获取应用信息（头像、角色名等）
      if (appIds.length) {
        const appInfos = await this.appEntity.find({ where: { id: In(appIds) } });
        mapped = res.map((item: any) => {
          const appInfo = appInfos.find(t => t.id === item.appId);
          item.appLogo = appInfo?.coverImg;
          item.appName = appInfo?.name; // 添加角色名
          item.appUserId = appInfo?.userId;
          return item;
        });
      }

      // 如果有关键词，按角色名称过滤
      if (keyword && keyword.trim()) {
        const searchKeyword = keyword.trim().toLowerCase();
        mapped = mapped.filter(item => {
          const appName = item.appName || '';
          return appName.toLowerCase().includes(searchKeyword);
        });
      }

      // 批量补充每个会话组的额外信息
      const enrichedList = await Promise.all(
        mapped.map(async item => {
          // 1. 获取亲密度（好感度阶段）
          let intimacy = '';
          if (item.appId) {
            try {
              const affectionData = await this.affectionService.getUserAffection(id, item.appId);
              intimacy = affectionData?.stage?.name || '';
            } catch (error) {
              console.log(`获取好感度失败 userId:${id} appId:${item.appId}`, error);
            }
          }

          // 2. 获取最后一条消息
          let lastMessage = '';
          let lastMessageTime = item.updatedAt;
          try {
            const lastChat = await this.chatLogEntity.findOne({
              where: { groupId: item.id, isDelete: false },
              order: { createdAt: 'DESC' },
            });
            if (lastChat) {
              lastMessage = lastChat.content || '';
              lastMessageTime = lastChat.createdAt;
            }
          } catch (error) {
            console.log(`获取最后消息失败 groupId:${item.id}`, error);
          }

          // 3. 未读消息数（暂时设为0，99AI暂无未读消息跟踪）
          const unreadCount = 0;

          // 4. 判断是否需要显示红点（自动回复开启 且 超过30分钟没有消息）
          let showRedDot = false;
          if (item.proactivelySend === 1 && lastMessageTime) {
            const now = new Date();
            const lastTime = new Date(lastMessageTime);
            const diffMinutes = (now.getTime() - lastTime.getTime()) / (1000 * 60);
            showRedDot = diffMinutes >= 30;
          }

          return {
            ...item,
            intimacy,
            last_message: lastMessage,
            last_message_time: lastMessageTime,
            unread_count: unreadCount,
            show_red_dot: showRedDot,
          };
        }),
      );

      // 根据 last_message_time 倒序排序（置顶的会话仍然排在前面）
      enrichedList.sort((a, b) => {
        // 首先按置顶状态排序
        if (a.isSticky !== b.isSticky) {
          return b.isSticky ? 1 : -1;
        }
        // 然后按最后消息时间倒序排序
        const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
        const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
        return timeB - timeA;
      });

      return enrichedList;
    } catch (error) {
      console.log('error: ', error);
      throw error;
    }
  }

  /* 查询群聊会话组列表 */
  async queryGroupChats(req: Request, keyword?: string) {
    try {
      const { id } = req.user;
      const params = { userId: id, isDelete: false, isGroupChat: true };
      const res = await this.chatGroupEntity.find({
        where: params,
        order: { isSticky: 'DESC', updatedAt: 'DESC' },
      });

      // 调试：打印第一条记录的 groupAvatar
      if (res.length > 0) {
        console.log('=== 群聊查询调试 ===');
        console.log('第一条记录 ID:', res[0].id);
        console.log('groupAvatar 值:', res[0].groupAvatar);
        console.log('所有字段:', Object.keys(res[0]));
      }

      const appIds = res.filter(t => t.appId).map(t => t.appId);
      let mapped = res as any[];

      // 获取应用信息（头像、角色名等）
      if (appIds.length) {
        const appInfos = await this.appEntity.find({ where: { id: In(appIds) } });
        mapped = res.map((item: any) => {
          const appInfo = appInfos.find(t => t.id === item.appId);
          item.appLogo = appInfo?.coverImg;
          item.appName = appInfo?.name; // 添加角色名
          item.appUserId = appInfo?.userId;
          return item;
        });
      }

      // 如果有关键词，按群组名称过滤
      if (keyword && keyword.trim()) {
        const searchKeyword = keyword.trim().toLowerCase();
        mapped = mapped.filter(item => {
          const groupName = item.title || '';
          return groupName.toLowerCase().includes(searchKeyword);
        });
      }

      // 批量补充每个会话组的额外信息
      const enrichedList = await Promise.all(
        mapped.map(async item => {
          // 1. 获取最后一条消息
          let lastMessage = '';
          let lastMessageTime = item.updatedAt;
          try {
            const lastChat = await this.chatLogEntity.findOne({
              where: { groupId: item.id, isDelete: false },
              order: { createdAt: 'DESC' },
            });
            if (lastChat) {
              lastMessage = lastChat.content || '';
              lastMessageTime = lastChat.createdAt;
            }
          } catch (error) {
            console.log(`获取最后消息失败 groupId:${item.id}`, error);
          }

          // 2. 未读消息数（暂时设为0，99AI暂无未读消息跟踪）
          const unreadCount = 0;

          // 3. 判断是否需要显示红点（自动回复开启 且 超过30分钟没有消息）
          let showRedDot = false;
          if (item.proactivelySend === 1 && lastMessageTime) {
            const now = new Date();
            const lastTime = new Date(lastMessageTime);
            const diffMinutes = (now.getTime() - lastTime.getTime()) / (1000 * 60);
            showRedDot = diffMinutes >= 30;
          }

          return {
            ...item,
            last_message: lastMessage,
            last_message_time: lastMessageTime,
            unread_count: unreadCount,
            show_red_dot: showRedDot,
          };
        }),
      );

      // 根据 last_message_time 倒序排序（置顶的会话仍然排在前面）
      enrichedList.sort((a, b) => {
        // 首先按置顶状态排序
        if (a.isSticky !== b.isSticky) {
          return b.isSticky ? 1 : -1;
        }
        // 然后按最后消息时间倒序排序
        const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
        const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
        return timeB - timeA;
      });

      return enrichedList;
    } catch (error) {
      console.log('error: ', error);
      throw error;
    }
  }

  async update(body: any, req: Request) {
    // Logger.debug(`body: ${JSON.stringify(body)}`);
    const {
      title,
      groupId,
      description,
      ownerNickname,
      characterRelationships,
      openingRemark,
      proactivelySend,
      describingMental,
      realTime,
      myName,
      myProfile,
      members,
      backgroundImage,
    } = body;
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
    typeof characterRelationships !== 'undefined' &&
      (data['characterRelationships'] = characterRelationships);
    typeof openingRemark !== 'undefined' && (data['openingRemark'] = openingRemark);
    typeof proactivelySend !== 'undefined' && (data['proactivelySend'] = proactivelySend);
    typeof describingMental !== 'undefined' && (data['describingMental'] = describingMental);
    typeof realTime !== 'undefined' && (data['realTime'] = realTime);
    typeof myName !== 'undefined' && (data['myName'] = myName);
    typeof myProfile !== 'undefined' && (data['myProfile'] = myProfile);
    typeof backgroundImage !== 'undefined' && (data['backgroundImage'] = backgroundImage);

    // 处理 members 参数 - 如果传入则完整替换
    if (members && Array.isArray(members)) {
      data['members'] = this.stringifyMembers(members);
      // 如果有成员，设置为群聊
      data['isGroupChat'] = members.length > 0;
    }

    const u = await this.chatGroupEntity.update({ id: groupId }, data);
    if (u.affected) {
      // 如果更新了成员列表，处理开场白
      if (members && Array.isArray(members)) {
        // 获取旧的成员列表
        const existingMembers = this.parseMembers(g.members);
        const existingMemberMap = new Map(existingMembers.map(m => [m.appId, m]));

        // 获取所有成员的 appId，批量查询角色信息
        const allAppIds = members.filter(m => m.appId).map(m => m.appId);
        const appInfos = await this.appEntity.find({ where: { id: In(allAppIds) } });
        const appInfoMap = new Map(appInfos.map(app => [app.id, app]));

        // 处理每个成员的开场白
        for (const member of members) {
          const existingMember = existingMemberMap.get(member.appId);
          const appInfo = appInfoMap.get(member.appId);

          // 获取角色名称和头像
          const roleName = appInfo?.name || '角色';
          const roleAvatar = appInfo?.coverImg || '';

          if (!existingMember) {
            // 新增的成员：添加开场白到 chatLog
            if (member.openingRemark && member.openingRemark.trim()) {
              console.log(`✅ 为新成员 ${member.appId} (${roleName}) 添加开场白到 chatLog`);
              const openingChatLog = {
                userId: id,
                groupId: groupId,
                appId: member.appId,
                type: 1, // 文本类型
                role: 'assistant', // 角色发送
                prompt: '', // 用户输入为空
                answer: member.openingRemark, // AI回复为开场白
                content: member.openingRemark,
                status: 2, // 已完成
                model: null,
                modelName: roleName, // 使用角色名称
                modelAvatar: roleAvatar, // 使用角色头像
                isDelete: false,
                isOpeningRemark: true, // 标记为开场白
              };
              await this.chatLogEntity.save(openingChatLog);
            }
          } else {
            // 已存在的成员：检查开场白是否有变化
            const oldOpeningRemark = existingMember.openingRemark || '';
            const newOpeningRemark = member.openingRemark || '';

            if (oldOpeningRemark !== newOpeningRemark && newOpeningRemark.trim()) {
              // 开场白有变化，更新 chatLog 中的开场白
              console.log(`✅ 更新成员 ${member.appId} (${roleName}) 的开场白`);

              // 查找该成员的开场白记录
              const existingOpeningLog = await this.chatLogEntity.findOne({
                where: {
                  groupId: groupId,
                  appId: member.appId,
                  isOpeningRemark: true,
                  isDelete: false,
                },
                order: { createdAt: 'ASC' }, // 获取最早的开场白记录
              });

              if (existingOpeningLog) {
                // 更新现有的开场白记录
                await this.chatLogEntity.update(
                  { id: existingOpeningLog.id },
                  {
                    answer: newOpeningRemark,
                    content: newOpeningRemark,
                    modelName: roleName, // 更新角色名称
                    modelAvatar: roleAvatar, // 更新角色头像
                  },
                );
              } else {
                // 如果没有找到开场白记录，创建一个新的
                const openingChatLog = {
                  userId: id,
                  groupId: groupId,
                  appId: member.appId,
                  type: 1,
                  role: 'assistant',
                  prompt: '',
                  answer: newOpeningRemark,
                  content: newOpeningRemark,
                  status: 2,
                  model: null,
                  modelName: roleName, // 使用角色名称
                  modelAvatar: roleAvatar, // 使用角色头像
                  isDelete: false,
                  isOpeningRemark: true,
                };
                await this.chatLogEntity.save(openingChatLog);
              }
            }
          }
        }

        // 重新生成群组头像
        // 优先使用传递的 userAvatarUrl，否则从数据库获取用户头像
        let userAvatar = (req as any).userAvatarUrl || null;
        if (!userAvatar) {
          const user = await this.userEntity.findOne({ where: { id } });
          userAvatar = user?.avatar || null;
        }
        await this.generateGroupAvatar(groupId, members, userAvatar);
      }

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
    const { id: userId } = (req as any).user;

    // 收集新添加的成员信息（用于后续创建开场白）
    const newMembersWithOpeningRemark = [];

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

      const memberData = {
        userId: memberId,
        name: appName,
        role: member.role,
        order: member.order,
        appId: member.appId,
        appName: appName,
        tasks: tasksList,
        openingRemark: finalOpeningRemark, // 保存开场白到成员数据中
      };

      existingMembers.push(memberData);

      // 如果有开场白，收集该成员信息用于创建 chatLog
      if (finalOpeningRemark && finalOpeningRemark.trim()) {
        newMembersWithOpeningRemark.push({
          appId: member.appId,
          order: member.order,
          openingRemark: finalOpeningRemark,
        });
      }
    }

    // 添加成员时，自动设置为群聊
    await this.chatGroupEntity.update(
      { id: groupId },
      { members: this.stringifyMembers(existingMembers), isGroupChat: true },
    );

    // 按照 order 排序，将开场白保存到 chatLog
    if (newMembersWithOpeningRemark.length > 0) {
      // 获取所有新增成员的角色信息
      const appIds = newMembersWithOpeningRemark.map(m => m.appId);
      const appInfos = await this.appEntity.find({ where: { id: In(appIds) } });
      const appInfoMap = new Map(appInfos.map(app => [app.id, app]));

      // 按 order 排序
      newMembersWithOpeningRemark.sort((a, b) => a.order - b.order);

      // 为每个成员创建开场白记录
      for (const member of newMembersWithOpeningRemark) {
        const appInfo = appInfoMap.get(member.appId);
        const roleName = appInfo?.name || `角色_${member.appId}`;
        const roleAvatar = appInfo?.coverImg || '';

        // 根据 isOpeningRemark 判断该成员是否已经有开场白记录
        const existingOpeningRemark = await this.chatLogEntity.findOne({
          where: {
            groupId: groupId,
            appId: member.appId,
            isOpeningRemark: true,
            isDelete: false,
          },
          order: { id: 'ASC' }, // 获取最早的一条记录
        });

        if (existingOpeningRemark) {
          // 如果已存在开场白，更新内容
          existingOpeningRemark.answer = member.openingRemark;
          existingOpeningRemark.content = member.openingRemark;
          existingOpeningRemark.modelName = roleName;
          existingOpeningRemark.modelAvatar = roleAvatar;
          await this.chatLogEntity.save(existingOpeningRemark);
          console.log(`✅ 更新成员 ${member.appId} (${roleName}) 的开场白`);
        } else {
          // 如果不存在，创建新的开场白记录
          const openingChatLog = {
            userId: userId,
            groupId: groupId,
            appId: member.appId,
            type: 1, // 文本类型
            role: 'assistant', // 角色发送
            prompt: '', // 用户输入为空
            answer: member.openingRemark, // AI回复为开场白
            content: member.openingRemark,
            status: 2, // 已完成
            model: null,
            modelName: roleName, // 使用角色名称
            modelAvatar: roleAvatar, // 使用角色头像
            isDelete: false,
            isOpeningRemark: true, // 标记为开场白
          };
          await this.chatLogEntity.save(openingChatLog);
          console.log(`✅ 创建成员 ${member.appId} (${roleName}) 的开场白`);
        }
        // 添加小延迟确保时间戳不同
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // 生成群组拼图头像
    // 优先使用传递的 userAvatarUrl，否则从数据库获取用户头像
    let userAvatar = (req as any).userAvatarUrl || null;
    if (!userAvatar) {
      const user = await this.userEntity.findOne({ where: { id: userId } });
      userAvatar = user?.avatar || null;
    }
    await this.generateGroupAvatar(groupId, existingMembers, userAvatar);

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

    // 重新生成群组拼图头像
    // 优先使用传递的 userAvatarUrl，否则从数据库获取用户头像
    const currentUserId = (req as any).user.id;
    let userAvatar = (req as any).userAvatarUrl || null;
    if (!userAvatar) {
      const user = await this.userEntity.findOne({ where: { id: currentUserId } });
      userAvatar = user?.avatar || null;
    }
    await this.generateGroupAvatar(groupId, members, userAvatar);

    return true;
  }

  async listMembers(body: { groupId: number }, req: Request) {
    const { groupId } = body;
    const g = await this.ensureGroupOwned(groupId, req);
    const members = this.parseMembers(g.members);

    // 获取所有成员的appId
    const appIds = members.filter(m => m.appId).map(m => m.appId);

    // 如果有appId，批量查询应用信息获取头像和角色名
    if (appIds.length > 0) {
      const appInfos = await this.appEntity.find({
        where: { id: In(appIds) },
      });

      // 为每个成员添加头像和角色名信息
      return members.map(member => {
        if (member.appId) {
          const appInfo = appInfos.find(app => app.id === member.appId);
          return {
            ...member,
            name: appInfo?.name || member.name || null, // 添加角色名
            appName: appInfo?.name || member.appName || null, // 添加appName
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
      members: Array<{
        appId: number;
        taskDetail?: string;
        order?: number;
        role?: string;
      }>;
    },
    req: Request,
  ) {
    const { groupId, members: updateMembers } = body;
    const g = await this.ensureGroupOwned(groupId, req);
    const existingMembers = this.parseMembers(g.members);

    const results = [];

    // 批量更新成员任务
    for (const updateMember of updateMembers) {
      const { appId, taskDetail, order, role } = updateMember;
      const m = existingMembers.find(x => Number(x.appId) === Number(appId));
      if (!m) {
        results.push({ appId, success: false, message: '成员不存在' });
        continue;
      }

      // 更新成员信息（如果传了 order 或 role）
      if (typeof order !== 'undefined') m.order = order;
      if (typeof role !== 'undefined') m.role = role;

      // 更新或创建任务
      if (typeof taskDetail !== 'undefined') {
        m.tasks = Array.isArray(m.tasks) ? m.tasks : [];
        if (m.tasks.length === 0) {
          // 没有任务，创建新任务
          const newTaskId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const newTask = {
            taskId: newTaskId,
            title: taskDetail,
            detail: '',
            status: 'todo',
            createdAt: new Date().toISOString(),
          };
          m.tasks.push(newTask);
          results.push({ appId, success: true, action: 'created', task: newTask });
        } else {
          // 更新第一个任务
          const t = m.tasks[0];
          t.title = taskDetail;
          results.push({ appId, success: true, action: 'updated', task: t });
        }
      } else {
        results.push({ appId, success: true, action: 'no_task_update' });
      }
    }

    // 按 order 排序
    existingMembers.sort(
      (a, b) =>
        Number(a.order || 999999) - Number(b.order || 999999) ||
        Number(a.userId) - Number(b.userId),
    );

    await this.chatGroupEntity.update(
      { id: groupId },
      { members: this.stringifyMembers(existingMembers) },
    );
    return results;
  }

  async updateSingleTask(
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
    m.tasks = Array.isArray(m.tasks) ? m.tasks : [];
    const t = m.tasks.find(x => x.taskId === taskId);
    if (!t) throw new HttpException('任务不存在', HttpStatus.BAD_REQUEST);
    if (typeof title !== 'undefined') t.title = title;
    if (typeof detail !== 'undefined') t.detail = detail;
    if (typeof status !== 'undefined') t.status = status;
    await this.chatGroupEntity.update({ id: groupId }, { members: this.stringifyMembers(members) });
    return t;
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
      tasks?: Array<{
        taskId: string;
        title: string;
        detail?: string;
        status?: string;
        createdAt?: string;
      }>;
    },
    req: Request,
  ) {
    const { groupId, userId, name, role, order, appId, appName, openingRemark, tasks } = body;
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

    // 更新任务列表 - 如果传入则完整替换
    if (typeof tasks !== 'undefined') {
      m.tasks = Array.isArray(tasks) ? tasks : [];
    }

    // 如果更新了开场白，同步更新 chatLog 中的开场白
    if (typeof openingRemark !== 'undefined' && openingRemark && openingRemark.trim()) {
      const memberAppId = m.appId || userId;
      const currentUserId = (req as any).user.id;

      // 根据 isOpeningRemark 判断该成员是否已经有开场白记录
      const existingOpeningRemark = await this.chatLogEntity.findOne({
        where: {
          groupId: groupId,
          appId: memberAppId,
          isOpeningRemark: true,
          isDelete: false,
        },
        order: { id: 'ASC' }, // 获取最早的一条记录
      });

      if (existingOpeningRemark) {
        // 如果已存在开场白，更新内容
        existingOpeningRemark.answer = openingRemark;
        existingOpeningRemark.content = openingRemark;
        await this.chatLogEntity.save(existingOpeningRemark);
        console.log(`✅ 更新成员 ${memberAppId} 的开场白`);
      } else {
        // 如果不存在，创建新的开场白记录
        const openingChatLog = {
          userId: currentUserId,
          groupId: groupId,
          appId: memberAppId,
          type: 1, // 文本类型
          role: 'assistant', // 角色发送
          prompt: '', // 用户输入为空
          answer: openingRemark, // AI回复为开场白
          content: openingRemark,
          status: 2, // 已完成
          model: null,
          modelName: null,
          isDelete: false,
          isOpeningRemark: true, // 标记为开场白
        };
        await this.chatLogEntity.save(openingChatLog);
        console.log(`✅ 创建成员 ${memberAppId} 的开场白`);
      }
    }

    // 按 order 排序，缺省放最后
    members.sort(
      (a, b) =>
        Number(a.order || 999999) - Number(b.order || 999999) ||
        Number(a.userId) - Number(b.userId),
    );
    await this.chatGroupEntity.update({ id: groupId }, { members: this.stringifyMembers(members) });
    return true;
  }

  /**
   * 生成群组拼图头像
   * @param groupId 群组ID
   * @param members 群成员列表
   * @param userAvatarUrl 可选的用户头像URL
   * @returns 生成的头像URL，失败返回null
   */
  private async generateGroupAvatar(
    groupId: number,
    members: any[],
    userAvatarUrl?: string,
  ): Promise<string | null> {
    try {
      // 10人以上或没有成员，不生成拼图
      if (!members || members.length === 0 || members.length > 9) {
        Logger.log(`群组 ${groupId} 成员数量不在1-9范围内，跳过头像生成`, 'ChatGroupService');
        return null;
      }

      // 检查是否需要重新生成头像
      // 如果提供了用户头像，总是重新生成以确保包含用户头像
      if (userAvatarUrl) {
        Logger.log(`群组 ${groupId} 包含用户头像，重新生成群组头像`, 'ChatGroupService');
      } else {
        // 如果没有用户头像，检查成员列表是否变化（缓存优化）
        const existingGroup = await this.chatGroupEntity.findOne({ where: { id: groupId } });
        if (existingGroup && existingGroup.groupAvatar) {
          // 获取当前成员信息，包括顺序
          const currentMembers = members.map((m, idx) => `${m.appId}_${m.order || idx}`).join(',');

          // 获取已存在的成员信息
          const existingMembers = this.parseMembers(existingGroup.members);
          const existingMembersStr = existingMembers
            .map((m, idx) => `${m.appId}_${m.order || idx}`)
            .join(',');

          // 如果成员信息相同，跳过生成
          if (currentMembers === existingMembersStr) {
            Logger.log(`群组 ${groupId} 成员未变化，跳过头像生成`, 'ChatGroupService');
            return existingGroup.groupAvatar;
          }
        }
      }

      // 获取成员的头像URL
      const appIds = members.filter(m => m.appId).map(m => m.appId);
      if (appIds.length === 0) {
        Logger.warn(`群组 ${groupId} 没有有效的成员appId`, 'ChatGroupService');
        return null;
      }

      const appInfos = await this.appEntity.find({ where: { id: In(appIds) } });
      const avatarUrls = members
        .map(member => {
          const appInfo = appInfos.find(app => app.id === member.appId);
          return appInfo?.coverImg;
        })
        .filter(url => !!url); // 过滤掉空值

      if (avatarUrls.length === 0) {
        Logger.warn(`群组 ${groupId} 没有有效的头像URL`, 'ChatGroupService');
        return null;
      }

      Logger.log(
        `开始为群组 ${groupId} 生成拼图头像，成员数：${avatarUrls.length}${
          userAvatarUrl ? '，包含用户头像' : ''
        }`,
        'ChatGroupService',
      );

      // 合成头像（如果提供了用户头像，会被添加到第一位）
      const compositeBuffer = await compositeGroupAvatar(avatarUrls, 300, userAvatarUrl);

      // 上传到云存储
      const timestamp = Date.now();
      const filename = `group_${groupId}_${timestamp}.jpg`;
      const avatarUrl = await this.uploadService.uploadFileFromBuffer(
        compositeBuffer,
        filename,
        'image/jpeg',
        'group-avatars',
      );

      // 更新数据库
      await this.chatGroupEntity.update({ id: groupId }, { groupAvatar: avatarUrl });

      Logger.log(`群组 ${groupId} 头像生成成功: ${avatarUrl}`, 'ChatGroupService');
      return avatarUrl;
    } catch (error) {
      Logger.error(`群组 ${groupId} 头像生成失败: ${error.message}`, 'ChatGroupService');
      console.error(error);
      return null; // 降级：返回null，不影响主流程
    }
  }
}
