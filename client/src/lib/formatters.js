export function formatCurrency(value = 0, locale = 'id-ID') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatBytes(value = 0) {
  if (!value) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function formatDate(value, locale) {
  const activeLocale = locale || (
    typeof document !== 'undefined' && document.documentElement?.lang === 'en'
      ? 'en-US'
      : 'id-ID'
  );
  return value
    ? new Intl.DateTimeFormat(activeLocale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
    : '—';
}
