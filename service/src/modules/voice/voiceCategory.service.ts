import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VoiceCategoryEntity } from './voiceCategory.entity';

@Injectable()
export class VoiceCategoryService {
  constructor(
    @InjectRepository(VoiceCategoryEntity)
    private readonly voiceCategoryRepo: Repository<VoiceCategoryEntity>,
  ) {}

  async create(data: {
    name: string;
    description?: string;
    sort?: number;
    isEnabled?: boolean;
  }): Promise<VoiceCategoryEntity> {
    if (!data.name || !data.name.trim()) {
      throw new HttpException('分类名称不能为空', HttpStatus.BAD_REQUEST);
    }

    // 检查名称是否已存在
    const existing = await this.voiceCategoryRepo.findOne({
      where: { name: data.name.trim() },
    });

    if (existing) {
      throw new HttpException('该分类名称已存在', HttpStatus.BAD_REQUEST);
    }

    const category = this.voiceCategoryRepo.create({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      sort: data.sort ?? 0,
      isEnabled: data.isEnabled ?? true,
    });

    return await this.voiceCategoryRepo.save(category);
  }

  async list(): Promise<VoiceCategoryEntity[]> {
    return await this.voiceCategoryRepo.find({
      order: { sort: 'DESC', createdAt: 'DESC' },
    });
  }

  async detail(id: number): Promise<VoiceCategoryEntity> {
    const category = await this.voiceCategoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new HttpException('分类不存在', HttpStatus.NOT_FOUND);
    }
    return category;
  }

  async update(
    id: number,
    data: {
      name?: string;
      description?: string;
      sort?: number;
      isEnabled?: boolean;
    },
  ): Promise<VoiceCategoryEntity> {
    const category = await this.detail(id);

    // 如果要更新名称，检查名称是否已被其他分类使用
    if (data.name && data.name.trim() !== category.name) {
      const existing = await this.voiceCategoryRepo.findOne({
        where: { name: data.name.trim() },
      });
      if (existing && existing.id !== id) {
        throw new HttpException('该分类名称已存在', HttpStatus.BAD_REQUEST);
      }
      category.name = data.name.trim();
    }

    if (data.description !== undefined) {
      category.description = data.description?.trim() || null;
    }
    if (data.sort !== undefined) {
      category.sort = data.sort;
    }
    if (data.isEnabled !== undefined) {
      category.isEnabled = data.isEnabled;
    }

    return await this.voiceCategoryRepo.save(category);
  }

  async remove(id: number): Promise<{ message: string }> {
    const category = await this.detail(id);
    await this.voiceCategoryRepo.remove(category);
    return { message: '删除成功' };
  }
}
