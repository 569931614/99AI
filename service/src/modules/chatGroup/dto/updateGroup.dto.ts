import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class UpdateGroupDto {
  @ApiProperty({ example: 1, description: '修改的对话ID', required: false })
  @IsOptional()
  groupId: number;

  @ApiProperty({ example: 10, description: '对话组title', required: false })
  @IsOptional()
  title: string;

  @ApiProperty({ example: '这是一个技术交流群', description: '群聊描述信息', required: false })
  @IsOptional()
  description: string;

  @ApiProperty({ example: '张三', description: '群主在群内的昵称', required: false })
  @IsOptional()
  ownerNickname: string;
}
