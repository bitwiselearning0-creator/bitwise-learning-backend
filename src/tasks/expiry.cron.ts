import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ExpiryCron {
  private readonly logger = new Logger(ExpiryCron.name);

  constructor(private db: DatabaseService) {}

  /**
   * Runs daily at midnight (12:00 AM) to deactivate expired subscriptions
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSubscriptionExpirations() {
    this.logger.log('Starting daily subscription expiry check...');
    
    try {
      const result = await this.db.query(`
        UPDATE subscriptions
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE expires_at <= CURRENT_TIMESTAMP
          AND is_active = TRUE
        RETURNING id, user_id, item_id;
      `);

      this.logger.log(`Subscription check completed. Deactivated ${result.rowCount} expired subscriptions.`);
      
      if (result.rowCount > 0) {
        for (const sub of result.rows) {
          this.logger.log(`Deactivated subscription ${sub.id} for user ${sub.user_id}`);
          // Integration point: Trigger custom notification / email system here
        }
      }
    } catch (err) {
      this.logger.error('Failed to process subscription expirations', err.stack);
    }
  }

  /**
   * Runs daily at 9:00 AM to notify users whose subscriptions will expire in 7 days or 1 day
   */
  @Cron('0 9 * * *') // Every day at 9:00 AM
  async sendExpiryReminders() {
    this.logger.log('Checking for subscriptions expiring in 1 or 7 days...');

    try {
      // 1. Expiring in 7 days
      const sevenDaysRes = await this.db.query(`
        SELECT s.id, s.user_id, s.item_id, u.email, u.full_name
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.expires_at BETWEEN CURRENT_TIMESTAMP + INTERVAL '6 days' AND CURRENT_TIMESTAMP + INTERVAL '7 days'
          AND s.is_active = TRUE;
      `);

      for (const row of sevenDaysRes.rows) {
        this.logger.log(`Reminder: User ${row.full_name} (${row.email}) subscription on item ${row.item_id} expires in 7 days`);
        // Trigger push notification using Firebase Cloud Messaging (FCM)
      }

      // 2. Expiring in 1 day
      const oneDayRes = await this.db.query(`
        SELECT s.id, s.user_id, s.item_id, u.email, u.full_name
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.expires_at BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '1 day'
          AND s.is_active = TRUE;
      `);

      for (const row of oneDayRes.rows) {
        this.logger.log(`Reminder: User ${row.full_name} (${row.email}) subscription on item ${row.item_id} expires in 24 hours`);
        // Trigger high-priority push notification / warning
      }

    } catch (err) {
      this.logger.error('Failed to run subscription expiry reminders', err.stack);
    }
  }
}
