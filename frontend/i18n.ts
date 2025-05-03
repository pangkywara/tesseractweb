import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend'; // Use http backend for loading translations

i18n
  // Load translation using http -> see /public/locales (recommended)
  // Learn more: https://github.com/i18next/i18next-http-backend
  // Want your translations to be loaded via a different path? See options in i18next-http-backend's docs.
  .use(Backend)
  // Detect user language
  // Learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // Init i18next
  // For all options read: https://www.i18next.com/overview/configuration-options
  .init({
    debug: process.env.NODE_ENV === 'development', // Enable debug messages in development
    fallbackLng: 'en',
    supportedLngs: ['en', 'id'],
    interpolation: {
      escapeValue: false, // React already safes from xss
    },
    backend: {
      // Path where resources get loaded from
      // Using NEXT_PUBLIC_BASE_PATH allows this to work correctly with deployments on subpaths
      // loadPath: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/locales/{{lng}}/{{ns}}.json`,
      loadPath: '/locales/{{lng}}/{{ns}}.json' // Simplified path
    }
  });

export default i18n; 