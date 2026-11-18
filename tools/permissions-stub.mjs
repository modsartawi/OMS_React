// oms 914 (BackOffice spec 4002): the one `GET Auth/Permissions` answer a drive stubs, in place of the per-area
// `*/Access` probes the app no longer calls. The app reads `screens` (the `BackOfficeScreen` keys the user holds, seed
// spelling, `src/core/permissions.ts` `SCREEN_KEYS`) and `extras`; a key not in `screens` is denied.
//
//   if (p === 'Auth/Permissions') return route.fulfill(permissions(['DocumentList:03', 'DocumentDetails:03']))
//   if (p === 'Auth/Permissions') return route.fulfill(permissions({ 'DocumentList:03': true, 'SdDocTypeConfig:06': canEdit }))
//   if (p === 'Auth/Permissions') return route.fulfill(permissions(flagKeys('Collection', access), { fileServerReady: true }))
//
// `flagKeys` is for a drive whose scenarios are still phrased in an area's old flag names (one half-grant per scenario):
// it maps them to keys by BackOffice brief 3995's table ("The mapping: every probe → a key or predicate"). New drives
// name the keys. `tools/permissions-stub.test.mjs` pins every key here to `SCREEN_KEYS`.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

/** Every two-field key the app reads, read from `SCREEN_KEYS` itself: for a drive whose subject is not the gating. */
export const ALL_SCREENS = Object.freeze(
  [
    ...readFileSync(new URL('../src/core/permissions.ts', import.meta.url), 'utf8')
      .match(/export const SCREEN_KEYS = \[([\s\S]*?)\] as const/)[1]
      .matchAll(/'([A-Za-z0-9]+:\d\d)'/g),
  ].map((m) => m[1]),
)

/** What the server answers when nothing beside the grants is switched on (`nphiesContractVersion` is today's). */
export const NO_EXTRAS = Object.freeze({
  fileServerReady: false,
  notificationCenterOn: false,
  nphiesContractVersion: '1.3',
  canManageRoles: false,
  canManageUsers: false,
})

/** `keys` as a list, or as `{ key: boolean }` (a falsy value leaves the key out). */
export function screensOf(keys = []) {
  const list = Array.isArray(keys) ? keys : Object.entries(keys).filter(([, on]) => on).map(([k]) => k)
  return [...new Set(list)].sort()
}

/** The wrapped body `{ success: true, data: { screens, extras, version } }`. */
export function permissionsBody(keys = [], extras = {}) {
  const screens = screensOf(keys)
  const allExtras = { ...NO_EXTRAS, ...extras }
  const version = createHash('md5').update(JSON.stringify({ screens, extras: allExtras })).digest('hex')
  return { statusCode: 200, success: true, message: '', errors: [], data: { screens, extras: allExtras, version } }
}

/** A Playwright `route.fulfill` argument answering `Auth/Permissions`. */
export const permissions = (keys = [], extras = {}) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(permissionsBody(keys, extras)),
})

/** The answer failing (the server's fail-closed 500): the app hides every gated item. */
export const permissionsFailed = (status = 500) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: false, message: 'boom', errors: [], data: null }),
})

/** Oms 852: every key the Campaigns, engine-switch, Insurance rules and HQ prescription-session leaves read. */
export const GRANTED_852 = [
  'RuleAuthoring:02', 'RuleAuthoring:06', 'RuleSupport:03', 'RuleEngineSwitch:02',
  'InsuranceRuleAuthoring:03', 'InsurancePatientBlock:03', 'InsuranceReferenceEdition:03', 'InsuranceGuardException:03',
  'InsurerSettings:03', 'InsuranceRulePlayground:01', 'InsuranceRuleInspection:03', 'InsuranceRuleHits:03',
  'IdfPriority:03',
  'PrescriptionSessionHq:03', 'PrescriptionSessionWriteOff:06',
]

