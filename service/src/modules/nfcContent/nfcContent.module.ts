import { Module, forwardRef } from '@nestjs/common';
import { NfcContentService } from './nfcContent.service';
import { AppModule } from '../app/app.module';

@Module({
  imports: [forwardRef(() => AppModule)],
  providers: [NfcContentService],
  exports: [NfcContentService],
})
export class NfcContentModule {}
