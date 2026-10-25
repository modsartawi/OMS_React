// Wire shapes for the `DeliverectWeb/*` doors (BackOffice spec 2615, ticket 477).
//
// 🚩 The ONE source is the door contract,
// `C:\Work\DMSCO\BackOffice\.issues\assets\2615-deliverect-web-door-contract.md`. Every type below
// mirrors it field for field in the camelCase ASP.NET Core emits: no field invented, none renamed,
// none dropped. Written once, for EVERY door, by the area's first slice — 478–482 read them here
// rather than each re-deciding a shape, and a slice that can show a drift against the contract
// fixes it here and logs it.
//
// Store codes, material numbers, account and platform keys are STRINGS and stay strings: shown as
// stored, never `Number()`-ed. Times are local wall-clock with no offset (`yyyy-MM-ddTHH:mm:ss`),
// dates `yyyy-MM-dd`; an absent value is `null`. Money is a 3-decimal number beside its
// `currencyKey` (always `"SAR"` in v1).

/** A local wall-clock time, `yyyy-MM-ddTHH:mm:ss`, no offset. Never append a `Z`. */
export type LocalDateTime = string
/** A date-only value, `yyyy-MM-dd` — declared once, in `@/core/util/date-window`. */
import type { LocalDate } from '@/core/util/date-window'
export type { LocalDate }

// ── Errors ───────────────────────────────────────────────────────────────────────────────────────

/** The area's refusal codes (contract § Error codes), read through `apiErrorCode`. */
export const DELIVERECT_ERRORS = {
  /** 404 — no such store. */
  noSuchStore: 'DLV-00001',
  /** 409 — onboard: the store is already onboarded on a Deliverect account. */
  alreadyOnboarded: 'DLV-00002',
  /** 400 — onboard: no such account, or the account is inactive. */
  noSuchAccount: 'DLV-00003',
  /** 404 — no such material, or it is not on the whitelist. */
  noSuchMaterial: 'DLV-00004',
  /** 400 — exclusion: no such platform. */
  noSuchPlatform: 'DLV-00005',
  /** 404 — no such Deliverect order. */
  noSuchOrder: 'DLV-00006',
  /** 409 — retry: the order or its status call is not in a failed state. */
  notFailed: 'DLV-00007',
  /** 400 — terms: `validFrom` overlaps an existing row for the platform. */
  termsOverlap: 'DLV-00008',
  /** 400 — a required `reason` is missing or longer than 200 characters. */
  reasonInvalid: 'DLV-00009',
  /** 409 — store status: the store is not linked (no Deliverect location yet). */
  notLinked: 'DLV-00010',
  /** 502 — Deliverect unreachable, or it refused the call (its answer is in `message`). */
  deliverectFailed: 'DLV-00011',
  /** 400 — whitelist import: no rows, more than 5000 rows, or a row that is not a material number. */
  importInvalid: 'DLV-00012',
} as const

// ── GET DeliverectWeb/Access ─────────────────────────────────────────────────────────────────────

/**
 * Exactly the four keys the probe returns. Cookie-gated, not grant-gated. Each flag is one
 * `BackOfficeScreen[…,03]` grant:
 *
 * - `canManageStores` ← `DeliverectStores`: Stores/*, Sync/*, StoreStatus/*.
 * - `canManageCatalog` ← `DeliverectCatalog`: Whitelist/*, Exclusions/*.
 * - `canViewOrders` ← `DeliverectOrders`: Orders/*.
 * - `canManageTerms` ← `DeliverectTerms`: Accounts, Platforms/*, Terms/*.
 */
export interface DeliverectAccessResult {
  canManageStores: boolean
  canManageCatalog: boolean
  canViewOrders: boolean
  canManageTerms: boolean
}

// ── Stores (2616; sync by 2624, status by 2625) ──────────────────────────────────────────────────

/** `linked` on `GET DeliverectWeb/Stores` — `any` is the default. */
export type DeliverectLinkedFilter = 'any' | 'yes' | 'no'

/** The query of `GET DeliverectWeb/Stores?account=&linked=&q=`. `q` matches a store code or name. */
export interface DeliverectStoresQuery {
  account: string | null
  linked: DeliverectLinkedFilter
  q: string | null
}

