export function parseAdminListSearch(search = '', defaults = {}) {
  const params = new URLSearchParams(search);
  const parsedCursor = Number.parseInt(params.get('cursor') || '', 10);
  const parsedLimit = Number.parseInt(params.get('limit') || '', 10);
  const result = {
    q: String(params.get('q') || defaults.q || '').trim().slice(0, 120),
    status: String(params.get('status') || defaults.status || '').trim().slice(0, 40),
    cursor: Number.isSafeInteger(parsedCursor) && parsedCursor >= 0 ? String(parsedCursor) : '',
    limit: Number.isSafeInteger(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 100)) : (defaults.limit || 25),
  };
  for (const [key, fallback] of Object.entries(defaults)) {
    if (key in result) continue;
    result[key] = String(params.get(key) || fallback || '').trim().slice(0, 120);
  }
  return result;
}

export function buildAdminListLocation(basePath, current, patch = {}) {
  const next = { ...current, ...patch };
  if (!Object.prototype.hasOwnProperty.call(patch, 'cursor') && Object.keys(patch).length) next.cursor = '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value !== '' && value !== null && value !== undefined) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function adminListApiPath(basePath, query, extra = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...extra })) {
    if (value !== '' && value !== null && value !== undefined) params.set(key, String(value));
  }
  return `${basePath}?${params.toString()}`;
}
