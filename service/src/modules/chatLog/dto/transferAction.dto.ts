import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsIn } from 'class-validator';

export class TransferActionDto {
  @ApiProperty({ example: 123, description: '聊天记录ID（转账消息）' })
  @IsNotEmpty({ message: '聊天记录ID不能为空' })
  @IsNumber()
  chatId: number;

  @ApiProperty({
    example: 'received',
    description: '操作类型: received=领取, returned=退还',
    enum: ['received', 'returned'],
  })
  @IsNotEmpty({ message: '操作类型不能为空' })
  @IsString()
  @IsIn(['received', 'returned'], { message: '操作类型只能是 received 或 returned' })
  action: 'received' | 'returned';
}
