// src/i18n/useT.js
// `const { t, lang, rtl, setLanguage } = useT();` in a component: it redraws when the language changes.
import { useCallback, useSyncExternalStore } from 'react';
import { getLanguage, subscribeLanguage, translate, setLanguage, isRtl, formatNumber, formatDate, formatYear, hasKey } from './index';
import { nameOf } from './names';

export const useLanguage = () => useSyncExternalStore(subscribeLanguage, getLanguage, () => 'en');

export const useT = () => {
  const lang = useLanguage();
  const t = useCallback((key, vars) => translate(key, vars, lang), [lang]);
  return {
    t, lang, rtl: isRtl(lang), setLanguage,
    n: useCallback((v, opts) => formatNumber(v, opts, lang), [lang]),
    date: useCallback((ms, opts) => formatDate(ms, opts, lang), [lang]),
    year: useCallback((y) => formatYear(y, lang), [lang]),
    name: useCallback((kind, id, english) => nameOf(kind, id, english, lang), [lang]),
    tx: useCallback((key, fallback, vars) => (hasKey(key, 'en') ? translate(key, vars, lang) : fallback), [lang])
  };
};
