import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthService, AuthedRequest, hash } from './auth';
import { SocialService } from './social.service';
import { RealtimeGateway } from './realtime';
import { PrismaService } from './prisma.service';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { uploadDir } from './profile.controller';
import { timingSafeEqual } from 'node:crypto';
import { verificationDir } from './verification.controller';

@Controller('account')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private social: SocialService, private realtime: RealtimeGateway, private auth: AuthService) {}
  @Post('notifications') async notifications(@Req() req: AuthedRequest, @Body() body: { token?: string; enabled?: boolean }) {
    if (!body?.token || !/^(Exponent|Expo)PushToken\[[\w-]+\]$/.test(body.token) || typeof body.enabled !== 'boolean') throw new BadRequestException('Invalid device token.');
    await this.social.db.deviceToken.upsert({ where: { token: body.token }, create: { token: body.token, userId: req.userId, enabled: body.enabled }, update: { userId: req.userId, enabled: body.enabled } });
    return { ok: true };
  }
  @Get('export') async export(@Req() req: AuthedRequest) {
    await this.auth.requireRecentAuthentication(req.userId, req.sessionId);
    // Export the requester's authored actions, not incoming private decisions or other users' content.
    const [user, trips, posts, comments, likes, interests, passes, matches, blocks, reports, devices] = await this.social.db.$transaction([
      this.social.db.user.findUnique({ where: { id: req.userId }, select: { id: true, phone: true, appleId: true, name: true, age: true, gender: true, city: true, bio: true, languages: true, styles: true, pace: true, safety: true, intent: true, hometown: true, occupation: true, education: true, heightCm: true, relationshipGoal: true, onboarded: true, verified: true, verificationStatus: true, verificationSubmittedAt: true, verificationReviewedAt: true, createdAt: true, updatedAt: true, location: true, photos: { orderBy: { sortOrder: 'asc' }, select: { key: true, sortOrder: true } }, prompts: { orderBy: { sortOrder: 'asc' }, select: { question: true, answer: true, sortOrder: true } }, sessions: { orderBy: { createdAt: 'asc' }, select: { id: true, createdAt: true, expiresAt: true } } } }),
      this.social.db.trip.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' } }),
      this.social.db.post.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' }, select: { id: true, caption: true, city: true, country: true, createdAt: true, updatedAt: true, media: { orderBy: { sortOrder: 'asc' }, select: { key: true, sortOrder: true } } } }),
      this.social.db.postComment.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'asc' }, select: { id: true, postId: true, body: true, createdAt: true } }),
      this.social.db.postLike.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'asc' }, select: { postId: true, createdAt: true } }),
      this.social.db.interest.findMany({ where: { fromUserId: req.userId }, orderBy: { createdAt: 'asc' }, select: { id: true, fromUserId: true, toUserId: true, tripId: true, kind: true, target: true, targetIndex: true, targetId: true, source: true, comment: true, createdAt: true } }),
      this.social.db.pass.findMany({ where: { fromUserId: req.userId }, select: { fromUserId: true, toUserId: true } }),
      this.social.db.match.findMany({ where: { OR: [{ userAId: req.userId }, { userBId: req.userId }] }, orderBy: { createdAt: 'asc' }, select: { id: true, tripId: true, ended: true, createdAt: true, messages: { where: { senderId: req.userId }, orderBy: { createdAt: 'asc' }, select: { id: true, body: true, clientId: true, createdAt: true } }, reads: { where: { userId: req.userId }, select: { lastReadAt: true } } } }),
      this.social.db.block.findMany({ where: { blockerId: req.userId }, orderBy: { createdAt: 'asc' }, select: { blockerId: true, blockedId: true, createdAt: true } }),
      this.social.db.report.findMany({ where: { reporterId: req.userId }, orderBy: { createdAt: 'desc' }, select: { id: true, reason: true, details: true, status: true, createdAt: true } }),
      this.social.db.deviceToken.findMany({ where: { userId: req.userId }, select: { enabled: true } }),
    ], { isolationLevel: 'RepeatableRead' });
    if (!user) throw new BadRequestException('Account not found.');
    return { exportedAt: new Date().toISOString(), account: user, trips, posts, comments, likes, interests, passes, matches, blocks, reports, devices };
  }
  @Delete() async remove(@Req() req: AuthedRequest, @Body() body: { confirmation?: string }) {
    if (body?.confirmation !== 'DELETE') throw new BadRequestException('Confirm account deletion.');
    await this.auth.requireRecentAuthentication(req.userId, req.sessionId);
    const id = req.userId;
    const [photos, posts, verification, apple] = await Promise.all([
      this.social.db.photo.findMany({ where: { userId: id } }),
      this.social.db.post.findMany({ where: { userId: id }, include: { media: true } }),
      this.social.db.user.findUnique({ where: { id }, select: { verificationKey: true } }),
      this.social.db.user.findUnique({ where: { id }, select: { appleId: true, appleRefreshTokenEncrypted: true } }),
    ]);
    if (apple?.appleId && !apple.appleRefreshTokenEncrypted && process.env.NODE_ENV === 'production') throw new BadRequestException('Sign in with Apple again before deleting this account so Apple access can be revoked.');
    await this.auth.revokeAppleToken(apple?.appleRefreshTokenEncrypted);
    const pairs = { OR: [{ userAId: id }, { userBId: id }] };
    await this.social.db.$transaction(async (tx) => {
      await tx.match.deleteMany({ where: pairs });
      await tx.interest.deleteMany({ where: { OR: [{ fromUserId: id }, { toUserId: id }] } });
      await tx.pass.deleteMany({ where: { OR: [{ fromUserId: id }, { toUserId: id }] } });
      await tx.block.deleteMany({ where: { OR: [{ blockerId: id }, { blockedId: id }] } });
      await tx.report.deleteMany({ where: { OR: [{ reporterId: id }, { reportedUserId: id }] } });
      await tx.deviceToken.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });
    this.realtime.disconnectUser(id);
    await Promise.all(photos.filter((p) => !/^https?:\/\//i.test(p.key)).map((p) => unlink(resolve(uploadDir, p.key)).catch(() => undefined)));
    await Promise.all(posts.flatMap((post) => post.media).filter((media) => !media.key.startsWith('http')).map((media) => unlink(resolve(uploadDir, media.key)).catch(() => undefined)));
    if (verification?.verificationKey && !/^https?:\/\//i.test(verification.verificationKey)) await unlink(resolve(verificationDir, verification.verificationKey)).catch(() => undefined);
    return { ok: true };
  }
}

@Controller('admin/reports')
export class AdminController {
  constructor(private db: PrismaService) {}
  private authorize(req: AuthedRequest) {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!process.env.ADMIN_TOKEN || !token || !timingSafeEqual(Buffer.from(hash(token)), Buffer.from(hash(process.env.ADMIN_TOKEN)))) throw new ForbiddenException();
  }
  @Get() list(@Req() req: AuthedRequest) { this.authorize(req); return this.db.report.findMany({ where: { status: 'open' }, orderBy: { createdAt: 'asc' }, take: 100 }); }
  @Post(':id/resolve') resolve(@Req() req: AuthedRequest, @Param('id') id: string) { this.authorize(req); return this.db.report.update({ where: { id }, data: { status: 'reviewed' } }); }
}
