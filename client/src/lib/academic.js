export function canonicalCourseLabel(value = '') {
  const clean = String(value || '')
    .replace(/^\s*laprak\s+/i, '')
    .replace(/\s+\d+\s*chat\b.*$/i, '')
    .replace(/\s*[|·]\s*project pribadi\b.*$/i, '')
    .replace(/\s+project pribadi\b.*$/i, '')
    .replace(/\bmanajemen\s+(?:intra|inter)networkin(?:g)?\b/i, 'Manajemen Internetworking')
    .replace(/\bsecurity\b/gi, 'Security')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^(?:mana(?:nya)?|halo|hai|hello|kok|kenapa|gimana|bagaimana|sudah|udah|belum|lanjut|oke|ok|iya|ya|tidak|nggak|gak|ga|terserah)[?!.]*$/i.test(clean)) {
    return 'Belum dikelompokkan';
  }
  return clean || 'Belum dikelompokkan';
}

export function normalizedCourseKey(value = '') {
  return canonicalCourseLabel(value)
    .normalize('NFKD')
    .toLocaleLowerCase('id-ID')
    .replace(/\b(?:intra|inter)networkin(?:g)?\b/g, 'internetworking')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'belum dikelompokkan';
}

export function courseTokens(value = '') {
  return normalizedCourseKey(value)
    .split(' ')
    .filter((token) => token && !['dan', 'and', 'mata', 'kuliah', 'mk'].includes(token));
}

export function courseAcronym(value = '') {
  const tokens = courseTokens(value);
  if (tokens.length === 1 && tokens[0].length <= 6) return tokens[0];
  return tokens.map((token) => token[0]).join('');
}

export function editDistance(left = '', right = '') {
  const a = String(left);
  const b = String(right);
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[b.length];
}
