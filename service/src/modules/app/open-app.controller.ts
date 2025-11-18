import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MaobingAuthUtil } from '../../common/utils/maobing-auth.util';
import { UserAppSettingsService } from '../userAppSettings/userAppSettings.service';
import { AppService } from './app.service';

@ApiTags('open-app')
@Controller('open/app')
export class OpenAppController {
  constructor(
    private readonly appService: AppService,
    private readonly userAppSettingsService: UserAppSettingsService,
  ) {}

  // 读
  @Get('list')
  @ApiOperation({ summary: '【开放】获取角色列表（无鉴权）' })
  @ApiQuery({ name: 'page', type: Number, required: false, description: '页码，默认 1' })
  @ApiQuery({ name: 'size', type: Number, required: false, description: '每页数量，默认 10' })
  @ApiQuery({ name: 'name', type: String, required: false, description: '按名称模糊搜索' })
  @ApiQuery({
    name: 'status',
    type: Number,
    required: false,
    description: '状态过滤：1 启用，0 禁用',
  })
  @ApiQuery({ name: 'catId', type: Number, required: false, description: '按分类ID过滤' })
  @ApiQuery({ name: 'role', type: String, required: false, description: '按角色标识过滤（可选）' })
  @ApiQuery({
    name: 'token',
    type: String,
    required: false,
    description: 'Maobing平台用户token（可选，传入则会验证并获取userId）',
  })
  @ApiQuery({
    name: 'excludeIds',
    type: String,
    required: false,
    description: '排除的角色ID列表，逗号分隔（例如：1,2,3）',
  })
  @ApiQuery({
    name: 'excludeAdded',
    type: Boolean,
    required: false,
    description: '是否排除已添加的单聊角色（默认true，传false则不排除）',
  })
  @ApiQuery({
    name: 'maobingBaseUrl',
    type: String,
    required: false,
    description: 'Maobing平台基础URL（可选，用于token验证）',
  })
  @ApiQuery({
    name: 'isSystem',
    type: Boolean,
    required: false,
    description: '是否只查询系统角色（true：只查系统角色，false：只查自创角色，不传：根据userId自动判断）',
  })
  async list(
    @Query()
    query: {
      page?: number;
      size?: number;
      name?: string;
      status?: number;
      catId?: number;
      role?: string;
      token?: string;
      excludeIds?: string;
      excludeAdded?: boolean;
      maobingBaseUrl?: string;
      isSystem?: boolean;
    },
  ) {
    // 如果传了token，则验证并获取userId
    let userId: number | undefined;
    if (query.token) {
      userId = await MaobingAuthUtil.validateTokenAndGetUserId(query.token, query.maobingBaseUrl);
    }

    const res: any = await this.appService.appList(
      undefined as any,
      {
        ...query,
        userId,
      } as any,
    );
    const rows = Array.isArray(res?.rows) ? res.rows : [];
    const safeRows = rows.map((r: any) => {
      const { preset, ...rest } = r || {};
      return rest;
    });

    // 计算是否还有更多数据
    const page = Number(query.page) || 1;
    const size = Number(query.size) || 10;
    const total = res?.count ?? 0;
    const hasMore = page * size < total;

    return {
      rows: safeRows,
      count: total,
      hasMore: hasMore, // 新增：是否还有更多数据
    };
  }

