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
// Document payments (spec 430, ticket 433). Namespace == feature name, English and Arabic together.
import documentPayments from '@/locales/en/document-payments.json'
import documentPaymentsAr from '@/locales/ar/document-payments.json'
// Failed donor transfers (spec 430, ticket 434). Namespace == feature name, English and Arabic together.
import failedDonorTransfers from '@/locales/en/failed-donor-transfers.json'
import failedDonorTransfersAr from '@/locales/ar/failed-donor-transfers.json'
// Cities & districts (spec 430, ticket 436). Namespace == feature name, English and Arabic together.
import geography from '@/locales/en/geography.json'
import geographyAr from '@/locales/ar/geography.json'
// Document source users (spec 430, ticket 438). Namespace == feature name, English and Arabic together.
import documentSourceUsers from '@/locales/en/document-source-users.json'
import documentSourceUsersAr from '@/locales/ar/document-source-users.json'
// Coupons (spec 2463, tickets 439/440): a PARTIAL Arabic namespace — the delete and result-download
// strings only; every older coupons key falls back to English.
import couponsAr from '@/locales/ar/coupons.json'
// Material search (BackOffice spec 2544, ticket 451) — the Materials area's first namespace, English
// and Arabic together. It also holds the area's shared words: the menu group and all three leaf
// labels (`menu.*`), and the stock-cap refusal `@/core/materials/stock-cap` names.
import materialsSearch from '@/locales/en/materials-search.json'
import materialsSearchAr from '@/locales/ar/materials-search.json'
// Stock check (BackOffice spec 2544, ticket 453) — English and Arabic together.
import materialsStockCheck from '@/locales/en/materials-stock-check.json'
import materialsStockCheckAr from '@/locales/ar/materials-stock-check.json'
// GS1 check (BackOffice spec 2544, ticket 454) — English and Arabic together.
import materialsGs1Check from '@/locales/en/materials-gs1-check.json'
import materialsGs1CheckAr from '@/locales/ar/materials-gs1-check.json'
// Material detail (BackOffice spec 2544, ticket 452) — English and Arabic together.
import materialsDetail from '@/locales/en/materials-detail.json'
import materialsDetailAr from '@/locales/ar/materials-detail.json'
// The store sync console (spec 444, ticket 445). Namespace == feature name, and ENGLISH ONLY by
// ruling (BackOffice 2522 §3): there is no `ar` bundle, so Arabic falls back to these strings.
// 446–449 add their keys here rather than minting a second namespace.
import syncConsole from '@/locales/en/sync-console.json'
// The SAP export console (BackOffice spec 2579, ticket 461). Namespace == feature name, and ENGLISH
// ONLY like the sync console (spec 2579 Out of Scope: no Arabic UI), so there is no `ar` bundle.
// 462–465 add their keys here rather than minting a second namespace.
import sapExportConsole from '@/locales/en/sap-export-console.json'
// Deliverect stores (BackOffice spec 2615, ticket 477) — the Deliverect area's first namespace, English
// and Arabic together. It also holds the area's shared words: the menu group and all four leaf labels
// (`menu.*`), and the reason dialog `@/core/deliverect/ReasonDialog` draws for every Deliverect write.
import deliverectStores from '@/locales/en/deliverect-stores.json'
import deliverectStoresAr from '@/locales/ar/deliverect-stores.json'
// Deliverect orders monitor (ticket 478), English and Arabic together.
import deliverectOrders from '@/locales/en/deliverect-orders.json'
import deliverectOrdersAr from '@/locales/ar/deliverect-orders.json'
// Deliverect catalog — the whitelist and platform exclusions (ticket 479), English and Arabic together.
import deliverectCatalog from '@/locales/en/deliverect-catalog.json'
import deliverectCatalogAr from '@/locales/ar/deliverect-catalog.json'
// Deliverect delivery platforms and terms (ticket 482), English and Arabic together.
import deliverectTerms from '@/locales/en/deliverect-terms.json'
import deliverectTermsAr from '@/locales/ar/deliverect-terms.json'
// Delivery statistics (BackOffice brief 2641, ticket 484). Namespace == feature name, English and
// Arabic together. 485–487 add their keys here rather than minting a second namespace.
import deliveryStatistics from '@/locales/en/delivery-statistics.json'
import deliveryStatisticsAr from '@/locales/ar/delivery-statistics.json'
import dispatchScorecard from '@/locales/en/dispatch-scorecard.json'
import dispatchScorecardAr from '@/locales/ar/dispatch-scorecard.json'
// Pick support (BackOffice brief 2691, ticket 496). Namespace == feature name, English and Arabic
// together. `core/pick-support` — the diagnosis panel Document Details also draws (499) — speaks in
// it too, the `central-invoice` precedent. 497–499 add their keys here rather than minting another.
import pickSupport from '@/locales/en/pick-support.json'
import pickSupportAr from '@/locales/ar/pick-support.json'
// Rule campaigns (BackOffice spec 2737, ticket 501) — the Campaigns area's list and workspace. ENGLISH
// ONLY by ruling for this wave: the UI's Arabic chrome is a later pass, so there is no `ar` bundle.
// (A campaign's own names and messages ARE bilingual — they are data the marketer enters, not keys.)
// 502–512, 515 and 516 add their keys to `campaign-workspace` rather than minting more namespaces.
import campaigns from '@/locales/en/campaigns.json'
import campaignWorkspace from '@/locales/en/campaign-workspace.json'
// Campaigns ▸ Priority (ticket 513) — its own namespace, English only by the same ruling.
import campaignPriority from '@/locales/en/campaign-priority.json'
import ruleSimulator from '@/locales/en/rule-simulator.json'
// Campaigns ▸ Sessions (ticket 518): support's view of the customer sessions, English only too.
import ruleSessions from '@/locales/en/rule-sessions.json'
// Campaigns ▸ Coupon finder and Customers (ticket 519): support's look-ups, English only too.
import couponFinder from '@/locales/en/coupon-finder.json'
import ruleCustomers from '@/locales/en/rule-customers.json'
// Admin ▸ Store engine switch (ticket 517): HQ flips a store's promotion engine, English only too.
import engineSwitch from '@/locales/en/engine-switch.json'
// Campaigns ▸ Campaign upload (ticket 530; 531 and 532 add their keys here): English only too.
import campaignUploads from '@/locales/en/campaign-uploads.json'
// The Promotions list and a promotion's page (ticket 534, BackOffice brief 2848): the rule engine's
// promotion, never a bonus buy's. English only, like the area's other namespaces.
import campaignPromotions from '@/locales/en/campaign-promotions.json'
// The Dispatch board (BackOffice spec 2952, ticket 541). Namespace == feature name, English and Arabic
// together. `core/dispatch` — the Release lock dialog Delivery details also draws (542) — speaks in it
// too, the `central-invoice` precedent.
import dispatchBoard from '@/locales/en/dispatch-board.json'
import dispatchBoardAr from '@/locales/ar/dispatch-board.json'
// The prescription session's code words (BackOffice spec 2994, ticket 544): `core/prescription-session`'s
// OWN namespace, named for it rather than for a feature (the `attachments` precedent), because Document
// Details (544) and the HQ list (545-548) say the same codes. English and Arabic together; 545-548 ADD
// their shared words here, a feature's own chrome stays in the feature's namespace.
import prescriptionSession from '@/locales/en/prescription-session.json'
import prescriptionSessionAr from '@/locales/ar/prescription-session.json'
// HQ prescription sessions (BackOffice spec 2994, tickets 545-548) — the feature's own chrome; the
// codes it shows read in `prescription-session` above. Namespace == feature name, English and Arabic.
import prescriptionSessions from '@/locales/en/prescription-sessions.json'
import prescriptionSessionsAr from '@/locales/ar/prescription-sessions.json'

