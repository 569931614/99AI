import { JwtAuthGuard } from '@/common/auth/jwtAuth.guard';
import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { UploadService } from './upload.service';

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('file')
  @ApiOperation({ summary: '上传文件' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB大小限制
      },
    }),
  )
  async uploadFile(@UploadedFile() file, @Req() req: Request, @Query('dir') dir?: string) {
    return this.uploadService.uploadFile(file, dir, req.user);
  }

  // @Post('fileFromUrl')
  // @ApiOperation({ summary: '从URL上传文件' })
  // async uploadFileFromUrl(@Body() { url, dir = 'ai' }): Promise<any> {
  //   return this.uploadService.uploadFileFromUrl({ url, dir });
  // }
}

@ApiTags('open-upload')
@Controller('open/upload')
export class OpenUploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('file')
  @ApiOperation({ summary: '【开放】上传文件（无鉴权，需显式传 userId）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'number', description: '外部用户ID（用于标识文件所有者）' },
        dir: { type: 'string', description: '上传目录（可选，默认为 chat/background）' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB大小限制
      },
    }),
  )
  async uploadFileOpen(
    @UploadedFile() file,
    @Body() body: any,
    @Query('userId') queryUserId?: string,
    @Query('dir') queryDir?: string,
    @Req() req?: Request,
    @Res() res?: Response,
  ) {
    try {
      // userId 可能来自 query 参数或 body（formData）
      const userId = queryUserId || body?.userId || req.body?.userId;
      const dir = body?.dir || queryDir || 'chat/background';

      console.log('[OpenUpload] 接收到上传请求:', {
        userId,
        dir,
        fileName: file?.originalname,
        fileSize: file?.size,
        queryUserId,
        bodyUserId: body?.userId,
      });

      if (!userId) {
        throw new HttpException('userId 必填', HttpStatus.BAD_REQUEST);
      }

      if (!file) {
        throw new HttpException('文件不能为空', HttpStatus.BAD_REQUEST);
      }

      // 构造伪造的 user 对象用于上传
      const fakeUser = { id: parseInt(userId), role: 'visitor' };

      const result = await this.uploadService.uploadFile(file, dir, fakeUser);

      console.log('[OpenUpload] 上传成功:', result);

      return res.status(200).json({ success: true, data: result });
    } catch (e: any) {
      console.error('[OpenUpload] 上传失败:', e.message);
      const status = e instanceof HttpException ? e.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = e?.message || '上传失败';
      return res.status(status).json({ success: false, message });
    }
  }
}
