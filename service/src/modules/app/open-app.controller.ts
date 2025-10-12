import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('open-app')
@Controller('open/app')
export class OpenAppController {
  constructor(private readonly appService: AppService) {}

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
  async list(
    @Query()
    query: {
      page?: number;
      size?: number;
      name?: string;
      status?: number;
      catId?: number;
      role?: string;
    },
  ) {
    const res: any = await this.appService.appList(undefined as any, query as any);
    const rows = Array.isArray(res?.rows) ? res.rows : [];
    const safeRows = rows.map((r: any) => {
      const { preset, ...rest } = r || {};
      return rest;
    });
    return { rows: safeRows, count: res?.count ?? safeRows.length };
  }

  @Get('detail/:id')
  @ApiOperation({ summary: '【开放】获取角色详情（无鉴权）' })
  @ApiParam({ name: 'id', type: Number, description: '角色(App) ID' })
  async detail(@Param('id') id: string) {
    return this.appService.queryOneCat({ id: Number(id) } as any);
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
    return this.appService.updateApp(body);
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
}
