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
// The binding description is the door contract
// `C:\Work\DMSCO\BackOffice\.issues\assets\3201-hungerstation-promotion-door-contract.md` (BackOffice
// 3211–3216, done; reconciled here 2026-10-29). Every interface below is FIELD FOR FIELD that asset:
// a change goes into the asset first, then here, then the drive's fixtures (its § 0 compares them).
// Envelope, messages, local wall-clock times and the bare 403 are as the 3028 contract. Every door is
// cookie-only behind `HungerStationPromotions`.
//
// Words (BackOffice CONTEXT.md): a **HungerStation promotion** is made here and SENT to
// HungerStation; our pricing never applies it (ADR 0114). A **HungerStation promotion part** is
// what one HungerStation promotion id carries: a strikethrough is one part, a same-item bundle one
// part per (buy, get, subtype, value). Never "deal", "offer", "campaign" or bare "bundle".
//
// Doors:
//   GET  Promotions?chain=&status=&q=&store=&skip=&take=  → HungerStationPromotionsPage
//   GET  Promotions/{id}                    → HungerStationPromotionDetail
//   GET  Promotions/Stores?chain=           → HungerStationPromotionStoreChoice[]
//   POST Promotions                         HungerStationPromotionSaveBody → HungerStationPromotionSaved
//   PUT  Promotions/{id}                    HungerStationPromotionSaveBody → HungerStationPromotionSaved
//                                           (a draft saved again; a sent one edited in place, 3215)
//   POST Promotions/{id}/Check              (no body) → HungerStationPromotionCheck
//   POST Promotions/{id}/Send               HungerStationPromotionReasonBody → detail
//   POST Promotions/{id}/Refresh            (no body) → detail
//   POST Promotions/{id}/Parts/{partId}/Resend  HungerStationPromotionReasonBody → detail
//   POST Promotions/{id}/RemoveItems        HungerStationPromotionRemoveItemsBody → detail
//   POST Promotions/{id}/SwitchOff          HungerStationPromotionReasonBody → detail
//   POST Promotions/{id}/Replace            HungerStationPromotionReplaceBody → the SUCCESSOR's detail

/** The promotion refusal codes (contract § Error codes). Every one carries only `message` (English
 *  / Arabic): no structured `data`. A HungerStation outage reuses
 *  `HUNGERSTATION_ERRORS.hungerStationFailed` (DHS-00014, 502); a missing reason
 *  `HUNGERSTATION_ERRORS.reasonInvalid` (DHS-00008). */
export const HUNGERSTATION_PROMOTION_ERRORS = {
  /** 404 — no such promotion (or, on Resend, no such part of it). */
  noSuchPromotion: 'DHS-00016',
  /** 409 — a part is Sending, another write holds the promotion, or it changed since this request
   *  read it: wait, reload, retry. */
  sending: 'DHS-00017',
  /** 400 — Send / edit refused: a check refuses. The message names every refused row / field. */
  checkFailed: 'DHS-00018',
  /** 409 — the name is in use by another live promotion of the chain (wins over DHS-00018; its
   *  message names every other refusal too). */
  nameInUse: 'DHS-00019',
  /** 409 — Replace stopped: a switch-off of the old promotion was refused. The message names the
   *  part and HungerStation's answer; nothing new was sent. */
  replaceStopped: 'DHS-00020',
  /** 409 — an in-place edit changed the name, type, stores, start or end: that is a Replace. */
  needsReplace: 'DHS-00021',
  /** 409 — save / send of a promotion that is no longer a draft, or a write on one switched off or
   *  replaced. */
  promotionSent: 'HungerStationPromotionSent',
} as const

/** A promotion's type, as HungerStation names it. */
export type HungerStationPromotionType = 'STRIKETHROUGH' | 'SAME_ITEM_BUNDLE'

/** A discount's subtype, as HungerStation names it. `PERCENTAGE` 1–100; the others an amount in
 *  SAR (`ABSOLUTE` off, `FINAL_PRICE` the price paid), positive, at most 3 decimals. */
