import translations from './translations.json';

const SUPPORTED = new Set(Object.keys(translations));

export function resolveLang(sdkLang) {
  const normalized = (sdkLang || navigator.language || 'en').slice(0, 2).toLowerCase();
  return SUPPORTED.has(normalized) ? normalized : 'en';
}

export function getTranslations(lang) {
  return translations[lang] || translations.en;
}
