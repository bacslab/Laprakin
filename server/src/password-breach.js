import crypto from 'node:crypto';

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

export async function checkPasswordBreach(password, {
  fetchImpl = fetch,
  timeoutMs = 3500,
} = {}) {
  const value = String(password || '');
  if (!value) return { breached: false, count: 0, checked: false, reason: 'INVALID_INPUT' };
  const hash = crypto.createHash('sha1').update(value, 'utf8').digest('hex').toUpperCase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${HIBP_RANGE_URL}${hash.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'Laprakin-password-security' },
      signal: controller.signal,
    });
    if (!response.ok) return { breached: false, count: 0, checked: false, reason: 'UNAVAILABLE' };
    const suffix = hash.slice(5);
    const match = (await response.text()).split(/\r?\n/).map((line) => line.trim()).find((line) => line.startsWith(`${suffix}:`));
    return { breached: Boolean(match), count: match ? Number(match.split(':')[1]) || 0 : 0, checked: true };
  } catch {
    return { breached: false, count: 0, checked: false, reason: 'UNAVAILABLE' };
  } finally {
    clearTimeout(timeout);
  }
}
