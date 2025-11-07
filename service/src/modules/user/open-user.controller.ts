import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MaobingAuthUtil } from '@/common/utils/maobing-auth.util';
import { SyncProfileDto } from './dto/syncProfile.dto';
import { UserService } from './user.service';

@ApiTags('open-user')
@Controller('open/user')
export class OpenUserController {
  constructor(private readonly userService: UserService) {}

  @Post('syncProfile')
  @ApiOperation({ summary: '【开放】同步用户资料（来自cat_AI，使用token验证）' })
  async syncProfile(@Body() body: SyncProfileDto & { token: string; maobingBaseUrl?: string }) {
    const { token, username, bio, maobingBaseUrl } = body;

    if (!token) {
      throw new HttpException('token 是必填参数', HttpStatus.BAD_REQUEST);
    }

    // 从 token 验证并获取 userId
    const userId = await MaobingAuthUtil.validateTokenAndGetUserId(token, maobingBaseUrl);

    if (!userId) {
      throw new HttpException('token 验证失败或已过期', HttpStatus.UNAUTHORIZED);
    }

    return await this.userService.syncProfile(userId, username, bio);
  }
}