export type HungerStationDiscountSubtype = 'PERCENTAGE' | 'ABSOLUTE' | 'FINAL_PRICE'

/** HungerStation's reporting reason. `COMPETITIVENESS` is the default when blank. */
export type HungerStationPromotionReason = 'COMPETITIVENESS' | 'OVERSTOCK' | 'DELISTING' | 'EXPIRING_SOON' | 'NMR' | 'TRADING'

/**
 * A promotion's (and a part's) status, derived on read, never sent by the client (contract §
 * Vocabulary). `scheduled` / `ended` are promotion-level only, derived from the window. A part
 * still `QUEUED` 24 hours after it was sent ("unanswered") reads `failed`; a switch-off job still
 * open reads `sending`.
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

/** A HungerStation job's status as HungerStation sends it. OPEN: a status its docs do not list
 *  (e.g. `IN_PROGRESS`) is passed through and counts as not final, like `QUEUED`. */
export type HungerStationPromotionJobStatus = 'QUEUED' | 'COMPLETED' | 'FAILED' | 'DUPLICATE' | (string & {})

/** What one send asked HungerStation: an upsert of the part, or its switch-off (`active: false`). */
export type HungerStationPromotionSendKind = 'UPSERT' | 'SWITCH_OFF' | (string & {})

// GET HungerStationWeb/Promotions ────────────────────────────────────────────────────────────────

/** The query of `GET HungerStationWeb/Promotions?chain=&status=&q=&store=&skip=&take=`. ONE
 *  `status` (`null` = `any`, the default); `q` matches the name (contains, any case); `store`
 *  (3216) the promotions that target that store. */
export interface HungerStationPromotionsQuery {
  chain: string | null
  status: HungerStationPromotionStatus | null
  q: string | null
  store: string | null
  skip: number
  take: number
}

/** `take` of the Promotions list: default 50, 1 to 200. */
export const HUNGERSTATION_PROMOTIONS_TAKE = { default: 50, max: 200 } as const

/** HungerStation's own `discount` ceiling: at most 20,000 SKUs a promotion (`tooManySkus`). */
export const HUNGERSTATION_PROMOTION_MAX_SKUS = 20000

/** One row of the list. */
export interface HungerStationPromotionRow {
  /** A ULID. */
  promotionId: string
  chainKey: string
  name: string
  type: HungerStationPromotionType
  status: HungerStationPromotionStatus
  /** Saudi local wall time, as entered; `null` on a draft not given one yet. */
  startAt: LocalDateTime | null
  endAt: LocalDateTime | null
  storeCount: number
  /** Its active item rows. */
  itemCount: number
  updatedAt: LocalDateTime
  updatedBy: string
  /** `null` until first sent. */
  sentAt: LocalDateTime | null
}

/** `GET HungerStationWeb/Promotions` — one page; `total` counts every match. */
export interface HungerStationPromotionsPage {
  total: number
  rows: HungerStationPromotionRow[]
}

// GET HungerStationWeb/Promotions/{promotionId} ───────────────────────────────────────────────────

/** A vendor HungerStation named in a part's result, and our store frozen under it at send (`null`
 *  when the vendor id is none of the promotion's). */
export interface HungerStationPromotionVendorRef {
  storeCode: string | null
  vendorId: string
}

/** A SKU HungerStation named, and the part's item sent under it (`null` when none was). */
export interface HungerStationPromotionSkuRef {
  sku: string
  materialNumber: string | null
}

/** The SKUs HungerStation refused at one store. HungerStation may name no vendor (a plain SKU
 *  list): then both are `null`. */
export interface HungerStationPromotionSkuRefusal {
  storeCode: string | null
  vendorId: string | null
  items: HungerStationPromotionSkuRef[]
}

/** What did not take, from a part's LATEST send's job result (3214): HungerStation's
 *  `invalid_vendors`, `missing_skus` and `invalid_discounted_skus`, read as our stores and
 *  materials. Each list `[]` when nothing of that kind was refused. */
