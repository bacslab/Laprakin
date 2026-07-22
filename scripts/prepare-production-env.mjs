import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatePath = path.join(root, 'server', '.env.production.example');
const outputPath = path.join(root, 'server', '.env.production.local');

const template = await fs.readFile(templatePath, 'utf8');
const secret = () => crypto.randomBytes(48).toString('base64url');
const prepared = template
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret()}`)
  .replace(/^DEVICE_HMAC_SECRET=.*$/m, `DEVICE_HMAC_SECRET=${secret()}`)
  .replace(/^TOKEN_HMAC_SECRET=.*$/m, `TOKEN_HMAC_SECRET=${secret()}`);

try {
  await fs.writeFile(outputPath, prepared, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  console.log('Production environment draft created at server/.env.production.local. Secret values were not printed.');
} catch (error) {
  if (error.code === 'EEXIST') {
    throw new Error('server/.env.production.local already exists; refusing to overwrite existing secrets.');
  }
  throw error;
}
