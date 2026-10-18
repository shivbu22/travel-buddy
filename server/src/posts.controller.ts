import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import type { Prisma } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { postCommentSchema, postReportSchema, postSchema, type PostDto } from '@raahi/contracts';
import { AuthGuard, AuthedRequest } from './auth';
import { PrismaService } from './prisma.service';
import { uploadDir } from './profile.controller';
import { parse } from './social.service';
import { safeJpeg } from './media';
import { assertSafeUserText } from './content-safety';

const mediaUrl = (key: string) => /^https?:\/\//.test(key) ? key : `${process.env.PUBLIC_URL || 'http://localhost:4000'}/uploads/${key}`;
const authorSelect = { id: true, name: true, age: true, city: true, verified: true, verificationStatus: true, photos: { orderBy: { sortOrder: 'asc' as const }, select: { key: true } } } satisfies Prisma.UserSelect;
const ready = { onboarded: true, verified: true, verificationStatus: 'APPROVED' };
const cursorSchema = z.object({ at: z.string().datetime(), id: z.string().uuid() });
function include(viewerId: string, excluded: string[] = []) {
  return {
    media: { orderBy: { sortOrder: 'asc' as const } },
    _count: { select: { likes: true } },
    likes: { where: { userId: viewerId }, select: { userId: true }, take: 1 },
    comments: { where: { userId: { notIn: excluded }, user: ready }, take: 3, orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }], include: { user: { select: authorSelect } } },
    user: { select: authorSelect },
  } satisfies Prisma.PostInclude;
}
type PostRecord = Prisma.PostGetPayload<{ include: ReturnType<typeof include> }>;

@Controller('posts')
@UseGuards(AuthGuard)
export class PostsController {
  constructor(private db: PrismaService) {}

  private dto(post: PostRecord): PostDto {
    const author = (user: PostRecord['user']) => ({ ...user, verificationStatus: user.verificationStatus as PostDto['author']['verificationStatus'], photos: user.photos.map((photo) => mediaUrl(photo.key)) });
    return { id: post.id, author: author(post.user), media: post.media.map((media) => mediaUrl(media.key)), caption: post.caption, city: post.city, country: post.country, createdAt: post.createdAt.toISOString(), likeCount: post._count.likes, likedByMe: post.likes.length > 0, comments: [...post.comments].reverse().map((comment) => ({ id: comment.id, author: author(comment.user), body: comment.body, createdAt: comment.createdAt.toISOString() })) };
  }

  private async eligible(userId: string) {
    if (!await this.db.user.findFirst({ where: { id: userId, ...ready }, select: { id: true } })) throw new ForbiddenException('Complete profile and selfie review to interact with the Journal.');
  }

  private async available(userId: string, id: string) {
    await this.eligible(userId);
    const post = await this.db.post.findFirst({ where: { id, user: ready }, select: { userId: true } });
    if (!post || await this.db.block.findFirst({ where: { OR: [{ blockerId: userId, blockedId: post.userId }, { blockerId: post.userId, blockedId: userId }] } })) throw new NotFoundException('This story is no longer available.');
    return post;
  }

