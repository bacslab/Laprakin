import dns from 'node:dns';
import net from 'node:net';

const INTERNAL_HOST = /(?:^|\.)(?:localhost|local|internal|intranet|lan|home|corp)$/i;

export class AiEgressPolicyError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AiEgressPolicyError';
    this.code = code;
  }
}

function normalizeHostname(value) {
  return String(value || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function ipv4Integer(address) {
  const parts = String(address).split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts.reduce((value, part) => ((value << 8) | part) >>> 0, 0);
}

function inIpv4Range(value, first, prefix) {
  const start = ipv4Integer(first);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (start & mask);
}

function publicIpv4(address) {
  const value = ipv4Integer(address);
  if (value == null) return false;
  const blocked = [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
    ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
    ['224.0.0.0', 4], ['240.0.0.0', 4],
  ];
  return !blocked.some(([first, prefix]) => inIpv4Range(value, first, prefix));
}

function loopbackAddress(address) {
  const normalized = normalizeHostname(address);
  const ipv4 = ipv4Integer(normalized);
  if (ipv4 != null) return inIpv4Range(ipv4, '127.0.0.0', 8);
  return ipv6Integer(normalized) === 1n;
}

function ipv6Integer(address) {
  let source = normalizeHostname(address).split('%')[0];
  if (source.includes('.')) {
    const lastColon = source.lastIndexOf(':');
    const ipv4 = ipv4Integer(source.slice(lastColon + 1));
    if (ipv4 == null) return null;
    source = `${source.slice(0, lastColon)}:${((ipv4 >>> 16) & 0xffff).toString(16)}:${(ipv4 & 0xffff).toString(16)}`;
  }
  const halves = source.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const parts = [...left, ...Array(missing).fill('0'), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[a-f0-9]{1,4}$/i.test(part))) return null;
  return parts.reduce((value, part) => (value << 16n) | BigInt(parseInt(part, 16)), 0n);
}

function inIpv6Range(value, first, prefix) {
  const start = ipv6Integer(first);
  const shift = BigInt(128 - prefix);
  return (value >> shift) === (start >> shift);
}

function publicIpv6(address) {
  const value = ipv6Integer(address);
  if (value == null) return false;
  if ((value >> 32n) === 0xffffn) {
    const mapped = Number(value & 0xffffffffn);
    return publicIpv4(`${mapped >>> 24}.${(mapped >>> 16) & 255}.${(mapped >>> 8) & 255}.${mapped & 255}`);
  }
  const blocked = [
    ['::', 96], ['100::', 64], ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
  ];
  return value !== 0n && value !== 1n && !blocked.some(([first, prefix]) => inIpv6Range(value, first, prefix));
}

export function isPublicProviderAddress(address) {
  const normalized = normalizeHostname(address);
  const family = net.isIP(normalized);
  if (family === 4) return publicIpv4(normalized);
  if (family === 6) return publicIpv6(normalized);
  return false;
}

function hostAllowed(hostname, policy = {}) {
  const host = normalizeHostname(hostname);
  const known = new Set((policy.allowedHosts || []).map(normalizeHostname));
  const custom = new Set((policy.customAllowedHosts || []).map(normalizeHostname));
  return known.has(host) || (policy.allowCustomHost === true && custom.has(host));
}

function assertSafeHostname(hostname, policy) {
  const host = normalizeHostname(hostname);
  if (!host || INTERNAL_HOST.test(host)) {
    throw new AiEgressPolicyError('Provider host is blocked.', 'AI_EGRESS_HOST_BLOCKED');
  }
  if (net.isIP(host) && !isPublicProviderAddress(host) && !(policy.isProd !== true && policy.allowTestLoopback === true && loopbackAddress(host))) {
    throw new AiEgressPolicyError('Provider address is blocked.', 'AI_EGRESS_ADDRESS_BLOCKED');
  }
  if (!hostAllowed(host, policy)) {
    throw new AiEgressPolicyError('Provider host is not allowlisted.', 'AI_EGRESS_HOST_NOT_ALLOWED');
  }
  return host;
}

export function validateProviderUrl(input, policy = {}) {
  let url;
  try { url = new URL(String(input || '')); } catch {
    throw new AiEgressPolicyError('Provider URL is invalid.', 'AI_EGRESS_URL_INVALID');
  }
  const allowHttp = policy.isProd !== true && policy.allowHttp === true;
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) {
    throw new AiEgressPolicyError('Provider URL scheme is not allowed.', 'AI_EGRESS_SCHEME_BLOCKED');
  }
  if (url.username || url.password) {
    throw new AiEgressPolicyError('Provider URL credentials are not allowed.', 'AI_EGRESS_CREDENTIALS_BLOCKED');
  }
  if (url.hash) throw new AiEgressPolicyError('Provider URL fragments are not allowed.', 'AI_EGRESS_FRAGMENT_BLOCKED');
  const effectivePort = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
  const allowedPorts = new Set((policy.allowedPorts || [443]).map(Number));
  if (!allowedPorts.has(effectivePort)) {
    throw new AiEgressPolicyError('Provider URL port is not allowed.', 'AI_EGRESS_PORT_BLOCKED');
  }
  assertSafeHostname(url.hostname, policy);
  return url;
}

export async function resolveAndValidateHost(hostname, {
  lookup = dns.promises.lookup,
  ...policy
} = {}) {
  const host = assertSafeHostname(hostname, policy);
  if (net.isIP(host)) return { hostname: host, addresses: [{ address: host, family: net.isIP(host) }] };
  let answers;
  try {
    answers = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new AiEgressPolicyError('Provider DNS is unavailable.', 'AI_EGRESS_DNS_UNAVAILABLE');
  }
  if (!Array.isArray(answers) || !answers.length) {
    throw new AiEgressPolicyError('Provider DNS is unavailable.', 'AI_EGRESS_DNS_UNAVAILABLE');
  }
  const addresses = answers.map((answer) => ({ address: normalizeHostname(answer?.address), family: Number(answer?.family || net.isIP(answer?.address)) }));
  if (addresses.some((answer) => ![4, 6].includes(answer.family)
    || net.isIP(answer.address) !== answer.family
    || (!isPublicProviderAddress(answer.address) && !(policy.isProd !== true && policy.allowTestLoopback === true && loopbackAddress(answer.address))))) {
    throw new AiEgressPolicyError('Provider DNS returned a blocked address.', 'AI_EGRESS_ADDRESS_BLOCKED');
  }
  return { hostname: host, addresses };
}
