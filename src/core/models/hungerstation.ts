// Wire shapes for the `HungerStationWeb/*` doors (BackOffice spec 3028, ticket 551).
//
// 🚩 The ONE source is the door contract,
// `C:\Work\DMSCO\BackOffice\.issues\assets\3028-hungerstation-web-door-contract.md`. Every type below
// mirrors it field for field in the camelCase ASP.NET Core emits: no field invented, none renamed,
// none dropped. Written once, for EVERY door, by the area's first slice — 552–556 read them here
// rather than each re-deciding a shape, and a slice that finds a drift against the contract fixes
// the contract first, then here.
//
// This is the DIRECT HungerStation rail (Delivery Hero's own API), not HungerStation through
// Deliverect. Store codes, vendor ids, chain keys, material numbers and HungerStation order ids are
// STRINGS and stay strings: shown as stored, never `Number()`-ed. Times are local wall-clock with no
// offset (`yyyy-MM-ddTHH:mm:ss`), dates `yyyy-MM-dd`; an absent value is `null`. Money is a
// 3-decimal number beside its `currencyKey` (always `"SAR"` in v1).
//
// A refusal for a missing grant (or an `x-api-key` caller) is a BARE 403 — no envelope, no code.

/** A local wall-clock time, `yyyy-MM-ddTHH:mm:ss`, no offset. Never append a `Z`. */
export type LocalDateTime = string
/** A date-only value, `yyyy-MM-dd`. */
export type LocalDate = string

// ── Errors ───────────────────────────────────────────────────────────────────────────────────────

/** The area's refusal codes (contract § Error codes), read through `apiErrorCode`. 00001–00007
 *  are spec 1867's and keep their meanings. */
export const HUNGERSTATION_ERRORS = {
  /** 400 — a field is blank or longer than its column. */
  fieldInvalid: 'DHS-00001',
  /** 404 — no such store in the store master. */
  noSuchStore: 'DHS-00002',
  /** 400 — onboard: the store is closed. */
  storeClosed: 'DHS-00003',
  /** 409 — onboard: the store is already onboarded (and not removed). */
  alreadyOnboarded: 'DHS-00004',
  /** 409 — the vendor id belongs to another onboarded (not removed) store. */
  vendorIdTaken: 'DHS-00005',
  /** 400 — no such chain configured. */
  noSuchChain: 'DHS-00006',
  /** 404 — the store is not onboarded, or it is removed. */
  notOnboarded: 'DHS-00007',
  /** 400 — a required `reason` is missing or longer than 200 characters. */
  reasonInvalid: 'DHS-00008',
  /** 404 — no such material in the HungerStation list. */
  noSuchMaterial: 'DHS-00009',
  /** 400 — material import: no rows, more than 5000 rows, or a row that is not a material number. */
  importInvalid: 'DHS-00010',
  /** 404 — no such HungerStation order (or no such delivery for it). */
  noSuchOrder: 'DHS-00011',
  /** 409 — retry: the order is not `failed`. */
  notFailed: 'DHS-00012',
  /** 409 — sync now: the store's stock sync is paused. */
  syncPaused: 'DHS-00013',
  /** 502 — HungerStation unreachable, or it refused the push (its answer is in `message`). */
  hungerStationFailed: 'DHS-00014',
  /** 404 — no such push for this store (or it is older than the 15 days kept). */
  noSuchPush: 'DHS-00015',
  /** 409 — sync now: another push of the store is running right now (ticket 3032). Nothing recorded. */
  syncBusy: 'HungerStationSyncBusy',
  /** 400 — a filter value the door does not know. */
  filterUnknown: 'HungerStationFilterUnknown',
  /** 400 — an input out of range (`take`, a missing `material`). */
  inputInvalid: 'HungerStationInputInvalid',
  /** 400 — the orders window is missing, malformed, reversed, too long or out of bounds. */
  windowInvalid: 'HungerStationWindowInvalid',
} as const

export type HungerStationErrorCode = (typeof HUNGERSTATION_ERRORS)[keyof typeof HUNGERSTATION_ERRORS]

// ── GET HungerStationWeb/Access ──────────────────────────────────────────────────────────────────

