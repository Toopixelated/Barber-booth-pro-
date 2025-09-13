import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

export const loadTranslations = async () => {
  const en = await import('./en.json');
  const es = await import('./es.json');

  const resources = {
    en: {
      translation: en.default,
    },
    es: {
      translation: es.default,
    },
  };

  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false, // react already safes from xss
      },
    });
};

export default i18n;
