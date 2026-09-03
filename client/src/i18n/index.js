import en from './en.json';
import id from './id.json';
import { createTranslatorFromDictionaries } from './translate';

export function createTranslator(language = 'id') {
  return createTranslatorFromDictionaries({ en, id }, language);
}

export { createTranslatorFromDictionaries, en, id };