/**
 * Exactly the three keys the probe returns. Cookie-gated, not grant-gated. Each flag is one
 * `BackOfficeScreen[…,03]` grant:
 *
 * - `canManageStores` ← `HungerStationStores`: Chains, Stores/*, Sync/*.
 * - `canManageCatalog` ← `HungerStationCatalog`: Materials/*.
 * - `canViewOrders` ← `HungerStationOrders`: Orders/* (Retry included).
 */
export interface HungerStationAccessResult {
  canManageStores: boolean
  canManageCatalog: boolean
  canViewOrders: boolean
}

// ── Stores ───────────────────────────────────────────────────────────────────────────────────────

/** `GET HungerStationWeb/Chains` — the configured chain keys, e.g. `["OlaCare", "AlDawaa"]`. */
export type HungerStationChains = string[]

/** `sync` on `GET HungerStationWeb/Stores` — `any` is the default. */
export type HungerStationSyncFilter = 'any' | 'active' | 'paused'

/** The health the server computes (the spec 1872 highlight). */
export type HungerStationHealth = 'ok' | 'failing' | 'silent'

/** `health` on `GET HungerStationWeb/Stores` — `any` is the default. */
export type HungerStationHealthFilter = 'any' | HungerStationHealth

/** The query of `GET HungerStationWeb/Stores?chain=&sync=&health=&q=`. `q` matches a store code,
 *  a store name or a vendor id (contains). */
export interface HungerStationStoresQuery {
  chain: string | null
  sync: HungerStationSyncFilter
  health: HungerStationHealthFilter
  q: string | null
}

/** A push's status: `"S"` success, `"E"` error. */
export type HungerStationPushStatus = 'S' | 'E'

/** A store's stock sync block. */
export interface HungerStationStoreSync {
  active: boolean
  /** `null` before a full push has been recorded. */
  lastFullRun: LocalDateTime | null
  /** `null` before a delta push has been recorded. */
  lastDeltaRun: LocalDateTime | null
  /** The newest push in the last 24 hours — `null` when there was none. */
  lastRun: LocalDateTime | null
  lastStatus: HungerStationPushStatus | null
  lastError: string | null
  health: HungerStationHealth
}

/** One row of `GET HungerStationWeb/Stores` — also the answer of onboard, edit and pause/resume. */
export interface HungerStationStoreRow {
  storeCode: string
  /** `""` when the store master has no `Store` row for the code. */
  storeName: string
  chainKey: string
  vendorId: string
  /** `null` when the stored stamp is `0001-01-01` (links from before spec 1867). */
  onboardedAt: LocalDateTime | null
  onboardedBy: string
  /** `null` when the stored stamp is `0001-01-01`. */
  updatedAt: LocalDateTime | null
  updatedBy: string
  sync: HungerStationStoreSync
}

/** `POST HungerStationWeb/Stores` — onboard (revives a removed store). Returns the store row. */
export interface HungerStationOnboardBody {
  storeCode: string
  chainKey: string
  vendorId: string
  reason: string
}

/** `PUT HungerStationWeb/Stores/{storeCode}` — edit vendor id or chain. Returns the store row. */
export interface HungerStationEditBody {
  chainKey: string
  vendorId: string
  reason: string
}

// `DELETE HungerStationWeb/Stores/{storeCode}?reason=` — remove onboarding; `data: null`. The reason
// rides the QUERY STRING, so it has no body type.

// ── Stock sync ───────────────────────────────────────────────────────────────────────────────────

/** `PUT HungerStationWeb/Sync/{storeCode}/Active` — pause / resume. Returns the store row. */
export interface HungerStationSyncActiveBody {
  active: boolean
  reason: string
}

/** `POST HungerStationWeb/Sync/{storeCode}/Now` — a full push now. Returns the log row. */
export interface HungerStationSyncNowBody {
  reason: string
}

/** A push's type: `"F"` full, `"D"` delta. */
export type HungerStationSyncType = 'F' | 'D'

/** One row of `GET HungerStationWeb/Sync/{storeCode}/Logs?take=` (newest first, 15 days back),
 *  and the answer of sync now. */
export interface HungerStationSyncLogRow {
  logId: string
  syncType: HungerStationSyncType
  startTime: LocalDateTime
  endTime: LocalDateTime | null
  status: HungerStationPushStatus
  /** The materials sent. */
  rows: number
  error: string | null
}

/** `take` of the Logs door: default 50, 1 to 500. */
export const HUNGERSTATION_LOGS_TAKE = { default: 50, max: 500 } as const

