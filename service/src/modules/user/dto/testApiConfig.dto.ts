import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class TestApiConfigDto {
  @ApiProperty({
    example: 'https://api.openai.com/v1',
    description: '要测试的API URL',
    required: true,
  })
  @IsNotEmpty({ message: 'API URL不能为空' })
  @IsUrl({}, { message: 'API URL格式不正确' })
  @MaxLength(500, { message: 'API URL长度不能超过500字符' })
  apiUrl: string;

  @ApiProperty({
    example: 'sk-xxxxxxxxxxxxxxxx',
    description: '要测试的API Key',
    required: true,
  })
  @IsNotEmpty({ message: 'API Key不能为空' })
  @IsString({ message: 'API Key必须是字符串' })
  @MaxLength(500, { message: 'API Key长度不能超过500字符' })
  apiKey: string;

  @ApiProperty({
    example: 'gpt-3.5-turbo',
    description: '要使用的模型名称',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '模型名称必须是字符串' })
  @MaxLength(100, { message: '模型名称长度不能超过100字符' })
  modelName?: string;
}
