import { JwtAuthGuard } from '@/common/auth/jwtAuth.guard';
import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AffectionService } from './affection.service';

@ApiTags('affection')
@Controller('affection')
export class AffectionController {
  constructor(private readonly affectionService: AffectionService) {}

  @Get('rules')
  @ApiOperation({ summary: '列出好感度规则' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listRules() {
    return this.affectionService.listRules();
  }

  @Post('rule')
  @ApiOperation({ summary: '新增/更新好感度规则' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  upsertRule(
    @Body()
    body: {
      id?: number;
      stageName: string;
      minScore: number;
      maxScore?: number | null;
      behaviors: string;
    },
  ) {
    return this.affectionService.upsertRule(body as any);
  }

  @Delete('rule/:id')
  @ApiOperation({ summary: '删除好感度规则' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.affectionService.removeRule(Number(id));
  }

  @Get('status')
  @ApiOperation({ summary: '获取当前用户在某app的好感度与阶段' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async status(@Query('userId') userId: string, @Query('appId') appId: string, @Req() req) {
    // 优先使用JWT token中的用户ID，如果URL中没有传userId参数的话
    const uid = userId ? userId : (req?.user?.id as any);
    console.log('[AffectionController] status接口被调用:', {
      queryUserId: userId,
      queryAppId: appId,
      jwtUserId: req?.user?.id,
      finalUserId: uid,
      finalAppId: Number(appId),
    });
    const result = await this.affectionService.getUserAffection(uid as any, Number(appId));
    console.log('[AffectionController] getUserAffection返回:', result);
    return result;
  }
}