/** A store's stock sync block (2624). The whole block is `null` until 2624 ships. */
export interface DeliverectStoreSync {
  /** The pause flag: `false` = paused. */
  active: boolean
  lastFullRun: LocalDateTime | null
  lastDeltaRun: LocalDateTime | null
  /** `"S"` is success; the contract enumerates nothing else. */
  lastStatus: string | null
  lastError: string | null
}

export type DeliverectStoreState = 'open' | 'busy' | 'closed'

/** A store's status block (2625). The whole block is `null` until 2625 ships. */
export interface DeliverectStoreStatus {
  state: DeliverectStoreState
  since: LocalDateTime | null
  reason: string | null
}

/**
 * One Deliverect store. `deliverectLocationId` and `linkedAt` are `null` until Deliverect's
 * registration names the store — "onboarded, not linked".
 */
export interface DeliverectStoreRow {
  storeCode: string
  storeName: string
  accountKey: string
  deliverectLocationId: string | null
  onboardedAt: LocalDateTime
  onboardedBy: string
  linkedAt: LocalDateTime | null
  onDirectHungerStation: boolean
  sync: DeliverectStoreSync | null
  status: DeliverectStoreStatus | null
}

/**
 * `POST DeliverectWeb/Stores` — onboard. Returns the store row; when the store is on the direct
 * HungerStation rail the row has `onDirectHungerStation: true` and the envelope `message` carries a
 * warning (not a refusal). Refusals: DLV-00001, DLV-00002, DLV-00003.
 */
export interface DeliverectOnboardBody {
  storeCode: string
  accountKey: string
  reason: string
}

/** `PUT DeliverectWeb/Stores/{storeCode}` — move to another account. The link is cleared. */
export interface DeliverectMoveBody {
  accountKey: string
  reason: string
}

// `DELETE DeliverectWeb/Stores/{storeCode}?reason=` — remove onboarding: no body, `reason` on the
// query string. The store's sync stops and its link is cleared; its history stays.

// ── Catalog (2623) ───────────────────────────────────────────────────────────────────────────────

/** `state` on `GET DeliverectWeb/Whitelist` — `active` is the default. */
export type DeliverectWhitelistState = 'active' | 'disabled' | 'deleted' | 'any'

/** The query of `GET DeliverectWeb/Whitelist?q=&state=&skip=&take=`. `take` is at most 500. */
export interface DeliverectWhitelistQuery {
  q: string | null
  state: DeliverectWhitelistState
  skip: number
  take: number
}

export interface DeliverectWhitelistRow {
  materialNumber: string
  nameEn: string
  nameAr: string
  gtins: string[]
  disabled: boolean
  deleted: boolean
  /** Platform keys this material is switched off for (a **platform exclusion** each). */
  excludedPlatforms: string[]
  updatedAt: LocalDateTime
  updatedBy: string
}

export interface DeliverectWhitelistPage {
  total: number
  rows: DeliverectWhitelistRow[]
}

/** `POST DeliverectWeb/Whitelist/Import`. Rows already present are re-activated. Refusal: DLV-00012. */
export interface DeliverectWhitelistImportBody {
  materialNumbers: string[]
  reason: string
}

export interface DeliverectWhitelistImportResult {
  added: number
  reactivated: number
  unknown: string[]
}

/** `PUT DeliverectWeb/Whitelist/{materialNumber}`. */
export interface DeliverectWhitelistUpdateBody {
  disabled: boolean
  deleted: boolean
  reason: string
}

/**
 * `PUT DeliverectWeb/Exclusions/{materialNumber}`. It REPLACES the material's exclusion set, so an
 * empty list re-enables every platform. Refusals: DLV-00004, DLV-00005.
 */
export interface DeliverectExclusionsBody {
  platforms: string[]
  reason: string
}

/** The query of `POST DeliverectWeb/Catalog/Push?account=`. */
export interface DeliverectCatalogPushQuery {
  account: string | null
}

/** `POST DeliverectWeb/Catalog/Push?account=` — pushes the catalog now. Refusal: DLV-00011. */
export interface DeliverectCatalogPushResult {
  fileId: string
  status: string
  rows: number
}

// ── Stock sync (2624) ────────────────────────────────────────────────────────────────────────────

