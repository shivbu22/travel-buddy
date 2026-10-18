import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from './auth';
import { SocialService } from './social.service';
@Controller('trips')
@UseGuards(AuthGuard)
export class TripsController {
  constructor(private service: SocialService) {}
  @Get() list(@Req() req: AuthedRequest) { return this.service.trips(req.userId); }
  @Post() create(@Req() req: AuthedRequest, @Body() body: unknown) { return this.service.saveTrip(req.userId, body); }
  @Put(':id') update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) { return this.service.saveTrip(req.userId, body, id); }
  @Delete(':id') close(@Req() req: AuthedRequest, @Param('id') id: string) { return this.service.closeTrip(req.userId, id); }
}
