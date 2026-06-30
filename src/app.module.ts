import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { StorageModule } from './common/services/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContentModule } from './modules/content/content.module';
import { VideosModule } from './modules/videos/videos.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { AdminModule } from './modules/admin/admin.module';
import { ExpiryCron } from './tasks/expiry.cron';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    StorageModule,
    AuthModule,
    ContentModule,
    VideosModule,
    PurchasesModule,
    AdminModule,
  ],
  providers: [ExpiryCron],
})
export class AppModule {}
