import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { normalizeInstitutionLogoBuffer } from '../src/services.js';

test('institution logo is trimmed and placed on a centered square canvas', async () => {
  const source = await sharp({
    create: {
      width: 500,
      height: 280,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  }).composite([{
    input: Buffer.from('<svg width="120" height="80"><rect width="120" height="80" fill="#101010"/></svg>'),
    left: 18,
    top: 22,
  }]).png().toBuffer();

  const normalized = await normalizeInstitutionLogoBuffer(source);
  const metadata = await sharp(normalized).metadata();
  const { info } = await sharp(normalized).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer({ resolveWithObject: true });

  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 720);
  assert.equal(metadata.height, 720);
  assert.equal(info.width, 720);
  assert.equal(info.height, 480);
});
