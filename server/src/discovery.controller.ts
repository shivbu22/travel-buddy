import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from './auth';
import { SocialService } from './social.service';
@Controller('discovery')
@UseGuards(AuthGuard)
export class DiscoveryController {
  constructor(private service: SocialService) {}
  @Get('feed') feed(@Req() req: AuthedRequest, @Query('tripId') tripId?: string, @Query('style') style?: string) { return this.service.feed(req.userId, tripId, style); }
  @Get('incoming') incoming(@Req() req: AuthedRequest) { return this.service.incomingInterests(req.userId); }
  @Post('incoming/:interestId/dismiss') dismissIncoming(@Req() req: AuthedRequest, @Param('interestId') interestId: string) { return this.service.dismissIncomingInterest(req.userId, interestId); }
  @Post('incoming/:interestId/accept') acceptIncoming(@Req() req: AuthedRequest, @Param('interestId') interestId: string) { return this.service.acceptIncomingInterest(req.userId, interestId); }
  @Post('reset') reset(@Req() req: AuthedRequest) { return this.service.db.pass.deleteMany({ where: { fromUserId: req.userId } }); }
  @Get(':id') profile(@Req() req: AuthedRequest, @Param('id') id: string) { return this.service.profile(req.userId, id); }
  @Post(':id/pass') pass(@Req() req: AuthedRequest, @Param('id') id: string) { return this.service.pass(req.userId, id); }
  @Post(':id/interest') interest(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: object) { return this.service.interest(req.userId, { ...body, toUserId: id }); }
}
