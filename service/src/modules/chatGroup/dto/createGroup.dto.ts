import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: '我的群聊', description: '群聊名称', required: false })
  @IsOptional()
  title?: string;

  @ApiProperty({
    example: '这是一个关于技术交流的群聊',
    description: '群聊描述信息',
    required: false,
  })
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '张三',
    description: '群主在群内的昵称',
    required: false,
  })
  @IsOptional()
  ownerNickname?: string;

  @ApiProperty({
    example: 0,
    description: '应用ID（角色ID）',
    required: false,
  })
  @IsOptional()
  appId?: number;

  @ApiProperty({
    example: '',
    description: '对话模型配置项序列化的字符串',
    required: false,
  })
  modelConfig?: any;

  @ApiProperty({
    example: '',
    description: '对话组参数序列化的字符串',
    required: false,
  })
  params?: string;
}