/** Brief 3995's table: each area's old flag → the key(s) it now reads (a combination lists every key it needs). */
export const FLAG_KEYS = {
  ActionSync: {
    screenAllowed: ['ActionSyncConsole:03'], canOperate: ['ActionSyncConsole:06'], canOnboard: ['StoreOnboard:06'],
    canEnrol: ['SyncObjectEnrol:06'], canReplay: ['ReceiptReplay:06'], canRunScripts: ['SyncStoreScript:06'],
  },
  Analytics: {
    canView: ['Analytics:03'], canAuthor: ['Analytics:03', 'Analytics:02'],
    canCurate: ['Analytics:03', 'Analytics:02', 'Analytics:06'], canSql: ['Analytics:03', 'Analytics:02', 'Analytics:07'],
  },
  AuthzAdmin: { screenAllowed: ['AuthzAdmin:03'] },
  UaAdmin: { canOpen: ['UaUsers:03'] },
  UaSessions: { canOpen: ['UaSessions:03'] },
  CallCenter: { canOpenConsole: ['CallCenter:03'] },
  DispatchBoard: { canOpenDispatchBoard: ['DispatchBoard:03'], canReleaseLock: ['DispatchBoard:06'] },
  DispatchScorecard: { screenAllowed: ['DispatchScorecard:03'] },
  ServingList: { canViewServingLists: ['ServingList:03'], canEditServingLists: ['ServingList:06'] },
  Copilot: { canAsk: ['Copilot:01'], canUseMcp: ['Copilot:01'], canCurate: ['Copilot:01', 'Copilot:06'] },
  Coupons: { canAdmin: ['CouponsAdmin:03'], canSupport: ['CouponsSupport:03'] },
  Idf: { canViewIdf: ['IdfPriority:03'], canEditIdf: ['IdfPriority:06'], canEditGeneral: ['IdfPriority:07'] },
  InsuranceRules: {
    canPatientLists: ['InsurancePatientBlock:03'], canEditions: ['InsuranceReferenceEdition:03'],
    canExceptions: ['InsuranceGuardException:03'], canInsurers: ['InsurerSettings:03'],
    canPlayground: ['InsuranceRulePlayground:01'], canInspector: ['InsuranceRuleInspection:03'],
    canRuleHits: ['InsuranceRuleHits:03'],
    ...Object.fromEntries(
      ['canIdfMasters', 'canIdfStoreLists', 'canIdfExceptions', 'canIdfLookup', 'canIdfEvents', 'canIdfGroups'].map((f) => [f, ['IdfPriority:03']]),
    ),
    ...Object.fromEntries(
      [
        'canGuards', 'canTemplates', 'canLists', 'canFields', 'canApprovals', 'canSimulator', 'canReview', 'canMetrics',
        'canCategories', 'canCoverage', 'canFieldProposals', 'canAliases', 'canCodeLabels',
      ].map((f) => [f, ['InsuranceRuleAuthoring:03']]),
    ),
  },
  Nphies: {
    canOpenNphies: ['Nphies:03'], canReleaseApprovalNumber: ['Nphies:03', 'NphiesReleaseApproval:03'],
    canUndispense: ['Nphies:03', 'NphiesUndispense:03'],
  },
  PayerMonth: { canManage: ['InsurancePayerMonth:03'] },
  Bby: { screenAllowed: ['BbyInquiry:03'] },
  BbyMaintain: { screenAllowed: ['BbyMaintain:03'], canTest: ['BbyMaintain:03', 'BbyMaintain:04'] },
  BbyDownload: { screenAllowed: ['BbyDownload:03'] },
  Simulation: { canOpen: ['PosSimulation:03'] },
  PricingCache: { canClear: ['PricingCache:03'] },
  LoyGroups: { canView: ['LoyaltyGroup:03'], canMaintain: ['LoyaltyGroup:02'] },
  Loy: { canOpenLoyMember: ['LoyMember:03'], canEditLoyMember: ['LoyMember:02'], canRemoveLoyMemberMobile: ['LoyMember:04'] },
  Material: {
    canSearchMaterials: ['ItemInquiryCustome:03'], canCheckStock: ['MaterialStockInquiry:03'],
    canCheckGs1: ['Gs1SerialInquiry:03'],
  },
  Broadcast: { canBroadcast: ['NotificationBroadcast:01'] },
  SerialRefusal: { screenAllowed: ['SerialRefusal:03'] },
  Collection: {
    canOpenCollections: ['CollectionInquiry:03'], canOpenAcrs: ['AcrInquiry:03'], canOpenDeposits: ['DepositInquiry:03'],
    canOpenAttempts: ['CollectionAttempts:03'], canOpenAssignment: ['CollectionAssignment:03'],
    canOpenSettlement: ['SettlementAccount:03'], canSuperviseSettlement: ['SettlementSupervision:03'],
    canOpenReady: ['CollectionReady:03'],
  },
  ReleaseQueue: { canView: ['PosReleaseQueue:03'], canManage: ['PosReleaseQueue:06'] },
  PrescriptionSession: { canView: ['PrescriptionSessionHq:03'], canWriteOff: ['PrescriptionSessionWriteOff:06'] },
  RetailInvoice: { screenAllowed: ['RetailInvoice:03'] },
  Rules: {
    canAuthor: ['RuleAuthoring:02'], canApprove: ['RuleAuthoring:06'], canSupport: ['RuleSupport:03'],
    canSwitchEngine: ['RuleEngineSwitch:02'],
  },
  IDocInspector: { screenAllowed: ['IDocInspector:03'] },
  SapExport: { screenAllowed: ['SapExportConsole:03'] },
  BupaOutcomes: { canView: ['BupaLineOutcomes:03'] },
  CentralInvoice: { canOpen: ['CentralInvoice:03'] },
  Deliverect: {
    canManageStores: ['DeliverectStores:03'], canManageCatalog: ['DeliverectCatalog:03'],
    canViewOrders: ['DeliverectOrders:03'], canManageTerms: ['DeliverectTerms:03'],
    canAddPlatform: ['DeliverectPlatformAdd:03'],
  },
  HungerStation: {
    canManageStores: ['HungerStationStores:03'], canManageCatalog: ['HungerStationCatalog:03'],
    canViewOrders: ['HungerStationOrders:03'], canManagePromotions: ['HungerStationPromotions:03'],
  },
  HybrisStock: { canView: ['HybrisStock:03'], canManage: ['HybrisStock:06'] },
  DocTypeConfig: { canViewDocTypeConfig: ['DocumentList:03'], canEditDocTypeConfig: ['DocumentList:03', 'SdDocTypeConfig:06'] },
  Oms: {
    canOpenList: ['DocumentList:03'], canOpenDetail: ['DocumentDetails:03'], canChangeDetail: ['DocumentDetails:02'],
    canMarkDelivered: ['OmsMarkDelivered:06'], canMarkReturnedBack: ['OmsReturnBack:06'],
    canOpenFailedTransfers: ['FailedDonorTransfers:03'], canReRunFailedTransfer: ['FailedDonorTransfers:06'],
    canOpenDonorRequests: ['DonorRequestInquiry:03'], canOpenDocumentPayments: ['DocumentPaymentInquiry:03'],
    canOpenGeography: ['SdCityInquiry:03'], canImportCities: ['SdCityImport:03'], canImportDistricts: ['SdDistrictImport:03'],
    canOpenDocumentSourceUsers: ['DocumentSourceUsersInquiry:03'],
    canImportDocumentSourceUsers: ['DocumentSourceUsersImport:03'],
    canOpenPickSupport: ['PickSupport:03'], canFixPickSupport: ['PickSupport:06'],
    canSeePickSupportSerial: ['PickSupportSerial:03'], canCreateReturn: ['OmsCreateReturn:01'],
    canCreateLocalFulfillmentReturn: ['LocalFulfillmentReturn:03'],
    canForceLocalFulfillmentReturnRefund: ['LocalFulfillmentReturn:03', 'LocalFulfillmentReturn:04'],
    canViewInsurance: ['OmsInsuranceView:03'], canOpenDeliveryStatistics: ['DocumentList:03'],
  },
  SourcingAdvisor: { canView: ['SourcingAdvisor:01'] },
  StoreStage: { screenAllowed: ['StoreStage:03'], canMove: ['StoreStage:02'], canCloseCount: ['StoreCountClose:02'] },
  DataSync: { screenAllowed: ['DataSyncConsole:03'], canOperate: ['DataSyncConsole:06'] },
}

/**
 * The keys an area's old flag object grants (`true` flags only). A flag the table does not know grants nothing, as
 * the app reads it today (e.g. Oms `canOverrideGuard`, constant false since 914).
 */
export function flagKeys(area, flags) {
  const table = FLAG_KEYS[area]
  if (!table) throw new Error(`flagKeys: no area '${area}'`)
  const keys = []
  for (const [flag, on] of Object.entries(flags ?? {})) {
    if (on && table[flag]) keys.push(...table[flag])
  }
  return keys
}

/** The Attachments keys a drive grants: read (`Attachments:03:<c>`) per category, withdraw (`:04:`) per category. */
export const attachmentKeys = (categories = [], withdrawCategories = []) => [
  ...categories.map((c) => `Attachments:03:${c}`),
  ...withdrawCategories.map((c) => `Attachments:04:${c}`),
]
