import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AuthGuard, AuthedRequest, hash } from './auth';
import { SocialService } from './social.service';
import { PrismaService } from './prisma.service';
import { safeJpeg } from './media';

const directory = resolve(process.env.VERIFICATION_DIR || 'verification-private');
export const verificationDir = directory;

@Controller('verification')
@UseGuards(AuthGuard)
export class VerificationController {
  constructor(private social: SocialService) {}
  @Get() status(@Req() req: AuthedRequest) { return this.social.me(req.userId); }
  @Post('selfie') async selfie(@Req() req: AuthedRequest) {
    const file = await (req as AuthedRequest & { file: () => Promise<{ toBuffer: () => Promise<Buffer>; file: { truncated?: boolean } } | undefined> }).file();
    if (!file) throw new BadRequestException('Take a selfie before submitting.');
    if ((await this.social.db.photo.count({ where: { userId: req.userId } })) < 3) throw new BadRequestException('Add at least three profile photos before submitting identity review.');
    const data = await file.toBuffer();
    if (file.file.truncated) throw new BadRequestException('Submit a JPEG, PNG or WebP selfie under 8 MB.');
    let normalized: Buffer;
    try { normalized = await safeJpeg(data, 1200); } catch { throw new BadRequestException('Submit a readable JPEG, PNG or WebP selfie under 8 MB.'); }
    const key = `${randomUUID()}.jpg`; await mkdir(directory, { recursive: true }); await writeFile(resolve(directory, key), normalized);
    const previous = await this.social.db.user.findUnique({ where: { id: req.userId }, select: { verificationKey: true } });
    await this.social.db.user.update({ where: { id: req.userId }, data: { verificationStatus: 'PENDING', verificationKey: key, verificationSubmittedAt: new Date(), verificationReviewedAt: null } });
    if (previous?.verificationKey && !/^https?:\/\//i.test(previous.verificationKey)) await unlink(resolve(directory, previous.verificationKey)).catch(() => undefined);
    return this.social.me(req.userId);
  }
}

@Controller('admin/verifications')
export class VerificationAdminController {
  constructor(private db: PrismaService) {}
  private authorize(req: AuthedRequest) {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!process.env.ADMIN_TOKEN || !token || !timingSafeEqual(Buffer.from(hash(token)), Buffer.from(hash(process.env.ADMIN_TOKEN)))) throw new ForbiddenException();
  }
  @Get() queue(@Req() req: AuthedRequest) { this.authorize(req); return this.db.user.findMany({ where: { verificationStatus: 'PENDING' }, select: { id: true, name: true, verificationKey: true, verificationSubmittedAt: true }, orderBy: { verificationSubmittedAt: 'asc' } }); }
  @Post(':id/review') review(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: { approved?: boolean }) { this.authorize(req); if (typeof body?.approved !== 'boolean') throw new BadRequestException('Choose approve or reject.'); return this.db.user.update({ where: { id }, data: { verificationStatus: body.approved ? 'APPROVED' : 'REJECTED', verificationReviewedAt: new Date() }, select: { id: true, verificationStatus: true } }); }
}
