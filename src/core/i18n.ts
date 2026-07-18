import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from '@/locales/en/common.json'
import auth from '@/locales/en/auth.json'
import deliveries from '@/locales/en/deliveries.json'
import document from '@/locales/en/document.json'
import uaAdmin from '@/locales/en/ua-admin.json'
import authzAdmin from '@/locales/en/authz-admin.json'
import activeSessions from '@/locales/en/active-sessions.json'
import simulation from '@/locales/en/simulation.json'
import bonusBuyDownload from '@/locales/en/bonus-buy-download.json'
import coupons from '@/locales/en/coupons.json'

// English-only today; the call-site contract (t('ns:key')) is frozen from day one
// so Arabic later is a locale folder + dir="rtl", not a codebase sweep.
i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'auth', 'deliveries', 'document', 'ua-admin', 'authz-admin', 'active-sessions', 'simulation', 'bonus-buy-download', 'coupons'],
  resources: {
    en: {
      common,
      auth,
      deliveries,
      document,
      'ua-admin': uaAdmin,
      'authz-admin': authzAdmin,
      'active-sessions': activeSessions,
      simulation,
      'bonus-buy-download': bonusBuyDownload,
      coupons,
    },
  },
  interpolation: { escapeValue: false },
})

export default i18n
