const SEARCH_KINDS = new Set(['all', 'features', 'ai', 'users', 'alerts', 'audit']);

export const ADMIN_SEARCH_FEATURES = Object.freeze([
  { id: 'feature-monitoring', kind: 'features', title: 'Monitoring', subtitle: 'Operational overview and interactive AI telemetry', path: '/admin', capability: 'audit.view', searchText: 'monitoring overview telemetry activity' },
  { id: 'feature-ai', kind: 'features', title: 'Kontrol AI', subtitle: 'Providers, models, routing, health, and change history', path: '/admin/ai/providers', capability: 'ai.providers.view', searchText: 'kontrol ai control plane providers models routing health changes' },
  { id: 'feature-alerts', kind: 'features', title: 'Realtime errors', subtitle: 'Operational errors and incident status', path: '/admin/alerts', capability: 'incidents.manage', searchText: 'alerts realtime errors incidents' },
  { id: 'feature-users', kind: 'features', title: 'User access', subtitle: 'Accounts, restrictions, and privacy-safe references', path: '/admin/users', capability: 'users.view', searchText: 'users access accounts restrictions' },
  { id: 'feature-audit', kind: 'features', title: 'Audit log', subtitle: 'Immutable administrative activity trail', path: '/admin/audit', capability: 'audit.view', searchText: 'audit log activity trail security' },
  { id: 'feature-feedback', kind: 'features', title: 'Feedback', subtitle: 'Product feedback queue and status', path: '/admin/feedback', capability: 'cms.edit', searchText: 'feedback product feedback queue' },
]);

export function normalizeAdminSearchQuery(input = {}) {
  const q = String(input.q || '').trim().slice(0, 120);
  const kind = SEARCH_KINDS.has(String(input.kind || '')) ? String(input.kind) : 'all';
  const parsedLimit = Number.parseInt(String(input.limit ?? ''), 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(40, Math.max(10, parsedLimit)) : 20;
  return { q, kind, limit };
}

function normalizeText(value) {
  return String(value || '').toLocaleLowerCase('id-ID').replace(/\s+/g, ' ').trim();
}

export function scoreAdminSearchCandidate(candidate = {}, query = '') {
  const needle = normalizeText(query);
  if (!needle) return 0;
  const title = normalizeText(candidate.title);
  const subtitle = normalizeText(candidate.subtitle);
  const haystack = normalizeText(candidate.searchText || [title, subtitle].filter(Boolean).join(' '));
  if (!haystack) return 0;
  const titleTokens = title.split(/\s+/).filter(Boolean);
  const haystackTokens = haystack.split(/\s+/).filter(Boolean);
  if (title === needle) return 1000;
  if (title.startsWith(needle)) return 800;
  if (titleTokens.some((token) => token.startsWith(needle))) return 650;
  if (haystackTokens.some((token) => token === needle)) return 520;
  if (haystackTokens.some((token) => token.startsWith(needle))) return 420;
  if (haystack.includes(needle)) return 240;
  const compactNeedle = needle.replace(/\s+/g, '');
  const compactHaystack = haystack.replace(/\s+/g, '');
  if (compactNeedle.length >= 3 && compactHaystack.includes(compactNeedle)) return 120;
  return 0;
}

export function rankAdminSearchResults(candidates = [], query = '', limit = 20) {
  const seen = new Set();
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreAdminSearchCandidate(candidate, query) }))
    .filter((candidate) => candidate.score > 0 && !seen.has(String(candidate.id)) && seen.add(String(candidate.id)))
    .sort((left, right) => right.score - left.score || normalizeText(left.title).localeCompare(normalizeText(right.title), 'id-ID') || String(left.id).localeCompare(String(right.id)))
    .slice(0, Math.max(1, Number(limit) || 20));
}

export { SEARCH_KINDS };
