import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StickerController } from './sticker.controller';
import { StickerEntity } from './sticker.entity';
import { StickerService } from './sticker.service';
import { GlobalConfigModule } from '../globalConfig/globalConfig.module';

@Module({
  imports: [TypeOrmModule.forFeature([StickerEntity]), GlobalConfigModule],
  controllers: [StickerController],
  providers: [StickerService],
  exports: [StickerService],
})
export class StickerModule {}
