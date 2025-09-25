import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AffectionService } from './affection.service';

@ApiTags('open-affection')
@Controller('open/affection')
export class OpenAffectionController {
  constructor(private readonly affectionService: AffectionService) {}

  // 读
  @Get('rules')
  @ApiOperation({ summary: '【开放】列出好感度规则（按app优先，其次全局）（无鉴权）' })
  listRules(@Query('appId') appId?: string) {
    return this.affectionService.listRules(appId ? Number(appId) : undefined);
  }

  @Get('status')
  @ApiOperation({ summary: '【开放】获取某用户在某app的好感度与阶段（无鉴权，需显式传 userId, appId）' })
  status(@Query('userId') userId: string, @Query('appId') appId: string) {
    return this.affectionService.getUserAffection(userId as any, Number(appId));
  }

  // 写
  @Post('rule')
  @ApiOperation({ summary: '【开放】新增/更新 好感度规则（无鉴权）' })
  @ApiBody({
    schema: { type: 'object', properties: { appId: { type: 'number', nullable: true }, stageName: { type: 'string' }, minScore: { type: 'number' }, maxScore: { type: 'number', nullable: true }, behaviors: { type: 'string' } }, required: ['stageName','minScore','behaviors'] },
    examples: { demo: { value: { appId: 123, stageName: '初见', minScore: 0, maxScore: 30, behaviors: '...' } } },
  })
  upsertRule(@Body() body: any) {
    return this.affectionService.upsertRule(body);
  }

  @Delete('rule/:id')
  @ApiOperation({ summary: '【开放】删除 好感度规则（无鉴权）' })
  removeRule(@Param('id') id: string) {
    return this.affectionService.removeRule(Number(id));
  }
}
