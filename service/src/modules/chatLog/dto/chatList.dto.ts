import { IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatListDto {
  @ApiProperty({ example: 1, description: '对话分组ID', required: false })
  @IsOptional()
  groupId: number;

  @ApiProperty({ example: 1, description: '页码', required: false })
  @IsOptional()
  page: number;

  @ApiProperty({ example: 20, description: '每页数量', required: false })
  @IsOptional()
  pageSize: number;
}
