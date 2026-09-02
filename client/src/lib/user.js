export function userInitials(user) {
  const source = String(user?.fullName || user?.email || 'Laprakin').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase().slice(0, 2) || 'L';
}

export function userGreetingName(user) {
  const nickname = String(user?.nickname || '').trim();
  if (nickname) return nickname;
  const fullName = String(user?.fullName || '').trim();
  if (fullName) return fullName.split(/\s+/)[0];
  return String(user?.email || 'kamu').split('@')[0].split(/[._-]+/)[0] || 'kamu';
}
