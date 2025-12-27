import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserAppSettingsService } from './userAppSettings.service';

@ApiTags('open-userAppSettings')
@Controller('open/userAppSettings')
export class OpenUserAppSettingsController {
  constructor(private readonly userAppSettingsService: UserAppSettingsService) {}

  @Get('psychological-desc')
  @ApiOperation({
    summary: '【开放】获取用户在某角色的心理描述开关状态（无鉴权）',
    description: `
获取用户在指定角色的心理描述开关状态

参数说明：
- userId（必填）：用户ID
- appId（必填）：角色ID

返回：{ enable: boolean }
    `,
  })
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: true,
    description: '用户ID',
  })
  @ApiQuery({
    name: 'appId',
    type: Number,
    required: true,
    description: '角色(App) ID',
  })
  async getPsychologicalDesc(
    @Query('userId') userId: string,
    @Query('appId') appId: string,
  ): Promise<{ enable: boolean }> {
    const enable = await this.userAppSettingsService.getEnablePsychologicalDesc(
      Number(userId),
      Number(appId),
    );
    return { enable };
  }

  @Post('psychological-desc')
  @ApiOperation({
    summary: '【开放】设置用户在某角色的心理描述开关（无鉴权）',
    description: `
设置用户在指定角色的心理描述开关

参数说明：
- userId（必填）：用户ID
- appId（必填）：角色ID
- enable（必填）：是否启用心理描述（true/false）

返回：{ success: boolean }
    `,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '用户ID' },
        appId: { type: 'number', description: '角色ID' },
        enable: { type: 'boolean', description: '是否启用心理描述' },
      },
      required: ['userId', 'appId', 'enable'],
    },
    examples: {
      enable: {
        summary: '开启心理描述',
        value: {
          userId: 1,
          appId: 101,
          enable: true,
        },
      },
      disable: {
        summary: '关闭心理描述',
        value: {
          userId: 1,
          appId: 101,
          enable: false,
        },
      },
    },
  })
  async setPsychologicalDesc(
    @Body() body: { userId: number; appId: number; enable: boolean },
  ): Promise<{ success: boolean }> {
    await this.userAppSettingsService.setEnablePsychologicalDesc(
      body.userId,
      body.appId,
      body.enable,
    );
    return { success: true };
  }

  @Get('nfc-preference')
  @ApiOperation({
    summary: '【开放】获取用户 NFC 内容偏好（无鉴权）',
    description: `
获取用户在指定角色的 NFC 消息内容偏好设置

参数说明：
- userId（必填）：用户ID
- appId（必填）：角色ID

返回：{ success: true, preference: "calendar_reminder,check_in" }
偏好类型：calendar_reminder（备忘录提醒）、chat_memory（关心）、check_in（查岗）、report（报备）
空字符串表示随机选择
    `,
  })
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: true,
    description: '用户ID',
  })
  @ApiQuery({
    name: 'appId',
    type: Number,
    required: true,
    description: '角色(App) ID',
  })
  async getNfcPreference(
    @Query('userId') userId: string,
    @Query('appId') appId: string,
  ): Promise<{ success: boolean; preference: string }> {
    const preference = await this.userAppSettingsService.getNfcContentPreference(
      Number(userId),
      Number(appId),
    );
    return { success: true, preference };
  }

  @Post('nfc-preference')
  @ApiOperation({
    summary: '【开放】设置用户 NFC 内容偏好（无鉴权）',
    description: `
设置用户在指定角色的 NFC 消息内容偏好

参数说明：
- userId（必填）：用户ID
- appId（必填）：角色ID
- preference（必填）：内容偏好，逗号分隔的字符串

偏好类型：
- calendar_reminder：备忘录提醒（包含天气信息）
- chat_memory：聊天记忆关心
- check_in：查岗
- report：报备

示例：
- "calendar_reminder,check_in" 表示只使用备忘录提醒和查岗
- "" 空字符串表示随机选择所有类型

返回：{ success: boolean }
    `,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '用户ID' },
        appId: { type: 'number', description: '角色ID' },
        preference: { type: 'string', description: 'NFC内容偏好，逗号分隔' },
      },
      required: ['userId', 'appId', 'preference'],
    },
    examples: {
      setPreference: {
        summary: '设置偏好为备忘录提醒和查岗',
        value: {
          userId: 1,
          appId: 101,
          preference: 'calendar_reminder,check_in',
        },
      },
      clearPreference: {
        summary: '清除偏好（使用随机）',
        value: {
          userId: 1,
          appId: 101,
          preference: '',
        },
      },
    },
  })
  async setNfcPreference(
    @Body() body: { userId: number; appId: number; preference: string },
  ): Promise<{ success: boolean }> {
    await this.userAppSettingsService.setNfcContentPreference(
      body.userId,
      body.appId,
      body.preference,
    );
    return { success: true };
  }

  @Get('detail')
  @ApiOperation({
    summary: '【开放】获取用户角色配置详情（无鉴权）',
    description: `
获取用户在指定角色的所有配置信息

参数说明：
- userId（必填）：用户ID
- appId（必填）：角色ID

返回：用户角色配置对象
    `,
  })
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: true,
    description: '用户ID',
  })
  @ApiQuery({
    name: 'appId',
    type: Number,
    required: true,
    description: '角色(App) ID',
  })
  async getUserAppSettings(@Query('userId') userId: string, @Query('appId') appId: string) {
    const settings = await this.userAppSettingsService.getUserAppSettings(
      Number(userId),
      Number(appId),
    );
    // 返回默认值如果不存在
    if (!settings) {
      return {
        userId: Number(userId),
        appId: Number(appId),
        characterRelationships: 0,
        openingRemarks: '',
        proactivelySend: 0,
        enablePsychologicalDesc: false,
        realTime: 0,
        myName: '',
        myProfile: '',
        nfcContentPreference: '',
      };
    }
    return settings;
  }

  @Post('update')
  @ApiOperation({
    summary: '【开放】更新用户角色配置（无鉴权）',
    description: `
更新用户在指定角色的配置信息

参数说明：
- userId（必填）：用户ID
- appId（必填）：角色ID
- characterRelationships（可选）：人物关系 0-其他，1-恋人，2-朋友
- openingRemarks（可选）：聊天开场白
- proactivelySend（可选）：是否主动发消息 0-否，1-是
- enablePsychologicalDesc（可选）：是否启用心理描述
- realTime（可选）：是否开启真实时间 0-否，1-是
- myName（可选）：对我的称呼
- myProfile（可选）：我的简介
- nfcContentPreference（可选）：NFC内容偏好，逗号分隔

返回：{ success: boolean, data: 更新后的配置 }
    `,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '用户ID' },
        appId: { type: 'number', description: '角色ID' },
        characterRelationships: { type: 'number', description: '人物关系：0-其他，1-恋人，2-朋友' },
        openingRemarks: { type: 'string', description: '聊天开场白' },
        proactivelySend: { type: 'number', description: '是否主动发消息：0-否，1-是' },
        enablePsychologicalDesc: { type: 'boolean', description: '是否启用心理描述' },
        realTime: { type: 'number', description: '是否开启真实时间：0-否，1-是' },
        myName: { type: 'string', description: '对我的称呼' },
        myProfile: { type: 'string', description: '我的简介' },
        nfcContentPreference: { type: 'string', description: 'NFC内容偏好，逗号分隔' },
      },
      required: ['userId', 'appId'],
    },
  })
  async updateUserAppSettings(
    @Body()
    body: {
      userId: number;
      appId: number;
      characterRelationships?: number;
      openingRemarks?: string;
      proactivelySend?: number;
      enablePsychologicalDesc?: boolean;
      realTime?: number;
      myName?: string;
      myProfile?: string;
      nfcContentPreference?: string;
    },
  ) {
    const { userId, appId, ...settings } = body;
    const updatedSettings = await this.userAppSettingsService.updateUserAppSettings(
      userId,
      appId,
      settings,
    );
    return { success: true, data: updatedSettings };
  }
}
