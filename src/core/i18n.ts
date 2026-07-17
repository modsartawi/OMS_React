import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from '@/locales/en/common.json'
import auth from '@/locales/en/auth.json'
import deliveries from '@/locales/en/deliveries.json'
import document from '@/locales/en/document.json'
import uaAdmin from '@/locales/en/ua-admin.json'

// English-only today; the call-site contract (t('ns:key')) is frozen from day one
// so Arabic later is a locale folder + dir="rtl", not a codebase sweep.
i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'auth', 'deliveries', 'document', 'ua-admin'],
  resources: { en: { common, auth, deliveries, document, 'ua-admin': uaAdmin } },
  interpolation: { escapeValue: false },
})

export default i18n
