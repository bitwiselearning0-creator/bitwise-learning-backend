import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionInterceptor } from './common/interceptors/encryption.interceptor';
import helmet from 'helmet';
import * as dns from 'dns';

// Global DNS lookup override for Supabase connection IPv4 compatibility on Render
const originalLookup = dns.lookup;
(dns as any).lookup = function (hostname: string, options: any, callback: any) {
  let cb = callback;
  let opts = options;
  if (typeof options === 'function') {
    cb = options;
    opts = {};
  }

  const cleanHost = hostname.replace(/['"]/g, '').trim();
  const targetHost = process.env.DB_HOST ? process.env.DB_HOST.replace(/['"]/g, '').trim() : '';

  if (targetHost && cleanHost === targetHost && cleanHost.endsWith('.supabase.co')) {
    const overrideOpts = typeof opts === 'object' ? { ...opts, family: 4 } : { family: 4 };
    return originalLookup('aws-1-ap-northeast-1.pooler.supabase.com', overrideOpts, cb);
  }

  return originalLookup(hostname, opts, cb);
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // Apply Helmet middleware for secure headers (XSS, Clickjacking, MIME type spoofing, etc.)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
      },
    },
  }));

  // Enable CORS
  app.enableCors({
    origin: '*', // In production, replace with specific domain client url
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Authorization, X-Device-Id',
  });

  // Global validation pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // Register Global Encryption Interceptor
  app.useGlobalInterceptors(new EncryptionInterceptor(configService));

  await app.listen(port);
  logger.log(`Bitwise Learning Backend API is running on: http://localhost:${port}`);
}

bootstrap();
