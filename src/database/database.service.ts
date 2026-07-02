import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const rawHost = this.configService.get<string>('DB_HOST', 'localhost');
    const host = typeof rawHost === 'string' ? rawHost.replace(/['"]/g, '').trim() : rawHost;
    this.logger.log(`DB Host parsed: [${host}]`);
    this.logger.log(`Is Supabase: ${host.endsWith('.supabase.co')}`);

    const port = this.configService.get<number>('DB_PORT', 5432);

    const rawDatabase = this.configService.get<string>('DB_NAME', 'bitwise_learning');
    const database = typeof rawDatabase === 'string' ? rawDatabase.replace(/['"]/g, '').trim() : rawDatabase;

    const rawUser = this.configService.get<string>('DB_USER', 'postgres');
    const user = typeof rawUser === 'string' ? rawUser.replace(/['"]/g, '').trim() : rawUser;

    const rawPassword = this.configService.get<string>('DB_PASSWORD', 'postgres');
    const password = typeof rawPassword === 'string' ? rawPassword.replace(/['"]/g, '').trim() : rawPassword;

    const dbSsl = this.configService.get<any>('DB_SSL');
    const sslStr = typeof dbSsl === 'string' ? dbSsl.replace(/['"]/g, '').trim() : String(dbSsl);
    const ssl = (sslStr === 'true' || dbSsl === true)
      ? { rejectUnauthorized: false }
      : undefined;

    const poolConfig: any = {
      host,
      port,
      database,
      user,
      password,
      ssl,
      max: 20, // max connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    if (host.endsWith('.supabase.co')) {
      const dns = require('dns');
      poolConfig.lookup = (hostname: string, options: any, callback: any) => {
        let cb = callback;
        let opts = options;
        if (typeof options === 'function') {
          cb = options;
          opts = {};
        }
        const overrideOpts = typeof opts === 'object' ? { ...opts, family: 4 } : { family: 4 };
        return dns.lookup('aws-1-ap-northeast-1.pooler.supabase.com', overrideOpts, cb);
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
