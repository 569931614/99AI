import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class TransferDecisionDto {
  @ApiProperty({ example: 123, description: '转账消息的chatId' })
  @IsNotEmpty({ message: 'chatId不能为空' })
  @IsNumber()
  chatId: number;

  @ApiProperty({ example: 1, description: '应用/角色ID' })
  @IsNotEmpty({ message: 'appId不能为空' })
  @IsNumber()
  appId: number;

  @ApiProperty({ example: 1, description: '会话组ID' })
  @IsOptional()
  @IsNumber()
  groupId?: number;

  @ApiProperty({ example: '520.00', description: '转账金额' })
  @IsNotEmpty({ message: '转账金额不能为空' })
  @IsString()
  amount: string;

  @ApiProperty({ example: '买礼物', description: '转账说明' })
  @IsOptional()
  @IsString()
  description?: string;
}
