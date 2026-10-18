import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from './auth';
import { SubscriptionService } from './subscription.service';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly service: SubscriptionService) {}

  @Get('plans')
  plans() {
    return this.service.getOfferings();
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: AuthedRequest) {
    return this.service.getEntitlement(req.userId);
  }

  @Post('upgrade')
  @UseGuards(AuthGuard)
  upgrade(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.service.upgrade(req.userId, body);
  }

  @Post('restore')
  @UseGuards(AuthGuard)
  restore(@Req() req: AuthedRequest) {
    return this.service.restore(req.userId);
  }

  @Post('cancel')
  @UseGuards(AuthGuard)
  cancel(@Req() req: AuthedRequest) {
    return this.service.cancel(req.userId);
  }

  @Get('dealbreakers')
  @UseGuards(AuthGuard)
  getDealbreakers(@Req() req: AuthedRequest) {
    return this.service.getDealbreakers(req.userId);
  }

  @Put('dealbreakers')
  @UseGuards(AuthGuard)
  updateDealbreakers(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.service.updateDealbreakers(req.userId, body);
  }
}
