import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber } from 'class-validator';

export class UpdateUserAppSettingsDto {
  @ApiProperty({ example: 1, description: '用户ID', required: true })
  @Type(() => Number)
  @IsNumber({}, { message: 'userId必须是Number' })
  userId: number;

  @ApiProperty({ example: 10000, description: '应用ID（角色ID）', required: true })
  @Type(() => Number)
  @IsNumber({}, { message: 'appId必须是Number' })
  appId: number;

  @ApiProperty({ example: true, description: '是否启用心理描述', required: true })
  @Type(() => Boolean)
  @IsBoolean({ message: 'enablePsychologicalDesc必须是Boolean' })
  enablePsychologicalDesc: boolean;
}