export interface HungerStationPromotionRefusals {
  invalidVendors: HungerStationPromotionVendorRef[]
  missingSkus: HungerStationPromotionSkuRefusal[]
  invalidDiscountedSkus: HungerStationPromotionSkuRefusal[]
}

/** A **HungerStation promotion part**. Empty list while a draft. */
export interface HungerStationPromotionPart {
  /** A ULID. */
  partId: string
  /** 1-based, in send order. */
  partNo: number
  /** The name it carries on HungerStation (`"<name> · B2G1 50%"`; a strikethrough's is the name). */
  name: string
  /** `"ALL"` (a strikethrough), else `"B<buy>G<get>|<subtype>|<value>"` (`"B2G1|PERCENTAGE|50"`,
   *  the value with no trailing zeros). */
  combination: string
  /** `false` once switched off (whole promotion, or emptied by an edit). */
  active: boolean
  /** The part's own status (`sending` while its latest job is open, `failed` when refused or
   *  unanswered for 24 hours…); `null` while the promotion is a draft. */
  status: HungerStationPromotionStatus | null
  /** `null` until its latest send has a job result. */
  refusals: HungerStationPromotionRefusals | null
}

/** One store of the promotion. While a draft, the stores it targets NOW; once sent, as frozen at
 *  send with the vendor id sent. */
export interface HungerStationPromotionStore {
  storeCode: string
  /** `""` when the store master has no row. */
  storeName: string
  vendorId: string
  /** The store's stock sync now. */
  syncActive: boolean
}

/** One item row, in the order pasted. A removed row stays, `active: false`. */
export interface HungerStationPromotionItem {
  rowNo: number
  materialNumber: string
  /** Resolved through the HungerStation material list at send; `null` before. */
  sku: string | null
  /** As entered: `null` = the promotion's `defaultSubtype` / `defaultValue`. */
  subtype: HungerStationDiscountSubtype | null
  value: number | null
  maxQuantity: number | null
  /** Bundle only (3213); always `null` on a strikethrough. */
  buyQuantity: number | null
  getQuantity: number | null
  /** The part the row was sent in; `null` while a draft. */
  partId: string | null
  active: boolean
}

/** One call to HungerStation (an upsert or a switch-off) for one part, oldest first. */
export interface HungerStationPromotionSend {
  sendId: string
  partId: string
  kind: HungerStationPromotionSendKind
  /** HungerStation's HTTP status (202 accepted). */
  httpStatus: number
  jobId: string | null
  jobStatus: HungerStationPromotionJobStatus | null
  /** HungerStation's own job stamps, converted to local at the server. */
  hsCreatedAt: LocalDateTime | null
  hsUpdatedAt: LocalDateTime | null
  /** The job's result object as HungerStation answered it, or `null` (kept raw for disputes). */
  result: unknown
  /** The refusal or transport error of a failed call, a poll's last error, or the 24-hour
   *  "HungerStation has not answered" note; `null` when none. */
  error: string | null
  sentAt: LocalDateTime
  sentBy: string
  /** The reason the user gave for the write. */
  reason: string
  /** Job reads so far (the poller and Refresh). */
  attempts: number
  lastAttemptAt: LocalDateTime | null
}

/** `GET HungerStationWeb/Promotions/{promotionId}` — the promotion row. Also the answer of every
 *  write door. DHS-00016. */
