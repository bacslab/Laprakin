import crypto from 'node:crypto';

const secrets = new Map();
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function toBase32(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { output += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function fromBase32(value) {
  let bits = 0;
  let buffer = 0;
  const output = [];
  for (const character of String(value || '').replace(/=+$/, '').toUpperCase()) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) continue;
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) { output.push((buffer >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(output);
}

function codeFor(secret, counter) {
  const message = Buffer.alloc(8);
  message.writeBigInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', fromBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const number = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(number % 1000000).padStart(6, '0');
}

export function createTotpSecret(userId) {
  const secret = toBase32(crypto.randomBytes(20));
  secrets.set(String(userId), secret);
  return secret;
}

export function verifyTotpCode(userId, code, at = Date.now()) {
  const secret = secrets.get(String(userId));
  if (!secret || !/^\d{6}$/.test(String(code))) return false;
  const counter = Math.floor(Number(at) / 30000);
  return [-1, 0, 1].some((offset) => codeFor(secret, counter + offset) === String(code));
}

export function adminMfaRequired(user, { enforced = false } = {}) {
  return user?.role === 'admin' && (enforced || Boolean(user.mfaEnrolled ?? user.mfa_enrolled));
}

export { codeFor as totpCodeForTest };
