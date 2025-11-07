import { JwtAuthGuard } from '@/common/auth/jwtAuth.guard';
import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VoiceCategoryService } from './voiceCategory.service';

@ApiTags('voice-category')
@Controller('voice-category')
export class VoiceCategoryController {
  constructor(private readonly voiceCategoryService: VoiceCategoryService) {}

  @Post()
  @ApiOperation({ summary: '创建音色分类' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(
    @Body()
    body: {
      name: string;
      description?: string;
      sort?: number;
      isEnabled?: boolean;
    },
  ) {
    return this.voiceCategoryService.create(body);
  }

  @Get()
  @ApiOperation({ summary: '获取音色分类列表' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  list() {
    return this.voiceCategoryService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取音色分类详情' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  detail(@Param('id') id: number) {
    return this.voiceCategoryService.detail(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新音色分类' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(
    @Param('id') id: number,
    @Body()
    body: {
      name?: string;
      description?: string;
      sort?: number;
      isEnabled?: boolean;
    },
  ) {
    return this.voiceCategoryService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除音色分类' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  remove(@Param('id') id: number) {
    return this.voiceCategoryService.remove(id);
  }
}
