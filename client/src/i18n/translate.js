function readPath(dictionary, key) {
  return String(key).split('.').reduce((current, part) => current?.[part], dictionary);
}

function translatedSource(dictionary, key, language, values) {
  if (values.count === undefined || values.count === null || !Number.isFinite(Number(values.count))) {
    return readPath(dictionary, key);
  }
  const category = new Intl.PluralRules(language === 'en' ? 'en' : 'id').select(Number(values.count));
  return readPath(dictionary, `${key}_${category}`)
    ?? readPath(dictionary, `${key}_other`)
    ?? readPath(dictionary, key);
}

export function createTranslatorFromDictionaries(dictionaries, language = 'id') {
  const activeLanguage = language === 'en' ? 'en' : 'id';
  const active = dictionaries[activeLanguage] || dictionaries.id || {};
  const fallback = dictionaries.id || {};
  return (key, values = {}) => {
    const source = translatedSource(active, key, activeLanguage, values)
      ?? translatedSource(fallback, key, 'id', values)
      ?? key;
    return String(source).replace(/\{\{([^}]+)\}\}/g, (_, name) => String(values[name.trim()] ?? ''));
  };
}