export interface HungerStationPromotionDetail {
  promotionId: string
  chainKey: string
  name: string
  displayNameEn: string
  displayNameAr: string
  type: HungerStationPromotionType
  hsReason: HungerStationPromotionReason
  /** Saudi local wall time; `null` on a draft not given one yet. */
  startAt: LocalDateTime | null
  endAt: LocalDateTime | null
  /** Per-order limit; `null` for none. */
  orderLimit: number | null
  /** Total-uses limit; `null` for none. */
  globalLimit: number | null
  /** The discount an item row with a blank subtype / value takes. There is NO promotion-level
   *  buy / get default: a bundle row left blank is refused by the checks. */
  defaultSubtype: HungerStationDiscountSubtype | null
  defaultValue: number
  /** Always `"SAR"` in v1. */
  currencyKey: string
  /** Targets every onboarded store of the chain (frozen into `stores` at send). */
  allStores: boolean
  status: HungerStationPromotionStatus
  /** The promotion this one replaced (3216). */
  replacesPromotionId: string | null
  createdAt: LocalDateTime
  createdBy: string
  updatedAt: LocalDateTime
  updatedBy: string
  sentAt: LocalDateTime | null
  sentBy: string | null
  /** The successor once `replaced` (3216). */
  replacedByPromotionId: string | null
  /** Set once switched off or replaced (a replace switches the old one off, with its reason). */
  switchedOffAt: LocalDateTime | null
  switchedOffBy: string | null
  switchedOffReason: string | null
  stores: HungerStationPromotionStore[]
  items: HungerStationPromotionItem[]
  parts: HungerStationPromotionPart[]
  /** Every call to HungerStation, OLDEST first. */
  sends: HungerStationPromotionSend[]
}

// GET HungerStationWeb/Promotions/Stores?chain= ────────────────────────────────────────────────

/** One store the picker offers: the chain's onboarded stores, removed ones left out, paused ones
 *  kept. DHS-00006. */
export interface HungerStationPromotionStoreChoice {
  storeCode: string
  storeName: string
  vendorId: string
  /** `false` while its stock sync is paused — still offered, it still sells on HungerStation. */
  syncActive: boolean
}

// POST HungerStationWeb/Promotions · PUT HungerStationWeb/Promotions/{promotionId} ──────────────

/** One pasted item row: our material number, never HungerStation's SKU. A blank subtype / value
 *  takes the promotion's default; buy / get are a bundle row's own (no default). */
export interface HungerStationPromotionItemInput {
  materialNumber: string
  subtype: HungerStationDiscountSubtype | null
  value: number | null
  maxQuantity: number | null
  buyQuantity: number | null
  getQuantity: number | null
}

/**
 * Save a draft (`POST`, create) or save it again (`PUT`). Save never refuses on the send checks —
 * it REPORTS them as the answer's `check`. On a SENT promotion the `PUT` is the in-place edit
 * (3215): every check runs and refuses (DHS-00018 / 19), the affected parts are re-sent, and a
 * change of name, type, stores, start or end is DHS-00021 (a Replace).
 */
export interface HungerStationPromotionSaveBody {
  chainKey: string
  name: string
  displayNameEn: string
  displayNameAr: string
  type: HungerStationPromotionType
  hsReason: HungerStationPromotionReason
  startAt: LocalDateTime | null
  endAt: LocalDateTime | null
  orderLimit: number | null
  globalLimit: number | null
  defaultSubtype: HungerStationDiscountSubtype | null
  defaultValue: number | null
  /** `null` = ALL the chain's onboarded stores, frozen at send (on a sent "all stores" promotion:
   *  the stores frozen at send). A list names the stores. ⚠ `[]` is NO store. */
  storeCodes: string[] | null
  items: HungerStationPromotionItemInput[]
  reason: string
}

/** The answer of a save (`POST` / `PUT`): the promotion row plus `check`, the Check answer for the
 *  draft as just saved (`duplicateCount` = the rows this request dropped for a repeated material). */
export interface HungerStationPromotionSaved extends HungerStationPromotionDetail {
  check: HungerStationPromotionCheck
}

// POST HungerStationWeb/Promotions/{promotionId}/Check ────────────────────────────────────────

/** One refusal or warning: on a header field (`rowNo` / `materialNumber` `null`) or on one item
 *  row. `storeCodes` is `[]` unless the issue names stores. `message` is "English / Arabic". */