  @Get('detail/:id')
  @ApiOperation({ summary: '【开放】获取角色详情（无鉴权）' })
  @ApiParam({ name: 'id', type: Number, description: '角色(App) ID' })
  async detail(@Param('id') id: string) {
    const appId = Number(id);
    if (isNaN(appId)) {
      throw new HttpException('无效的角色ID', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.appService.queryOneCat({ id: appId } as any);
    } catch (error) {
      // 如果角色不存在，返回更友好的错误信息
      throw new HttpException(
        error.message || '获取角色详情失败',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('my-list')
  @ApiOperation({ summary: '【开放】获取用户自己创建的角色列表（无鉴权）' })
  @ApiQuery({ name: 'userId', type: Number, required: true, description: '用户ID' })
  @ApiQuery({ name: 'page', type: Number, required: false, description: '页码，默认 1' })
  @ApiQuery({ name: 'size', type: Number, required: false, description: '每页数量，默认 10' })
  @ApiQuery({ name: 'name', type: String, required: false, description: '按名称模糊搜索' })
  @ApiQuery({
    name: 'status',
    type: Number,
    required: false,
    description: '状态过滤：1 启用，0 禁用',
  })
  async myList(
    @Query()
    query: {
      userId: number;
      page?: number;
      size?: number;
      name?: string;
      status?: number;
    },
  ) {
    const { userId, page = 1, size = 10, name, status } = query;

    if (!userId) {
      throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);
    }

    try {
      const pageNum = Math.max(1, Number(page) || 1);
      const sizeNum = Math.max(1, Math.min(100, Number(size) || 10));

      // 通过 appList 方法获取用户创建的角色列表
      const result = await this.appService.appList(
        undefined as any,
        {
          page: pageNum,
          size: sizeNum,
          name,
          status,
          userId: Number(userId),
        } as any,
      );

      return {
        success: true,
        data: {
          rows: result?.rows || [],
          count: result?.count || 0,
          page: pageNum,
          size: sizeNum,
          hasMore: pageNum * sizeNum < (result?.count || 0),
        },
      };
    } catch (error) {
      throw new HttpException(
        error.message || '获取用户角色列表失败',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('cats')
  @ApiOperation({ summary: '【开放】获取角色分类（无鉴权）' })
  @ApiQuery({ name: 'page', type: Number, required: false, description: '页码，默认 1' })
  @ApiQuery({ name: 'size', type: Number, required: false, description: '每页数量，默认 10' })
  @ApiQuery({ name: 'name', type: String, required: false, description: '分类名称，模糊搜索' })
  @ApiQuery({
    name: 'status',
    type: Number,
    required: false,
    description: '状态过滤：1 启用，0 禁用',
  })
  async cats(@Query() query: { page?: number; size?: number; name?: string; status?: number }) {
    return this.appService.appCatsList(query as any);
  }

  // 写：分类
  @Post('createAppCats')
  @ApiOperation({ summary: '【开放】创建角色分类（无鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { name: { type: 'string', description: '分类名称' } },
      required: ['name'],
    },
    examples: { demo: { value: { name: '通用助手' } } },
  })
  createAppCats(@Body() body: any) {
    return this.appService.createAppCat(body);
  }

  @Post('updateAppCats')
  @ApiOperation({ summary: '【开放】更新角色分类（无鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '分类ID' },
        name: { type: 'string', description: '新的分类名称' },
      },
      required: ['id', 'name'],
    },
    examples: { demo: { value: { id: 12, name: '办公助手' } } },
  })
  updateAppCats(@Body() body: any) {
    return this.appService.updateAppCats(body);
  }

  @Delete('delAppCats/:id')
  @ApiOperation({ summary: '【开放】删除角色分类（无鉴权）' })
  @ApiParam({ name: 'id', type: Number, description: '分类ID' })
  delAppCats(@Param('id') id: string) {
    return this.appService.delAppCat({ id: Number(id) } as any);
  }

  // 写：App
  @Post('createApp')
  @ApiOperation({ summary: '【开放】创建角色（无鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '角色ID（可选）' },
        name: { type: 'string', description: 'App应用名称（必填）' },
        catId: { type: 'string', description: '分类ID列表，逗号分隔（必填）' },
        preset: { type: 'string', description: '角色设定/预设场景信息（推荐）' },
        coverImg: { type: 'string', description: '封面图片URL（可选）' },
        voiceId: {
          type: 'string',
          description: '角色默认音色ID（可选，DashScope/CosyVoice voice_id）',
        },
        emotionVoices: {
          type: 'array',
          description: '情绪-音色映射，仅传 {emotionId, voiceId} 且 voiceId 非空（可选）',
          items: {
            type: 'object',
            properties: {
              emotionId: { type: 'number', description: '全局情绪ID' },
              voiceId: { type: 'string', description: '音色ID（DashScope/CosyVoice voice_id）' },
            },
            required: ['emotionId', 'voiceId'],
          },
        },
        enableRealTime: { type: 'boolean', description: '是否开启真实时间（星尘API，可选）' },
        enableLongTermMemory: {
          type: 'boolean',
          description: '是否开启长期记忆（星尘API，可选）',
        },
        enableKnowledgeBase: {
          type: 'boolean',
          description: '是否开启知识库搜索（星尘API，可选）',
        },
        knowledgeBaseIds: {
          type: 'string',
          description: '知识库ID列表，JSON数组格式（星尘API，可选），例如：["kb_id_1","kb_id_2"]',
        },
        dialogueExamples: {
          type: 'string',
          description:
            '对话示例，JSON数组格式（星尘API，可选），例如：[{"role":"user","content":"你好"},{"role":"assistant","content":"你好！"}]',
        },
        openingRemark: { type: 'string', description: '开场白（角色初始问候语，可选）' },
      },
      required: ['name', 'catId'],
    },
    examples: {
      demo: {
        value: {
          name: '陆景和',
          catId: '1',
          preset:
            '身份：和印执行总裁知名画家"Z"未名大学研究生\n身高188cm比较臭屁生日6.21双子座年下患有幽闭恐惧症也有分离焦虑症经常会故意歪解姐姐的话比如故意说姐姐竟然这么喜欢我高攻低防没事就盯着姐姐发呆也爱在姐姐面前展示自己会开飞机会画画喜欢弹吉他但水平一般擅长应酬酒量很好但是讨厌应酬很会撒娇！也很爱在姐姐面前撒娇但对待感情很严肃认真缺乏安全感很害怕失去姐姐会吃醋！有点病娇爱吃墨水味粽子冰淇淋喜欢极限运动有一只猫叫葡萄皮肤很敏感容易泛红有五个耳洞喜欢吃脐橙搭积木蓝莓汤圆金丝鱼丸注意个人形象喜欢叫姐姐占有欲强',
          coverImg:
            'https://roleaudio.oss-cn-beijing.aliyuncs.com/dev/system/app/1759056197398_y9bn.jpeg',
          voiceId: 'cosyvoice-v2-mm-217e50b2826e45caae935f42a5442a95',
          emotionVoices: [
            { emotionId: 2, voiceId: 'cosyvoice-v2-ss-46df1d221ce74d91ab63552315263334' },
          ],
          enableRealTime: true,
          enableLongTermMemory: true,
          enableKnowledgeBase: false,
          openingRemark: '你好，我是陆景和，很高兴认识你。',
        },
      },
    },
  })
  createApp(@Body() body: any) {
    return this.appService.createApp(body);
  }

  @Post('updateApp')
  @ApiOperation({ summary: '【开放】更新角色（无鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '角色(App) ID' },
        name: { type: 'string', description: 'App应用名称（可选）' },
        catId: { type: 'string', description: '分类ID列表，逗号分隔（可选）' },
        preset: { type: 'string', description: '角色设定/预设场景信息（可选）' },
        coverImg: { type: 'string', description: '封面图片URL（可选）' },
        voiceId: { type: 'string', description: '角色默认音色ID（可选）' },
        emotionVoices: {
          type: 'array',
          description: '情绪-音色映射，仅传 {emotionId, voiceId} 且 voiceId 非空',
          items: {
            type: 'object',
            properties: {
              emotionId: { type: 'number', description: '全局情绪ID' },
              voiceId: { type: 'string', description: '音色ID（DashScope/CosyVoice voice_id）' },
            },
            required: ['emotionId', 'voiceId'],
          },
        },
        enableRealTime: { type: 'boolean', description: '是否开启真实时间（星尘API，可选）' },
        enableLongTermMemory: {
          type: 'boolean',
          description: '是否开启长期记忆（星尘API，可选）',
        },
        enableKnowledgeBase: {
          type: 'boolean',
          description: '是否开启知识库搜索（星尘API，可选）',
        },
        knowledgeBaseIds: {
          type: 'string',
          description: '知识库ID列表，JSON数组格式（星尘API，可选），例如：["kb_id_1","kb_id_2"]',
        },
        dialogueExamples: {
          type: 'string',
          description:
            '对话示例，JSON数组格式（星尘API，可选），例如：[{"role":"user","content":"你好"},{"role":"assistant","content":"你好！"}]',
        },
        openingRemark: { type: 'string', description: '开场白（角色初始问候语，可选）' },
      },
      required: ['id'],
    },
    examples: {
      demo: {
        value: {
          id: 10000,
          name: '陆景和',
          catId: '1',
          preset:
            '身份：和印执行总裁知名画家"Z"未名大学研究生\n身高188cm比较臭屁生日6.21双子座年下患有幽闭恐惧症也有分离焦虑症经常会故意歪解姐姐的话比如故意说姐姐竟然这么喜欢我高攻低防没事就盯着姐姐发呆也爱在姐姐面前展示自己会开飞机会画画喜欢弹吉他但水平一般擅长应酬酒量很好但是讨厌应酬很会撒娇！也很爱在姐姐面前撒娇但对待感情很严肃认真缺乏安全感很害怕失去姐姐会吃醋！有点病娇爱吃墨水味粽子冰淇淋喜欢极限运动有一只猫叫葡萄皮肤很敏感容易泛红有五个耳洞喜欢吃脐橙搭积木蓝莓汤圆金丝鱼丸注意个人形象喜欢叫姐姐占有欲强',
          coverImg:
            'https://roleaudio.oss-cn-beijing.aliyuncs.com/dev/system/app/1759056197398_y9bn.jpeg',
          voiceId: 'cosyvoice-v2-mm-217e50b2826e45caae935f42a5442a95',
          emotionVoices: [
            { emotionId: 2, voiceId: 'cosyvoice-v2-ss-46df1d221ce74d91ab63552315263334' },
          ],
          enableRealTime: true,
          enableLongTermMemory: true,
          enableKnowledgeBase: true,
          knowledgeBaseIds: '["kb_fashion_2024","kb_trends"]',
          dialogueExamples:
            '[{"role":"user","content":"你好"},{"role":"assistant","content":"姐姐好，我是陆景和。"}]',
          openingRemark: '你好，我是陆景和，很高兴认识你。',
        },
      },
    },
  })
  updateApp(@Body() body: any) {
    console.log('[OpenAppController.updateApp] 收到请求参数:', JSON.stringify(body, null, 2));
    try {
      return this.appService.updateApp(body);
    } catch (error) {
      console.error('[OpenAppController.updateApp] 错误:', error);
      throw error;
    }
  }

  @Delete('delApp/:id')
  @ApiOperation({ summary: '【开放】删除角色（无鉴权）' })
  @ApiParam({ name: 'id', type: Number, description: '角色(App) ID' })
  delApp(@Param('id') id: string) {
    return this.appService.delApp({ id: Number(id) } as any);
  }

  // 全局情绪配置（读写）
  @Get('emotions')
  @ApiOperation({ summary: '【开放】获取全局情绪→音色映射（无鉴权）' })
  getEmotions() {
    return this.appService.getGlobalRoleEmotions();
  }

  @Post('emotions')
  @ApiOperation({ summary: '【开放】设置全局情绪→音色映射（无鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        emotions: {
          type: 'array',
          description: '全局情绪-音色映射数组',
          items: {
            type: 'object',
            properties: {
              emotion: { type: 'string', description: '情绪标识，如 happy/angry' },
              voiceId: { type: 'string', description: '对应的音色ID（可选）' },
            },
            required: ['emotion'],
          },
        },
      },
      required: ['emotions'],
    },
    examples: {
      demo: { value: { emotions: [{ emotion: 'happy', voiceId: 'cosyvoice-v2-ls3' }] } },
    },
  })
  setEmotions(@Body() body: any) {
    return this.appService.setGlobalRoleEmotions(body);
  }

  // 心理描述开关
  @Get('psychologicalDesc')
  @ApiOperation({ summary: '【开放】获取用户对某角色的心理描述开关状态（无鉴权）' })
  @ApiQuery({ name: 'userId', type: Number, required: true, description: '用户ID' })
  @ApiQuery({ name: 'appId', type: Number, required: true, description: '角色(App) ID' })
  async getPsychologicalDesc(@Query('userId') userId: string, @Query('appId') appId: string) {
    const enable = await this.userAppSettingsService.getEnablePsychologicalDesc(
      Number(userId),
      Number(appId),
    );
    return { enable };
  }

  @Post('psychologicalDesc')
  @ApiOperation({ summary: '【开放】设置用户对某角色的心理描述开关（无鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '用户ID' },
        appId: { type: 'number', description: '角色(App) ID' },
        enable: { type: 'boolean', description: '是否启用心理描述' },
      },
      required: ['userId', 'appId', 'enable'],
    },
    examples: {
      demo: { value: { userId: 1, appId: 10000, enable: true } },
    },
  })
  async setPsychologicalDesc(@Body() body: { userId: number; appId: number; enable: boolean }) {
    await this.userAppSettingsService.setEnablePsychologicalDesc(
      body.userId,
      body.appId,
      body.enable,
    );
    return { success: true };
  }
}
