import { JwtAuthGuard } from '@/common/auth/jwtAuth.guard';
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ChatGroupService } from './chatGroup.service';
import { CreateGroupDto } from './dto/createGroup.dto';
import { DelGroupDto } from './dto/delGroup.dto';
import { UpdateGroupDto } from './dto/updateGroup.dto';

@ApiTags('group')
@Controller('group')
export class ChatGroupController {
  constructor(private readonly chatGroupService: ChatGroupService) {}

  @Post('create')
  @ApiOperation({ summary: '创建对话组' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@Body() body: CreateGroupDto, @Req() req: Request) {
    return this.chatGroupService.create(body, req);
  }

  @Get('query')
  @ApiOperation({ summary: '查询对话组' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  query(@Req() req: Request) {
    return this.chatGroupService.query(req);
  }

  @Post('update')
  @ApiOperation({ summary: '更新对话组' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(@Body() body: UpdateGroupDto, @Req() req: Request) {
    return this.chatGroupService.update(body, req);
  }

  @Post('del')
  @ApiOperation({ summary: '删除对话组' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  del(@Body() body: DelGroupDto, @Req() req: Request) {
    return this.chatGroupService.del(body, req);
  }

  @Post('delAll')
  @ApiOperation({ summary: '删除对话组' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  delAll(@Req() req: Request) {
    return this.chatGroupService.delAll(req);
  }

  // ==== 群组成员与任务 ====
  @Post('members/add')
  @ApiOperation({ summary: '群组新增成员' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  addMember(
    @Body() body: { groupId: number; userId: number; name?: string; role?: string; order?: number },
    @Req() req: Request,
  ) {
    return this.chatGroupService.addMember(body, req);
  }

  @Post('members/remove')
  @ApiOperation({ summary: '群组移除成员' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  removeMember(@Body() body: { groupId: number; userId: number }, @Req() req: Request) {
    return this.chatGroupService.removeMember(body, req);
  }

  @Post('members/list')
  @ApiOperation({ summary: '群组成员列表' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listMembers(@Body() body: { groupId: number }, @Req() req: Request) {
    return this.chatGroupService.listMembers(body, req);
  }

  @Post('task/assign')
  @ApiOperation({ summary: '为成员分配任务' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  assignTask(
    @Body()
    body: {
      groupId: number;
      userId: number;
      taskId?: string;
      title: string;
      detail?: string;
      status?: string;
    },
    @Req() req: Request,
  ) {
    return this.chatGroupService.assignTask(body, req);
  }

  @Post('task/update')
  @ApiOperation({ summary: '更新成员任务' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateTask(
    @Body()
    body: {
      groupId: number;
      userId: number;
      taskId: string;
      title?: string;
      detail?: string;
      status?: string;
    },
    @Req() req: Request,
  ) {
    return this.chatGroupService.updateTask(body, req);
  }

  @Post('members/update')
  @ApiOperation({ summary: '更新群员信息（角色/顺序/昵称）' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateMember(
    @Body() body: { groupId: number; userId: number; name?: string; role?: string; order?: number },
    @Req() req: Request,
  ) {
    return this.chatGroupService.updateMember(body, req);
  }
}
