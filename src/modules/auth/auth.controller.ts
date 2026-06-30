import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('test-db')
  async testDb() {
    return this.authService.testDatabaseConnection();
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleAuth(
    @Body('idToken') idToken: string,
    @Body('deviceId') deviceId: string,
  ) {
    return this.authService.loginWithGoogle(idToken, deviceId);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('deviceId') deviceId: string,
  ) {
    return this.authService.loginWithEmailPassword(email, password, deviceId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }
}
