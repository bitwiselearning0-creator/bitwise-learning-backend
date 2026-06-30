import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionInterceptor implements NestInterceptor {
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor(private configService: ConfigService) {
    const secret = this.configService.get<string>('API_ENCRYPTION_KEY', 'default_secret_32_bytes_long_key_!');
    // Ensure the key is exactly 32 bytes
    this.encryptionKey = crypto.createHash('sha256').update(secret).digest();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    // Check if the client sent encrypted data
    if (request.body && request.body.ciphertext && request.body.iv && request.body.tag) {
      try {
        request.body = this.decrypt(request.body);
      } catch (err) {
        throw new BadRequestException('Failed to decrypt request payload');
      }
    }

    return next.handle().pipe(
      map((data) => {
        // Skip encryption for file streams or if data is already a buffer or empty
        if (!data || data instanceof Buffer || data.stream || response.getHeader('Content-Type')?.includes('pdf')) {
          return data;
        }

        // Encrypt the outgoing response payload
        return this.encrypt(data);
      }),
    );
  }

  private encrypt(data: any) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    let ciphertext = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    return {
      ciphertext,
      iv: iv.toString('hex'),
      tag,
    };
  }

  private decrypt(encrypted: { ciphertext: string; iv: string; tag: string }) {
    const iv = Buffer.from(encrypted.iv, 'hex');
    const tag = Buffer.from(encrypted.tag, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }
}
