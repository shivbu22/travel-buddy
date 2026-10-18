import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = fileURLToPath(new URL('../mobile/assets/icon.svg', import.meta.url));
const output = fileURLToPath(new URL('../mobile/assets/icon.png', import.meta.url));
await sharp(source).flatten({ background: '#E1037D' }).removeAlpha().png().toFile(output);
const { width, height, hasAlpha } = await sharp(output).metadata();
assert.equal(width, 1024);
assert.equal(height, 1024);
assert.equal(hasAlpha, false);
console.log('Generated mobile/assets/icon.png: 1024 × 1024, opaque PNG.');