/** `PUT DeliverectWeb/Sync/{storeCode}/Active` — pause or resume; never takes the store offline. */
export interface DeliverectSyncActiveBody {
  active: boolean
  reason: string
}

/** One row of `GET DeliverectWeb/Sync/{storeCode}/Logs?take=` (`take` defaults to 50). */
export interface DeliverectSyncLogRow {
  logId: string
  /** `F` full, `D` delta (spec 2615 "Sync log"). */
  syncType: string
  startTime: LocalDateTime
  endTime: LocalDateTime | null
  status: string
  rows: number
  fileId: string | null
  callbackStatus: string | null
  error: string | null
  /**
   * BackOffice 3026: `true` while the push's lines are kept (15 days from its start), else `false`.
   * Optional only because a server before 3026 leaves it off; then the Lines door is the answer.
   */
  linesKept?: boolean
}

/** The query of `GET DeliverectWeb/Sync/{storeCode}/Logs?take=` — `take` defaults to 50. */
export interface DeliverectSyncLogsQuery {
  take: number | null
}

// ── Stock sync lines (3026) ──────────────────────────────────────────────────────────────────────

/**
 * One row of an inventory file built for a push. A **base row** (`channel` `null`) carries the
 * location's stock, status and price; a **platform row** (`channel` = the platform's name on
 * Deliverect) its stock status only.
 */
export interface DeliverectSyncLine {
  plu: string
  channel: string | null
  /** The VAT-inclusive price sent, or `null` when none was sent (the items file's price stands). */
  price: number | null
  /** The ATP sent on a base row; `null` on a platform row. */
  stock: number | null
  /** `"IN_STOCK"` or `"OUT_OF_STOCK"`. */
  stockStatus: string
}

/** `GET DeliverectWeb/Sync/{storeCode}/Logs/{logId}/Lines?plu=&channel=&skip=&take=`. */
export interface DeliverectSyncLinesPage {
  logId: string
  /** `false` for a push outside the 15 days: no lines, and `total` 0. */
  linesKept: boolean
  /** The lines matching the filters. */
  total: number
  lines: DeliverectSyncLine[]
}

/** The query of the Lines door. `channel` is a platform name or `base`; `take` 1–1000, default 200. */
export interface DeliverectSyncLinesQuery {
  plu: string | null
  channel: string | null
  skip: number
  take: number
}

/** One row of `GET DeliverectWeb/Sync/{storeCode}/Lines?plu=` — a line with its push. */
export interface DeliverectMaterialLine extends DeliverectSyncLine {
  logId: string
  syncType: string
  sentAt: LocalDateTime
  status: string
  callbackStatus: string | null
}

// ── Store status (2625) ──────────────────────────────────────────────────────────────────────────

export type DeliverectStoreAction = 'busy' | 'close' | 'reopen'

/**
 * `POST DeliverectWeb/StoreStatus/{storeCode}`. `delayMinutes` applies to `busy` only.
 * Refusals: DLV-00010, DLV-00011.
 */
export interface DeliverectStoreStatusBody {
  action: DeliverectStoreAction
  delayMinutes?: number
  reason: string
}

/** One row `POST DeliverectWeb/StoreStatus/{storeCode}/Hours` returns — the hours that were sent. */
export interface DeliverectHoursRow {
  day: string
  /** `HH:mm`. */
  open: string
  /** `HH:mm`; on the next day when `overnight`. */
  close: string
  overnight: boolean
}

/** The query of `GET DeliverectWeb/StoreStatus/{storeCode}/History?take=`. */
export interface DeliverectStoreStatusHistoryQuery {
  take: number | null
}

/** One row of `GET DeliverectWeb/StoreStatus/{storeCode}/History?take=`. */
export interface DeliverectStoreStatusHistoryRow {
  action: string
  delayMinutes: number | null
  reason: string
  by: string
  at: LocalDateTime
  deliverectAnswer: string | null
}

// ── Orders monitor (2626) ────────────────────────────────────────────────────────────────────────

export type DeliverectOrderOutcome = 'created' | 'refused' | 'droppedLines' | 'cancelled' | 'statusFailed'

/**
 * The query of `GET DeliverectWeb/Orders?from=&to=&platform=&store=&outcome=&q=&skip=&take=`.
 * `from`/`to` are date-only and required (span ≤ 31 days); `platform` and `outcome` repeat.
 */
