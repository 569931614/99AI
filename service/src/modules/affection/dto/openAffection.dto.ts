import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class IncrementAffectionDto {
  @ApiProperty({
    description: '用户ID',
    example: 1,
  })
  @IsNotEmpty({ message: 'userId不能为空' })
  userId: number | string;

  @ApiProperty({
    description: '角色应用ID',
    example: 101,
  })
  @IsNotEmpty({ message: 'appId不能为空' })
  @IsNumber({}, { message: 'appId必须为数字' })
  appId: number;

  @ApiProperty({
    description: '增加的分数（正数增加，负数减少，默认+1）',
    example: 5,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'amount必须为数字' })
  amount?: number;
}

export class SetAffectionDto {
  @ApiProperty({
    description: '用户ID',
    example: 1,
  })
  @IsNotEmpty({ message: 'userId不能为空' })
  userId: number | string;

  @ApiProperty({
    description: '角色应用ID',
    example: 101,
  })
  @IsNotEmpty({ message: 'appId不能为空' })
  @IsNumber({}, { message: 'appId必须为数字' })
  appId: number;

  @ApiProperty({
    description: '要设置的分数（最小为0）',
    example: 50,
  })
  @IsNotEmpty({ message: 'score不能为空' })
  @IsNumber({}, { message: 'score必须为数字' })
  score: number;
}
