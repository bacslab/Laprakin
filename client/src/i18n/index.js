import en from './en.json';
import id from './id.json';

function readPath(dictionary, key) {
  return String(key).split('.').reduce((current, part) => current?.[part], dictionary);
}

export function createTranslator(language = 'id') {
  return (key, values = {}) => {
    const source = readPath(language === 'en' ? en : id, key) ?? readPath(id, key) ?? key;
    return String(source).replace(/\{\{([^}]+)\}\}/g, (_, name) => String(values[name.trim()] ?? ''));
  };
}

export { en, id };
