import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from './auth';
import { SocialService } from './social.service';
import { RealtimeGateway } from './realtime';
@Controller('safety')
@UseGuards(AuthGuard)
export class SafetyController {
  constructor(private service: SocialService, private realtime: RealtimeGateway) {}
  @Post('block/:id') async block(@Req() req: AuthedRequest, @Param('id') id: string) {
    const matches = await this.service.db.match.findMany({ where: { pairKey: [id, req.userId].sort().join(':') } });
    await this.service.block(req.userId, id); matches.forEach((m) => this.realtime.ended(m.id)); return { ok: true };
  }
  @Get('blocks') async blocks(@Req() req: AuthedRequest) { return Promise.all((await this.service.db.block.findMany({ where: { blockerId: req.userId } })).map(async (b) => { const u = await this.service.me(b.blockedId); return { id: u.id, name: u.name }; })); }
  @Delete('block/:id') async unblock(@Req() req: AuthedRequest, @Param('id') id: string) { await this.service.db.block.deleteMany({ where: { blockerId: req.userId, blockedId: id } }); return { ok: true }; }
  @Post('report') async report(@Req() req: AuthedRequest, @Body() body: unknown) { const report = await this.service.report(req.userId, body); return { id: report.id }; }
}
