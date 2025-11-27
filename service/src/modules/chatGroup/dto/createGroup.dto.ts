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
    example: '你好，欢迎来到我们的群聊！',
    description: '开场白（会作为第一条消息保存到chatLog）',
    required: false,
  })
  @IsOptional()
  openingRemark?: string;

  @ApiProperty({
    example: 'https://example.com/background.jpg',
    description: '群聊背景图片URL',
    required: false,
  })
  @IsOptional()
  backgroundImage?: string;

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

  @ApiProperty({
    example: 0,
    description: '是否主动发消息（0否 1是）',
    required: false,
  })
  @IsOptional()
  proactivelySend?: number;

  @ApiProperty({
    example: 0,
    description: '是否开启心理动作描述（0否 1是）',
    required: false,
  })
  @IsOptional()
  describingMental?: number;

  @ApiProperty({
    example: 0,
    description: '是否开启真实时间（0否 1是）',
    required: false,
  })
  @IsOptional()
  realTime?: number;

  @ApiProperty({
    example: 1,
    description: '最多回复条数（默认1）',
    required: false,
  })
  @IsOptional()
  maxReplyCount?: number;

  @ApiProperty({
    example: 0,
    description: '是否开启翻译（0否 1是）',
    required: false,
  })
  @IsOptional()
  enableTranslation?: number;
}
