import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AffectionService } from './affection.service';
import { IncrementAffectionDto, SetAffectionDto } from './dto/openAffection.dto';

@ApiTags('open-affection')
@Controller('open/affection')
export class OpenAffectionController {
  constructor(private readonly affectionService: AffectionService) {}

  // 读
  @Get('rules')
  @ApiOperation({ summary: '【开放】列出好感度规则（无鉴权）' })
  listRules() {
    return this.affectionService.listRules();
  }

  @Get('status')
  @ApiOperation({
    summary: '【开放】获取某用户在某app的好感度与阶段（无鉴权，需显式传 userId, appId）',
  })
  @ApiQuery({
    name: 'userId',
    type: Number,
    required: true,
    description: '用户ID（系统内有效的用户）',
  })
  @ApiQuery({ name: 'appId', type: Number, required: true, description: '角色(App) ID' })
  status(@Query('userId') userId: string, @Query('appId') appId: string) {
    return this.affectionService.getUserAffection(userId as any, Number(appId));
  }

  // 写
  @Post('rule')
  @ApiOperation({ summary: '【开放】新增/更新 好感度规则（无鉴权）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        stageName: { type: 'string' },
        minScore: { type: 'number' },
        maxScore: { type: 'number', nullable: true },
        behaviors: { type: 'string' },
      },
      required: ['stageName', 'minScore', 'behaviors'],
    },
    examples: {
      demo: {
        value: {
          stageName: '初见',
          minScore: 0,
          maxScore: 30,
          behaviors: '...',
        },
      },
    },
  })
  upsertRule(@Body() body: any) {
    return this.affectionService.upsertRule(body);
  }

  @Delete('rule/:id')
  @ApiOperation({ summary: '【开放】删除 好感度规则（无鉴权）' })
  removeRule(@Param('id') id: string) {
    return this.affectionService.removeRule(Number(id));
  }

  @Post('increment')
  @ApiOperation({
    summary: '【开放】增加好感度',
    description: `
增加或减少用户在指定角色的好感度

参数说明：
- userId（必填）：用户ID
- appId（必填）：角色ID
- amount：增加的分数（正数增加，负数减少，默认+1）

返回：当前好感度分数和阶段信息
    `,
  })
  @ApiBody({
    type: IncrementAffectionDto,
    examples: {
      increase: {
        summary: '增加好感度（推荐）',
        description: '增加5分好感度',
        value: {
          userId: 1,
          appId: 101,
          amount: 5,
        },
      },
      decrease: {
        summary: '减少好感度',
        description: '减少3分好感度',
        value: {
          userId: 1,
          appId: 101,
          amount: -3,
        },
      },
      default: {
        summary: '默认增加',
        description: '不传amount则默认+1',
        value: {
          userId: 1,
          appId: 101,
        },
      },
    },
  })
  increment(@Body() body: IncrementAffectionDto) {
    return this.affectionService.increment(body.userId, body.appId, body.amount);
  }

  @Put('score')
  @ApiOperation({
    summary: '【开放】设置好感度',
    description: `
直接设置用户在指定角色的好感度分数

参数说明：
- userId（必填）：用户ID
- appId（必填）：角色ID
- score（必填）：要设置的分数（最小为0）

返回：当前好感度分数和阶段信息
    `,
  })
  @ApiBody({
    type: SetAffectionDto,
    examples: {
      set: {
        summary: '设置好感度（推荐）',
        description: '直接设置为50分',
        value: {
          userId: 1,
          appId: 101,
          score: 50,
        },
      },
      reset: {
        summary: '重置好感度',
        description: '重置为0分',
        value: {
          userId: 1,
          appId: 101,
          score: 0,
        },
      },
    },
  })
  setScore(@Body() body: SetAffectionDto) {
    return this.affectionService.setScore(body.userId, body.appId, body.score);
  }
}
