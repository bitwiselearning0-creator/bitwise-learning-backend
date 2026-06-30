import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { DeviceGuard } from '../../common/guards/device.guard';
import { PurchasesService } from './purchases.service';
import { Request } from 'express';

@Controller('api/v1/purchases')
export class PurchasesController {
  constructor(private purchasesService: PurchasesService) {}

  @Post('create-order')
  @UseGuards(AuthGuard, DeviceGuard)
  @HttpCode(HttpStatus.OK)
  async createOrder(
    @Req() req: Request,
    @Body('itemId') itemId: string,
    @Body('itemType') itemType: 'note' | 'pyq' | 'bundle',
  ) {
    if (!itemId || !itemType) {
      throw new BadRequestException('itemId and itemType are required');
    }
    const user = req['user'];
    return this.purchasesService.createOrder(user.id, itemId, itemType);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: any,
    @Headers('x-razorpay-signature') signature: string,
    @Body() body: any,
  ) {
    const rawBody = req.rawBody || Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    return this.purchasesService.handleWebhook(rawBody, signature);
  }

  @Get('my-purchases')
  @UseGuards(AuthGuard, DeviceGuard)
  async getMyPurchases(@Req() req: Request) {
    const user = req['user'];
    return this.purchasesService.getMyPurchases(user.id);
  }
}