/** The query of `GET …/Sync/{storeCode}/Logs/{logId}/Lines?material=&skip=&take=`. `material`
 *  matches exactly. */
export interface HungerStationSyncLinesQuery {
  material: string | null
  skip: number
  take: number
}

/** `take` of the push lines door: default 200, 1 to 1000. */
export const HUNGERSTATION_LINES_TAKE = { default: 200, max: 1000 } as const

/** One material line a push sent. A `null` value was not sent by that push — never a zero. */
export interface HungerStationSyncLine {
  materialNumber: string
  active: boolean | null
  quantity: number | null
  maximumSalesQuantity: number | null
  price: number | null
  currencyKey: string
  sentAt: LocalDateTime
}

/** `GET …/Sync/{storeCode}/Logs/{logId}/Lines` — ordered by material number; `total` counts the
 *  matching lines. */
export interface HungerStationSyncLinesPage {
  logId: string
  total: number
  lines: HungerStationSyncLine[]
}

/** One row of `GET …/Sync/{storeCode}/Lines?material=` — the material's history, newest first, at
 *  most the newest 200 lines, each with its push. */
export interface HungerStationMaterialLine {
  logId: string
  syncType: HungerStationSyncType
  status: HungerStationPushStatus
  sentAt: LocalDateTime
  materialNumber: string
  active: boolean | null
  quantity: number | null
  maximumSalesQuantity: number | null
  price: number | null
  currencyKey: string
}

/** The material-history door's cap. */
export const HUNGERSTATION_MATERIAL_HISTORY_CAP = 200

/** How long push records and their lines are kept (ADR 0106). */
export const HUNGERSTATION_SYNC_HISTORY_DAYS = 15

// ── Materials ────────────────────────────────────────────────────────────────────────────────────

/** `state` on `GET HungerStationWeb/Materials` — `active` is the default. */
export type HungerStationMaterialState = 'active' | 'disabled' | 'deleted' | 'any'

/** The query of `GET HungerStationWeb/Materials?q=&state=&skip=&take=`. `q` matches the start of a
 *  material number, its SKU, or either name (contains). */
export interface HungerStationMaterialsQuery {
  q: string | null
  state: HungerStationMaterialState
  skip: number
  take: number
}

/** `take` of the Materials door: default 100, 1 to 500. */
export const HUNGERSTATION_MATERIALS_TAKE = { default: 100, max: 500 } as const

/** One material of the HungerStation list — also the answer of a per-row change. */
export interface HungerStationMaterialRow {
  materialNumber: string
  sku: string
  /** `""` when the material master no longer has the material. */
  nameEn: string
  nameAr: string
  disabled: boolean
  deleted: boolean
  /** `null` when the stored stamp is `0001-01-01`. */
  updatedAt: LocalDateTime | null
  updatedBy: string
}

/** `GET HungerStationWeb/Materials` — one server page. */
export interface HungerStationMaterialsPage {
  total: number
  rows: HungerStationMaterialRow[]
}

/** One row of a material import (the WPF sheet's X marks become booleans). */
export interface HungerStationMaterialImportRow {
  materialNumber: string
  disabled: boolean
  deleted: boolean
}

/** `POST HungerStationWeb/Materials/Import` — up to 5000 rows; a repeated number counts once, its
 *  last row wins. */
export interface HungerStationMaterialImportBody {
  rows: HungerStationMaterialImportRow[]
  reason: string
}

/** The import's row ceiling. */
export const HUNGERSTATION_IMPORT_MAX_ROWS = 5000

/** The import's answer. `unknown` lists numbers the material master does not have; not added. */
export interface HungerStationMaterialImportResult {
  added: number
  updated: number
  unknown: string[]
}

/** `PUT HungerStationWeb/Materials/{materialNumber}` — returns the material's row. */
export interface HungerStationMaterialChangeBody {
  disabled: boolean
  deleted: boolean
  reason: string
}

// ── Orders monitor ───────────────────────────────────────────────────────────────────────────────

/** A **HungerStation order outcome**, judged on our side (`cancelled` wins over `created`). */
export type HungerStationOrderOutcome = 'created' | 'cancelled' | 'failed' | 'pending'

/** `outcome` on `GET HungerStationWeb/Orders` — the four outcomes plus two facts beside them;
 *  repeatable (OR). */
export type HungerStationOutcomeFilter = HungerStationOrderOutcome | 'replacedLines' | 'unmatched'

