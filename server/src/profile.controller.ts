import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Put, Query, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AuthGuard, AuthedRequest } from './auth';
import { parse, SocialService } from './social.service';
import { locationSchema } from '@raahi/contracts';
import { Post } from '@nestjs/common';
import { safeJpeg } from './media';
export const uploadDir = resolve(process.env.UPLOAD_DIR || 'uploads');
const isRemoteKey = (key: string) => /^https?:\/\//i.test(key);

@Controller('me')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private service: SocialService) {}
  @Get() me(@Req() req: AuthedRequest) { return this.service.me(req.userId); }
  @Put() save(@Req() req: AuthedRequest, @Body() body: unknown) { return this.service.saveProfile(req.userId, body); }
  @Get('location') async location(@Req() req: AuthedRequest) { const fix = await this.service.db.userLocation.findUnique({ where: { userId: req.userId } }); if (!fix) return null; const { userId: _userId, updatedAt, ...data } = fix; return { ...data, updatedAt: updatedAt.toISOString() }; }
  @Put('location') async saveLocation(@Req() req: AuthedRequest, @Body() body: unknown) { const data = parse(locationSchema, body); const fix = await this.service.db.userLocation.upsert({ where: { userId: req.userId }, create: { userId: req.userId, ...data }, update: data }); const { userId: _userId, updatedAt, ...saved } = fix; return { ...saved, updatedAt: updatedAt.toISOString() }; }
  @Delete('location') async removeLocation(@Req() req: AuthedRequest) { await this.service.db.userLocation.deleteMany({ where: { userId: req.userId } }); return { ok: true }; }
  @Put('photos/order') reorder(@Req() req: AuthedRequest, @Body() body: unknown) { return this.service.reorderPhotos(req.userId, body); }
  @Post('photos') async photo(@Req() req: AuthedRequest, @Query('replace') replace?: string) {
    const file = await (req as AuthedRequest & { file: () => Promise<{ toBuffer: () => Promise<Buffer>; file: { truncated?: boolean } } | undefined> }).file();
    if (!file) throw new BadRequestException('Select a photo.');
    const data = await file.toBuffer();
    if (file.file.truncated) throw new BadRequestException('Use a JPEG, PNG or WebP photo under 8 MB.');
    let normalized: Buffer;
    try { normalized = await safeJpeg(data); } catch { throw new BadRequestException('Use a readable JPEG, PNG or WebP photo under 8 MB.'); }
    const key = `${randomUUID()}.jpg`;
    await mkdir(uploadDir, { recursive: true });
    await writeFile(resolve(uploadDir, key), normalized);
    try {
      if (replace !== undefined) {
        if (!/^[0-5]$/.test(replace)) throw new BadRequestException('Invalid photo slot.');
        const result = await this.service.replacePhoto(req.userId, Number(replace), key);
         if (!isRemoteKey(result.oldKey)) await unlink(resolve(uploadDir, result.oldKey)).catch(() => undefined);
        return result.user;
      }
      return await this.service.addPhoto(req.userId, key);
    } catch (error) { await unlink(resolve(uploadDir, key)).catch(() => undefined); throw error; }
  }
  @Delete('photos/:index') async remove(@Req() req: AuthedRequest, @Param('index', ParseIntPipe) index: number) {
    const result = await this.service.removePhoto(req.userId, index);
    if (!isRemoteKey(result.key)) await unlink(resolve(uploadDir, result.key)).catch(() => undefined);
    return result.user;
  }
}
