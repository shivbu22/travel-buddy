import { expect, it } from 'vitest';
import sharp from 'sharp';
import { safeJpeg } from '../src/media';

it('rejects a forged signature and strips metadata from real images', async () => {
  await expect(safeJpeg(Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex'))).rejects.toThrow();
  const source = await sharp({ create: { width: 2200, height: 100, channels: 3, background: '#123456' } }).withMetadata().jpeg().toBuffer();
  const metadata = await sharp(await safeJpeg(source)).metadata();
  expect(metadata.format).toBe('jpeg'); expect(metadata.width).toBe(1600); expect(metadata.exif).toBeUndefined();
});
