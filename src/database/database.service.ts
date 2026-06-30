import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('DB_HOST', 'localhost');
    const port = this.configService.get<number>('DB_PORT', 5432);
    const database = this.configService.get<string>('DB_NAME', 'bitwise_learning');
    const user = this.configService.get<string>('DB_USER', 'postgres');
    const password = this.configService.get<string>('DB_PASSWORD', 'postgres');
    const dbSsl = this.configService.get<any>('DB_SSL');
    const ssl = (dbSsl === 'true' || dbSsl === true)
      ? { rejectUnauthorized: false }
      : undefined;

    const poolConfig: any = {
      host,
      port,
      database,
      user,
      password,
      ssl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    if (host.endsWith('.supabase.co')) {
      const dns = require('dns');
      poolConfig.lookup = (hostname, options, callback) => {
        let cb = callback;
        if (typeof options === 'function') {
          cb = options;
        }
        dns.lookup('aws-0-ap-northeast-1.pooler.supabase.com', { family: 4 }, (err, address) => {
          if (err) {
            cb(err);
          } else {
            cb(null, address, 4);
          }
        });
      };
    }

    this.pool = new Pool(poolConfig);

    this.logger.log('PostgreSQL Connection Pool initialized');
  }

  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log('PostgreSQL Connection Pool closed');
  }

  /**
   * Execute a single query helper
   */
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      this.logger.debug(`Executed query: ${text} | Duration: ${duration}ms`);
      return res;
    } catch (error) {
      this.logger.error(`Query failed: ${text}`, error.stack);
      throw error;
    }
  }

  /**
   * Execute a transaction helper
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction rolled back', error.stack);
      throw error;
    } finally {
      client.release();
    }
  }
}