// English-only today; the call-site contract (t('ns:key')) is frozen from day one
// so Arabic later is a locale folder + dir="rtl", not a codebase sweep.
i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'home', 'auth', 'deliveries', 'document', 'ua-admin', 'authz-admin', 'active-sessions', 'simulation', 'bonus-buy-download', 'bonus-buy-inquiry', 'bonus-buy-maintenance', 'coupons', 'notifications', 'broadcast', 'callcenter', 'eligibility', 'authorizations', 'loy', 'collection', 'settlement', 'reports', 'attachments', 'central-invoice', 'donor-requests', 'document-payments', 'failed-donor-transfers', 'geography', 'document-source-users', 'materials-search', 'materials-stock-check', 'materials-gs1-check', 'materials-detail', 'sync-console', 'sap-export-console', 'deliverect-stores', 'deliverect-orders', 'deliverect-catalog', 'deliverect-terms', 'delivery-statistics', 'pick-support', 'campaigns', 'campaign-workspace', 'campaign-priority', 'rule-simulator', 'rule-sessions', 'coupon-finder', 'rule-customers', 'engine-switch', 'campaign-uploads', 'campaign-promotions', 'dispatch-board', 'dispatch-scorecard', 'prescription-session', 'prescription-sessions'],
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
      'document-payments': documentPayments,
      'failed-donor-transfers': failedDonorTransfers,
      geography,
      'document-source-users': documentSourceUsers,
      'materials-search': materialsSearch,
      'materials-stock-check': materialsStockCheck,
      'materials-gs1-check': materialsGs1Check,
      'materials-detail': materialsDetail,
      'sync-console': syncConsole,
      'sap-export-console': sapExportConsole,
      'deliverect-stores': deliverectStores,
      'deliverect-orders': deliverectOrders,
      'deliverect-catalog': deliverectCatalog,
      'deliverect-terms': deliverectTerms,
      'delivery-statistics': deliveryStatistics,
      'dispatch-scorecard': dispatchScorecard,
      'pick-support': pickSupport,
      campaigns,
      'campaign-workspace': campaignWorkspace,
      'campaign-priority': campaignPriority,
      'rule-simulator': ruleSimulator,
      'rule-sessions': ruleSessions,
      'coupon-finder': couponFinder,
      'rule-customers': ruleCustomers,
      'engine-switch': engineSwitch,
      'campaign-uploads': campaignUploads,
      'campaign-promotions': campaignPromotions,
      'dispatch-board': dispatchBoard,
      'prescription-session': prescriptionSession,
      'prescription-sessions': prescriptionSessions,
    },
    ar: {
      document: documentAr,
      'donor-requests': donorRequestsAr,
      'document-payments': documentPaymentsAr,
      'failed-donor-transfers': failedDonorTransfersAr,
      geography: geographyAr,
      'document-source-users': documentSourceUsersAr,
      coupons: couponsAr,
      'materials-search': materialsSearchAr,
      'materials-stock-check': materialsStockCheckAr,
      'materials-gs1-check': materialsGs1CheckAr,
      'materials-detail': materialsDetailAr,
      'deliverect-stores': deliverectStoresAr,
      'deliverect-orders': deliverectOrdersAr,
      'deliverect-catalog': deliverectCatalogAr,
      'deliverect-terms': deliverectTermsAr,
      'delivery-statistics': deliveryStatisticsAr,
      'dispatch-scorecard': dispatchScorecardAr,
      'pick-support': pickSupportAr,
      'dispatch-board': dispatchBoardAr,
      'prescription-session': prescriptionSessionAr,
      'prescription-sessions': prescriptionSessionsAr,
    },
  },
  interpolation: { escapeValue: false },
})

export default i18n
