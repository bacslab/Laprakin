export function parseAdminListQuery(input = {}, {
  statuses = [],
  defaultStatus = '',
  defaultLimit = 25,
  maxLimit = 100,
} = {}) {
  const q = String(input.q || '').trim().slice(0, 120);
  const requestedStatus = String(input.status || '').trim();
  const status = statuses.includes(requestedStatus) ? requestedStatus : defaultStatus;
  const parsedCursor = Number.parseInt(String(input.cursor || '0'), 10);
  const parsedLimit = Number.parseInt(String(input.limit || defaultLimit), 10);
  const cursor = Number.isSafeInteger(parsedCursor) && parsedCursor >= 0 ? parsedCursor : 0;
  const limit = Number.isSafeInteger(parsedLimit) ? Math.max(1, Math.min(parsedLimit, maxLimit)) : defaultLimit;
  return { q, status, cursor, limit };
}

export function adminListPage(rows, { cursor = 0, limit = 25 } = {}) {
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  return {
    items,
    pageInfo: {
      cursor: String(cursor),
      nextCursor: hasMore ? String(cursor + limit) : null,
      limit,
      hasMore,
    },
  };
}
