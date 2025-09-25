import { JwtAuthGuard } from '@/common/auth/jwtAuth.guard';
import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AffectionService } from './affection.service';

@ApiTags('affection')
@Controller('affection')
export class AffectionController {
  constructor(private readonly affectionService: AffectionService) {}

  @Get('rules')
  @ApiOperation({ summary: '列出好感度规则（按app优先，其次全局）' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listRules(@Query('appId') appId?: string) {
    return this.affectionService.listRules(appId ? Number(appId) : undefined);
    
  }

  @Post('rule')
  @ApiOperation({ summary: '新增/更新好感度规则' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  upsertRule(@Body() body: { id?: number; appId?: number | null; stageName: string; minScore: number; maxScore?: number | null; behaviors: string; }) {
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
  status(@Query('userId') userId: string, @Query('appId') appId: string, @Req() req) {
    const uid = userId ?? (req?.user?.id as any)
    return this.affectionService.getUserAffection(uid as any, Number(appId));
  }
}

