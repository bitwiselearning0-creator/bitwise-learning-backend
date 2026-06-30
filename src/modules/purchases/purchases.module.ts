import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { PurchasesService } from './purchases.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PurchasesController, SubscriptionsController],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
