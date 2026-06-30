import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { DeviceGuard } from '../../common/guards/device.guard';
import { PurchasesService } from './purchases.service';
import { Request } from 'express';

@Controller('api/v1/subscriptions')
@UseGuards(AuthGuard, DeviceGuard)
export class SubscriptionsController {
  constructor(private purchasesService: PurchasesService) {}

  @Get('my-subscriptions')
  async getMySubscriptions(@Req() req: Request) {
    const user = req['user'];
    return this.purchasesService.getMySubscriptions(user.id);
  }
}
