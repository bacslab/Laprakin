function normalizedSearch(value) {
  return String(value || '').trim().toLocaleLowerCase('id-ID');
}

export function filterAdminUsers(users = [], query = '', selectedId = '') {
  const needle = normalizedSearch(query);
  if (!needle) return users;
  const result = users.filter((user) => normalizedSearch(user.userRef || user.id).includes(needle));
  if (selectedId && !result.some((user) => user.id === selectedId)) {
    const selected = users.find((user) => user.id === selectedId);
    if (selected) return [selected, ...result];
  }
  return result;
}

export function filterAdminRowsByUser(rows = [], query = '') {
  const needle = normalizedSearch(query);
  if (!needle) return rows;
  return rows.filter((row) => normalizedSearch(row.userRef).includes(needle));
}

