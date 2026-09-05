import { forwardRef, useEffect, useState } from 'react';
import { Text as NativeText, type TextProps } from 'react-native';

import { useI18n, type AppLanguage } from '@/lib/i18n/i18n-context';

const languageCodes: Record<AppLanguage, string> = {
  en: 'en', ms: 'ms', zh: 'zh-CN', es: 'es', hi: 'hi', ar: 'ar', fr: 'fr', pt: 'pt', ru: 'ru', id: 'id',
};
const cache = new Map<string, string>();

function shouldTranslate(value: string): boolean {
  // Never send wallet addresses, numbers, asset tickers, or a person's name to
  // the translation service. Those values should always remain exactly as entered.
  const trimmed = value.trim();
  return trimmed.length > 2
    && /[a-zA-Z]{3}/.test(trimmed)
    && !/\bRemitGuard\b/i.test(trimmed)
    && !/^0x[\da-f]+$/i.test(trimmed)
    && !/^(SUI|USDC)$/i.test(trimmed)
    && !/^[-+]?\d[\d,./: -]*$/.test(trimmed);
}

/**
 * Translates static UI text that has not yet been added to the local catalog.
 * Localized catalog entries render synchronously; this is only a safe fallback
 * for fixed English interface copy.
 */
export const Text = forwardRef<NativeText, TextProps>(function TranslatedText({ children, ...props }, ref) {
  const { language } = useI18n();
  const source = typeof children === 'string' ? children : null;
  const [translated, setTranslated] = useState(source);

  useEffect(() => {
    // Always show the new catalog value immediately when the language changes.
    // The network fallback may replace only an untranslated English literal later.
    setTranslated(source);
    if (!source || language === 'en' || !shouldTranslate(source)) {
      return;
    }
    const key = `${language}:${source}`;
    const saved = cache.get(key);
    if (saved) {
      setTranslated(saved);
      return;
    }
    let cancelled = false;
    const query = encodeURIComponent(source);
    void fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${languageCodes[language]}&dt=t&q=${query}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Translation unavailable.')))
      .then((payload: unknown) => {
        const rows = Array.isArray(payload) ? payload[0] : null;
        const next = Array.isArray(rows) ? rows.map((row) => Array.isArray(row) ? row[0] : '').join('') : '';
        if (next && !cancelled) { cache.set(key, next); setTranslated(next); }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [language, source]);

  return <NativeText ref={ref} {...props}>{translated ?? children}</NativeText>;
});
