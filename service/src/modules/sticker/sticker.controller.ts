import { JwtAuthGuard } from '@/common/auth/jwtAuth.guard';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StickerService } from './sticker.service';

@ApiTags('stickers')
@Controller('stickers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StickerController {
  constructor(private readonly stickerService: StickerService) {}

  @Get()
  @ApiOperation({ summary: 'List stickers with filters' })
  list(
    @Query()
    query: {
      keyword?: string;
      tags?: string | string[];
      emotion?: string;
      page?: number;
      size?: number;
    },
  ) {
    const parsedTags = this.parseTags(query.tags);
    return this.stickerService.list({
      keyword: query.keyword,
      emotion: query.emotion,
      page: query.page ? Number(query.page) : undefined,
      size: query.size ? Number(query.size) : undefined,
      tags: parsedTags,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sticker detail' })
  detail(@Param('id') id: string) {
    return this.stickerService.detail(Number(id));
  }

  @Post()
  @ApiOperation({ summary: 'Create sticker' })
  create(
    @Body()
    body: {
      name: string;
      imageUrl: string;
      tags?: string[] | string;
      emotion?: string;
      scenario?: string;
    },
    @Req() req: any,
  ) {
    if (!body?.name?.trim()) {
      throw new BadRequestException('Sticker name is required');
    }
    if (!body?.imageUrl?.trim()) {
      throw new BadRequestException('Sticker imageUrl is required');
    }
    return this.stickerService.create(
      {
        name: body.name.trim(),
        imageUrl: body.imageUrl.trim(),
        tags: this.normalizeBodyTags(body.tags),
        emotion: body.emotion,
        scenario: body.scenario,
      },
      req?.user?.id,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update sticker' })
  update(
    @Param('id') id: string,
    @Body()
    body: {
      name: string;
      imageUrl: string;
      tags?: string[] | string;
      emotion?: string;
      scenario?: string;
    },
  ) {
    if (!body?.name?.trim()) {
      throw new BadRequestException('Sticker name is required');
    }
    if (!body?.imageUrl?.trim()) {
      throw new BadRequestException('Sticker imageUrl is required');
    }
    return this.stickerService.update(Number(id), {
      name: body.name.trim(),
      imageUrl: body.imageUrl.trim(),
      tags: this.normalizeBodyTags(body.tags),
      emotion: body.emotion,
      scenario: body.scenario,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete sticker' })
  remove(@Param('id') id: string) {
    return this.stickerService.remove(Number(id));
  }

  private parseTags(tags?: string | string[]) {
    if (!tags) return undefined;
    if (Array.isArray(tags)) {
      return tags.map(tag => tag.trim()).filter(Boolean);
    }
    return tags
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  private normalizeBodyTags(tags?: string[] | string | null) {
    if (!tags) return null;
    if (Array.isArray(tags)) {
      return tags.map(tag => tag.trim()).filter(Boolean);
    }
    return tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
  }
}
