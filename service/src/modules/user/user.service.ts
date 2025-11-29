import { RechargeType } from '@/common/constants/balance.constant';
import { VerificationEnum } from '@/common/constants/verification.constant';
import {
  createRandomUid,
  decryptApiKey,
  encryptApiKey,
  getClientIp,
  maskApiKey,
  maskEmail,
  maskIpAddress,
} from '@/common/utils';
import { MailerService } from '../mailer/mailer.service';

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Request } from 'express';
import * as _ from 'lodash';
import { Connection, In, Like, Not, Repository, UpdateResult } from 'typeorm';
import { UserRegisterDto } from '../auth/dto/authRegister.dto';
import { ConfigEntity } from '../globalConfig/config.entity';
import { UserBalanceService } from '../userBalance/userBalance.service';
import { UserStatusEnum, UserStatusErrMsg } from './../../common/constants/user.constant';
import { GlobalConfigService } from './../globalConfig/globalConfig.service';
import { VerificationEntity } from './../verification/verification.entity';
import { VerificationService } from './../verification/verification.service';
import { QueryAllUserDto } from './dto/queryAllUser.dto';
import { ResetUserPassDto } from './dto/resetUserPass.dto';
import { UpdateUserDto } from './dto/updateUser.dto';
import { UpdateUserStatusDto } from './dto/updateUserStatus.dto';
import { UserRechargeDto } from './dto/userRecharge.dto';
import { UserEntity } from './user.entity';
import { UserApiConfigEntity } from './userApiConfig.entity';
import OpenAI from 'openai';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,
    @InjectRepository(UserApiConfigEntity)
    private readonly userApiConfigEntity: Repository<UserApiConfigEntity>,
    private readonly connection: Connection,
    private readonly verificationService: VerificationService,
    private readonly mailerService: MailerService,
    private readonly userBalanceService: UserBalanceService,
    private readonly globalConfigService: GlobalConfigService,
    @InjectRepository(ConfigEntity)
    private readonly configEntity: Repository<ConfigEntity>,
  ) {}

  /* create and verify */
  async createUserAndVerifycation(
    user: UserEntity | UserRegisterDto,
    req: Request,
  ): Promise<UserEntity> {
    const { username, email, password, client = 0 } = user;

    /* 用户是否已经在系统中 */
    const where = [{ username }, { email }];
    const u: UserEntity = await this.userEntity.findOne({ where: where });

    if (u && u.status !== UserStatusEnum.PENDING) {
      throw new HttpException('用户名或者邮箱已被注册！', HttpStatus.BAD_REQUEST);
    }

    try {
      const userInput: any = _.cloneDeep(user);
      const hashedPassword = bcrypt.hashSync(password, 10);
      const ip = getClientIp(req);
      userInput.password = hashedPassword;
      userInput.registerIp = ip;
      userInput.client = client;

      let n: UserEntity;
      /* 如果没有注册用户则首次注册记录 如果注册了覆盖发送验证码即可 无需记录用户 */
      if (!u) {
        const userDefaultAvatar = await this.globalConfigService.getConfigs(['userDefaultAvatar']);
        userInput.avatar = userDefaultAvatar;
        n = await this.userEntity.save(userInput);
      } else {
        n = u;
      }
      const emailConfigs = await this.configEntity.find({
        where: {
          configKey: In([
            'isVerifyEmail',
            'registerBaseUrl',
            'registerVerifyEmailTitle',
            'registerVerifyEmailDesc',
            'registerVerifyEmailFrom',
            'registerVerifyExpir',
          ]),
        },
      });

      const configMap: any = emailConfigs.reduce((pre, cur: any) => {
        pre[cur.configKey] = cur.configVal;
        return pre;
      }, {});

      const isVerifyEmail = configMap['isVerifyEmail'] ? Number(configMap['isVerifyEmail']) : 1;
      if (isVerifyEmail) {
        const expir = configMap['registerVerifyExpir']
          ? Number(configMap['registerVerifyExpir'])
          : 30 * 60;
        const v: VerificationEntity = await this.verificationService.createVerification(
          n,
          VerificationEnum.Registration,
          expir,
        );
        const { email } = v;

        console.log('configMap: ', configMap);

        console.log(`尝试发送邮件到: ${email}`); // 在尝试发送邮件之前打印日志
      } else {
        /* 如果没有邮箱验证则 则直接主动注册验证通过逻辑 */
        const { id } = n;
        await this.updateUserStatus(id, UserStatusEnum.ACTIVE);
        await this.userBalanceService.addBalanceToNewUser(id);
      }
      return n;
    } catch (error) {
      console.log('error: ', error);
      throw error;
    }
  }

  async getSuper() {
    const user = await this.userEntity.findOne({ where: { role: 'super' } });
    return user;
  }

  /* 账号登录验证密码 扫码登录则不用 */
  async verifyUserCredentials(user): Promise<UserEntity> {
    const { username, password, uid = 0, phone } = user;
    let u = null;

    /* 三方登录的 */
    if (uid > 0) {
      u = await this.userEntity.findOne({ where: { id: uid } });
      if (!u) {
        throw new HttpException('当前账户不存在！', HttpStatus.BAD_REQUEST);
      }
      if (!bcrypt.compareSync(password, u.password)) {
        throw new HttpException('当前密码错误！', HttpStatus.BAD_REQUEST);
      }
    }

    /* 普通登录 */
    if (username && password) {
      const where: any = [{ username }, { email: username }, { phone: username }];
      u = await this.userEntity.findOne({ where: where });
      if (!u) {
        throw new HttpException('当前账户不存在！', HttpStatus.BAD_REQUEST);
      }
      if (!bcrypt.compareSync(password, u.password)) {
        throw new HttpException('当前密码错误！', HttpStatus.BAD_REQUEST);
      }
    }

    if (!u) {
      throw new HttpException('当前账户不存在！', HttpStatus.BAD_REQUEST);
    }
    if (u.status !== UserStatusEnum.ACTIVE) {
      throw new HttpException(UserStatusErrMsg[u.status], HttpStatus.BAD_REQUEST);
    }

    return u;
  }

  async verifyUserPassword(userId, password) {
    const u = await this.userEntity.findOne({ where: { id: userId } });
    return bcrypt.compareSync(password, u.password);
  }

  async updateUserStatus(id: number, status: UserStatusEnum) {
    const u: UpdateResult = await this.userEntity.update({ id }, { status });
    return u.affected > 0;
  }

  async getUserStatus(id: number): Promise<number> {
    const u: UserEntity = await this.userEntity.findOne({ where: { id } });
    return u.status;
  }

  async queryUserInfoById(id: number): Promise<UserEntity> {
    return await this.userEntity.findOne({ where: { id } });
  }

  async queryOneUserInfo(userId: number): Promise<UserEntity> {
    return await this.userEntity.findOne({ where: { id: userId } });
  }

  /* 检查用户状态 */
  async checkUserStatus(user) {
    const { id: userId, role } = user;
    if (role === 'visitor') return true;
    const u = await this.userEntity.findOne({ where: { id: userId } });
    if (!u) {
      throw new HttpException('当前用户信息失效、请重新登录！', HttpStatus.UNAUTHORIZED);
    }
    if (u.status === UserStatusEnum.BLACKLISTED) {
      throw new HttpException(
        '您的账户已被永久加入黑名单、如有疑问、请联系管理员！',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (u.status === UserStatusEnum.LOCKED) {
      throw new HttpException('您的账户已被封禁、如有疑问、请联系管理员！', HttpStatus.BAD_REQUEST);
    }
  }

  /* 获取用户基础信息 */
  async getUserInfo(userId: number) {
    console.log('getUserInfo', userId.toString());

    // 检查userId是否是游客指纹ID (大于用户表中通常ID范围)
    const isVisitor = userId > 100000000; // 假设正常用户ID不会超过这个范围

    if (isVisitor) {
      Logger.debug(`检测到游客用户访问: ${userId}`, 'UserService-getUserInfo');

      // 为游客创建默认用户信息
      const visitorInfo: any = {
        username: `游客${userId}`,
        avatar: '', // 可以设置一个默认头像URL
        role: 'visitor',
        email: `${userId}@visitor.com`,
        consecutiveDays: 0,
        phone: null,
        realName: null,
        idCard: null,
        nickname: `游客${userId.toString().slice(-6)}`,
        isBindWx: false,
      };

      // 处理游客ID
      const processedId = (userId * 123 + 100000000).toString(36).toUpperCase().slice(-6);
      visitorInfo.id = processedId;
      visitorInfo.originalId = userId; // 游客也保留原始ID（指纹ID对应的数字）

      // 获取游客余额
      let userBalance;
      try {
        userBalance = await this.userBalanceService.queryUserBalance(userId);
      } catch (error) {
        Logger.debug(`游客余额查询失败，使用默认值: ${error.message}`, 'UserService-getUserInfo');
        // 如果查询余额失败，提供默认余额
        userBalance = {
          packageId: null,
          model3Count: 0,
          model4Count: 0,
          drawMjCount: 0,
          memberModel3Count: 0,
          memberModel4Count: 0,
          memberDrawMjCount: 0,
          sumModel3Count: 0,
          sumModel4Count: 0,
          sumDrawMjCount: 0,
        };
      }

      return { userInfo: visitorInfo, userBalance: { ...userBalance } };
    }

    // 原有逻辑：处理正常用户
    const userInfo: any = await this.userEntity.findOne({
      where: { id: userId },
      select: [
        'username',
        'avatar',
        'role',
        'email',
        'openId',
        'consecutiveDays',
        'phone',
        'realName',
        'idCard',
        'nickname',
      ],
    });

    if (!userInfo) {
      throw new HttpException('当前用户信息失效、请重新登录！', HttpStatus.UNAUTHORIZED);
    }

    userInfo.isBindWx = !!userInfo?.openId;
    delete userInfo.openId;

    const userBalance = await this.userBalanceService.queryUserBalance(userId);

    // 对id进行处理
    const processedId = (userId * 123 + 100000000).toString(36).toUpperCase().slice(-6);

    // 将处理后的id放入userInfo对象中，同时保留原始ID
    userInfo.id = processedId;
    userInfo.originalId = userId; // 保留原始数字ID，用于需要真实userId的接口

    return { userInfo, userBalance: { ...userBalance } };
  }

  /* 获取用户信息 */
  async getUserById(id: number) {
    return await this.userEntity.findOne({ where: { id } });
  }

  /* 通过openId获取用户信息 */
  async getUserOpenId(openId: string) {
    return await this.userEntity.findOne({ where: { openId } });
  }

  /* 修改用户信息 */
  async updateInfo(body: UpdateUserDto, req: Request) {
    const { id } = req.user;

    const u = await this.userEntity.findOne({ where: { id } });
    if (!u) {
      throw new HttpException('当前用户不存在！', HttpStatus.BAD_REQUEST);
    }
    if (body.nickname && u.nickname === body.nickname) {
      throw new HttpException('没有变更，无需更改！', HttpStatus.BAD_REQUEST);
    }

    const r = await this.userEntity.update({ id }, body);
    if (r.affected <= 0) {
      throw new HttpException('修改用户信息失败！', HttpStatus.BAD_REQUEST);
    }
    return '修改用户昵称成功！';
  }

  /* 检查用户名是否已存在 */
  async isUsernameTaken(username: string, excludeUserId?: number): Promise<boolean> {
    const where: any = { username };
    if (excludeUserId) {
      where.id = Not(excludeUserId);
    }
    const user = await this.userEntity.findOne({ where });
    return !!user;
  }

  /* 修改用户密码 */
  async updateUserPassword(userId: number, password: string) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const r = await this.userEntity.update({ id: userId }, { password: hashedPassword });
    if (r.affected <= 0) {
      throw new HttpException('修改密码失败、请重新试试吧。', HttpStatus.BAD_REQUEST);
    }
  }

  /* 给用户充值 */
  async userRecharge(body: UserRechargeDto) {
    const { userId, model3Count = 0, model4Count = 0, drawMjCount = 0 } = body;
    await this.userBalanceService.addBalanceToUser(userId, {
      model3Count,
      model4Count,
      drawMjCount,
    });
    const res = await this.userBalanceService.saveRecordRechargeLog({
      userId,
      rechargeType: RechargeType.ADMIN_GIFT,
      model3Count,
      model4Count,
      drawMjCount,
      extent: '',
    });
    return res;
  }

  /* 查询所有用户 */
  async queryAll(query: QueryAllUserDto, req: Request) {
    const { page = 1, size = 10, username, email, status, keyword, phone, nickname } = query;
    let where = {};
    username && Object.assign(where, { username: Like(`%${username}%`) });
    email && Object.assign(where, { email: Like(`%${email}%`) });
    phone && Object.assign(where, { phone: Like(`%${phone}%`) });
    nickname && Object.assign(where, { nickname: Like(`%${nickname}%`) });
    status && Object.assign(where, { status });
    if (keyword) {
      where = [
        { username: Like(`%${keyword}%`) },
        { email: Like(`%${keyword}%`) },
        { phone: Like(`%${keyword}%`) },
        { nickname: Like(`%${keyword}%`) },
      ];
    }
    const [rows, count] = await this.userEntity.findAndCount({
      skip: (page - 1) * size,
      where,
      take: size,
      order: { createdAt: 'DESC' },
      cache: true,
      select: [
        'username',
        'avatar',
        'role',
        'sign',
        'status',
        'id',
        'email',
        'createdAt',
        'lastLoginIp',
        'phone',
        'realName',
        'idCard',
        'nickname',
      ],
    });
    const ids = rows.map(t => t.id);
    const data = await this.userBalanceService.queryUserBalanceByIds(ids);
    rows.forEach((user: any) => (user.balanceInfo = data.find(t => t.userId === user.id)));
    req.user.role !== 'super' && rows.forEach(t => (t.email = maskEmail(t.email)));
    req.user.role !== 'super' && rows.forEach(t => (t.lastLoginIp = maskIpAddress(t.lastLoginIp)));
    req.user.role !== 'super' && rows.forEach(t => (t.phone = maskIpAddress(t.phone)));
    return { rows, count };
  }

  /* 查询单个用户详情 */
  // async queryOne({ id }) {
  //   return await this.userEntity.findOne({
  //     where: { id },
  //     select: ['username', 'avatar', 'role', 'sign', 'status'],
  //   });
  // }

  /* 修改用户状态 */
  async updateStatus(body: UpdateUserStatusDto) {
    const { id, status } = body;
    const n = await this.userEntity.findOne({ where: { id } });
    if (!n) {
      throw new HttpException('用户不存在！', HttpStatus.BAD_REQUEST);
    }
    if (n.role === 'super') {
      throw new HttpException('超级管理员不可被操作！', HttpStatus.BAD_REQUEST);
    }
    // if (n.status === UserStatusEnum.PENDING) {
    //   throw new HttpException('未激活用户不可手动变更状态！', HttpStatus.BAD_REQUEST);
    // }
    if (n.role === 'super') {
      throw new HttpException('超级管理员不可被操作！', HttpStatus.BAD_REQUEST);
    }
    // if (status === UserStatusEnum.PENDING) {
    //   throw new HttpException('不可将用户置为未激活状态！', HttpStatus.BAD_REQUEST);
    // }
    const r = await this.userEntity.update({ id }, { status });
    if (r.affected <= 0) {
      throw new HttpException('修改用户状态失败！', HttpStatus.BAD_REQUEST);
    }
    return '修改用户状态成功！';
  }

  /* 重置用户密码 */
  async resetUserPass(body: ResetUserPassDto) {
    const { id } = body;
    const u = await this.userEntity.findOne({ where: { id } });
    if (!u) {
      throw new HttpException('用户不存在！', HttpStatus.BAD_REQUEST);
    }
    const defaultPassword = '123456';
    const hashPassword = bcrypt.hashSync(defaultPassword, 10);
    const raw = await this.userEntity.update({ id }, { password: hashPassword });
    if (raw.affected <= 0) {
      throw new HttpException('重置密码失败！', HttpStatus.BAD_REQUEST);
    }
    return `密码重置为[${defaultPassword}]成功!`;
  }

  /* 记录登录ip */
  async savaLoginIp(userId: number, ip: string) {
    return await this.userEntity.update({ id: userId }, { lastLoginIp: ip });
  }

  /* 通过openId 拿到或创建 */
  async getUserFromOpenId(openId: string, sceneStr?: string) {
    const user = await this.userEntity.findOne({ where: { openId } });
    if (!user) {
      const user = await this.createUserFromOpenId(openId);
      await this.userBalanceService.addBalanceToNewUser(user.id);
      return user;
    }
    return user;
  }

  async updateUserInfo(id: number, userInfo: any) {
    const user = await this.userEntity.findOne({ where: { id } });
    if (!user) {
      return;
    }
    const { nickname, sex, headimgurl } = userInfo;
    Logger.log('更新用户信息: ', userInfo);
    return await this.userEntity.update(
      { id },
      { sex: sex, nickname: nickname, avatar: headimgurl },
    );
  }

  /* 通过openId创建一个用户, 传入邀请码 是邀请人的不是自己的 */
  async createUserFromOpenId(openId: string) {
    const userDefaultAvatar = await this.globalConfigService.getConfigs(['userDefaultAvatar']);
    const userInfo = {
      // avatar: userDefaultAvatar,
      username: `用户${createRandomUid()}`,
      status: UserStatusEnum.ACTIVE,
      sex: 0,
      email: `${createRandomUid()}@default.com`,
      openId,
    };
    const user = await this.userEntity.save(userInfo);
    return user;
  }

  /* 通过openId创建一个用户, 传入邀请码 是邀请人的不是自己的 */
  async createUserFromContact(params: any) {
    const { username, email, phone } = params;
    // const userDefaultAvatar = await this.globalConfigService.getConfigs([
    //   'userDefaultAvatar',
    // ]);
    // 创建 userInfo 对象时条件性地添加 email 和 phone
    const userInfo: any = {
      // avatar: userDefaultAvatar,
      username: `用户${createRandomUid()}`,
      status: UserStatusEnum.ACTIVE,
      sex: 0,
    };

    if (username) {
      userInfo.username = username;
    }

    if (email) {
      userInfo.email = email;
    }

    if (phone) {
      userInfo.phone = phone;
    }

    const user = await this.userEntity.save(userInfo);
    return user;
  }

  async getUserByContact(params: any) {
    const { username, email, phone } = params;
    const where: any = [];
    if (username) {
      where.push({ username });
    }
    if (email) {
      where.push({ email });
    }
    if (phone) {
      where.push({ phone });
    }
    return await this.userEntity.findOne({ where });
  }

  async bindWx(openId, userId) {
    try {
      const user = await this.userEntity.findOne({ where: { id: userId } });
      if (!user) return { status: false, msg: '当前绑定用户不存在！' };
      const bindU = await this.userEntity.findOne({ where: { openId } });
      if (bindU) return { status: false, msg: '该微信已绑定其他账号！' };
      const res = await this.userEntity.update({ id: userId }, { openId });
      if (res.affected <= 0) return { status: false, msg: '绑定微信失败、请联系管理员！' };
      return { status: true, msg: '恭喜您绑定成功、后续可直接扫码登录了！' };
    } catch (error) {
      return { status: false, msg: '绑定微信失败、请联系管理员！' };
    }
  }

  /* 专门用于迁移场景：直接更新用户OpenID，允许清空或者修改为任意值 */
  async updateUserOpenId(userId: number, openId: string | null) {
    try {
      Logger.log(
        `执行迁移OpenID操作 - 用户ID: ${userId}, 目标OpenID: ${openId || '(清空)'}`,
        'UserService',
      );

      // 检查用户是否存在
      const user = await this.userEntity.findOne({ where: { id: userId } });
      if (!user) {
        Logger.log(`迁移失败: 用户不存在 - ID: ${userId}`, 'UserService');
        return { status: false, msg: '用户不存在' };
      }

      // 记录旧的OpenID用于日志
      const oldOpenId = user.openId;

      // 直接更新数据库，绕过bindWx方法的限制
      const res = await this.userEntity.update({ id: userId }, { openId });

      if (res.affected <= 0) {
        Logger.log(`迁移失败: 数据库更新失败 - ID: ${userId}`, 'UserService');
        return { status: false, msg: '数据库更新失败' };
      }

      Logger.log(
        `迁移成功 - 用户ID: ${userId}, 旧OpenID: ${oldOpenId || '(无)'}, 新OpenID: ${
          openId || '(已清空)'
        }`,
        'UserService',
      );

      return {
        status: true,
        msg: '成功更新用户OpenID',
        oldOpenId,
        newOpenId: openId,
        userId,
      };
    } catch (error) {
      Logger.log(`迁移过程异常: ${error.message}`, 'UserService');
      return { status: false, msg: `更新OpenID时出错: ${error.message}` };
    }
  }

  /* 通过userId获取用户的openId */
  async getOpenIdByUserId(userId: number) {
    const user = await this.userEntity.findOne({ where: { id: userId } });
    return user?.openId;
  }

  /* 校验手机号/邮箱号注册 */
  async verifyUserRegister(params: any): Promise<boolean> {
    const { username, phone, email } = params;

    // 如果提供了手机号，就验证手机号
    if (phone) {
      const userByPhone = await this.userEntity.findOne({ where: { phone } });
      if (userByPhone) {
        // 手机号已注册，返回 false
        return false;
      }
    }

    // 如果提供了邮箱，就验证邮箱
    if (email) {
      const userByEmail = await this.userEntity.findOne({ where: { email } });
      if (userByEmail) {
        // 邮箱已注册，返回 false
        return false;
      }
    }

    // 验证用户名是否已存在
    if (username) {
      const userByUsername = await this.userEntity.findOne({
        where: { username },
      });
      if (userByUsername) {
        // 用户名已存在，返回 false
        return false;
      }
    }

    if (!phone && !email && !username) {
      return false;
    }

    // 所有检查都通过，没有发现重复的注册信息，返回 true
    return true;
  }

  /* 校验手机号注册 */
  async verifyUserRegisterByPhone(params: any) {
    const { username, password, phone, phoneCode } = params;
    const user = await this.userEntity.findOne({
      where: [{ username }, { phone }],
    });
    if (user && user.username === username) {
      throw new HttpException('用户名已存在、请更换用户名！', HttpStatus.BAD_REQUEST);
    }
    if (user && user.phone === phone) {
      throw new HttpException('当前手机号已注册、请勿重复注册！', HttpStatus.BAD_REQUEST);
    }
  }

  /* 校验邮箱注册 */
  async verifyUserRegisterByEmail(params: any) {
    const { username, email } = params;
    console.log(`校验邮箱注册: 开始 - 用户名: ${username}, 邮箱: ${email}`);

    // 查找数据库中是否存在该用户名或邮箱
    const user = await this.userEntity.findOne({
      where: [{ username }, { email }],
    });

    // 校验用户名是否已存在
    if (user && user.username === username) {
      console.error(`校验失败: 用户名 "${username}" 已存在`);
      throw new HttpException('用户名已存在、请更换用户名！', HttpStatus.BAD_REQUEST);
    }

    // 校验邮箱是否已被注册
    // 注意：这里应检查user.email而不是user.phone，除非你的数据模型是这样设计的
    if (user && user.email === email) {
      console.error(`校验失败: 邮箱 "${email}" 已被注册`);
      throw new HttpException('当前邮箱已注册、请勿重复注册！', HttpStatus.BAD_REQUEST);
    }

    console.log(`校验邮箱注册: 成功 - 用户名: ${username}, 邮箱: ${email} 未被占用`);
  }

  /* 创建基础用户 */
  async createUser(userInfo) {
    return await this.userEntity.save(userInfo);
  }

  /* 存储实名信息 */
  async saveRealNameInfo(userId: number, realName: string, idCard: string) {
    const user = await this.userEntity.findOne({ where: { id: userId } });
    if (!user) {
      Logger.error('用户不存在');
    }
    await this.userEntity.update({ id: userId }, { realName, idCard });
    return;
  }

  /* 更新用户手机号，用户名，密码 */
  async updateUserPhone(userId: number, phone: string, username: string, password: string) {
    const user = await this.userEntity.findOne({ where: { id: userId } });
    const hashedPassword = bcrypt.hashSync(password, 10);
    if (!user) {
      Logger.error('用户不存在');
    }
    if (!phone || !username || !hashedPassword) {
      throw new HttpException('参数错误！', HttpStatus.BAD_REQUEST);
    }
    await this.userEntity.update({ id: userId }, { phone, username, password: hashedPassword });
    return;
  }

  /* 同步用户资料（来自cat_AI） */
  async syncProfile(userId: number, username: string, bio?: string) {
    let user = await this.userEntity.findOne({ where: { id: userId } });

    if (!user) {
      // 用户不存在，创建新用户
      Logger.log(`用户不存在，自动创建新用户: userId=${userId}`, 'UserService');

      // 获取默认头像
      const userDefaultAvatar = await this.globalConfigService.getConfigs(['userDefaultAvatar']);

      // 创建用户（cat_AI同步过来的用户）
      user = await this.userEntity.save({
        id: userId,
        username: username,
        nickname: username, // 昵称默认使用用户名
        bio: bio || '',
        email: `cat_ai_${userId}@temp.com`, // 临时邮箱
        status: 1, // 直接设为激活状态
        avatar: userDefaultAvatar || '',
        role: 'viewer',
      });

      // 为新用户初始化余额
      await this.userBalanceService.addBalanceToNewUser(userId);

      Logger.log(`新用户创建成功: userId=${userId}, username=${username}`, 'UserService');
      return { success: true, message: '用户创建并同步成功' };
    }

    // 用户已存在，更新用户名和简介
    const updateData: any = { username };
    if (bio !== undefined) {
      updateData.bio = bio;
    }

    await this.userEntity.update({ id: userId }, updateData);

    Logger.log(`用户资料同步成功: userId=${userId}, username=${username}`, 'UserService');
    return { success: true, message: '用户资料同步成功' };
  }

  /* ============ 用户自定义API配置管理 ============ */

  /**
   * 获取用户的API配置
   * @param userId 用户ID
   * @returns 用户API配置（脱敏后）
   */
  async getUserApiConfig(userId: number) {
    const config = await this.userApiConfigEntity.findOne({ where: { userId } });

    if (!config) {
      return null;
    }

    // 返回时脱敏API Key
    return {
      apiUrl: config.apiUrl,
      apiKey: config.apiKey ? maskApiKey(config.apiKey) : null,
      modelName: config.modelName,
      enabled: config.enabled === 1,
    };
  }

  /**
   * 获取用户的API配置（原始数据，包含解密后的API Key）
   * @param userId 用户ID
   * @returns 用户API配置（用于内部使用）
   */
  async getUserApiConfigRaw(userId: number) {
    const config = await this.userApiConfigEntity.findOne({ where: { userId } });

    if (!config || config.enabled !== 1) {
      return null;
    }

    // 解密API Key
    return {
      apiUrl: config.apiUrl,
      apiKey: config.apiKey ? decryptApiKey(config.apiKey) : null,
      modelName: config.modelName || 'gpt-3.5-turbo',
      enabled: config.enabled === 1,
    };
  }

  /**
   * 更新用户的API配置
   * @param userId 用户ID
   * @param dto API配置DTO
   */
  async updateUserApiConfig(userId: number, dto: any) {
    const { apiUrl, apiKey, modelName, enabled } = dto;

    // 加密API Key
    const encryptedApiKey = apiKey ? encryptApiKey(apiKey) : null;

    // 查找是否已存在配置
    let config = await this.userApiConfigEntity.findOne({ where: { userId } });

    if (config) {
      // 更新现有配置
      await this.userApiConfigEntity.update(
        { userId },
        {
          apiUrl: apiUrl || config.apiUrl,
          apiKey: encryptedApiKey || config.apiKey,
          modelName: modelName || config.modelName,
          enabled: enabled ? 1 : 0,
        },
      );
      Logger.log(`用户 ${userId} 更新API配置成功`, 'UserService');
    } else {
      // 创建新配置
      await this.userApiConfigEntity.save({
        userId,
        apiUrl,
        apiKey: encryptedApiKey,
        modelName,
        enabled: enabled ? 1 : 0,
      });
      Logger.log(`用户 ${userId} 创建API配置成功`, 'UserService');
    }

    return { success: true, message: 'API配置更新成功' };
  }

  /**
   * 测试API配置的连通性
   * @param apiUrl API URL
   * @param apiKey API Key
   * @param modelName 模型名称
   * @returns 测试结果
   */
  async testApiConnection(apiUrl: string, apiKey: string, modelName?: string) {
    try {
      // 创建OpenAI客户端
      const openai = new OpenAI({
        baseURL: apiUrl,
        apiKey: apiKey,
        timeout: 10000, // 10秒超时
      });

      // 发送简单的测试请求
      const response = await openai.chat.completions.create({
        model: modelName || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
      });

      Logger.log('API连接测试成功', 'UserService');

      return {
        success: true,
        message: 'API连接测试成功',
        model: response.model,
        response: response.choices[0]?.message?.content || '',
      };
    } catch (error) {
      Logger.error(`API连接测试失败: ${error.message}`, 'UserService');

      // 解析错误类型
      let errorMessage = 'API连接失败';
      if (error.message.includes('timeout')) {
        errorMessage = 'API请求超时，请检查URL是否正确';
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        errorMessage = 'API Key无效，请检查';
      } else if (error.message.includes('404')) {
        errorMessage = 'API URL不正确，请检查';
      } else if (error.message.includes('model')) {
        errorMessage = '模型名称不正确或不支持';
      } else {
        errorMessage = error.message;
      }

      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }
}
