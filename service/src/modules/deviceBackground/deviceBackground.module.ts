import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceBackgroundEntity } from './deviceBackground.entity';
import { DeviceBackgroundService } from './deviceBackground.service';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceBackgroundEntity])],
  providers: [DeviceBackgroundService],
  exports: [DeviceBackgroundService],
})
export class DeviceBackgroundModule {}
