import { useEffect, useMemo } from 'react';
import { useResolvedTheme } from '../lib/theme';
import { useApp } from '../state/ui-context';
import { createTranslator } from './index';
import { I18nContext } from './context';
import { translateUiText } from './legacy';

const textNodeOriginals = new WeakMap();
const textNodeRendered = new WeakMap();
const attributeOriginals = new WeakMap();
const attributeRendered = new WeakMap();

export default function I18nRuntime({ children }) {
  const { prefs } = useApp();
  const language = prefs?.language || 'id';
  const resolvedTheme = useResolvedTheme(prefs?.theme || 'system');
  const translateKey = useMemo(() => createTranslator(language), [language]);
  const translateDom = () => {
    const root = document.getElementById('root');
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE'].includes(parent.tagName)) return;
      const storedOriginal = textNodeOriginals.get(node);
      const lastRendered = textNodeRendered.get(node);
      const original = storedOriginal != null && node.nodeValue === lastRendered ? storedOriginal : node.nodeValue;
      textNodeOriginals.set(node, original);
      const next = translateUiText(original, language);
      if (node.nodeValue !== next) node.nodeValue = next;
      textNodeRendered.set(node, next);
    });
    root.querySelectorAll('[placeholder],[title],[aria-label]').forEach((element) => {
      let originals = attributeOriginals.get(element);
      if (!originals) { originals = {}; attributeOriginals.set(element, originals); }
      let rendered = attributeRendered.get(element);
      if (!rendered) { rendered = {}; attributeRendered.set(element, rendered); }
      ['placeholder', 'title', 'aria-label'].forEach((attribute) => {
        if (!element.hasAttribute(attribute)) return;
        const current = element.getAttribute(attribute);
        const previousRendered = rendered[attribute];
        if (!(attribute in originals) || current !== previousRendered) originals[attribute] = current;
        const next = translateUiText(originals[attribute], language);
        if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
        rendered[attribute] = next;
      });
    });
  };
  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'id';
    document.body.dataset.laprakinTheme = resolvedTheme;
    let frame = requestAnimationFrame(translateDom);
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(translateDom);
    });
    const root = document.getElementById('root');
    if (root) observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [language, resolvedTheme]);
  return <I18nContext.Provider value={{ language, t: (value, values) => translateKey(value, values) }}>{children}</I18nContext.Provider>;
}
