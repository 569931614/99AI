import { JwtAuthGuard } from '@/common/auth/jwtAuth.guard';
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VoiceService } from './voice.service';

@ApiTags('voice')
@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('enroll')
  @ApiOperation({ summary: '声音复刻：创建音色' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  enroll(@Body() body: { prefix: string; url: string; targetModel?: string; name?: string }) {
    return this.voiceService.enroll(body);
  }

  @Get('list')
  @ApiOperation({ summary: '查询音色列表' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  list(@Query() query: { prefix?: string; page_index?: number; page_size?: number }) {
    return this.voiceService.list(query);
  }

  @Get('detail/:voiceId')
  @ApiOperation({ summary: '查询音色详情/状态' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  detail(@Param('voiceId') voiceId: string) {
    return this.voiceService.query(voiceId);
  }

  @Post('update')
  @ApiOperation({ summary: '更新音色（训练）' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(@Body() body: { voice_id: string; url: string }) {
    return this.voiceService.update(body);
  }

  @Post('delete')
  @ApiOperation({ summary: '删除音色' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  remove(@Body() body: { voice_id: string }) {
    return this.voiceService.remove(body);
  }

  @Post('preview')
  @ApiOperation({ summary: '试听：根据音色合成音频并返回URL' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  preview(
    @Body()
    body: { voice_id: string; text: string; model?: string; format?: 'mp3'|'wav'|'pcm'; sample_rate?: number; volume?: number; rate?: number; pitch?: number },
  ) {
    return this.voiceService.preview(body);
  }

  @Get('params/:voiceId')
  @ApiOperation({ summary: '获取音色默认合成参数' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getParams(@Param('voiceId') voiceId: string) {
    return this.voiceService.getVoiceParams(voiceId);
  }

  @Post('params')
  @ApiOperation({ summary: '设置音色默认合成参数' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  setParams(@Body() body: { voice_id: string; params: any }) {
    return this.voiceService.setVoiceParams(body);
  }

  @Get('meta/:voiceId')
  @ApiOperation({ summary: '获取音色元信息（如名称）' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getMeta(@Param('voiceId') voiceId: string) {
    return this.voiceService.getVoiceMeta(voiceId);
  }

  @Post('meta')
  @ApiOperation({ summary: '设置音色元信息（如名称）' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  setMeta(@Body() body: { voice_id: string; meta: any }) {
    return this.voiceService.setVoiceMeta(body);
  }


  @Post('asr')
  @ApiOperation({ summary: '语音识别：上传音频并返回识别文本' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  asr(
    @Body()
    body: {
      audioBase64: string;
      format?: 'wav' | 'pcm' | 'mp3' | 'opus' | 'speex' | 'aac' | 'amr';
      sample_rate?: number;
      model?: string;
      language_hints?: string[];
      disfluency_removal_enabled?: boolean;
    },
  ) {
    return this.voiceService.asr(body as any);
  }
}

