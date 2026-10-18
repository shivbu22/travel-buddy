import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthService, AuthedRequest } from './auth';
import { RouteConfig } from '@nestjs/platform-fastify';
@Controller('auth')
export class AuthController {
  constructor(private service: AuthService) {}
  @RouteConfig({ rateLimit: { max: 10, timeWindow: '1 minute' } })
  @Post('otp/request') request(@Body() body: { phone?: string }) { return this.service.requestOtp(body?.phone); }
  @RouteConfig({ rateLimit: { max: 20, timeWindow: '1 minute' } })
  @Post('otp/verify') verify(@Body() body: { phone?: string; code?: string }) { return this.service.verifyOtp(body?.phone, body?.code); }
  @RouteConfig({ rateLimit: { max: 10, timeWindow: '1 minute' } })
  @Post('apple') apple(@Body() body: { identityToken?: string; authorizationCode?: string }) { return this.service.apple(body?.identityToken, body?.authorizationCode); }
  @HttpCode(200)
  @Post('apple/notifications') appleNotification(@Body() body: { payload?: string; signedPayload?: string }) { return this.service.handleAppleNotification(body?.payload ?? body?.signedPayload); }
  @Post('refresh') refresh(@Body() body: { refreshToken?: string }) { return this.service.refresh(body?.refreshToken); }
  @Post('logout') async logout(@Body() body: { refreshToken?: string }) { await this.service.logout(body?.refreshToken); return { ok: true }; }
  @UseGuards(AuthGuard)
  @RouteConfig({ rateLimit: { max: 5, timeWindow: '1 minute' } })
  @Post('reauth/request') requestReauth(@Req() req: AuthedRequest) { return this.service.requestReauth(req.userId, req.sessionId); }
  @UseGuards(AuthGuard)
  @RouteConfig({ rateLimit: { max: 10, timeWindow: '1 minute' } })
  @Post('reauth/verify') verifyReauth(@Req() req: AuthedRequest, @Body() body: unknown) { return this.service.verifyReauth(req.userId, req.sessionId, body); }
}
