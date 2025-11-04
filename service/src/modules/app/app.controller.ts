import { AdminAuthGuard } from '@/common/auth/adminAuth.guard';
import { JwtAuthGuard } from '@/common/auth/jwtAuth.guard';
import { SuperAuthGuard } from '@/common/auth/superAuth.guard';
import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { UserAppSettingsService } from '../userAppSettings/userAppSettings.service';
import { AppService } from './app.service';
import { CollectAppDto } from './dto/collectApp.dto';
import { CreateAppDto } from './dto/createApp.dto';
import { CreateCatsDto } from './dto/createCats.dto';
import { OperateAppDto } from './dto/deleteApp.dto';
import { DeleteCatsDto } from './dto/deleteCats.dto';
import { QuerAppDto } from './dto/queryApp.dto';
import { QuerCatsDto } from './dto/queryCats.dto';
import { UpdateAppDto } from './dto/updateApp.dto';
import { UpdateCatsDto } from './dto/updateCats.dto';

@ApiTags('app')
@Controller('app')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly userAppSettingsService: UserAppSettingsService,
  ) {}

  @Get('queryAppCats')
  @ApiOperation({ summary: '获取App分类列表' })
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  appCatsList(@Query() query: QuerCatsDto, @Req() req: Request) {
    return this.appService.appCatsList(query, req);
  }

  @Get('queryCats')
  @ApiOperation({ summary: '用户端获取App分类列表' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  catsList(@Req() req: Request) {
    const params: QuerCatsDto = { status: 1, page: 1, size: 1000, name: '' };
    return this.appService.appCatsList(params, req);
  }

  @Get('queryOneCat')
  @ApiOperation({ summary: '用户端获取App详情' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  queryOneCats(@Query() query, @Req() req: Request) {
    return this.appService.queryOneCat(query, req);
  }

  @Post('createAppCats')
  @ApiOperation({ summary: '添加角色分类' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  createAppCat(@Body() body: CreateCatsDto) {
    return this.appService.createAppCat(body);
  }

  @Post('updateAppCats')
  @ApiOperation({ summary: '修改角色分类' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  updateAppCats(@Body() body: UpdateCatsDto) {
    return this.appService.updateAppCats(body);
  }

  @Post('delAppCats')
  @ApiOperation({ summary: '删除角色分类' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  delAppCat(@Body() body: DeleteCatsDto) {
    return this.appService.delAppCat(body);
  }

  @Get('queryApp')
  @ApiOperation({ summary: '获取角色列表' })
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  appList(@Req() req: Request, @Query() query: QuerAppDto) {
    return this.appService.appList(req, query);
  }

  @Get('list')
  @ApiOperation({ summary: '客户端获取角色' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  list(@Req() req: Request, @Query() query: QuerAppDto) {
    return this.appService.frontAppList(req, query);
  }

  @Post('searchList')
  @ApiOperation({ summary: '客户端获取角色' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async searchList(@Body() body: any, @Req() req: Request) {
    body.userId = req.user.id;
    return this.appService.searchAppList(body);
  }

  @Post('createApp')
  @ApiOperation({ summary: '添加角色' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  createApp(@Body() body: CreateAppDto) {
    return this.appService.createApp(body);
  }

  @Post('updateApp')
  @ApiOperation({ summary: '修改角色' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  updateApp(@Body() body: UpdateAppDto) {
    return this.appService.updateApp(body);
  }

  @Post('delApp')
  @ApiOperation({ summary: '删除角色' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  delApp(@Body() body: OperateAppDto) {
    return this.appService.delApp(body);
  }

  @Post('collect')
  @ApiOperation({ summary: '收藏/取消收藏App' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  collect(@Body() body: CollectAppDto, @Req() req: Request) {
    return this.appService.collect(body, req);
  }

  @Get('mineApps')
  @ApiOperation({ summary: '我的收藏' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  mineApps(@Req() req: Request) {
    return this.appService.mineApps(req);
  }

  @Get('emotions')
  @ApiOperation({ summary: '获取统一角色情绪配置（应用到所有角色）' })
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  getGlobalRoleEmotions() {
    return this.appService.getGlobalRoleEmotions();
  }

  @Post('emotions')
  @ApiOperation({ summary: '设置统一角色情绪配置（应用到所有角色）' })
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  setGlobalRoleEmotions(@Body() body: { emotions: Array<{ emotion: string; voiceId?: string }> }) {
    return this.appService.setGlobalRoleEmotions(body);
  }

  @Get('emotionVoices')
  @ApiOperation({ summary: '获取指定角色的情绪-音色映射' })
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  getEmotionVoices(@Query('appId') appId: number) {
    return this.appService.getAppEmotionVoices(Number(appId));
  }

  @Post('emotionVoices')
  @ApiOperation({ summary: '设置指定角色的情绪-音色映射' })
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  setEmotionVoices(
    @Body() body: { appId: number; items: Array<{ emotion: string; voiceId: string }> },
  ) {
    return this.appService.setAppEmotionVoices(body);
  }

  /* ========== 用户创建角色相关接口 ========== */

  @Post('user/createRole')
  @ApiOperation({ summary: '用户创建自己的角色' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  userCreateRole(@Body() body: CreateAppDto, @Req() req: Request) {
    return this.appService.userCreateRole(body, req);
  }

  @Get('user/myRoles')
  @ApiOperation({ summary: '获取用户自己创建的角色列表' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  userMyRoles(@Req() req: Request, @Query() query: QuerAppDto) {
    return this.appService.userMyRoles(req, query);
  }

  @Post('user/updateRole')
  @ApiOperation({ summary: '用户更新自己的角色' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  userUpdateRole(@Body() body: UpdateAppDto, @Req() req: Request) {
    return this.appService.userUpdateRole(body, req);
  }

  @Post('user/delRole')
  @ApiOperation({ summary: '用户删除自己的角色' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  userDelRole(@Body() body: OperateAppDto, @Req() req: Request) {
    return this.appService.userDelRole(body, req);
  }

  @Post('user/togglePublic')
  @ApiOperation({ summary: '用户切换角色公开状态' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  userTogglePublic(@Body() body: { id: number }, @Req() req: Request) {
    return this.appService.userTogglePublic(body, req);
  }

  /* ========== 心理描述开关接口 ========== */

  @Get('psychologicalDesc')
  @ApiOperation({ summary: '获取用户对某角色的心理描述开关状态' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getPsychologicalDesc(@Query('appId') appId: number, @Req() req: Request) {
    const enable = await this.userAppSettingsService.getEnablePsychologicalDesc(
      req.user.id,
      Number(appId),
    );
    return { enable };
  }

  @Post('psychologicalDesc')
  @ApiOperation({ summary: '设置用户对某角色的心理描述开关' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async setPsychologicalDesc(
    @Body() body: { appId: number; enable: boolean },
    @Req() req: Request,
  ) {
    await this.userAppSettingsService.setEnablePsychologicalDesc(
      req.user.id,
      body.appId,
      body.enable,
    );
    return { success: true };
  }
}
