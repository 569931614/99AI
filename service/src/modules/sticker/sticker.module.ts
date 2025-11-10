import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StickerController } from './sticker.controller';
import { StickerEntity } from './sticker.entity';
import { StickerService } from './sticker.service';

@Module({
  imports: [TypeOrmModule.forFeature([StickerEntity])],
  controllers: [StickerController],
  providers: [StickerService],
  exports: [StickerService],
})
export class StickerModule {}
