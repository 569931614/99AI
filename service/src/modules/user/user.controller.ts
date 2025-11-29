import { AdminAuthGuard } from '@/common/auth/adminAuth.guard';
import { JwtAuthGuard } from '@/common/auth/jwtAuth.guard';
import { SuperAuthGuard } from '@/common/auth/superAuth.guard';
import { Body, Controller, Get, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { QueryAllUserDto } from './dto/queryAllUser.dto';
import { ResetUserPassDto } from './dto/resetUserPass.dto';
import { SyncProfileDto } from './dto/syncProfile.dto';
import { TestApiConfigDto } from './dto/testApiConfig.dto';
import { UpdateUserDto } from './dto/updateUser.dto';
import { UpdateUserStatusDto } from './dto/updateUserStatus.dto';
import { UserApiConfigDto } from './dto/userApiConfig.dto';
import { UserRechargeDto } from './dto/userRecharge.dto';
import { UserService } from './user.service';

@Controller('user')
@ApiTags('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('update')
  @ApiOperation({ summary: '更新用户信息' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async update(@Body() body: UpdateUserDto, @Req() req: Request) {
    return await this.userService.updateInfo(body, req);
  }

  @Post('recharge')
  @ApiOperation({ summary: '用户充值' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  async userRecharge(@Body() body: UserRechargeDto) {
    return await this.userService.userRecharge(body);
  }

  @Get('queryAll')
  @ApiOperation({ summary: '查询所有用户' })
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  async queryAll(@Query() query: QueryAllUserDto, @Req() req: Request) {
    return await this.userService.queryAll(query, req);
  }

  // @Get('queryOne')
  // @ApiOperation({ summary: '查询单个用户' })
  // @UseGuards(AdminAuthGuard)
  // @ApiBearerAuth()
  // async queryOne(@Query() params: QueryOneUserDto) {
  //   return await this.userService.queryOne(params);
  // }

  @Post('updateStatus')
  @ApiOperation({ summary: '更新用户状态' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  async updateStatus(@Body() body: UpdateUserStatusDto) {
    return await this.userService.updateStatus(body);
  }

  @Post('resetUserPass')
  @ApiOperation({ summary: '重置用户密码' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  async resetUserPass(@Body() body: ResetUserPassDto) {
    return await this.userService.resetUserPass(body);
  }

  @Post('syncProfile')
  @ApiOperation({ summary: '同步用户资料（来自cat_AI）' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async syncProfile(@Body() body: SyncProfileDto, @Req() req: Request) {
    const userId = req.user.id;
    return await this.userService.syncProfile(userId, body.username, body.bio);
  }

  /* ============ 用户自定义API配置端点 ============ */

  @Get('api-config')
  @ApiOperation({ summary: '获取当前用户的自定义API配置' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getApiConfig(@Req() req: Request) {
    const userId = req.user.id;
    const config = await this.userService.getUserApiConfig(userId);
    return {
      success: true,
      data: config,
    };
  }

  @Put('api-config')
  @ApiOperation({ summary: '更新当前用户的自定义API配置' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateApiConfig(@Body() body: UserApiConfigDto, @Req() req: Request) {
    const userId = req.user.id;
    return await this.userService.updateUserApiConfig(userId, body);
  }

  @Post('api-config/test')
  @ApiOperation({ summary: '测试自定义API配置的连通性' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async testApiConfig(@Body() body: TestApiConfigDto) {
    try {
      const result = await this.userService.testApiConnection(
        body.apiUrl,
        body.apiKey,
        body.modelName,
      );
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message || 'API连接测试失败',
      };
    }
  }
}
