import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      
      // Verify user state in database
      const userRes = await this.db.query(
        'SELECT id, email, role, status FROM users WHERE id = $1',
        [payload.sub]
      );

      if (userRes.rows.length === 0) {
        throw new UnauthorizedException('User not found');
      }

      const user = userRes.rows[0];

      if (user.status === 'banned') {
        throw new ForbiddenException('Your account has been banned');
      }

      // Attach user to request object
      request['user'] = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