export interface HungerStationPromotionCheckIssue {
  code: string
  field: string
  rowNo: number | null
  materialNumber: string | null
  storeCodes: string[]
  message: string
}

/** One part Send would make (3213), in send order. A strikethrough's single part `"ALL"` carries
 *  no buy / get and no single subtype / value (`null`). Planned even while a refusal stands. */
export interface HungerStationPromotionPartPreview {
  partNo: number
  combination: string
  buyQuantity: number | null
  getQuantity: number | null
  subtype: HungerStationDiscountSubtype | null
  value: number | null
  /** The part's active rows. */
  skuCount: number
  /** The name it will carry on HungerStation. */
  name: string
}

/** `POST …/{promotionId}/Check` — NO body: every pre-check on the SAVED promotion, nothing
 *  written. `canSend` = no refusals (warnings never refuse). A row with neither is not listed. */
export interface HungerStationPromotionCheck {
  promotionId: string
  canSend: boolean
  /** The active item rows checked. */
  itemCount: number
  /** Rows dropped for a repeated material: on a Save answer only; always 0 on this door. */
  duplicateCount: number
  refusals: HungerStationPromotionCheckIssue[]
  warnings: HungerStationPromotionCheckIssue[]
  /** The part preview. Empty when there are no rows. */
  parts: HungerStationPromotionPartPreview[]
}

/** The refusal codes (`refusals[].code`), in the contract's order. A code the screen does not know
 *  is shown in the server's words. */
export const HUNGERSTATION_PROMOTION_CHECK_CODES = [
  'nameMissing',
  'nameInUse',
  'displayNameEnMissing',
  'displayNameArMissing',
  'startMissing',
  'endMissing',
  'windowReversed',
  'endPast',
  'noStores',
  'storeNotOnboarded',
  'noItems',
  'tooManySkus',
  'materialNotListed',
  'materialDisabled',
  'materialDeleted',
  'subtypeMissing',
  'percentOutOfRange',
  'valueNotPositive',
  'valueTooManyDecimals',
  'buyBelowOne',
  'getBelowOne',
  'maxQuantityMixed',
] as const

/** The warning code (`warnings[].code`, never refuses): a `FINAL_PRICE` / `ABSOLUTE` row not below
 *  our VAT-inclusive price at the stores it names. */
export const HUNGERSTATION_PROMOTION_PRICE_WARNING = 'priceNotBelow'

/** The fields a check names: a header refusal's (`rowNo` null), or a row's. */
export const HUNGERSTATION_PROMOTION_CHECK_FIELDS = [
  'name',
  'displayNameEn',
  'displayNameAr',
  'startAt',
  'endAt',
  'stores',
  'items',
  'materialNumber',
  'subtype',
  'value',
  'buyQuantity',
  'getQuantity',
  'maxQuantity',
] as const

// The write doors that take only a reason ─────────────────────────────────────────────────────

/** `POST …/Send`, `POST …/SwitchOff`, `POST …/Parts/{partId}/Resend` — each returns the detail.
 *  `POST …/Refresh` takes NO body (it only asks HungerStation). */
export interface HungerStationPromotionReasonBody {
  reason: string
}

/** `POST …/{promotionId}/RemoveItems` — those active rows go out `active: false` in their parts.
 *  Returns the plain detail (no `check`). Naming EVERY active row is refused (that is a switch-off). */
export interface HungerStationPromotionRemoveItemsBody {
  materialNumbers: string[]
  reason: string
}

/** `POST …/{promotionId}/Replace` — only what changes; a key left `null` keeps the old value.
 *  `allStores: true` = every onboarded store of the chain (frozen at send); else `storeCodes` names
 *  them; both `null` = the old stores as frozen. Nothing changed is `HungerStationInputInvalid`. */
export interface HungerStationPromotionReplaceBody {
  name: string | null
  startAt: LocalDateTime | null
  endAt: LocalDateTime | null
  allStores: boolean | null
  storeCodes: string[] | null
  reason: string
}
