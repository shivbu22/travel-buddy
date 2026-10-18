import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('health')
export class HealthController {
  constructor(private db: PrismaService) {}
  @Get()
  async getHealth() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok', service: 'travelbuddy-api', production: process.env.NODE_ENV === 'production', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException('Database is temporarily unavailable.');
    }
  }
}
