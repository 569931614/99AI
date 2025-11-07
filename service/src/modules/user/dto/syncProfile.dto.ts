import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SyncProfileDto {
  @ApiProperty({
    example: '张三',
    description: '用户名称',
    required: true,
  })
  @IsString({ message: '用户名必须是字符串！' })
  @IsNotEmpty({ message: '用户名不能为空！' })
  @MaxLength(12, { message: '用户名不得超过12位！' })
  username: string;

  @ApiProperty({
    example: '这是我的个人简介',
    description: '用户简介',
    required: false,
  })
  @IsString({ message: '用户简介必须是字符串！' })
  @IsOptional()
  @MaxLength(500, { message: '用户简介不得超过500字符！' })
  bio?: string;
}
