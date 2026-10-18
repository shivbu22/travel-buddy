import sharp from 'sharp';

function supported(data: Buffer) {
  return (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
    || data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    || (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP');
}

export async function safeJpeg(data: Buffer, width = 1600) {
  if (!supported(data)) throw new Error('Unsupported image format.');
  return sharp(data, { limitInputPixels: 40_000_000 }).rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}
