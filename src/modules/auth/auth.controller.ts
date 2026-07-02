import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('test-db')
  async testDb() {
    return this.authService.testDatabaseConnection();
  }

  @Get('version-check')
  @HttpCode(HttpStatus.OK)
  async versionCheck(@Query('currentVersion') currentVersion: string) {
    const latestVersion = process.env.APP_LATEST_VERSION || '1.0.0';
    const minRequiredVersion = process.env.APP_MIN_REQUIRED_VERSION || '1.0.0';
    const downloadUrl = process.env.APP_DOWNLOAD_URL || 'https://play.google.com/store/apps/details?id=com.bitwise.learning';

    const current = currentVersion || '1.0.0';
    
    const isVersionOlder = (curr: string, target: string): boolean => {
      const currParts = curr.split('.').map(v => parseInt(v, 10) || 0);
      const targetParts = target.split('.').map(v => parseInt(v, 10) || 0);
      for (let i = 0; i < Math.max(currParts.length, targetParts.length); i++) {
        const c = currParts[i] || 0;
        const t = targetParts[i] || 0;
        if (c < t) return true;
        if (c > t) return false;
      }
      return false;
    };

    const updateRequired = isVersionOlder(current, latestVersion);
    const forceUpdate = isVersionOlder(current, minRequiredVersion);

    return {
      latestVersion,
      minRequiredVersion,
      downloadUrl,
      updateRequired,
      forceUpdate,
    };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleAuth(
    @Body('idToken') idToken: string,
    @Body('deviceId') deviceId: string,
  ) {
    return this.authService.loginWithGoogle(idToken, deviceId);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: any,
  ) {
    return this.authService.registerStudent(body);
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