  @Get('feed')
  async feed(@Req() req: AuthedRequest, @Query('cursor') cursor?: string) {
    if (!await this.db.user.findFirst({ where: { id: req.userId, ...ready }, select: { id: true } })) return { items: [], nextCursor: null };
    const blocks = await this.db.block.findMany({ where: { OR: [{ blockerId: req.userId }, { blockedId: req.userId }] } });
    const excluded = blocks.map((block) => block.blockerId === req.userId ? block.blockedId : block.blockerId);
    let position: z.infer<typeof cursorSchema> | undefined;
    if (cursor) { try { position = cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString())); } catch { throw new BadRequestException('Invalid Journal cursor.'); } }
    const posts = await this.db.post.findMany({ where: { userId: { notIn: excluded }, ...(position ? { OR: [{ createdAt: { lt: new Date(position.at) } }, { createdAt: new Date(position.at), id: { lt: position.id } }] } : {}), user: ready }, include: include(req.userId, excluded), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21 });
    const page = posts.slice(0, 20); const last = page.at(-1);
    return { items: page.map((post) => this.dto(post)), nextCursor: posts.length > 20 && last ? Buffer.from(JSON.stringify({ at: last.createdAt.toISOString(), id: last.id })).toString('base64url') : null };
  }

  @Post()
  @RouteConfig({ rateLimit: { max: 20, timeWindow: '1 minute' } })
  async create(@Req() req: AuthedRequest) {
    await this.eligible(req.userId);
    const parts = (req as AuthedRequest & FastifyRequest).parts();
    const files: { key: string; data: Buffer }[] = [];
    const fields: Record<string, string> = Object.create(null);
    for await (const part of parts) {
      if (part.type === 'file') {
        const data = await part.toBuffer();
        if (part.file.truncated) throw new BadRequestException('Use images under 8 MB each.');
        let normalized: Buffer;
        try { normalized = await safeJpeg(data, 1800); } catch { throw new BadRequestException('Choose a readable JPEG, PNG or WebP image.'); }
        files.push({ key: `${randomUUID()}.jpg`, data: normalized });
      } else if (['caption', 'city', 'country'].includes(part.fieldname)) fields[part.fieldname] = String(part.value || '');
    }
    const input = parse(postSchema, fields);
    assertSafeUserText(input.caption, 'story caption');
    if (files.length < 1 || files.length > 6) throw new BadRequestException('Choose between one and six travel photos.');
    await mkdir(uploadDir, { recursive: true });
    try {
      for (const file of files) await writeFile(resolve(uploadDir, file.key), file.data);
      const post = await this.db.post.create({ data: { userId: req.userId, ...input, media: { create: files.map((file, sortOrder) => ({ key: file.key, sortOrder })) } }, include: include(req.userId) });
      return this.dto(post);
    } catch (error) {
      await Promise.all(files.map((file) => unlink(resolve(uploadDir, file.key)).catch(() => undefined)));
      throw error;
    }
  }

  @Post(':id/like')
  @RouteConfig({ rateLimit: { max: 60, timeWindow: '1 minute' } })
  async like(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    await this.available(req.userId, id);
    const { liked } = parse(z.object({ liked: z.boolean() }), body);
    if (liked) await this.db.postLike.upsert({ where: { postId_userId: { postId: id, userId: req.userId } }, create: { postId: id, userId: req.userId }, update: {} });
    else await this.db.postLike.deleteMany({ where: { postId: id, userId: req.userId } });
    return { liked, likeCount: await this.db.postLike.count({ where: { postId: id } }) };
  }

  @Post(':id/comments')
  @RouteConfig({ rateLimit: { max: 30, timeWindow: '1 minute' } })
  async comment(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    await this.available(req.userId, id);
    const input = parse(postCommentSchema, body);
    assertSafeUserText(input.body, 'comment');
    const comment = await this.db.postComment.create({ data: { postId: id, userId: req.userId, body: input.body }, include: { user: { select: authorSelect } } });
    return { id: comment.id, author: { ...comment.user, photos: comment.user.photos.map((photo) => mediaUrl(photo.key)) }, body: comment.body, createdAt: comment.createdAt.toISOString() };
  }

  @Post(':id/report')
  @RouteConfig({ rateLimit: { max: 10, timeWindow: '1 minute' } })
  async report(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const post = await this.available(req.userId, id);
    if (post.userId === req.userId) throw new BadRequestException('Use delete to remove your own story.');
    const input = parse(postReportSchema, body);
    return this.db.report.create({ data: { reporterId: req.userId, reportedUserId: post.userId, reason: 'Other', details: `Post ${id}: ${input.details || 'Reported story'}` }, select: { id: true } });
  }

  @Delete(':id')
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    const post = await this.db.post.findFirst({ where: { id, userId: req.userId }, include: { media: true } });
    if (!post) throw new NotFoundException('This post is no longer available.');
    await this.db.post.delete({ where: { id } });
    await Promise.all(post.media.filter((media) => !media.key.startsWith('http')).map((media) => unlink(resolve(uploadDir, media.key)).catch(() => undefined)));
    return { ok: true };
  }
}
