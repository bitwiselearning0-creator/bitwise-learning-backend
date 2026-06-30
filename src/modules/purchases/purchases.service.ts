import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);
  private razorpay: any;
  private isRazorpayConfigured = false;

  constructor(
    private db: DatabaseService,
    private configService: ConfigService,
  ) {
    this.initRazorpay();
  }

  private initRazorpay() {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    if (keyId && keySecret) {
      try {
        this.razorpay = new Razorpay({
          key_id: keyId,
          key_secret: keySecret,
        });
        this.isRazorpayConfigured = true;
        this.logger.log('Razorpay SDK initialized successfully');
      } catch (err) {
        this.logger.error('Failed to initialize Razorpay SDK', err.stack);
      }
    } else {
      this.logger.warn('Razorpay keys not configured. Running in mock-payment mode for development.');
    }
  }

  async createOrder(userId: string, itemId: string, itemType: 'note' | 'pyq' | 'bundle') {
    // 1. Fetch item details and price
    let title: string;
    let price: number;

    if (itemType === 'bundle') {
      const bundleRes = await this.db.query('SELECT title, price, is_available FROM bundles WHERE id = $1', [itemId]);
      if (bundleRes.rows.length === 0 || !bundleRes.rows[0].is_available) {
        throw new NotFoundException('Bundle not found or unavailable');
      }
      title = bundleRes.rows[0].title;
      price = parseFloat(bundleRes.rows[0].price);
    } else {
      const contentRes = await this.db.query('SELECT title, price, is_available FROM contents WHERE id = $1 AND type = $2', [itemId, itemType]);
      if (contentRes.rows.length === 0 || !contentRes.rows[0].is_available) {
        throw new NotFoundException(`${itemType.toUpperCase()} not found or unavailable`);
      }
      title = contentRes.rows[0].title;
      price = parseFloat(contentRes.rows[0].price);
    }

    if (price <= 0) {
      // Free item - bypass payment gateway and activate subscription immediately
      return this.db.transaction(async (client) => {
        const orderId = `free_order_${crypto.randomBytes(8).toString('hex')}`;
        const purchaseRes = await client.query(
          `INSERT INTO purchases (user_id, order_id, payment_id, purchase_type, item_id, amount, status)
           VALUES ($1, $2, $3, $4, $5, 0.00, 'completed') RETURNING id`,
          [userId, orderId, `free_pay_${crypto.randomBytes(8).toString('hex')}`, itemType, itemId]
        );
        
        await client.query(
          `INSERT INTO subscriptions (user_id, purchase_id, subscription_type, item_id, activated_at, expires_at, is_active)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '6 months', TRUE)`,
          [userId, purchaseRes.rows[0].id, itemType, itemId]
        );

        return {
          orderId,
          amount: 0,
          currency: 'INR',
          status: 'completed',
          free: true,
        };
      });
    }

    // 2. Create Razorpay order
    let razorpayOrderId = `mock_order_${crypto.randomBytes(8).toString('hex')}`;
    const amountInPaise = Math.round(price * 100);

    if (this.isRazorpayConfigured) {
      try {
        const order = await this.razorpay.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `receipt_${itemId.substring(0, 8)}`,
          notes: {
            userId,
            itemId,
            itemType,
          },
        });
        razorpayOrderId = order.id;
      } catch (err) {
        this.logger.error('Razorpay order creation failed', err.stack);
        throw new BadRequestException('Payment gateway failure');
      }
    }

    // 3. Save pending purchase record
    await this.db.query(
      `INSERT INTO purchases (user_id, order_id, purchase_type, item_id, amount, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [userId, razorpayOrderId, itemType, itemId, price]
    );

    return {
      orderId: razorpayOrderId,
      amount: amountInPaise,
      currency: 'INR',
      status: 'pending',
      free: false,
    };
  }

  async handleWebhook(rawBody: Buffer | string, signature: string) {
    const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET', 'mock_webhook_secret');

    // Validate Signature
    if (this.isRazorpayConfigured) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== signature) {
        this.logger.warn('Invalid Razorpay webhook signature');
        throw new BadRequestException('Invalid signature');
      }
    }

    const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf-8'));
    const event = payload.event;

    if (event === 'payment.captured') {
      const paymentEntity = payload.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      this.logger.log(`Payment captured event for order ${orderId}`);

      await this.db.transaction(async (client) => {
        // Find pending purchase
        const purchaseRes = await client.query(
          'SELECT id, user_id, purchase_type, item_id, status FROM purchases WHERE order_id = $1',
          [orderId]
        );

        if (purchaseRes.rows.length === 0) {
          this.logger.warn(`Purchase order ${orderId} not found in database`);
          return;
        }

        const purchase = purchaseRes.rows[0];

        if (purchase.status === 'completed') {
          this.logger.log(`Purchase order ${orderId} is already processed`);
          return;
        }

        // Update purchase
        await client.query(
          `UPDATE purchases 
           SET status = 'completed', payment_id = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [paymentId, purchase.id]
        );

        // Calculate expires_at (6 months from now)
        await client.query(
          `INSERT INTO subscriptions (user_id, purchase_id, subscription_type, item_id, activated_at, expires_at, is_active)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '6 months', TRUE)`,
          [purchase.user_id, purchase.id, purchase.purchase_type, purchase.item_id]
        );

        this.logger.log(
          `Active subscription created for user ${purchase.user_id} on item ${purchase.item_id}`
        );
      });
    }

    return { status: 'processed' };
  }

  async getMyPurchases(userId: string) {
    const res = await this.db.query(
      `SELECT id, order_id AS "orderId", payment_id AS "paymentId", purchase_type AS "purchaseType", 
              item_id AS "itemId", amount, status, created_at AS "createdAt"
       FROM purchases 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows.map((row) => ({
      id: row.id,
      orderId: row.orderId,
      paymentId: row.paymentId,
      purchaseType: row.purchaseType,
      itemId: row.itemId,
      amount: parseFloat(row.amount),
      status: row.status,
      createdAt: row.createdAt,
    }));
  }

  async getMySubscriptions(userId: string) {
    const res = await this.db.query(
      `SELECT id, purchase_id AS "purchaseId", subscription_type AS "subscriptionType", 
              item_id AS "itemId", activated_at AS "activatedAt", expires_at AS "expiresAt", is_active AS "isActive"
       FROM subscriptions 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows.map((row) => ({
      id: row.id,
      purchaseId: row.purchaseId,
      subscriptionType: row.subscriptionType,
      itemId: row.itemId,
      activatedAt: row.activatedAt,
      expiresAt: row.expiresAt,
      isActive: row.isActive && new Date(row.expiresAt) > new Date(),
    }));
  }
}