/** What a person must do about an order — v1 names only `"unmatched"` (onboard or revive the store). */
export type HungerStationOrderAlert = 'unmatched'

/** The query of `GET HungerStationWeb/Orders?from=&to=&store=&chain=&outcome=&q=&skip=&take=`.
 *  `from`/`to` are required, both days included, at most 31 days. */
export interface HungerStationOrdersQuery {
  from: LocalDate
  to: LocalDate
  store: string | null
  chain: string | null
  outcome: HungerStationOutcomeFilter[]
  q: string | null
  skip: number
  take: number
}

/** `take` of the Orders door: default 100, 1 to 500. */
export const HUNGERSTATION_ORDERS_TAKE = { default: 100, max: 500 } as const

/** The window's widest span, in days. */
export const HUNGERSTATION_ORDERS_MAX_DAYS = 31

/** The fields an order row and its detail share. */
interface HungerStationOrderBase {
  orderId: string
  orderCode: string
  chainKey: string
  vendorId: string
  /** `null` when the order never resolved a store. */
  storeCode: string | null
  /** The earliest delivery's receive time (stamped by us), not HungerStation's created time. */
  receivedAt: LocalDateTime
  /** HungerStation's own status (`RECEIVED`, `CANCELLED`, …). */
  hsStatus: string
  /** `null` when no delivery document exists. */
  documentNumber: string | null
  outcome: HungerStationOrderOutcome
  /** The error of a `failed` order's latest run, otherwise `null`. */
  reason: string | null
  /** Lines HungerStation's picker replaced. */
  replacedLines: number
  /** The sum of the lines still in the cart, at HungerStation's price. */
  total: number
  currencyKey: string
  alert: HungerStationOrderAlert | null
  /** `true` exactly when `outcome` is `failed`. */
  retryable: boolean
}

/** One row of `GET HungerStationWeb/Orders` — `deliveries` is a COUNT here. */
export interface HungerStationOrderRow extends HungerStationOrderBase {
  deliveries: number
}

/** `GET HungerStationWeb/Orders` — one server page; `total` counts every match. */
export interface HungerStationOrdersPage {
  total: number
  rows: HungerStationOrderRow[]
}

/** One line of an order, in line-id order, each replacement right after the line it replaced.
 *  Lines carry NO `currencyKey` — the order row's applies. */
export interface HungerStationOrderLine {
  itemId: string
  replacedId: string | null
  sku: string
  name: string
  /** HungerStation's (`IN_CART`, `REPLACED`, …). */
  status: string
  quantity: number
  unitPrice: number
  totalPrice: number
  discount: number
  materialNumber: string | null
}

/** A delivery's processing run: `"C"` done, `"P"` waiting, `"F"` stopped with an error. The
 *  worker's `"R"` and the legacy `"E"` both read as `"P"`. */
export type HungerStationRunStatus = 'C' | 'P' | 'F'

export interface HungerStationOrderRun {
  status: HungerStationRunStatus
  attempts: number
  lastAttemptAt: LocalDateTime | null
  /** Present only for a `"P"` run; `null` for `"C"` and `"F"`. */
  nextAttemptAt: LocalDateTime | null
  /** `null` for a `"C"` run, even when an earlier attempt left an error. */
  error: string | null
}

/** One webhook call for the order, oldest first. */
export interface HungerStationOrderDelivery {
  receiveId: string
  receivedAt: LocalDateTime
  /** `null` for a delivery whose intake failed before its run was written. */
  run: HungerStationOrderRun | null
}

/** `GET HungerStationWeb/Orders/{orderId}` — the row, with `deliveries` as the LIST, plus lines. */
export interface HungerStationOrderDetail extends HungerStationOrderBase {
  lines: HungerStationOrderLine[]
  deliveries: HungerStationOrderDelivery[]
}

/** `GET HungerStationWeb/Orders/{orderId}/Deliveries/{receiveId}/Raw` — `body` is the raw body
 *  exactly as HungerStation sent it, as a JSON STRING. */
export interface HungerStationOrderRaw {
  receivedAt: LocalDateTime
  body: string
}

/** `POST HungerStationWeb/Orders/{orderId}/Retry`. */
export interface HungerStationRetryBody {
  reason: string
}

export interface HungerStationRetryResult {
  orderId: string
  receiveId: string
  requeued: boolean
}
