import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from '@/locales/en/common.json'
import home from '@/locales/en/home.json'
import auth from '@/locales/en/auth.json'
import deliveries from '@/locales/en/deliveries.json'
import document from '@/locales/en/document.json'
import uaAdmin from '@/locales/en/ua-admin.json'
import authzAdmin from '@/locales/en/authz-admin.json'
import activeSessions from '@/locales/en/active-sessions.json'
import simulation from '@/locales/en/simulation.json'
import bonusBuyDownload from '@/locales/en/bonus-buy-download.json'
import bonusBuyInquiry from '@/locales/en/bonus-buy-inquiry.json'
import coupons from '@/locales/en/coupons.json'
import notifications from '@/locales/en/notifications.json'
import broadcast from '@/locales/en/broadcast.json'
import callcenter from '@/locales/en/callcenter.json'
import eligibility from '@/locales/en/eligibility.json'
import authorizations from '@/locales/en/authorizations.json'
// 🚩 `loy`, not `member` — a DELIBERATE deviation from "namespace == feature
// name" (spec 231, ticket 233). The feature is `member` under the new `loy`
// area, and `member` is too generic a name for a global namespace.
import loy from '@/locales/en/loy.json'
// The Collections area's ONE namespace (spec 249, ticket 253) — one feature, four
// screens and both documents share it, so every later slice ADDS keys here rather
// than minting a second namespace or re-registering this one.
import collection from '@/locales/en/collection.json'

// English-only today; the call-site contract (t('ns:key')) is frozen from day one
// so Arabic later is a locale folder + dir="rtl", not a codebase sweep.
i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'home', 'auth', 'deliveries', 'document', 'ua-admin', 'authz-admin', 'active-sessions', 'simulation', 'bonus-buy-download', 'bonus-buy-inquiry', 'coupons', 'notifications', 'broadcast', 'callcenter', 'eligibility', 'authorizations', 'loy', 'collection'],
  resources: {
    en: {
      common,
      home,
      auth,
      deliveries,
      document,
      'ua-admin': uaAdmin,
      'authz-admin': authzAdmin,
      'active-sessions': activeSessions,
      simulation,
      'bonus-buy-download': bonusBuyDownload,
      'bonus-buy-inquiry': bonusBuyInquiry,
      coupons,
      notifications,
      broadcast,
      callcenter,
      eligibility,
      authorizations,
      loy,
      collection,
    },
  },
  interpolation: { escapeValue: false },
})

export default i18n
