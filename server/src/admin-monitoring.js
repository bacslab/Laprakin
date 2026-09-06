const MONITORING_STATUSES = new Set(['success', 'error', 'pending', 'timeout']);

function bounded(value, max = 120) {
  return String(value || '').trim().slice(0, max);
}

export function normalizeAdminMonitoringQuery(input = {}) {
  const parsedDays = Number.parseInt(String(input.days ?? ''), 10);
  const days = Number.isFinite(parsedDays) ? Math.min(90, Math.max(1, parsedDays)) : 30;
  const status = bounded(input.status, 24).toLowerCase();
  return {
    days,
    userId: bounded(input.userId, 80),
    provider: bounded(input.provider),
    model: bounded(input.model),
    route: bounded(input.route),
    status: MONITORING_STATUSES.has(status) ? status : '',
  };
}

export function buildAdminMonitoringWhere(input = {}, alias = 'usage') {
  const query = normalizeAdminMonitoringQuery(input);
  const since = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000).toISOString();
  const prefix = alias ? `${alias}.` : '';
  const clauses = [`${prefix}created_at >= ?`];
  const params = [since];
  const add = (sql, value) => {
    if (!value) return;
    clauses.push(sql);
    params.push(value);
  };
  add(`${prefix}user_id = ?`, query.userId);
  add(`COALESCE(${prefix}provider, '') = ?`, query.provider);
  add(`COALESCE(${prefix}model, '') = ?`, query.model);
  add(`COALESCE(${prefix}route_id, '') = ?`, query.route);
  add(`${prefix}status = ?`, query.status);
  return { query, since, sql: clauses.join(' AND '), params };
}

export { MONITORING_STATUSES };
