import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class QuerAppDto {
  @ApiProperty({ example: 1, description: '查询页数', required: false })
  @IsOptional()
  page: number;

  @ApiProperty({ example: 10, description: '每页数量', required: false })
  @IsOptional()
  size: number;

  @ApiProperty({ example: 'name', description: 'app名称', required: false })
  @IsOptional()
  name: string;

  @ApiProperty({
    example: 1,
    description: 'app状态 0：禁用 1：启用 3:审核加入广场中 4：已拒绝加入广场',
    required: false,
  })
  @IsOptional()
  status: number;

  @ApiProperty({ example: 2, description: 'app分类Id', required: false })
  @IsOptional()
  catId: number;

  @ApiProperty({ example: 'role', description: 'app角色', required: false })
  @IsOptional()
  role: string;

  @ApiProperty({
    example: '关键词',
    description: '搜索关键词',
    required: false,
  })
  @IsOptional()
  keyword: string;

  @ApiProperty({ example: 1, description: '用户ID（传入时过滤掉已添加的角色）', required: false })
  @IsOptional()
  userId: number;

  @ApiProperty({
    example: '1,2,3',
    description: '需要排除的App ID列表（逗号分隔）',
    required: false,
  })
  @IsOptional()
  excludeIds: string;

  @ApiProperty({
    example: true,
    description: '是否只返回该用户创建的角色（配合userId使用）',
    required: false,
  })
  @IsOptional()
  onlyOwn: boolean;

  @ApiProperty({
    example: false,
    description: '是否排除已添加的单聊角色（默认true，传false则不排除）',
    required: false,
  })
  @IsOptional()
  excludeAdded: boolean;

  @ApiProperty({
    example: true,
    description: '是否只查询系统角色（true：只查系统角色，false：只查自创角色，不传：根据userId自动判断）',
    required: false,
  })
  @IsOptional()
  isSystem: boolean;
}
