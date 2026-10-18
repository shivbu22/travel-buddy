import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HealthController } from './health.controller';
import { AuthController } from './auth.controller';
import { ProfileController } from './profile.controller';
import { DiscoveryController } from './discovery.controller';
import { TripsController } from './trips.controller';
import { MatchesController } from './matches.controller';
import { SafetyController } from './safety.controller';
import { PrismaService } from './prisma.service';
import { AuthGuard, AuthService } from './auth';
import { SocialService } from './social.service';
import { RealtimeGateway } from './realtime';
import { AccountController, AdminController } from './account.controller';
import { VerificationAdminController, VerificationController } from './verification.controller';
import { PostsController } from './posts.controller';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET || 'dev-only-change-me', signOptions: { expiresIn: '15m' } })],
  controllers: [HealthController, AuthController, ProfileController, DiscoveryController, TripsController, MatchesController, SafetyController, AccountController, AdminController, VerificationController, VerificationAdminController, PostsController, SubscriptionController],
  providers: [PrismaService, AuthService, AuthGuard, SocialService, SubscriptionService, RealtimeGateway],
})
export class AppModule {}
