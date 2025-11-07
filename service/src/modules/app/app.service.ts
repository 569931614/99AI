import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { DataSource, In, IsNull, Like, MoreThan, Not, Repository } from 'typeorm';
import { ChatGroupEntity } from '../chatGroup/chatGroup.entity';
import { GlobalConfigService } from '../globalConfig/globalConfig.service';
import { UserBalanceService } from '../userBalance/userBalance.service';
import { AppEntity } from './app.entity';
import { AppCatsEntity } from './appCats.entity';
import { AppEmotionVoiceEntity } from './appEmotionVoice.entity';
import { AppVoiceEntity } from './appVoice.entity';
import { CollectAppDto } from './dto/collectApp.dto';
import { CreateAppDto } from './dto/createApp.dto';
import { CreateCatsDto } from './dto/createCats.dto';
import { OperateAppDto } from './dto/deleteApp.dto';
import { DeleteCatsDto } from './dto/deleteCats.dto';
import { QuerAppDto } from './dto/queryApp.dto';
import { QuerCatsDto } from './dto/queryCats.dto';
import { UpdateAppDto } from './dto/updateApp.dto';
import { UpdateCatsDto } from './dto/updateCats.dto';
import { RoleEmotionEntity } from './roleEmotion.entity';

import { UserAppsEntity } from './userApps.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(AppCatsEntity)
    private readonly appCatsEntity: Repository<AppCatsEntity>,
    @InjectRepository(AppEntity)
    private readonly appEntity: Repository<AppEntity>,
    @InjectRepository(UserAppsEntity)
    private readonly userAppsEntity: Repository<UserAppsEntity>,
    @InjectRepository(AppVoiceEntity)
    private readonly appVoiceRepo: Repository<AppVoiceEntity>,
    @InjectRepository(AppEmotionVoiceEntity)
    private readonly appEmotionRepo: Repository<AppEmotionVoiceEntity>,
    @InjectRepository(RoleEmotionEntity)
    private readonly emotionRepo: Repository<RoleEmotionEntity>,
    @InjectRepository(ChatGroupEntity)
    private readonly chatGroupEntity: Repository<ChatGroupEntity>,
    private readonly userBalanceService: UserBalanceService,
    private readonly globalConfigService: GlobalConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async createAppCat(body: CreateCatsDto) {
    const { name } = body;
    const c = await this.appCatsEntity.findOne({ where: { name } });
    if (c) {
      throw new HttpException('该分类名称已存在！', HttpStatus.BAD_REQUEST);
    }
    // 设置默认值
    const saveData = {
      ...body,
      status: body.status ?? 1,
      isMember: body.isMember ?? 0,
      hideFromNonMember: body.hideFromNonMember ?? 0,
      order: body.order ?? 100,
    };
    return await this.appCatsEntity.save(saveData);
  }

  async delAppCat(body: DeleteCatsDto) {
    const { id } = body;
    const c = await this.appCatsEntity.findOne({ where: { id } });
    if (!c) {
      throw new HttpException('该分类不存在！', HttpStatus.BAD_REQUEST);
    }
    // 查找所有包含该分类ID的App
    const apps = await this.appEntity.find();
    const appsWithThisCat = apps.filter(app => {
      const catIds = app.catId.split(',');
      return catIds.includes(id.toString());
    });

    if (appsWithThisCat.length > 0) {
      throw new HttpException('该分类下存在App，不可删除！', HttpStatus.BAD_REQUEST);
    }
    const res = await this.appCatsEntity.delete(id);
    if (res.affected > 0) return '删除成功';
    throw new HttpException('删除失败！', HttpStatus.BAD_REQUEST);
  }

  async updateAppCats(body: UpdateCatsDto) {
    const { id, name } = body;
    const c = await this.appCatsEntity.findOne({
      where: { name, id: Not(id) },
    });
    if (c) {
      throw new HttpException('该分类名称已存在！', HttpStatus.BAD_REQUEST);
    }
    const res = await this.appCatsEntity.update({ id }, body);
    if (res.affected > 0) return '修改成功';
    throw new HttpException('修改失败！', HttpStatus.BAD_REQUEST);
  }

  async queryOneCat(params, req?: Request) {
    const { id } = params;
    if (!id) {
      throw new HttpException('缺失必要参数！', HttpStatus.BAD_REQUEST);
    }
    const app = await this.appEntity.findOne({ where: { id } });
    if (!app) {
      throw new HttpException('角色不存在！', HttpStatus.BAD_REQUEST);
    }

    const appData = app as any;
    // 关联默认音色（如果存在）
    let voiceId: string | null = null;
    try {
      const v = await this.appVoiceRepo.findOne({ where: { appId: Number(id), isDefault: 1 } });
      voiceId = v?.voiceId || null;
    } catch (_) {}

    // 关联情绪音色（如果存在）
    let emotionVoices: any[] = [];
    try {
      const emotions = await this.appEmotionRepo.find({ where: { appId: Number(id) } });
      // 查询全局情绪表获取情绪ID
      const globalEmotions = await this.emotionRepo.find();
      const emotionMap = new Map(globalEmotions.map(e => [e.emotion, e.id]));

      emotionVoices = emotions
        .filter(e => e.voiceId) // 只返回有音色的情绪
        .map(e => ({
          emotionId: emotionMap.get(e.emotion),
          emotion: e.emotion,
          voiceId: e.voiceId,
        }));
    } catch (_) {}

    return {
      id: appData.id,
      demoData: appData.demoData ? appData.demoData.split('\n') : [],
      coverImg: appData.coverImg,
      des: appData.des,
      preset: appData.preset,
      name: appData.name,
      isGPTs: appData.isGPTs,
      isFlowith: appData.isFlowith,
      flowithId: appData.flowithId,
      flowithName: appData.flowithName,

      isFixedModel: appData.isFixedModel,
      appModel: appData.appModel,
      backgroundImg: appData.backgroundImg,
      prompt: appData.prompt,

      openingRemark: appData.openingRemark,
      voiceId,
      emotionVoices,
      userId: appData.userId,
      gender: appData.gender,
      enableRealTime: appData.enableRealTime,
      enableLongTermMemory: appData.enableLongTermMemory,
    };
  }

  async appCatsList(query: QuerCatsDto, req?: Request) {
    const { page = 1, size = 10, name, status } = query;
    const pageNum = Math.max(1, Number(page) || 1);
    const sizeNum = Math.max(1, Number(size) || 10);
    const where: any = {};
    if (typeof name === 'string' && name.length > 0) where.name = Like(`%${name}%`);
    if ([0, 1, '0', '1'].includes(status as any)) where.status = Number(status);

    const [rows, count] = await this.appCatsEntity.findAndCount({
      where,
      order: { order: 'DESC' },
      skip: (pageNum - 1) * sizeNum,
      take: sizeNum,
    });

    // 如果是超级管理员，跳过过滤逻辑
    let filteredRows = [...rows];
    if (req?.user?.role !== 'super') {
      // 获取用户的分类ID列表（未登录/无 userId 时按空集合处理）
      const userId = Number(req?.user?.id || 0);
      const userCatIds = userId ? await this.userBalanceService.getUserApps(userId) : [];
      const userCatIdsSet = new Set(userCatIds);

      // 过滤分类：如果分类ID在用户的分类ID列表中则保留，否则检查是否需要隐藏
      filteredRows = rows.filter(cat => {
        // 如果分类ID在用户的分类ID列表中，保留它
        if (userCatIdsSet.has(cat.id.toString())) {
          return true;
        }
        // 只过滤掉设置了hideFromNonMember的分类，不考虑isMember属性
        return cat.hideFromNonMember !== 1;
      });
    }

    // 查出所有分类下对应的App数量
    const catIds = filteredRows.map(item => item.id);
    const apps = await this.appEntity.find();
    const appCountMap = {};

    // 初始化每个分类的App计数为0
    catIds.forEach(id => {
      appCountMap[id] = 0;
    });

    // 统计每个分类下的App数量
    apps.forEach(item => {
      const appCatIds = item.catId.split(',');
      appCatIds.forEach(catId => {
        const catIdNum = Number(catId);
        if (catIds.includes(catIdNum)) {
          appCountMap[catIdNum] = (appCountMap[catIdNum] || 0) + 1;
        }
      });
    });

    filteredRows.forEach((item: any) => (item.appCount = appCountMap[item.id] || 0));

    return { rows: filteredRows, count: filteredRows.length };
  }

  async appList(req: Request, query: QuerAppDto, orderKey = 'id') {
    const { page = 1, size = 10, name, status, catId, role, userId, excludeIds, onlyOwn } = query;
    const pageNum = Math.max(1, Number(page) || 1);
    const sizeNum = Math.max(1, Number(size) || 10);

    // 正确解析 excludeAdded 参数（处理字符串 "false"）
    let excludeAdded: any = query.excludeAdded;
    if (excludeAdded === undefined || excludeAdded === null) {
      excludeAdded = true; // 默认值
    } else if (typeof excludeAdded === 'string') {
      excludeAdded = excludeAdded.toLowerCase() !== 'false'; // 字符串 "false" 转为 false，其他转为 true
    } else {
      excludeAdded = Boolean(excludeAdded); // 其他类型转为布尔值
    }

    // 构建基础查询条件数组（支持OR查询）
    let baseWhere: any[] = [];

    // 如果传入了 onlyOwn=true，则只返回该 userId 创建的角色
    if (onlyOwn && userId) {
      baseWhere = [{ userId: Number(userId) }];
    }
    // 如果传入了 userId 但 onlyOwn 不为 true，限制只查询系统角色或该用户创建的角色
    else if (userId) {
      baseWhere = [
        { userId: IsNull() }, // 系统角色
        { userId: Number(userId) }, // 用户自己创建的角色
      ];
    } else {
      // 如果没有传入 userId，只返回官方角色（系统角色）
      baseWhere = [{ userId: IsNull() }];
    }

    let addedAppIds: number[] = [];
    let excludeAppIds: number[] = [];
    let filteredByCategory: number[] = null;

    // 如果传入了 excludeIds，解析为数组
    if (excludeIds && typeof excludeIds === 'string') {
      excludeAppIds = excludeIds
        .split(',')
        .map(id => Number(id.trim()))
        .filter(id => !isNaN(id) && id > 0);
    }

    // 如果传入了 userId 且 excludeAdded=true，查询该用户已添加的角色ID列表（用于排除）
    // 但如果 onlyOwn=true，则不过滤聊天列表中的角色，因为用户想看到所有自己创建的角色
    if (userId && !onlyOwn && excludeAdded !== false) {
      const userGroups = await this.chatGroupEntity.find({
        where: {
          userId: Number(userId),
          isDelete: false,
          isGroupChat: false, // 只查询单聊会话组
        },
        select: ['appId'],
      });
      addedAppIds = userGroups.map(g => g.appId).filter(id => id != null && id > 0);
    }

    // 合并需要排除的ID列表
    const allExcludeIds = [...new Set([...addedAppIds, ...excludeAppIds])];

    // 如果指定了分类ID，则查找包含该分类ID的App
    if (catId) {
      const apps = await this.appEntity.find();
      filteredByCategory = apps
        .filter(app => {
          const appCatIds = app.catId ? app.catId.split(',') : [];
          return appCatIds.includes(String(catId));
        })
        .map(app => app.id);

      if (filteredByCategory.length === 0) {
        return { rows: [], count: 0 };
      }
    }

    // 为每个基础条件添加额外的过滤条件
    baseWhere = baseWhere.map(condition => {
      const newCondition = { ...condition };

      // 添加名称过滤
      if (typeof name === 'string' && name.length > 0) {
        newCondition.name = Like(`%${name}%`);
      }

      // 添加角色类型过滤
      if (role) {
        newCondition.role = role;
      }

      // 添加状态过滤
      if ([0, 1, '0', '1', '4', 4].includes(status as any)) {
        newCondition.status = Number(status);
      }

      // 处理ID过滤（分类、排除等）
      if (filteredByCategory !== null && allExcludeIds.length > 0) {
        const finalIds = filteredByCategory.filter(id => !allExcludeIds.includes(id));
        if (finalIds.length > 0) {
          newCondition.id = In(finalIds);
        }
      } else if (filteredByCategory !== null) {
        newCondition.id = In(filteredByCategory);
      } else if (allExcludeIds.length > 0) {
        newCondition.id = Not(In(allExcludeIds));
      }

      return newCondition;
    });

    const [rows, count] = await this.appEntity.findAndCount({
      where: baseWhere,
      order: { [orderKey]: 'DESC' },
      skip: (pageNum - 1) * sizeNum,
      take: sizeNum,
    });

    // 获取所有分类信息
    const allCats = await this.appCatsEntity.find();
    const catsMap = {};
    allCats.forEach(cat => {
      catsMap[cat.id] = cat;
    });

    // 为每个App添加分类名称
    rows.forEach((item: any) => {
      const catIds = item.catId.split(',');
      const catNames = catIds
        .map(id => {
          const cat = catsMap[Number(id)];
          return cat ? cat.name : '';
        })
        .filter(name => name);

      item.catName = catNames.join(', ');
      item.backgroundImg = item.backgroundImg;
      item.prompt = item.prompt;
    });

    // 关联默认音色（通过关联表）
    try {
      const appIds = rows.map(r => r.id);
      if (appIds.length > 0) {
        const maps = await this.appVoiceRepo.find({ where: { appId: In(appIds), isDefault: 1 } });
        const mapByApp = new Map(maps.map(m => [m.appId, m.voiceId]));
        // 显式设置为可枚举，避免序列化时被忽略
        rows.forEach((item: any) => {
          const v = mapByApp.get(item.id) ?? null;
          try {
            Object.defineProperty(item, 'voiceId', {
              value: v,
              enumerable: true,
              configurable: true,
              writable: true,
            });
          } catch (_) {
            (item as any).voiceId = v;
          }
        });
      }
    } catch (e) {
      // 忽略关联失败，避免影响列表返回
    }

    if (req?.user?.role !== 'super') {
      rows.forEach((item: any) => {
        delete item.preset;
      });
    }
    return { rows, count };
  }

  async frontAppList(req: Request, query: QuerAppDto, orderKey = 'id') {
    const { page = 1, size = 1000, catId } = query;
    const where: any = [
      {
        status: In([1, 4]),
        userId: IsNull(),
        public: false,
      },
      { userId: MoreThan(0), public: true },
    ];

    const userCatIds = await this.userBalanceService.getUserApps(Number(req.user.id));
    const userCatIdsSet = new Set(userCatIds);

    // 如果指定了分类ID，则过滤包含该分类ID的App
    if (catId) {
      const apps = await this.appEntity.find();
      const filteredByCategory = apps
        .filter(app => {
          const appCatIds = app.catId.split(',');
          return appCatIds.includes(catId.toString());
        })
        .map(app => app.id);

      if (filteredByCategory.length === 0) {
        return { rows: [], count: 0 };
      }

      // 修改查询条件，只查询包含指定分类ID的App
      where[0].id = In(filteredByCategory);
      where[1].id = In(filteredByCategory);
    }

    const [rows, count] = await this.appEntity.findAndCount({
      where,
      order: { order: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });

    // 获取所有分类信息
    const allCats = await this.appCatsEntity.find();
    const catsMap = {};
    allCats.forEach(cat => {
      catsMap[cat.id] = cat;
    });

    // 如果是超级管理员，跳过过滤逻辑
    let filteredRows = [...rows];
    if (req?.user?.role !== 'super') {
      // 过滤应用：如果应用的分类ID在用户的 userCatIds 中则保留，否则检查是否需要隐藏
      filteredRows = rows.filter(app => {
        // 获取应用所属的所有分类
        const appCatIds = app.catId.split(',').map(id => Number(id));

        // 检查应用是否属于用户拥有的任何分类
        for (const catId of appCatIds) {
          if (userCatIdsSet.has(catId.toString())) {
            return true;
          }
        }

        // 检查应用的分类是否有会员专属且对非会员隐藏的
        for (const catId of appCatIds) {
          const cat = catsMap[catId];
          if (cat && cat.isMember === 1 && cat.hideFromNonMember === 1) {
            return false; // 过滤掉这个应用
          }
        }
        return true; // 保留这个应用
      });
    }

    // 为每个App添加分类名称
    filteredRows.forEach((item: any) => {
      const appCatIds = item.catId.split(',');
      const catNames = appCatIds
        .map(id => {
          const cat = catsMap[Number(id)];
          return cat ? cat.name : '';
        })
        .filter(name => name);

      item.catName = catNames.join(',');
      item.backgroundImg = item.backgroundImg;
    });

    // 只有非超级管理员需要删除 preset
    if (req?.user?.role !== 'super') {
      filteredRows.forEach((item: any) => {
        delete item.preset;
      });
    }

    return { rows: filteredRows, count: filteredRows.length };
  }

  async searchAppList(body: any) {
    const { page = 1, size = 1000, keyword, catId, userId, role } = body;

    // 基础查询条件
    let baseWhere: any = [
      {
        status: In([1, 4]),
        userId: IsNull(),
        public: false,
      },
      { userId: MoreThan(0), public: true },
    ];

    // 如果存在关键字，修改查询条件以搜索 name
    if (keyword) {
      baseWhere = baseWhere.map(condition => ({
        ...condition,
        name: Like(`%${keyword}%`),
      }));
    }

    // 如果指定了分类ID，则过滤包含该分类ID的App
    if (catId && !isNaN(Number(catId))) {
      const apps = await this.appEntity.find();
      const filteredByCategory = apps
        .filter(app => {
          const appCatIds = app.catId.split(',');
          return appCatIds.includes(catId.toString());
        })
        .map(app => app.id);

      if (filteredByCategory.length === 0) {
        return { rows: [], count: 0 };
      }

      baseWhere = baseWhere.map(condition => ({
        ...condition,
        id: In(filteredByCategory),
      }));
    }

    try {
      // 确保 userId 是有效数字
      const userIdNum = isNaN(Number(userId)) ? 0 : Number(userId);

      // 获取用户的分类ID列表
      const userCatIds = await this.userBalanceService.getUserApps(userIdNum);
      const userCatIdsSet = new Set(userCatIds);

      const [rows, count] = await this.appEntity.findAndCount({
        where: baseWhere,
        skip: (page - 1) * size,
        take: size,
      });

      // 获取所有分类信息
      const allCats = await this.appCatsEntity.find();
      const catsMap = {};
      allCats.forEach(cat => {
        catsMap[cat.id] = cat;
      });

      // 如果是超级管理员，跳过过滤逻辑
      let filteredRows = [...rows];
      if (role !== 'super') {
        // 过滤应用：如果应用的分类在用户的分类ID列表中则保留，否则检查是否需要隐藏
        filteredRows = rows.filter(app => {
          // 获取应用所属的所有分类
          const appCatIds = app.catId.split(',').map(id => Number(id));

          // 检查应用是否属于用户拥有的任何分类
          for (const catId of appCatIds) {
            if (userCatIdsSet.has(catId.toString())) {
              return true; // 保留这个应用
            }
          }

          // 检查应用的分类是否有会员专属且对非会员隐藏的
          for (const catId of appCatIds) {
            const cat = catsMap[catId];
            if (cat && cat.isMember === 1 && cat.hideFromNonMember === 1) {
              return false; // 过滤掉这个应用
            }
          }
          return true; // 保留这个应用
        });
      }

      // 为每个App添加分类名称
      filteredRows.forEach((item: any) => {
        const appCatIds = item.catId.split(',');
        const catNames = appCatIds
          .map(id => {
            const cat = catsMap[Number(id)];
            return cat ? cat.name : '';
          })
          .filter(name => name);

        item.catName = catNames.join(', ');
        item.backgroundImg = item.backgroundImg;
        item.prompt = item.prompt;
        // 只有非超级管理员需要删除 preset
        if (role !== 'super') {
          delete item.preset;
        }
      });

      return { rows: filteredRows, count: filteredRows.length };
    } catch (error) {
      throw new HttpException('查询应用列表失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createApp(body: CreateAppDto) {
    const { name, catId } = body;
    // 只在没有提供 role 时才设置默认值，保留用户传递的 role
    if (!body.role) {
      body.role = 'system';
    }

    // 检查应用名称是否已存在 - 已移除限制，允许重复应用名
    // const a = await this.appEntity.findOne({ where: { name } });
    // if (a) {
    //   throw new HttpException('该角色名称已存在！', HttpStatus.BAD_REQUEST);
    // }

    // 验证所有分类ID是否存在
    if (!catId) {
      throw new HttpException('缺少分类ID！', HttpStatus.BAD_REQUEST);
    }

    const catIds = catId.split(',');
    for (const id of catIds) {
      const numId = Number(id);
      if (isNaN(numId)) {
        throw new HttpException(`分类ID ${id} 不是有效的数字！`, HttpStatus.BAD_REQUEST);
      }

      const c = await this.appCatsEntity.findOne({ where: { id: numId } });
      if (!c) {
        throw new HttpException(`分类ID ${id} 不存在！`, HttpStatus.BAD_REQUEST);
      }
    }

    try {
      // 添加必要的默认字段
      const saveData: any = { ...body };

      // voice 与角色仅通过关联表，不写入 app 表
      if ('voiceId' in saveData) delete saveData.voiceId;
      // 情绪-音色映射使用独立表，不写入 app.emotionVoices
      if ('emotionVoices' in saveData) delete saveData.emotionVoices;

      // 检查ID是否有效，如果无效则删除
      if (!saveData.id || isNaN(Number(saveData.id))) {
        delete saveData.id;
      }

      saveData.public = false;

      // 设置默认值
      saveData.des = saveData.des || '';
      saveData.appModel = saveData.appModel || '';
      saveData.order = isNaN(Number(saveData.order)) ? 100 : saveData.order;
      saveData.status = isNaN(Number(saveData.status)) ? 1 : saveData.status;
      saveData.isGPTs = isNaN(Number(saveData.isGPTs)) ? 0 : saveData.isGPTs;
      saveData.isFlowith = isNaN(Number(saveData.isFlowith)) ? 0 : saveData.isFlowith;
      saveData.flowithId = saveData.flowithId || '';
      saveData.flowithName = saveData.flowithName || '';
      saveData.flowithKey = saveData.flowithKey || '';
      saveData.isFixedModel = isNaN(Number(saveData.isFixedModel)) ? 0 : saveData.isFixedModel;
      saveData.backgroundImg = saveData.backgroundImg || '';
      saveData.prompt = saveData.prompt || '';

      // 保存应用
      const saved = await this.appEntity.save(saveData);

      // 处理角色音色关联（默认一对一，可扩展多音色）
      try {
        const delRes = await this.appVoiceRepo.delete({ appId: saved.id });
        Logger.log(
          `[AppService] 删除旧音色映射 appId=${saved.id} affected=${delRes.affected ?? 0}`,
        );
        const voiceId = (body as any)?.voiceId;
        if (voiceId) {
          await this.appVoiceRepo.save({
            appId: saved.id,
            voiceId: String(voiceId),
            isDefault: 1,
          } as any);
          Logger.log(`[AppService] 写入默认音色成功 appId=${saved.id} voiceId=${voiceId}`);
        } else {
          Logger.log(`[AppService] 未提供 voiceId, 跳过写入 app_voice appId=${saved.id}`);
        }
      } catch (e) {
        Logger.warn(
          `[AppService] 写入/删除 app_voice 失败 appId=${saved.id} err=${e?.message || e}`,
        );
      }

      // 内联保存情绪-音色映射（若提供 emotionVoices）
      try {
        const items = Array.isArray((body as any)?.emotionVoices)
          ? (body as any).emotionVoices
          : [];
        if (items.length) {
          const all = await this.emotionRepo.find();
          const idToName = new Map(all.map(e => [e.id, e.emotion]));
          const cleaned = items
            .map((i: any) => {
              const emotionId = Number(i?.emotionId || 0);
              const emotionFromId = idToName.get(emotionId);
              const emotionName = emotionFromId || String(i?.emotion || '').trim();
              return { emotion: emotionName, voiceId: String(i?.voiceId || '') };
            })
            .filter((i: any) => i.emotion && i.voiceId); // 仅保存情绪ID与非空音色ID
          Logger.log(
            `[AppService] 准备覆盖 emotionVoices appId=${saved.id} incoming=${items.length} cleaned=${cleaned.length}`,
          );
          await this.appEmotionRepo.delete({ appId: saved.id });
          if (cleaned.length) {
            const now = new Date();
            await this.appEmotionRepo.save(
              cleaned.map((i: any) => ({
                appId: saved.id,
                emotion: i.emotion,
                voiceId: i.voiceId,
                status: 1,
                createdAt: now,
                updatedAt: now,
              })) as any,
            );
          }
          Logger.log(`[AppService] 已保存 emotionVoices 条目=${cleaned.length} appId=${saved.id}`);
        }
      } catch (e) {
        Logger.warn(
          `[AppService] 保存 emotionVoices 失败 appId=${saved.id} err=${e?.message || e}`,
        );
      }

      return saved;
    } catch (error) {
      Logger.error(`[AppService] 保存应用失败: ${error?.message || error}`, error?.stack);
      throw new HttpException(
        `保存应用失败: ${error?.message || '未知错误'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async updateApp(body: UpdateAppDto) {
    const { id, name, catId, status } = body;

    // 验证ID是否有效
    if (id === undefined || id === null || isNaN(Number(id))) {
      throw new HttpException('无效的应用ID！', HttpStatus.BAD_REQUEST);
    }

    // 检查应用名称是否重复 - 已移除限制，允许重复应用名
    // const a = await this.appEntity.findOne({ where: { name, id: Not(id) } });
    // if (a) {
    //   throw new HttpException('该应用名称已存在！', HttpStatus.BAD_REQUEST);
    // }

    // 验证所有分类ID是否存在（仅在传递了 catId 时校验）
    if (typeof (catId as any) === 'string' && String(catId).trim().length > 0) {
      const catIds = String(catId).split(',');
      for (const id of catIds) {
        const c = await this.appCatsEntity.findOne({ where: { id: Number(id) } });
        if (!c) {
          throw new HttpException(`分类ID ${id} 不存在！`, HttpStatus.BAD_REQUEST);
        }
      }
    }

    // 创建更新数据对象
    const updateData = { ...body } as any;
    const curApp = await this.appEntity.findOne({ where: { id } });
    if (!curApp) {
      throw new HttpException('角色不存在！', HttpStatus.BAD_REQUEST);
    }
    const curAppData = curApp as any;

    // 从 body 中取 voiceId，但不直接写入 app 表
    const newVoiceId = (body as any)?.voiceId;
    if ('voiceId' in updateData) delete updateData.voiceId;
    if ('emotionVoices' in updateData) delete updateData.emotionVoices;

    // 设置默认值
    updateData.appModel = updateData.appModel ?? (curAppData.appModel || '');
    updateData.order = isNaN(Number(updateData.order)) ? 100 : updateData.order;
    updateData.status = isNaN(Number(updateData.status)) ? 1 : updateData.status;
    updateData.isGPTs = isNaN(Number(updateData.isGPTs)) ? 0 : updateData.isGPTs;
    updateData.isFlowith = isNaN(Number(updateData.isFlowith)) ? 0 : updateData.isFlowith;
    updateData.flowithId = updateData.flowithId ?? (curAppData.flowithId || '');
    updateData.flowithName = updateData.flowithName ?? (curAppData.flowithName || '');
    updateData.isFixedModel = isNaN(Number(updateData.isFixedModel)) ? 0 : updateData.isFixedModel;
    updateData.backgroundImg = updateData.backgroundImg ?? (curAppData.backgroundImg || '');
    updateData.prompt = updateData.prompt ?? (curAppData.prompt || '');

    if (curAppData.status !== updateData.status) {
      await this.userAppsEntity.update({ appId: id }, { status: updateData.status });
    }
    const res = await this.appEntity.update({ id }, updateData);
    if ((res.affected ?? 0) >= 0) {
      // 同步角色音色关联（仅当提供了 voiceId 且不为空时才更新）
      if (
        typeof newVoiceId !== 'undefined' &&
        newVoiceId !== null &&
        String(newVoiceId).trim() !== ''
      ) {
        try {
          const delRes2 = await this.appVoiceRepo.delete({ appId: id });
          Logger.log(`[AppService] 更新时删除旧映射 appId=${id} affected=${delRes2.affected ?? 0}`);
          await this.appVoiceRepo.save({
            appId: id,
            voiceId: String(newVoiceId),
            isDefault: 1,
          } as any);
          Logger.log(`[AppService] 更新写入默认音色成功 appId=${id} voiceId=${String(newVoiceId)}`);
        } catch (e) {
          Logger.warn(
            `[AppService] 更新写入/删除 app_voice 失败 appId=${id} err=${e?.message || e}`,
          );
        }
      }
      // 内联覆盖保存情绪-音色映射（若提供 emotionVoices）
      try {
        if (Array.isArray((body as any)?.emotionVoices)) {
          const items = (body as any).emotionVoices as Array<{
            emotion?: string;
            emotionId?: number;
            voiceId?: string;
          }>;
          const all = await this.emotionRepo.find();
          const idToName = new Map(all.map(e => [e.id, e.emotion]));
          const cleaned = items
            .map(i => {
              const emotionId = Number((i as any)?.emotionId || 0);
              const emotionFromId = idToName.get(emotionId);
              const emotionName = emotionFromId || String((i as any)?.emotion || '').trim();
              return { emotion: emotionName, voiceId: String((i as any)?.voiceId || '') };
            })
            .filter(i => i.emotion && i.voiceId); // 仅保存情绪ID与非空音色ID
          Logger.log(
            `[AppService] 准备覆盖 emotionVoices appId=${id} incoming=${items.length} cleaned=${cleaned.length}`,
          );
          await this.appEmotionRepo.delete({ appId: id });
          if (cleaned.length) {
            const now = new Date();
            await this.appEmotionRepo.save(
              cleaned.map(i => ({
                appId: id,
                emotion: i.emotion,
                voiceId: i.voiceId,
                status: 1,
                createdAt: now,
                updatedAt: now,
              })) as any,
            );
          }
          Logger.log(`[AppService] 更新 emotionVoices 条目=${cleaned.length} appId=${id}`);
        }
      } catch (e) {
        Logger.error(
          `[AppService] 更新 emotionVoices 失败 appId=${id} err=${e?.message || e}`,
          e?.stack || '',
        );
      }

      return '修改角色信息成功';
    }
    throw new HttpException('修改角色信息失败！', HttpStatus.BAD_REQUEST);
  }

  async delApp(body: OperateAppDto) {
    const { id } = body;
    const a = await this.appEntity.findOne({ where: { id } });
    if (!a) {
      throw new HttpException('该角色不存在！', HttpStatus.BAD_REQUEST);
    }
    const res = await this.appEntity.delete(id);
    if (res.affected > 0) return '删除角色成功';
    throw new HttpException('删除角色失败！', HttpStatus.BAD_REQUEST);
  }

  async collect(body: CollectAppDto, req: Request) {
    const { appId } = body;
    const { id: userId } = req.user;

    // 验证参数
    if (appId === undefined || appId === null || isNaN(Number(appId))) {
      throw new HttpException('无效的应用ID！', HttpStatus.BAD_REQUEST);
    }

    if (userId === undefined || userId === null || isNaN(Number(userId))) {
      throw new HttpException('无效的用户ID！', HttpStatus.BAD_REQUEST);
    }

    const historyApp = await this.userAppsEntity.findOne({
      where: { appId, userId },
    });
    if (historyApp) {
      const r = await this.userAppsEntity.delete({ appId, userId });
      if (r.affected > 0) {
        return '取消收藏成功!';
      } else {
        throw new HttpException('取消收藏失败！', HttpStatus.BAD_REQUEST);
      }
    }

    const app = await this.appEntity.findOne({ where: { id: appId } });
    if (!app) {
      throw new HttpException('角色不存在！', HttpStatus.BAD_REQUEST);
    }

    const { id, role: appRole, catId } = app;
    const collectInfo = {
      userId,
      appId: id,
      catId,
      appRole,
      public: true,
      status: 1,
    };
    await this.userAppsEntity.save(collectInfo);
    return '已将角色加入到我的收藏！';
  }

  async mineApps(req: Request, query = { page: 1, size: 30 }) {
    const { id } = req.user;
    const { page = 1, size = 30 } = query;
    let filteredRows = [];

    try {
      // 获取用户的分类ID列表
      const userCatIds = await this.userBalanceService.getUserApps(Number(id));
      const userCatIdsSet = new Set(userCatIds);

      const [rows, count] = await this.userAppsEntity.findAndCount({
        where: { userId: id, status: In([1, 3, 4, 5]) },
        order: { id: 'DESC' },
        skip: (page - 1) * size,
        take: size,
      });

      const appIds = rows.map(item => item.appId);
      const appsInfo = await this.appEntity.find({ where: { id: In(appIds) } });

      // 获取所有分类信息
      const allCats = await this.appCatsEntity.find();
      const catsMap = {};
      allCats.forEach(cat => {
        catsMap[cat.id] = cat;
      });

      // 如果是超级管理员，跳过过滤逻辑
      filteredRows = [...rows];
      if (req?.user?.role !== 'super') {
        filteredRows = rows.filter(item => {
          const app = appsInfo.find(c => c.id === item.appId);
          if (!app) return false;

          // 获取应用所属的所有分类
          const appCatIds = app.catId.split(',').map(id => Number(id));

          // 检查应用是否属于用户拥有的任何分类
          for (const catId of appCatIds) {
            if (userCatIdsSet.has(catId.toString())) {
              return true;
            }
          }

          // 检查应用的分类是否有会员专属且对非会员隐藏的
          for (const catId of appCatIds) {
            const cat = catsMap[catId];
            if (cat && cat.isMember === 1 && cat.hideFromNonMember === 1) {
              return false; // 过滤掉这个应用
            }
          }
          return true; // 保留这个应用
        });
      }

      // 为每个应用添加详细信息
      filteredRows.forEach((item: any) => {
        const app = appsInfo.find(c => c.id === item.appId);
        if (!app) return;

        item.appName = app.name || '';
        item.appRole = app.role || '';
        item.appDes = app.des || '';
        item.coverImg = app.coverImg || '';
        item.demoData = app.demoData || '';
        item.backgroundImg = app.backgroundImg || '';

        // 添加分类名称
        const appCatIds = app.catId.split(',');
        const catNames = appCatIds
          .map(id => {
            const cat = catsMap[Number(id)];
            return cat ? cat.name : '';
          })
          .filter(name => name);
        item.catName = catNames.join(',');

        // 处理 preset 字段
        item.preset = app.userId === id ? app.preset : '******';
        item.prompt = app.prompt || '';
      });
    } catch (error) {
      throw new HttpException('获取用户应用列表失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return { rows: filteredRows, count: filteredRows.length };
  }

  /**
   * 检查应用是否是会员专属
   * @param appId 应用ID
   * @returns 返回应用是否是会员专属的布尔值
   */
  async checkAppIsMemberOnly(appId: number): Promise<boolean> {
    try {
      // 查询应用信息
      const appInfo = await this.appEntity.findOne({
        where: { id: appId },
        select: ['catId'],
      });

      if (!appInfo || !appInfo.catId) {
        return false;
      }

      // 解析分类ID列表
      const catIds = appInfo.catId
        .split(',')
        .map(id => Number(id.trim()))
        .filter(id => id > 0);

      if (catIds.length === 0) {
        return false;
      }

      // 查询这些分类是否有会员专属的
      const cats = await this.appCatsEntity.find({
        where: { id: In(catIds) },
        select: ['id', 'isMember'],
      });

      // 检查是否有任何一个分类是会员专属的
      return cats.some(cat => cat.isMember === 1);
    } catch (error) {
      return false; // 出错时默认返回非会员专属
    }
  }

  // 全局：统一角色情绪配置（应用到所有角色）
  async getGlobalRoleEmotions() {
    try {
      const list = await this.emotionRepo.find({ order: { id: 'ASC' } });
      const emotions = list.map(i => ({ id: i.id, emotion: i.emotion, voiceId: i.voiceId || '' }));
      Logger.log(`[GlobalEmotions][GET] count=${emotions.length}`, AppService.name);
      return { emotions };
    } catch (e) {
      Logger.error(`[GlobalEmotions][GET][Error] ${e?.message || e}`, AppService.name);
      return { emotions: [] };
    }
  }

  async setGlobalRoleEmotions(body: { emotions: Array<{ emotion: string; voiceId?: string }> }) {
    const arr = Array.isArray(body?.emotions) ? body.emotions : [];
    const seen = new Set<string>();
    const cleaned = arr
      .map(i => ({
        emotion: String(i?.emotion || '').trim(),
        voiceId: i?.voiceId ? String(i.voiceId) : '',
      }))
      .filter(i => i.emotion)
      .filter(i => (seen.has(i.emotion) ? false : (seen.add(i.emotion), true)));

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.manager.createQueryBuilder().delete().from(RoleEmotionEntity).execute();
      if (cleaned.length) {
        const now = new Date();
        await qr.manager
          .createQueryBuilder()
          .insert()
          .into(RoleEmotionEntity)
          .values(
            cleaned.map(i => ({
              emotion: i.emotion,
              voiceId: i.voiceId || '',
              status: 1,
              createdAt: now,
              updatedAt: now,
            })),
          )
          .execute();
      }
      await qr.commitTransaction();
      const cnt = await this.emotionRepo.count();
      Logger.log(
        `[GlobalEmotions][SET][TX] incoming=${arr.length} saved=${cleaned.length} tableCount=${cnt}`,
        AppService.name,
      );
      return { success: true };
    } catch (e) {
      await qr.rollbackTransaction();
      Logger.error(`[GlobalEmotions][SET][TX][Error] ${e?.message || e}`, AppService.name);
      throw new HttpException('保存失败', HttpStatus.INTERNAL_SERVER_ERROR);
    } finally {
      await qr.release();
    }
  }

  // 每个角色的：情绪-音色映射，使用独立表 app_emotion_voices
  async getAppEmotionVoices(appId: number) {
    const id = Number(appId) || 0;
    if (!id) return { items: [] };
    try {
      const list = await this.appEmotionRepo.find({ where: { appId: id }, order: { id: 'ASC' } });
      const all = await this.emotionRepo.find();
      const nameToId = new Map(all.map(e => [e.emotion, e.id]));
      const items = list.map(i => ({
        emotion: i.emotion,
        emotionId: nameToId.get(i.emotion) || 0,
        voiceId: i.voiceId || '',
      }));
      return { items };
    } catch (e) {
      return { items: [] };
    }
  }

  async setAppEmotionVoices(body: {
    appId: number;
    items: Array<{ emotion: string; voiceId: string }>;
  }) {
    const appIdNum = Number(body?.appId || 0);
    if (!appIdNum) throw new HttpException('appId 必填', HttpStatus.BAD_REQUEST);
    const arr = Array.isArray(body?.items) ? body.items : [];
    // 规范化、去重 emotion
    const seen = new Set<string>();
    const cleaned = arr
      .map(i => ({ emotion: String(i?.emotion || '').trim(), voiceId: String(i?.voiceId || '') }))
      .filter(i => i.emotion)
      .filter(i => (seen.has(i.emotion) ? false : (seen.add(i.emotion), true)));

    // 覆盖式写入：删除旧记录再批量保存
    await this.appEmotionRepo.delete({ appId: appIdNum });
    if (cleaned.length) {
      await this.appEmotionRepo.save(
        cleaned.map(i => ({
          appId: appIdNum,
          emotion: i.emotion,
          voiceId: i.voiceId,
          status: 1,
        })) as any,
      );
    }
    return { success: true };
  }

  /* ========== 用户创建角色相关方法 ========== */

  async userCreateRole(body: CreateAppDto, req: Request) {
    const { name, catId } = body;
    const userId = req.user.id;

    // 检查该用户是否已创建同名角色 - 已移除限制，允许重复应用名
    // const existingRole = await this.appEntity.findOne({
    //   where: { name, userId },
    // });
    // if (existingRole) {
    //   throw new HttpException('您已经创建了同名的角色！', HttpStatus.BAD_REQUEST);
    // }

    // 验证分类ID是否存在
    if (typeof (catId as any) === 'string' && String(catId).trim().length > 0) {
      const catIds = String(catId).split(',');
      for (const id of catIds) {
        const c = await this.appCatsEntity.findOne({ where: { id: Number(id) } });
        if (!c) {
          throw new HttpException(`分类ID ${id} 不存在！`, HttpStatus.BAD_REQUEST);
        }
      }
    }

    const saveData = { ...body } as any;
    saveData.userId = userId;
    saveData.public = false; // 用户角色默认私有
    saveData.role = 'user'; // 标记为用户创建
    saveData.status = 1; // 默认启用

    try {
      const saved = await this.appEntity.save(saveData);
      return { success: true, data: saved };
    } catch (error) {
      throw new HttpException(
        `创建角色失败: ${error?.message || '未知错误'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async userMyRoles(req: Request, query: QuerAppDto) {
    const userId = req.user.id;
    const { page = 1, size = 10, name, status } = query;

    // 构建查询条件：userId为空或等于当前用户ID
    const baseWhere: any[] = [{ userId: IsNull() }, { userId }];

    // 添加额外的过滤条件
    if (name) {
      baseWhere.forEach(condition => {
        condition.name = Like(`%${name}%`);
      });
    }

    if (status !== undefined && status !== null) {
      baseWhere.forEach(condition => {
        condition.status = status;
      });
    }

    try {
      const pageNum = Math.max(1, Number(page) || 1);
      const sizeNum = Math.max(1, Math.min(100, Number(size) || 10));

      const [rows, count] = await this.appEntity.findAndCount({
        where: baseWhere,
        order: { id: 'DESC' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
      });

      return {
        success: true,
        data: {
          rows,
          count,
          page: pageNum,
          size: sizeNum,
        },
      };
    } catch (error) {
      throw new HttpException('查询角色列表失败', HttpStatus.BAD_REQUEST);
    }
  }

  async userUpdateRole(body: UpdateAppDto, req: Request) {
    const { id, name, catId } = body;
    const userId = req.user.id;

    if (!id) {
      throw new HttpException('角色ID不能为空！', HttpStatus.BAD_REQUEST);
    }

    // 验证角色所有权
    const role = await this.appEntity.findOne({ where: { id } });
    if (!role) {
      throw new HttpException('角色不存在！', HttpStatus.NOT_FOUND);
    }
    if (role.userId !== userId) {
      throw new HttpException('无权修改此角色！', HttpStatus.FORBIDDEN);
    }

    // 检查同名（排除自己）- 已移除限制，允许重复应用名
    // if (name) {
    //   const existing = await this.appEntity.findOne({
    //     where: { name, userId, id: Not(id) },
    //   });
    //   if (existing) {
    //     throw new HttpException('您已有同名的角色！', HttpStatus.BAD_REQUEST);
    //   }
    // }

    // 验证分类ID
    if (typeof (catId as any) === 'string' && String(catId).trim().length > 0) {
      const catIds = String(catId).split(',');
      for (const cid of catIds) {
        const c = await this.appCatsEntity.findOne({ where: { id: Number(cid) } });
        if (!c) {
          throw new HttpException(`分类ID ${cid} 不存在！`, HttpStatus.BAD_REQUEST);
        }
      }
    }

    try {
      const updateData = { ...body } as any;
      delete updateData.userId; // 禁止修改userId
      await this.appEntity.update(id, updateData);

      const updated = await this.appEntity.findOne({ where: { id } });
      return { success: true, data: updated };
    } catch (error) {
      throw new HttpException('更新角色失败', HttpStatus.BAD_REQUEST);
    }
  }

  async userDelRole(body: OperateAppDto, req: Request) {
    const { id } = body;
    const userId = req.user.id;

    const role = await this.appEntity.findOne({ where: { id } });
    if (!role) {
      throw new HttpException('角色不存在！', HttpStatus.NOT_FOUND);
    }

    if (role.userId !== userId) {
      throw new HttpException('无权删除此角色！', HttpStatus.FORBIDDEN);
    }

    try {
      await this.appEntity.delete(id);
      return { success: true, message: '删除成功' };
    } catch (error) {
      throw new HttpException('删除角色失败', HttpStatus.BAD_REQUEST);
    }
  }

  async userTogglePublic(body: { id: number }, req: Request) {
    const { id } = body;
    const userId = req.user.id;

    const role = await this.appEntity.findOne({ where: { id } });
    if (!role) {
      throw new HttpException('角色不存在！', HttpStatus.NOT_FOUND);
    }

    if (role.userId !== userId) {
      throw new HttpException('无权修改此角色！', HttpStatus.FORBIDDEN);
    }

    try {
      const newPublic = !role.public;
      await this.appEntity.update(id, { public: newPublic });

      return {
        success: true,
        data: { public: newPublic },
        message: newPublic ? '已设为公开' : '已设为私有',
      };
    } catch (error) {
      throw new HttpException('切换公开状态失败', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * 获取应用的默认音色ID
   * @param appId 应用ID
   * @returns 默认音色ID或null
   */
  async getDefaultVoiceId(appId: number | null): Promise<string | null> {
    if (!appId) return null;

    try {
      const voiceMapping = await this.appVoiceRepo.findOne({
        where: { appId: Number(appId), isDefault: 1 },
      });

      if (voiceMapping?.voiceId) {
        Logger.log(
          `[AppService] 获取到应用默认音色: appId=${appId}, voiceId=${voiceMapping.voiceId}`,
        );
        return voiceMapping.voiceId;
      }
      return null;
    } catch (error: any) {
      Logger.warn(`[AppService] 获取默认音色失败: appId=${appId}, error=${error?.message}`);
      return null;
    }
  }
}
