import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isPublicProviderAddress,
  resolveAndValidateHost,
  validateProviderUrl,
} from '../src/ai-egress-policy.js';

const productionPolicy = {
  isProd: true,
  allowedHosts: ['router.bynara.id', 'api.cloudflare.com'],
  allowedPorts: [443],
};

test('provider URL policy accepts canonical allowlisted HTTPS endpoints', () => {
  const result = validateProviderUrl('https://router.bynara.id/v1/', productionPolicy);
  assert.equal(result.href, 'https://router.bynara.id/v1/');
  assert.equal(result.hostname, 'router.bynara.id');
});

test('provider URL policy rejects unsafe schemes, credentials, fragments, ports, and hosts', () => {
  const rejected = [
    'http://router.bynara.id/v1',
    'file:///etc/passwd',
    'https://user:password@router.bynara.id/v1',
    'https://router.bynara.id/v1#credential',
    'https://router.bynara.id:8443/v1',
    'https://localhost/v1',
    'https://service.internal/v1',
    'https://metadata.google.internal/v1',
    'https://169.254.169.254/latest/meta-data',
    'https://2130706433/v1',
    'https://0x7f000001/v1',
    'https://017700000001/v1',
    'https://[::1]/v1',
    'https://[::ffff:127.0.0.1]/v1',
    'https://evil.example/v1',
  ];
  for (const value of rejected) {
    assert.throws(() => validateProviderUrl(value, productionPolicy), (error) => error.code?.startsWith('AI_EGRESS_'), value);
  }
});

test('custom provider hosts require both owner authority and deployment allowlisting', () => {
  const base = { ...productionPolicy, customAllowedHosts: ['models.example.com'] };
  assert.throws(() => validateProviderUrl('https://models.example.com/v1', base), (error) => error.code === 'AI_EGRESS_HOST_NOT_ALLOWED');
  assert.equal(
    validateProviderUrl('https://models.example.com/v1', { ...base, allowCustomHost: true }).hostname,
    'models.example.com',
  );
  assert.throws(
    () => validateProviderUrl('https://unlisted.example.com/v1', { ...base, allowCustomHost: true }),
    (error) => error.code === 'AI_EGRESS_HOST_NOT_ALLOWED',
  );
});

test('address policy rejects non-public IPv4 and IPv6 ranges', () => {
  const blocked = [
    '0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.169.254',
    '172.16.0.1', '192.168.1.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
    '::', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fd12::1', 'fe80::1', 'ff02::1', '2001:db8::1',
  ];
  for (const address of blocked) assert.equal(isPublicProviderAddress(address), false, address);
  for (const address of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111', '2001:4860:4860::8888']) {
    assert.equal(isPublicProviderAddress(address), true, address);
  }
});

test('DNS validation rejects empty, mixed-private, and rebinding answers', async () => {
  const publicLookup = async () => [{ address: '1.1.1.1', family: 4 }, { address: '2606:4700:4700::1111', family: 6 }];
  assert.deepEqual(
    (await resolveAndValidateHost('router.bynara.id', { ...productionPolicy, lookup: publicLookup })).addresses,
    await publicLookup(),
  );
  await assert.rejects(
    resolveAndValidateHost('router.bynara.id', { ...productionPolicy, lookup: async () => [] }),
    (error) => error.code === 'AI_EGRESS_DNS_UNAVAILABLE',
  );
  await assert.rejects(
    resolveAndValidateHost('router.bynara.id', {
      ...productionPolicy,
      lookup: async () => [{ address: '1.1.1.1', family: 4 }, { address: '127.0.0.1', family: 4 }],
    }),
    (error) => error.code === 'AI_EGRESS_ADDRESS_BLOCKED',
  );
});
