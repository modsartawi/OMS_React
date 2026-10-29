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
/** A date-only value, `yyyy-MM-dd` — declared once, in `@/core/util/date-window`. */
import type { LocalDate } from '@/core/util/date-window'
export type { LocalDate }

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
 * Exactly the four keys the probe returns. Cookie-gated, not grant-gated. Each flag is one
 * `BackOfficeScreen[…,03]` grant:
 *
 * - `canManageStores` ← `HungerStationStores`: Chains, Stores/*, Sync/*.
 * - `canManageCatalog` ← `HungerStationCatalog`: Materials/*.
 * - `canViewOrders` ← `HungerStationOrders`: Orders/* (Retry included).
 * - `canManagePromotions` ← `HungerStationPromotions` (spec 3201, BackOffice 3211): Promotions/*.
 */
export interface HungerStationAccessResult {
  canManageStores: boolean
  canManageCatalog: boolean
  canViewOrders: boolean
  canManagePromotions: boolean
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

// ── Promotions (BackOffice spec 3201, oms-react 665–671) ─────────────────────────────────────────
//
// 🚩 PROVISIONAL. The promotion door contract
// (`C:\Work\DMSCO\BackOffice\.issues\assets\3201-hungerstation-promotion-door-contract.md`, written
// by BackOffice 3211) does NOT exist yet, and no door is built. These shapes follow spec 3201's
// Implementation Decisions (the record, the status, the Doors list) in the area's conventions
// (camelCase, local wall-clock times, `null` for absent, codes and ids as strings). Each later
// ticket re-checks its section against the contract once it lands and fixes it HERE, not per
// screen. Every door is cookie-only behind `HungerStationPromotions`: a missing grant is a BARE 403.
//
// Words (BackOffice CONTEXT.md): a **HungerStation promotion** is made here and SENT to
// HungerStation; our pricing never applies it (ADR 0114). A **HungerStation promotion part** is
// what one HungerStation promotion id carries: a strikethrough is one part, a same-item bundle one
// part per (buy, get, subtype, value). Never "deal", "offer", "campaign" or bare "bundle".
//
// Doors (spec 3201 § Doors), each typed below:
//   GET  Promotions                         → HungerStationPromotionsPage      (665)
//   GET  Promotions/{id}                    → HungerStationPromotionDetail     (665)
//   GET  Promotions/Stores?chain=           → HungerStationPromotionStoreChoice[] (666)
//   POST Promotions                         HungerStationPromotionSaveBody → detail (666)
//   PUT  Promotions/{id}                    HungerStationPromotionSaveBody → detail (666 draft, 670 edit)
//   POST Promotions/{id}/Check              (no body) → HungerStationPromotionCheckResult (667, 668)
//   POST Promotions/{id}/Send               HungerStationPromotionReasonBody → detail (666)
//   POST Promotions/{id}/Refresh            (no body) → detail (666)
//   POST Promotions/{id}/Parts/{partId}/Resend  HungerStationPromotionReasonBody → detail (669)
//   POST Promotions/{id}/RemoveItems        HungerStationPromotionRemoveItemsBody → detail (670)
//   POST Promotions/{id}/Replace            HungerStationPromotionReplaceBody → the NEW detail (671)
//   POST Promotions/{id}/SwitchOff          HungerStationPromotionReasonBody → detail (671)

/** The promotion refusal codes (spec 3201 § Doors: "continue the series from DHS-00016", in the
 *  order the spec lists them). 🚩 Numbers provisional until the contract asset names them. A
 *  HungerStation outage reuses `HUNGERSTATION_ERRORS.hungerStationFailed` (DHS-00014); a missing
 *  reason `HUNGERSTATION_ERRORS.reasonInvalid` (DHS-00008). */
export const HUNGERSTATION_PROMOTION_ERRORS = {
  /** 404 — no such promotion. */
  noSuchPromotion: 'DHS-00016',
  /** 409 — a part of the promotion is Sending: every write waits for HungerStation's answer. */
  sending: 'DHS-00017',
  /** 400 — Send refused: a check still refuses. The per-row detail rides the Check answer. */
  checkFailed: 'DHS-00018',
  /** 409 — the name is used by another promotion of the chain not switched off, replaced or ended. */
  nameInUse: 'DHS-00019',
  /** 502 — Replace stopped: HungerStation refused a part's switch-off. Nothing new was sent; the
   *  old promotion is unchanged. */
  replaceRefused: 'DHS-00020',
  /** 409 — an in-place edit changed the name, stores, start or end: that is a Replace (BO 3215). */
  needsReplace: 'DHS-00021',
} as const

/** A promotion's type, as HungerStation names it. */
export type HungerStationPromotionType = 'STRIKETHROUGH' | 'SAME_ITEM_BUNDLE'

/** A discount's subtype, as HungerStation names it. `PERCENTAGE` 1–100; the others an amount in
 *  SAR (`ABSOLUTE` off, `FINAL_PRICE` the price paid), positive, at most 3 decimals. */
export type HungerStationDiscountSubtype = 'PERCENTAGE' | 'ABSOLUTE' | 'FINAL_PRICE'

/** HungerStation's reporting reason. `COMPETITIVENESS` is the default. */
export type HungerStationPromotionReason = 'COMPETITIVENESS' | 'OVERSTOCK' | 'DELISTING' | 'EXPIRING_SOON' | 'NMR' | 'TRADING'

/**
 * A promotion's status (spec 3201 § Status). `scheduled` (sent, start still ahead) and `ended`
 * (past end) are DERIVED from the window by the server, in the read and in the list filter —
 * never stored, never a call. `livePartlyRefused` = every part final, some refusal in a result.
 */
export type HungerStationPromotionStatus =
  | 'draft'
  | 'sending'
  | 'live'
  | 'livePartlyRefused'
  | 'failed'
  | 'switchedOff'
  | 'replaced'
  | 'scheduled'
  | 'ended'

/** A HungerStation job's status (`getPromotionStatus`), as HungerStation sends it. */
export type HungerStationPromotionJobStatus = 'QUEUED' | 'COMPLETED' | 'FAILED' | 'DUPLICATE'

/** What one send asked HungerStation: an upsert of the part, or its switch-off (`active: false`). */
export type HungerStationPromotionSendKind = 'upsert' | 'switchOff'

// GET HungerStationWeb/Promotions ────────────────────────────────────────────────────────────────

/** The query of `GET HungerStationWeb/Promotions?chain=&status=&type=&q=&store=&skip=&take=`.
 *  `status` is a repeated key (OR); `q` matches the name (contains); `store` (3216) answers "which
 *  promotions are live on this store". */
export interface HungerStationPromotionsQuery {
  chain: string | null
  status: HungerStationPromotionStatus[]
  type: HungerStationPromotionType | null
  q: string | null
  store: string | null
  skip: number
  take: number
}

/** `take` of the Promotions list: default 100, 1 to 500 (the area's paging). */
export const HUNGERSTATION_PROMOTIONS_TAKE = { default: 100, max: 500 } as const

/** HungerStation's own `discount` ceiling: at most 20,000 SKUs a promotion, refused before send. */
export const HUNGERSTATION_PROMOTION_MAX_SKUS = 20000

/** One row of the list. */
export interface HungerStationPromotionRow {
  /** A ULID. */
  promotionId: string
  chainKey: string
  name: string
  type: HungerStationPromotionType
  status: HungerStationPromotionStatus
  /** Saudi local wall time, as entered. */
  startAt: LocalDateTime
  endAt: LocalDateTime
  /** The stores it targets (frozen at send; a draft on "all" counts the chain's stores now). */
  storeCount: number
  /** Its active items. */
  skuCount: number
  /** `null` until first sent. */
  lastSentAt: LocalDateTime | null
  lastSentBy: string | null
}

/** `GET HungerStationWeb/Promotions` — one server page; `total` counts every match. */
export interface HungerStationPromotionsPage {
  total: number
  rows: HungerStationPromotionRow[]
}

// GET HungerStationWeb/Promotions/{promotionId} ───────────────────────────────────────────────────

/**
 * The combination a part stands for. A strikethrough's single part is "all": every field `null`.
 * A bundle part names its buy and get quantities and its one discount.
 */
export interface HungerStationPromotionCombination {
  buyQuantity: number | null
  getQuantity: number | null
  subtype: HungerStationDiscountSubtype | null
  value: number | null
}

/** A store HungerStation called invalid in a part's result, as our store and the vendor id sent. */
export interface HungerStationPromotionVendorRef {
  /** `null` when the vendor id no longer resolves to one of our stores. */
  storeCode: string | null
  vendorId: string
}

/** A SKU HungerStation named in a part's result, with our material number when it resolves. */
export interface HungerStationPromotionRefusedSku {
  sku: string
  materialNumber: string | null
}

/** One store's refused SKUs in a part's result. */
export interface HungerStationPromotionStoreSkus extends HungerStationPromotionVendorRef {
  skus: HungerStationPromotionRefusedSku[]
}

/** What did not take, from a part's latest final result (3214): HungerStation's
 *  `invalid_vendors`, `missing_skus` and `invalid_discounted_skus`, per store. */
export interface HungerStationPromotionRefusals {
  invalidVendors: HungerStationPromotionVendorRef[]
  missingSkus: HungerStationPromotionStoreSkus[]
  invalidDiscountedSkus: HungerStationPromotionStoreSkus[]
}

/** A **HungerStation promotion part**. */
export interface HungerStationPromotionPart extends HungerStationPromotionCombination {
  /** A ULID; also the identity HungerStation knows the part by, unchanged across resends. */
  partId: string
  /** The name sent to HungerStation (`"<name> · B2G1 50%"`; a strikethrough's is the name). */
  name: string
  /** `false` once switched off (whole promotion, or emptied by an edit). */
  active: boolean
  /** Its active items. */
  skuCount: number
  /** The latest send's job status; `null` while a draft (never sent). */
  latestJobStatus: HungerStationPromotionJobStatus | null
  /** The latest send's job is still QUEUED after 24 hours: left for a manual Refresh. */
  unanswered: boolean
  /** `null` until a final result; empty lists when HungerStation refused nothing. */
  refusals: HungerStationPromotionRefusals | null
}

/** One store of the promotion, with the vendor id AS SENT (frozen at send). */
export interface HungerStationPromotionStore {
  storeCode: string
  /** `""` when the store master has no `Store` row for the code. */
  storeName: string
  vendorId: string
}

/** One item row. A removed item stays, `active: false` — nothing is deleted. */
export interface HungerStationPromotionItem {
  itemId: string
  materialNumber: string
  /** The SKU resolved through the HungerStation material list at send; `null` before. */
  sku: string | null
  subtype: HungerStationDiscountSubtype
  value: number
  maxQuantity: number | null
  /** Bundle only; `null` on a strikethrough. */
  buyQuantity: number | null
  getQuantity: number | null
  /** The part it belongs to; `null` while a draft (parts are made at send). */
  partId: string | null
  active: boolean
}

/** One HungerStation call (an upsert or a switch-off) for one part. The request and result bodies
 *  are kept on the server for disputes; the read does not carry them. */
export interface HungerStationPromotionSend {
  sendId: string
  partId: string
  kind: HungerStationPromotionSendKind
  sentAt: LocalDateTime
  sentBy: string
  /** The reason the user gave for the write. */
  reason: string
  /** HungerStation's HTTP status (202 accepted); `null` when it was never reached. */
  httpStatus: number | null
  jobId: string | null
  jobStatus: HungerStationPromotionJobStatus | null
  /** HungerStation's own `created_at` / `updated_at`, converted to local at the wire. */
  hsCreatedAt: LocalDateTime | null
  hsUpdatedAt: LocalDateTime | null
  pollAttempts: number
  lastPolledAt: LocalDateTime | null
  /** Still QUEUED after 24 hours. */
  unanswered: boolean
  /** Why the call or its poll failed (HungerStation's answer, an outage); `null` when none. */
  error: string | null
}

/** `GET HungerStationWeb/Promotions/{promotionId}` — the header, parts, stores, items and every
 *  send (newest first). Also the answer of every write door. DHS-00016. */
export interface HungerStationPromotionDetail {
  promotionId: string
  chainKey: string
  name: string
  displayNameEn: string
  displayNameAr: string
  type: HungerStationPromotionType
  hsReason: HungerStationPromotionReason
  startAt: LocalDateTime
  endAt: LocalDateTime
  /** Per-order limit; `null` for none. */
  orderLimit: number | null
  /** Total-uses limit; `null` for none. */
  globalLimit: number | null
  /** The discount a row with a blank subtype / value takes. */
  defaultSubtype: HungerStationDiscountSubtype
  defaultValue: number | null
  status: HungerStationPromotionStatus
  /** A draft targeting every store of the chain; frozen into `stores` at send. */
  allStores: boolean
  /** The promotion this one replaced, and the one that replaced it (3216). */
  replacesId: string | null
  replacedById: string | null
  createdAt: LocalDateTime
  createdBy: string
  updatedAt: LocalDateTime
  updatedBy: string
  sentAt: LocalDateTime | null
  sentBy: string | null
  switchedOffAt: LocalDateTime | null
  switchedOffBy: string | null
  switchedOffReason: string | null
  parts: HungerStationPromotionPart[]
  stores: HungerStationPromotionStore[]
  items: HungerStationPromotionItem[]
  sends: HungerStationPromotionSend[]
}

// GET HungerStationWeb/Promotions/Stores?chain= ────────────────────────────────────────────────

/** One store the picker offers: the chain's onboarded stores, removed ones left out, paused ones
 *  kept (and in "all"). */
export interface HungerStationPromotionStoreChoice {
  storeCode: string
  storeName: string
  vendorId: string
  /** `false` while its stock sync is paused — still offered, it still sells on HungerStation. */
  syncActive: boolean
}

// POST HungerStationWeb/Promotions · PUT HungerStationWeb/Promotions/{promotionId} ──────────────

/** One pasted item row. A blank subtype or value takes the promotion's default. Buy / get on a
 *  bundle only. Our material number, never HungerStation's SKU. */
export interface HungerStationPromotionItemInput {
  materialNumber: string
  subtype: HungerStationDiscountSubtype | null
  value: number | null
  maxQuantity: number | null
  buyQuantity: number | null
  getQuantity: number | null
}

/**
 * Save a draft (`POST`, create) or save / edit (`PUT`). On a SENT promotion the `PUT` is the
 * in-place edit (3215): it re-sends the affected parts, and a change of name, stores, start or end
 * is refused (`needsReplace`). Returns the detail. DHS-00008 / 00016 / 00017 / 00019.
 */
export interface HungerStationPromotionSaveBody {
  chainKey: string
  name: string
  displayNameEn: string
  displayNameAr: string
  type: HungerStationPromotionType
  hsReason: HungerStationPromotionReason
  startAt: LocalDateTime
  endAt: LocalDateTime
  orderLimit: number | null
  globalLimit: number | null
  defaultSubtype: HungerStationDiscountSubtype
  defaultValue: number | null
  /** Every store of the chain (frozen at send); `storeCodes` is then ignored. */
  allStores: boolean
  storeCodes: string[]
  items: HungerStationPromotionItemInput[]
  reason: string
}

// POST HungerStationWeb/Promotions/{promotionId}/Check ────────────────────────────────────────

/** One problem a check found. `code` is a machine code; `message` the server's words. */
export interface HungerStationPromotionProblem {
  code: string
  message: string
}

/** A header field's refusal (name, display names, window, limits). */
export interface HungerStationPromotionFieldProblem extends HungerStationPromotionProblem {
  field: string
}

/** A row where a `FINAL_PRICE` or `ABSOLUTE` value is not below our VAT-inclusive price at some
 *  chosen stores: a WARNING — HungerStation will refuse that SKU there; Send is not refused. */
export interface HungerStationPromotionPriceWarning {
  storeCodes: string[]
}

/** One item row's check: its refusals (they block Send) and its price warning. */
export interface HungerStationPromotionRowCheck {
  materialNumber: string
  refusals: HungerStationPromotionProblem[]
  priceWarning: HungerStationPromotionPriceWarning | null
}

/** A part as it WILL be sent. */
export interface HungerStationPromotionPartPreview extends HungerStationPromotionCombination {
  name: string
  skuCount: number
}

/** `POST …/{promotionId}/Check` — every pre-check, no write. `sendable` is `true` exactly when
 *  nothing refuses (warnings never refuse). `rows` carries only rows with a refusal or a warning. */
export interface HungerStationPromotionCheckResult {
  sendable: boolean
  header: HungerStationPromotionFieldProblem[]
  rows: HungerStationPromotionRowCheck[]
  parts: HungerStationPromotionPartPreview[]
  skuCount: number
}

/**
 * The check codes a `HungerStationPromotionProblem` carries (ticket 667, BackOffice 3212), in the
 * order 3212 lists the refusals. 🚩 PROVISIONAL: the contract's Check section is not written; these
 * spellings are assumed (`NO_SKU` is 666's). The screen says each in its own words and shows the
 * server's `message` for a code it does not know.
 *
 * A row refusal rides `rows[].refusals`; a header refusal rides `header[]` with its `field` —
 * `name`, `displayNameEn`, `displayNameAr`, `startAt`, `endAt`, and for the promotion as a whole
 * `items` (more than 20,000 SKUs) and `stores` (none).
 */
export const HUNGERSTATION_PROMOTION_CHECK_CODES = {
  // Row: the material.
  /** Not on the HungerStation material list (no SKU). */
  noSku: 'NO_SKU',
  /** On the list, disabled there. */
  materialDisabled: 'MATERIAL_DISABLED',
  /** On the list, deleted there. */
  materialDeleted: 'MATERIAL_DELETED',
  // Row: the value.
  /** A `PERCENTAGE` outside 1–100. */
  percentRange: 'PERCENT_RANGE',
  /** A value of 0 or less. */
  valueNotPositive: 'VALUE_NOT_POSITIVE',
  /** More than 3 decimals. */
  valueDecimals: 'VALUE_DECIMALS',
  // Header.
  /** `startAt` / `endAt`: the start is not before the end. */
  windowOrder: 'WINDOW_ORDER',
  /** `endAt`: the end has already passed. */
  endPast: 'END_PAST',
  /** `displayNameEn` / `displayNameAr`: missing. */
  displayNameMissing: 'DISPLAY_NAME_MISSING',
  /** `name`: used by another promotion of the chain not switched off, replaced or ended. */
  nameInUse: 'NAME_IN_USE',
  /** `items`: more than 20,000 SKUs. */
  tooManySkus: 'TOO_MANY_SKUS',
  /** `stores`: no store. */
  noStores: 'NO_STORES',
} as const

/** The header fields a check names. */
export const HUNGERSTATION_PROMOTION_CHECK_FIELDS = ['name', 'displayNameEn', 'displayNameAr', 'startAt', 'endAt', 'items', 'stores'] as const

// The write doors that take only a reason ─────────────────────────────────────────────────────

/** `POST …/Send`, `POST …/SwitchOff`, `POST …/Parts/{partId}/Resend` — each returns the detail.
 *  `POST …/Refresh` takes NO body (it only asks HungerStation). */
export interface HungerStationPromotionReasonBody {
  reason: string
}

/** `POST …/{promotionId}/RemoveItems` — those materials go out `active: false` in their parts and
 *  their items turn inactive. Returns the detail. */
export interface HungerStationPromotionRemoveItemsBody {
  materialNumbers: string[]
  reason: string
}

/** `POST …/{promotionId}/Replace` — switch off every part of the old promotion first; only if
 *  each is accepted, a fresh promotion (linked through `replacesId`) with the same items is made
 *  and sent. Returns the NEW promotion's detail. DHS-00020 when a switch-off was refused. */
export interface HungerStationPromotionReplaceBody {
  name: string
  startAt: LocalDateTime
  endAt: LocalDateTime
  allStores: boolean
  storeCodes: string[]
  reason: string
}
