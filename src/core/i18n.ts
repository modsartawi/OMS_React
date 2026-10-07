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
import bonusBuyMaintenance from '@/locales/en/bonus-buy-maintenance.json'
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
// 🚩 `reports`, not `retail-invoice` — the AREA's name rather than the feature's,
// and the one deliberate departure from "namespace == feature name" in this wave
// (spec 261, ticket 263). The second report screen JOINS this namespace instead of
// minting another, so every later slice ADDS keys to `reports.json` and must not
// re-register it here. An unregistered namespace renders raw keys to users and no
// gate catches it, which is why this registration lands in the area's first slice.
import reports from '@/locales/en/reports.json'
// 🚩 `settlement`, and NOT the `collection` namespace above (spec 267, ticket 268).
// The accountant's screen shares the Collections area, its URL prefix and its access
// probe, but it is its OWN feature — so "namespace == feature name" applies plainly
// here, and 269–273 add their keys to `settlement.json`. Sharing `collection.json`
// would put a second feature's growth inside a namespace the inquiry feature owns.
import settlement from '@/locales/en/settlement.json'
// The shared attachments panel's OWN words (spec 324, ticket 326) — the panel lives in
// `core/attachments`, not in a feature, so its namespace is named for it rather than for a
// feature. Only words that name no owner live here; a caller's words (the slip drawer's
// "slip", the order tab's "prescription") stay in the caller's namespace and are passed in.
import attachments from '@/locales/en/attachments.json'
// Central invoicing (BackOffice spec 2094, ticket 332). Namespace == the bulk screen's feature
// name (`features/oms/central-invoice`), and `core/central-invoice` — the delivery page's dialog
// and the verdict pill both features draw — speaks in it too, so a verdict reads the same in both.
import centralInvoice from '@/locales/en/central-invoice.json'
// 🚩 The first Arabic strings (BackOffice 2422): Mark delivered's reasons, refusals and
// dialog, so they ship with the feature rather than in a later sweep. A PARTIAL namespace —
// `lng` stays `en`, and once Arabic is switched on every key not in it falls back to English.
import documentAr from '@/locales/ar/document.json'
// Donor requests (spec 430, ticket 431) — the first of the wave's five OMS screens. Namespace ==
// feature name; it ships its Arabic strings beside its English ones.
import donorRequests from '@/locales/en/donor-requests.json'
import donorRequestsAr from '@/locales/ar/donor-requests.json'

// English-only today; the call-site contract (t('ns:key')) is frozen from day one
// so Arabic later is a locale folder + dir="rtl", not a codebase sweep.
i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'home', 'auth', 'deliveries', 'document', 'ua-admin', 'authz-admin', 'active-sessions', 'simulation', 'bonus-buy-download', 'bonus-buy-inquiry', 'bonus-buy-maintenance', 'coupons', 'notifications', 'broadcast', 'callcenter', 'eligibility', 'authorizations', 'loy', 'collection', 'settlement', 'reports', 'attachments', 'central-invoice', 'donor-requests'],
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
      'bonus-buy-maintenance': bonusBuyMaintenance,
      coupons,
      notifications,
      broadcast,
      callcenter,
      eligibility,
      authorizations,
      loy,
      collection,
      settlement,
      reports,
      attachments,
      'central-invoice': centralInvoice,
      'donor-requests': donorRequests,
    },
    ar: {
      document: documentAr,
      'donor-requests': donorRequestsAr,
    },
  },
  interpolation: { escapeValue: false },
})

export default i18n
