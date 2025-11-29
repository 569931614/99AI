import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UserApiConfigDto {
  @ApiProperty({
    example: 'https://api.openai.com/v1',
    description: '自定义大模型API URL',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'API URL格式不正确' })
  @MaxLength(500, { message: 'API URL长度不能超过500字符' })
  apiUrl?: string;

  @ApiProperty({
    example: 'sk-xxxxxxxxxxxxxxxx',
    description: '自定义大模型API Key',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'API Key必须是字符串' })
  @MaxLength(500, { message: 'API Key长度不能超过500字符' })
  apiKey?: string;

  @ApiProperty({
    example: 'gpt-3.5-turbo',
    description: '自定义API使用的模型名称',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '模型名称必须是字符串' })
  @MaxLength(100, { message: '模型名称长度不能超过100字符' })
  modelName?: string;

  @ApiProperty({
    example: true,
    description: '是否启用自定义API配置',
    required: true,
  })
  @IsBoolean({ message: 'enabled必须是布尔值' })
  enabled: boolean;
}
