import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(private db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request['user'];
    
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const deviceId = request.headers['x-device-id'] as string;
    
    if (!deviceId) {
      throw new UnauthorizedException('Device Identifier (X-Device-Id) is required');
    }

    // Query user device binding
    const userRes = await this.db.query(
      'SELECT device_id, role FROM users WHERE id = $1',
      [user.id]
    );

    if (userRes.rows.length === 0) {
      throw new UnauthorizedException('User not found');
    }

    const dbUser = userRes.rows[0];

    // Admins are exempt from device binding to allow them to test on multiple devices/emulators
    if (dbUser.role === 'admin') {
      return true;
    }

    if (!dbUser.device_id) {
      // Auto-bind on first request if empty
      await this.db.query(
        'UPDATE users SET device_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [deviceId, user.id]
      );
      return true;
    }

    if (dbUser.device_id !== deviceId) {
      throw new ForbiddenException(
        'Device mismatch: This account is bound to another device. Please contact support to transfer devices.'
      );
    }

    return true;
  }
}
