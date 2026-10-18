import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from './auth';
import { SocialService } from './social.service';
import { RealtimeGateway } from './realtime';
import { RouteConfig } from '@nestjs/platform-fastify';
@Controller('matches')
@UseGuards(AuthGuard)
export class MatchesController {
  constructor(private service: SocialService, private realtime: RealtimeGateway) {}
  @Get() list(@Req() req: AuthedRequest) { return this.service.matches(req.userId); }
  @Get(':id/messages') messages(@Req() req: AuthedRequest, @Param('id') id: string, @Query('before') before?: string) { return this.service.messages(req.userId, id, before); }
  @Post(':id/messages') @RouteConfig({ rateLimit: { max: 60, timeWindow: '1 minute' } }) async send(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) { const message = await this.service.send(req.userId, id, body); await this.realtime.message(message); return message; }
  @Delete(':id') async end(@Req() req: AuthedRequest, @Param('id') id: string) { await this.service.unmatch(req.userId, id); this.realtime.ended(id); }
}
