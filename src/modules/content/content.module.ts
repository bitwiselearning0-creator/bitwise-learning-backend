import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { MetadataController } from './metadata.controller';
import { ContentService } from './content.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ContentController, MetadataController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