export interface DeliverectOrdersQuery {
  from: LocalDate
  to: LocalDate
  platform: string[]
  store: string | null
  outcome: DeliverectOrderOutcome[]
  q: string | null
  skip: number
  take: number
}

export interface DeliverectOrderRow {
  deliverectOrderId: string
  platformKey: string
  channelOrderId: string
  channelDisplayId: string
  storeCode: string
  accountKey: string
  receivedAt: LocalDateTime
  documentNumber: string | null
  outcome: DeliverectOrderOutcome
  reason: string | null
  droppedLines: number
  /** The last status code sent: 20 Accepted, 90 Finalized, 110 Cancelled, 120 Failed, 126 cancel failed. */
  lastStatusSent: number | null
  lastStatusAt: LocalDateTime | null
  lastStatusOk: boolean | null
  total: number
  currencyKey: string
}

export interface DeliverectOrdersPage {
  total: number
  rows: DeliverectOrderRow[]
}

export interface DeliverectOrderLine {
  plu: string
  name: string
  quantity: number
  unitPrice: number
  fundedDiscount: number
  materialNumber: string | null
  dropped: boolean
  droppedReason: string | null
}

export interface DeliverectOrderStatusSent {
  status: number
  sentAt: LocalDateTime
  ok: boolean
  answer: string | null
  attempts: number
}

/** `GET DeliverectWeb/Orders/{deliverectOrderId}` — the row, plus its lines and statuses. */
export interface DeliverectOrderDetail extends DeliverectOrderRow {
  lines: DeliverectOrderLine[]
  statuses: DeliverectOrderStatusSent[]
}

/**
 * `GET DeliverectWeb/Orders/{deliverectOrderId}/Raw` — "the raw body exactly as Deliverect sent it
 * (`text/plain` JSON), plus `receivedAt`".
 *
 * 🚩 **Contract gap (ticket 478, HITL-478).** The contract names no data fields, and BackOffice 2626
 * does not pin them either. Ruled: an ENVELOPED data object of two fields, named here and nowhere
 * else — `rawBody` (spec 2615's inbox column "raw body"), a STRING holding the body verbatim, and
 * `receivedAt`. The screen shows `rawBody` as received (pretty-printed only when it parses, never
 * altered). If 2626 ships another shape, this is the one place to change.
 */
export interface DeliverectOrderRaw {
  rawBody: string
  receivedAt: LocalDateTime
}

// `POST DeliverectWeb/Orders/{deliverectOrderId}/Retry` — no body. Refusals: DLV-00006, DLV-00007.

// ── Platforms and terms (2627) ───────────────────────────────────────────────────────────────────

/** One row of `GET DeliverectWeb/Accounts`. */
export interface DeliverectAccount {
  accountKey: string
  deliverectAccountId: string
  active: boolean
}

/** One row of `GET DeliverectWeb/Platforms`. A platform with no `creditCustomer` cannot be active. */
export interface DeliverectPlatform {
  platformKey: string
  displayName: string
  channelId: number
  creditCustomer: string | null
  active: boolean
}

/** `PUT DeliverectWeb/Platforms/{platformKey}`. */
export interface DeliverectPlatformBody {
  displayName: string
  channelId: number
  creditCustomer: string | null
  active: boolean
  reason: string
}

/** The query of `GET DeliverectWeb/Terms?platform=`. */
export interface DeliverectTermsQuery {
  platform: string | null
}

/** One row of `GET DeliverectWeb/Terms?platform=`. Rows are never edited or deleted. */
export interface DeliverectTermsRow {
  termsId: string
  platformKey: string
  validFrom: LocalDate
  /** `null` on the open (current) row. */
  validTo: LocalDate | null
  customerDiscountPct: number
  commissionPct: number
  deliveryFee: number
  deliveryFeeThreshold: number
  currencyKey: string
}

/**
 * `POST DeliverectWeb/Terms` — the row without `termsId` and `validTo`, plus `reason`. It closes the
 * previous open row the day before `validFrom`. Refusal: DLV-00008.
 */
export interface DeliverectTermsBody {
  platformKey: string
  validFrom: LocalDate
  customerDiscountPct: number
  commissionPct: number
  deliveryFee: number
  deliveryFeeThreshold: number
  currencyKey: string
  reason: string
}
