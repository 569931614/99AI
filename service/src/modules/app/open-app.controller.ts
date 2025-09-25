import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('open-app')
@Controller('open/app')
export class OpenAppController {
  constructor(private readonly appService: AppService) {}

  // 读
  @Get('list')
  @ApiOperation({ summary: '【开放】获取角色(App)列表（无鉴权）' })
  async list(@Query() query: { page?: number; size?: number; name?: string; status?: number; catId?: number; role?: string }) {
    const res: any = await this.appService.appList(undefined as any, query as any);
    const rows = Array.isArray(res?.rows) ? res.rows : [];
    const safeRows = rows.map((r: any) => {
      const { preset, ...rest } = r || {};
      return rest;
    });
    return { rows: safeRows, count: res?.count ?? safeRows.length };
  }

  @Get('detail/:id')
  @ApiOperation({ summary: '【开放】获取角色(App)详情（无鉴权）' })
  async detail(@Param('id') id: string) {
    return this.appService.queryOneCat({ id: Number(id) } as any);
  }

  @Get('cats')
  @ApiOperation({ summary: '【开放】获取角色分类（无鉴权）' })
  async cats(@Query() query: { page?: number; size?: number; name?: string; status?: number }) {
    return this.appService.appCatsList(query as any);
  }

  // 写：分类
  @Post('createAppCats')
  @ApiOperation({ summary: '【开放】创建角色分类（无鉴权）' })
  @ApiBody({
    schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    examples: { demo: { value: { name: '通用助手' } } },
  })
  createAppCats(@Body() body: any) {
    return this.appService.createAppCat(body);
  }

  @Post('updateAppCats')
  @ApiOperation({ summary: '【开放】更新角色分类（无鉴权）' })
  @ApiBody({
    schema: { type: 'object', properties: { id: { type: 'number' }, name: { type: 'string' } }, required: ['id','name'] },
    examples: { demo: { value: { id: 12, name: '办公助手' } } },
  })
  updateAppCats(@Body() body: any) {
    return this.appService.updateAppCats(body);
  }

  @Delete('delAppCats/:id')
  @ApiOperation({ summary: '【开放】删除角色分类（无鉴权）' })
  delAppCats(@Param('id') id: string) {
    return this.appService.delAppCat({ id: Number(id) } as any);
  }

  // 写：App
  @Post('createApp')
  @ApiOperation({ summary: '【开放】创建角色App（无鉴权）' })
  @ApiBody({
    schema: { type: 'object', properties: { name: { type: 'string' }, catId: { type: 'string', description: '逗号分隔' }, status: { type: 'number' } }, required: ['name','catId'] },
    examples: { demo: { value: { name: '销售小助理', catId: '1,2', status: 1 } } },
  })
  createApp(@Body() body: any) {
    return this.appService.createApp(body);
  }

  @Post('updateApp')
  @ApiOperation({ summary: '【开放】更新角色App（无鉴权）' })
  @ApiBody({
    schema: { type: 'object', properties: { id: { type: 'number' }, name: { type: 'string' }, status: { type: 'number' } }, required: ['id'] },
    examples: { demo: { value: { id: 101, name: '销售助理Pro', status: 1 } } },
  })
  updateApp(@Body() body: any) {
    return this.appService.updateApp(body);
  }

  @Delete('delApp/:id')
  @ApiOperation({ summary: '【开放】删除角色App（无鉴权）' })
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
    schema: { type: 'object', properties: { emotions: { type: 'array', items: { type: 'object', properties: { emotion: { type: 'string' }, voiceId: { type: 'string' } }, required: ['emotion'] } } }, required: ['emotions'] },
    examples: { demo: { value: { emotions: [{ emotion: 'happy', voiceId: 'cosyvoice-v2-ls3' }] } } },
  })
  setEmotions(@Body() body: any) {
    return this.appService.setGlobalRoleEmotions(body);
  }
}

