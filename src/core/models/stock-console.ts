/**
 * The stock console (BackOffice spec 4157; oms 940–945) — wire shapes, as SIS.Api's `StockConsole/*` routes answer them
 * (BackOffice 4158–4163, `Sartawi.Retail.Data/Modules/Stock_v2/StockConsole/*.cs`). Reconciled against the built server:
 * see `.issues/STOCK-CONSOLE-WIRE-CONTRACT.md`.
 *
 * Every route is behind `BackOfficeScreen[StockConsole, 03]` (role `STOCK_CONSOLE_VIEWER`); there is no `Access` probe
 * (oms 914). A refusal is HTTP 400 with the envelope's `errors[0].errorCode` (`refusals.ts`).
 *
 * The wire is SIS.Api's minimal-API System.Text.Json (web defaults): camelCase, nulls sent as `null` (never left out),
 * enums are C# strings. The server judges; the page draws: a string typed as a union is read defensively — an unknown
 * value draws, it never throws.
 *
 * ⚠️ Times are the estate's local wall-clock, `"yyyy-MM-ddTHH:mm:ss"` with no offset; they stay strings and are never
 * shifted. A day is a C# `DateTime` at midnight, `"yyyy-MM-ddT00:00:00"`: read its first ten characters. Quantities are
 * base units (C# `decimal`); a figure that may be absent is `number | null`, and null is never drawn as 0.
 */

// ── Shared ──────────────────────────────────────────────────────────────────────────────────────────

/** Reserved's three states, judged by SIS.Api (`StockConsoleReservedStates`). */
export type ReservedState = 'Computed' | 'Stale' | 'NeverComputed'

/** A store's status: the worst of its flags (`StockConsoleStatuses`). */
export type StoreStatus = 'Ok' | 'Watch' | 'Problem'

export type FlagLevel = 'Watch' | 'Problem'

/** The six flags (`StockConsoleFlagCodes`), in the spec's order. */
export const STOCK_CONSOLE_FLAGS = [
  'SapQuiet',
  'BelowZero',
  'OldHold',
  'SalesNotApplied',
  'ComparisonDiffers',
  'PlaceholderStock',
] as const
export type StockConsoleFlagCode = (typeof STOCK_CONSOLE_FLAGS)[number]

/** One raised flag: what was measured against which limit ("no SAP document for 31 hours, limit 24"). */
export interface StockConsoleFlag {
  /** A `StockConsoleFlagCode`, read defensively. */
  code: string
  /** A `FlagLevel`, read defensively. */
  level: string
  /** In the limit's unit — SapQuiet hours, BelowZero items, OldHold days, SalesNotApplied hours, ComparisonDiffers
   *  batches, PlaceholderStock base units. Null when there was nothing to measure from (no SAP document ever applied). */
  value: number | null
  /** The limit the value is strictly over. 0 for "any" (ComparisonDiffers, PlaceholderStock, BelowZero's Watch). */
  limit: number
}

/** A page of a list (`StockConsolePage<T>`): `total` is the whole match, `page` 1-based, `size` at most 200. */
export interface StockConsolePage<T> {
  total: number
  page: number
  size: number
  rows: T[]
}

/** The reserved recompute's last success, as Stock Visibility keeps it (`StockConsoleReservedRun`). */
export interface StockConsoleReservedRunBrief {
  lastSuccessAt: string | null
  lastNetting: string | null
}

// ── Stores ──────────────────────────────────────────────────────────────────────────────────────────

/** `StockConsoleFleetCodes`: a fleet fact that is a problem now. `NoAnswer` = a status route gave no answer. */
export const FLEET_PROBLEM_CODES = ['FeedLate', 'ReservedNeverRun', 'ReservedStale', 'ReaderBehind', 'NoAnswer'] as const

/** One fleet fact that is a problem now (`StockConsoleFleetProblem`): what, which, the measured value and its limit. */
export interface StockConsoleFleetProblem {
  /** One of `FLEET_PROBLEM_CODES`, read defensively. */
  code: string
  /** The feed's name (`SapFeed`, …), `ReservedRecompute`, `HoldLedgerReader`, or the status route that gave no answer. */
  subject: string
  /** Minutes; null when there is nothing to measure from (never passed, never run, no answer). */
  value: number | null
  limit: number | null
}

/** One store's summary row (`StockConsoleStoreRow`): Stock Visibility's facts and what SIS.Api owns. */
export interface StockConsoleStoreRow {
  /** The store code. Route params say `{store}`. */
  plant: string
  city: string
  /** 'Shadow' | 'Seeding' | 'Seeded' | 'Blocking', read defensively. */
  stage: string
  /** Rows with either counter not zero. */
  itemsWithStock: number
  /** The SAP counter. */
  sapStock: number
  /** The till-side counter — the store's stock figure. */
  tillStock: number
  /** sapStock − tillStock: sold at the till, not in SAP yet. */
  gap: number
  /** heldStanding + heldSold. */
  held: number
  heldStanding: number
  /** "Sold not applied". */
  heldSold: number
  /** null in NeverComputed — NEVER 0. */
  reserved: number | null
  /** A `ReservedState`, read defensively. */
  reservedState: string
  /** The recompute's last success, beside a computed or stale figure; null when never computed. */
  reservedAt: string | null
  /** till − held − reserved, never floored; reserved left out when it is not computed. */
  free: number
  /** false in NeverComputed → "reserved not included". */
  reservedIncluded: boolean
  /** Items below zero on the till-side counter. */
  belowZero: number
  lastUpdate: string | null
  oldestStandingAt: string | null
  oldestSoldAt: string | null
  /** The SAP feed's place = "last SAP document applied". */
  sapPlace: string | null
  sapLastAttempt: string | null
  /** The till feed's place = "last till read". */
  tillPlace: string | null
  tillLastAttempt: string | null
  /** Counted stores only: the nightly comparison's differing batches (null otherwise) and when it ran. */
  driftBatches: number | null
  driftRanAt: string | null
  /** Counted stores only: till-side stock on placeholder batches. */
  placeholderStock: number | null
  flags: StockConsoleFlag[]
  /** A `StoreStatus`, read defensively. */
  status: string
}

/** `GET StockConsole/Stores` (`StockConsoleStoresAnswer`): every store, whole (under a thousand rows). */
export interface StockConsoleStores {
  /** When SIS.Api read Stock Visibility (its copy is at most 60 s old). */
  readAt: string
  reservedRun: StockConsoleReservedRunBrief
  stores: StockConsoleStoreRow[]
  /** The fleet line: the fleet facts that are a problem now; empty when all is well. */
  fleet: StockConsoleFleetProblem[]
}

/** `GET StockConsole/Stores/{store}` (`StockConsoleStoreAnswer`): one store's row, read fresh. `NoStore` when unknown. */
export interface StockConsoleStoreAnswer {
  readAt: string
  reservedRun: StockConsoleReservedRunBrief
  /** null only when Stock Visibility answered without a row (it refuses an unknown store `NoStore`). */
  store: StockConsoleStoreRow | null
}

// ── A store's lists ─────────────────────────────────────────────────────────────────────────────────
// `…/Items` (item, batch, filter, sort, page, size) and `…/Batches` (item, batch, filter, page, size) answer a page.

/** The Items list's filters (SIS.Stock 076); `all` is the default. */
export const ITEM_FILTERS = ['all', 'withStock', 'belowZero', 'held', 'differ'] as const
/** The Items list's sorts; `item` is the default. */
export const ITEM_SORTS = ['item', 'held', 'till', 'gap'] as const

/** The seven stock types other than unrestricted; the item page shows them when not zero. */
export interface StockConsoleOtherStock {
  quality: number
  blocked: number
  returnsBlocked: number
  restricted: number
  inTransit: number
  inTransferPlant: number
  inTransferLocation: number
}

/** One item at the store (`StockConsoleItemRow`). */
export interface StockConsoleItemRow extends StockConsoleOtherStock {
  /** As Stock Visibility stores it (no leading zeros). Never a number. */
  item: string
  /** HQ's item master; '' when it does not know the number. */
  nameEn: string
  nameAr: string
  sapStock: number
  tillStock: number
  gap: number
  held: number
  heldStanding: number
  heldSold: number
  /** null in NeverComputed — NEVER 0. */
  reserved: number | null
  reservedState: string
  reservedAt: string | null
  free: number
  reservedIncluded: boolean
  lastUpdate: string | null
}

/** The Batches list's filters; `all` is the default; `expiring` = within 90 days. Sorted item, expiry (server). */
export const BATCH_FILTERS = ['all', 'withStock', 'belowZero', 'held', 'placeholder', 'expired', 'expiring'] as const

/** One batch of one item at the store (`StockConsoleBatchRow`). */
export interface StockConsoleBatchRow {
  item: string
  nameEn: string
  nameAr: string
  /** Our batch. */
  batch: string
  /** The vendor's batch (lot); '' when none. */
  vendorBatch: string
  /** A day, `yyyy-MM-ddT00:00:00`; compared on its first ten characters. */
  expiry: string | null
  sapStock: number
  tillStock: number
  /** Holds on this batch not released. */
  held: number
  /** tillStock − held: what the take door may give from it (reserved never enters a batch). */
  freeForTheDoor: number
  firstReceivedOn: string | null
  /** Stock Visibility's own placeholder-batch rule. */
  placeholder: boolean
}

/** The Holds list's `state` (SIS.Stock 077); `open` (standing and sold not applied) is the default; `released` = 7 days. */
export const HOLD_STATES = ['open', 'standing', 'sold', 'released'] as const

/** One hold at the store (`StockConsoleHoldRow`). Nothing is joined from OMS. */
export interface StockConsoleHoldRow {
  takeId: string
  item: string
  nameEn: string
  nameAr: string
  /** '' for a hold on no batch. */
  batch: string
  quantity: number
  takenAt: string
  /** 'Held' (standing) | 'Sold' (sold not applied) | 'Released', read defensively. */
  state: string
  /** 'Door' | 'Ledger' | 'Check', drawn as it came. */
  source: string
  /** A picking hold's document and line. */
  documentNo: string | null
  lineNumber: number | null
  /** A till sale's store and transaction. */
  soldStore: string | null
  soldTrx: string | null
  /** Moved on every change of state: for a hold still sold, when it became sold. */
  updatedAt: string
  releasedAt: string | null
  releaseReason: string | null
}

/** The Takes list's `outcome`; `all` is the default. */
export const TAKE_OUTCOMES = ['all', 'granted', 'refused', 'failed'] as const

/** A batch a granted take took: one of its holds, as it stands. */
export interface StockConsoleTakeBatch {
  batch: string
  quantity: number
  state: string
  /** BackOffice 4277 (SIS.Stock 086): this batch came by the expiry fallback; absent from an older server. */
  isExpiryFallback?: boolean
}

/**
 * One call of the take door (`StockConsoleTakeRow`): one flat row whose `kind` says which fields it fills; the others are
 * null. `granted`: quantity, code, available, stage, the scanned vendor batch and expiry, the entered batch, `batches`.
 * `refused`: `batch` (the batch refused), `batchWithStock` (the batch the door named instead), reason, asked, available,
 * code, shadow, stage. `failed`: duration, status code, instance — never an item.
 */
export interface StockConsoleTakeRow {
  /** 'granted' | 'refused' | 'failed', read defensively. */
  kind: string
  at: string
  takeId: string | null
  item: string | null
  /** '' when the row names no item, or the master does not know it. */
  nameEn: string
  nameAr: string
  code: string | null
  stage: string | null
  available: number | null
  quantity: number | null
  scannedVendorBatch: string | null
  scannedExpiry: string | null
  enteredBatch: string | null
  batches: StockConsoleTakeBatch[] | null
  batch: string | null
  batchWithStock: string | null
  reason: string | null
  asked: number | null
  shadow: boolean | null
  durationMs: number | null
  statusCode: number | null
  instance: string | null
  /**
   * BackOffice 4277 (spec 4275, ADR 0146): granted, some of the take was placed by the expiry fallback; refused, false;
   * failed, null. Absent from an older server.
   */
  isExpiryFallback?: boolean | null
  /** Refused rows: the batch the fallback would have chosen (a `Record` store) and its quantity. */
  fallbackBatch?: string | null
  fallbackQuantity?: number | null
  /** Refused rows: why the fallback did not place the pack, as Stock Visibility names it (`ScannedDateDisagrees`). */
  fallbackNote?: string | null
}

/** The Takes list's `fallback` extra: `true` lists only the calls the expiry fallback touched (failed calls left out). */
export const TAKES_FALLBACK_ONLY = 'true'

/**
 * BackOffice 4277: `GET StockConsole/Stores/{store}/ExpiryFallbackTakes?from=&to=` — inventory control's list of a store's
 * expiry fallback takes over local days (both in, at most 32), by material, the pack's vendor batch and the batch the door
 * chose, so the counted stock can be moved to its own batch. Refused `NeedADay` / `DaysOutOfRange`. Days
 * `yyyy-MM-ddT00:00:00`, times local.
 */
export interface StockConsoleExpiryFallbackRow {
  item: string
  nameEn: string
  nameAr: string
  /** The pack's own (scanned) vendor batch. */
  vendorBatch: string
  /** The batch the door chose by the fallback. */
  batch: string
  expiryDate: string | null
  takes: number
  quantity: number
  firstTakenAt: string
  lastTakenAt: string
}

export interface StockConsoleExpiryFallbackList {
  store: string
  from: string
  to: string
  takes: number
  quantity: number
  rows: StockConsoleExpiryFallbackRow[]
}

/** `…/Takes` (item, batch, day, outcome, page, size) and `…/Items/{item}/Takes` (outcome, page, size). */
export interface StockConsoleTakes extends StockConsolePage<StockConsoleTakeRow> {
  /** An item or a batch was searched: failed calls carry no item, so they are not in the list. */
  failedLeftOut: boolean
}

/** `…/Feeds` (`StockConsoleFeedsAnswer`): the store's two feed places and the nightly comparison. */
export interface StockConsoleStoreFeeds {
  readAt: string
  store: string
  sapPlace: string | null
  sapLastAttempt: string | null
  tillPlace: string | null
  tillLastAttempt: string | null
  /** Whether the nightly comparison covers the store; false: the two below are null. */
  counted: boolean
  driftBatches: number | null
  driftRanAt: string | null
}

/** One row of a store's stage log (`StoreStageMove`). */
export interface StockConsoleStageMove {
  store: string
  from: string
  to: string
  /** 'Person' | 'CountClosing' | 'Seed'. */
  mover: string
  /** HQ's user id, or a system mover's name. */
  who: string
  /** The person's name from HQ's user directory; the raw `who` when it does not know it. */
  whoName: string
  why: string
  movedAt: string
}

/** A store's stage and its last move (`StoreStage`). */
export interface StockConsoleStageNow {
  store: string
  stage: string
  updatedAt: string | null
  lastMove: StockConsoleStageMove | null
}

/** A store's last seed run (`StoreSeedRun`); `state` 'None' for a store never seeded. */
export interface StockConsoleSeedRun {
  store: string
  /** 'None' | 'Running' | 'Seeded' | 'Refused' | 'Failed', read defensively. */
  state: string
  kind: string
  reason: string
  ask: string
  countDay: string
  who: string
  askedAt: string | null
  endedAt: string | null
  batchRows: number
}

/** One measured gate (`StoreGate`). */
export interface StockConsoleGate {
  gate: string
  holds: boolean
  /** Text: what the gate asks when it holds; else each failing day or feed and why. */
  figure: string
}

/** A store's gates toward Blocking over the days `from`–`to`, both in (`StoreGates`). */
export interface StockConsoleGates {
  store: string
  /** Days, `yyyy-MM-ddT00:00:00`. */
  from: string
  to: string
  /** Every measured gate holds and every gate owned elsewhere is confirmed. */
  hold: boolean
  measured: StockConsoleGate[]
  confirmed: string[]
  notConfirmed: string[]
}

/** `…/Stage` (`StockConsoleStageAnswer`): the stage, its log (newest first), the last seed run and the gates. */
export interface StockConsoleStoreStage {
  store: string
  /** null when Stock Visibility's stage list does not hold the store. */
  stage: StockConsoleStageNow | null
  moves: StockConsoleStageMove[]
  seed: StockConsoleSeedRun
  /** null when the gates' read alone gave no answer (`gatesAnswered` false). */
  gates: StockConsoleGates | null
  gatesAnswered: boolean
  gatesNoAnswer: string | null
}

// ── The fleet ───────────────────────────────────────────────────────────────────────────────────────

/** A fleet fact from one status route: `answered` false = no answer (its other fields are defaults), never healthy. */
export interface StockConsoleFleetFact {
  answered: boolean
  noAnswer: string | null
}

/** Stock Visibility's feed names (`StockFeedNames`). */
export const FLEET_FEEDS = ['SapFeed', 'PosFeed', 'HoldLedgerReader', 'SapCount'] as const

/** One feed: its last complete pass and its age, late against the feed watch's own limit (`StockConsoleFeedRow`). */
export interface StockConsoleFeedRow {
  feed: string
  /** SIS.Api's English name ("SAP feed"); the page uses its own words for a known feed. */
  name: string
  lastCompletePassAt: string | null
  /** Minutes since the last complete pass; null: never passed. */
  ageMinutes: number | null
  /** The feed watch's alarm limit; null for a feed not watched. */
  limitMinutes: number | null
  /** A watched feed at or over its limit, never passed, or not listed by Stock Visibility. */
  late: boolean
}

export interface StockConsoleFleetFeeds extends StockConsoleFleetFact {
  rows: StockConsoleFeedRow[]
}

export interface StockConsoleFleetReserved extends StockConsoleFleetFact {
  /** A `ReservedState`: never run, stale (older than `limitMinutes` outside the quiet window) or computed. */
  state: string
  limitMinutes: number
  lastStartedAt: string | null
  lastSuccessAt: string | null
  lastComputedAt: string | null
  lastDurationMs: number
  lastDocuments: number
  lastPairs: number
  lastChangedPairs: number
  consecutiveFailures: number
  lastFailureAt: string | null
  lastError: string | null
  lastNetting: string | null
  fellBackAt: string | null
}

export interface StockConsoleFleetHeldServed extends StockConsoleFleetFact {
  served: boolean
  changedAt: string | null
  /** 'None' | 'Sold' | 'All'. */
  netting: string
  fellBackAt: string | null
  lastNetting: string | null
  subtractsHeld: boolean
}

export interface StockConsoleFleetReader extends StockConsoleFleetFact {
  lastPassAt: string | null
  /** Minutes since the reader's last complete pass; null: never passed. */
  lagMinutes: number | null
  limitMinutes: number
  /** Lag over `limitMinutes`, or never passed. */
  behind: boolean
  readThroughAt: string | null
  rowsApplied: number
  unmatchedRows: number
}

export interface StockConsoleTakeOutage {
  from: string
  to: string
  minutes: number
}

/** Today's take door figures, fleet-wide. */
export interface StockConsoleFleetTakes extends StockConsoleFleetFact {
  /** Today. ⚠️ Sent with the server's offset (`…T00:00:00+03:00`, see the contract): read its first ten characters. */
  day: string
  /** Every call, whatever its outcome. */
  takes: number
  withinLimit: number
  shareWithinLimit: number | null
  /** Calls the door could not answer. */
  failed: number
  failedPerThousand: number | null
  /** Calls refused before the door answered (counted in takes, not in failed). */
  rejected: number
  limitMilliseconds: number
  outages: StockConsoleTakeOutage[]
}

/** `GET StockConsole/Fleet` (`StockConsoleFleetAnswer`): each fleet fact on its own, and the ones that are a problem. */
export interface StockConsoleFleet {
  readAt: string
  feeds: StockConsoleFleetFeeds
  reserved: StockConsoleFleetReserved
  heldServed: StockConsoleFleetHeldServed
  reader: StockConsoleFleetReader
  takes: StockConsoleFleetTakes
  /** The same list the stores summary carries as its fleet line. */
  problems: StockConsoleFleetProblem[]
}

// ── The GS1 scan ────────────────────────────────────────────────────────────────────────────────────

/** What `StockConsole/Scan` took the code for. Read defensively: an unknown kind is "not a code we know". */
export type ScanKind = 'Gs1' | 'Barcode' | 'Unknown'

/** `GET StockConsole/Scan?code=` (`StockConsoleScanAnswer`, shape verbatim in BO 4162). The code is not stored. */
export interface StockConsoleScan {
  /** A `ScanKind`, read defensively. */
  kind: string
  itemFound: boolean
  item: string | null
  nameEn: string | null
  nameAr: string | null
  gtin: string | null
  /** AI 10: the vendor batch to search. */
  lot: string | null
  /** AI 17 as `yyyy-MM-dd`, or the month's first day when the code's day is 00. */
  expiry: string | null
  /** False when the code's day is 00 (compare by month), or there is no expiry. */
  expiryDayKnown: boolean
  /** AI 21. */
  serial: string | null
}

// ── An item ─────────────────────────────────────────────────────────────────────────────────────────

/** Sum 1: SAP stock − sold at the till and not in SAP = till-side stock. */
export interface StockConsoleTillSideSum {
  sapStock: number
  soldNotInSap: number
  tillStock: number
}

/** Sum 2: till-side − held standing − held sold not applied − reserved = free, never floored. */
export interface StockConsoleFreeSum {
  tillStock: number
  heldStanding: number
  heldSold: number
  held: number
  /** null in NeverComputed — NEVER 0. */
  reserved: number | null
  reservedState: string
  /** The recompute's last success, beside a computed or stale figure. */
  reservedAt: string | null
  reservedIncluded: boolean
  free: number
}

/**
 * Sum 3: what `Stock/CurrentStock` answers now (`quantity`, Stock Visibility's, not floored) and the rule that made it.
 * Under `LiveOrders`: till-side − `liveOrders`. Under `HeldServed`: till-side − `held` − `reserved`. The other rule's
 * operands are null. `rule` '' = the answer did not carry it.
 */
export interface StockConsoleAnsweredNowSum {
  /** 'HeldServed' | 'LiveOrders' | '', read defensively. */
  rule: string
  tillStock: number
  liveOrders: number | null
  held: number | null
  reserved: number | null
  quantity: number
}

/** Sum 4: till-side − held − reserved (0 without a row) = `unfloored`; `quantity` is what the change feed sends (≥ 0). */
export interface StockConsoleChangeFeedSum {
  tillStock: number
  held: number
  reserved: number
  unfloored: number
  quantity: number
}

/** `GET …/Items/{item}` (`StockConsoleItemAnswer`): the item's figures, names and four sums. `NoRow` when absent. */
export interface StockConsoleItem extends StockConsoleOtherStock {
  readAt: string
  store: string
  item: string
  nameEn: string
  nameAr: string
  lastUpdate: string | null
  tillSide: StockConsoleTillSideSum
  free: StockConsoleFreeSum
  answeredNow: StockConsoleAnsweredNowSum
  changeFeed: StockConsoleChangeFeedSum
  /** Held on a blank batch or one the store's book has no row for: it reduces free and no batch's figure. */
  heldOnNoBatch: number
  /** The reserved row's own computed time (Stock Visibility's). */
  reservedComputedAt: string | null
}

/**
 * `…/Items/{item}/Holds` (`StockConsoleItemHoldsAnswer`): open holds (oldest first) then those released in the last 7
 * days (newest first), one list, each part at most 200 rows. Not paged.
 */
export interface StockConsoleItemHolds {
  open: number
  released: number
  /** open + released. */
  total: number
  /** False when either part had more than the 200 rows read. */
  allShown: boolean
  rows: StockConsoleHoldRow[]
}

/** The item at one store of the fleet (`StockConsoleItemStoreRow`). */
export interface StockConsoleItemStoreRow {
  plant: string
  /** '' for a store with no `StockPlant` row. */
  city: string
  stage: string
  sapStock: number
  tillStock: number
  gap: number
  held: number
  heldStanding: number
  heldSold: number
  /** null in NeverComputed — NEVER 0. */
  reserved: number | null
  reservedState: string
  reservedAt: string | null
  reservedIncluded: boolean
  free: number
  lastUpdate: string | null
}

/** `GET StockConsole/Items/{item}/Stores` (`StockConsoleItemStoresAnswer`): the item, its names, a page of its stores. */
export interface StockConsoleItemStores extends StockConsolePage<StockConsoleItemStoreRow> {
  item: string
  nameEn: string
  nameAr: string
}

/** One store, item and batch found (`StockConsoleFindBatchRow`). */
export interface StockConsoleFindBatchRow {
  plant: string
  city: string
  item: string
  nameEn: string
  nameAr: string
  batch: string
  /** null without a batch master row. */
  vendorBatch: string | null
  expiry: string | null
  sapStock: number
  tillStock: number
  held: number
  freeForTheDoor: number
}

/** One item HQ's item master has for the item box (`StockConsoleFindItemRow`). */
export interface StockConsoleFindItemRow {
  item: string
  nameEn: string
  nameAr: string
}

/** `StockConsoleFindKinds`. */
export type FindKind = 'batches' | 'items'

/**
 * `GET StockConsole/Find` (`StockConsoleFindAnswer`). With a batch (`kind` 'batches'): `batches`, the whole match's
 * `total` and its distinct `stores`. Without (`items`): `items` from HQ's item master, `stores` null, `more` when the
 * name matched more than the 200 listed. The other kind's list is empty.
 */
export interface StockConsoleFind {
  kind: string
  total: number
  page: number
  size: number
  stores: number | null
  more: boolean
  batches: StockConsoleFindBatchRow[]
  items: StockConsoleFindItemRow[]
}

// ── Movements ───────────────────────────────────────────────────────────────────────────────────────

/** One SAP entry day and movement type (`StockConsoleSapMovementDay`): quantities in and out, both positive. */
export interface StockConsoleSapDay {
  /** The SAP entry day, `yyyy-MM-ddT00:00:00`. */
  day: string
  movementType: string
  documents: number
  lines: number
  quantityIn: number
  quantityOut: number
}

/** `GET …/SapMovements?from=&to=` (`StockConsoleSapMovementsRead`): SAP read live; at most 5 entry days. */
export interface StockConsoleSapMovements {
  readAt: string
  /** Our SAP feed's place for the store (its last document applied) and its last attempt. */
  place: { sapPlace: string | null; lastAttempt: string | null }
  days: StockConsoleSapDay[]
}

/** Each SAP line's mark against our copy of SAP's documents (`StockConsoleSapMarks`). */
export const SAP_LINE_MARKS = ['Applied', 'ReceivedNotApplied', 'NotReceived'] as const
export type SapLineMark = (typeof SAP_LINE_MARKS)[number]

/** One SAP line (`StockConsoleSapLineRow`), with the item's names. */
export interface StockConsoleSapLine {
  materialDocument: string
  year: string
  line: string
  item: string
  nameEn: string
  nameAr: string
  storageLocation: string
  batch: string
  /** Signed: debit in, credit out, in `unit`. */
  quantity: number
  unit: string
  postingDay: string | null
  /** SAP's entry time of day, `HH:mm:ss`. */
  entryTime: string | null
  /** A `SapLineMark`, read defensively. */
  mark: string
}

/** `GET …/SapMovements/Lines?day=&type=&page=&size=` (`StockConsoleSapLinesAnswer`). */
export interface StockConsoleSapLines {
  readAt: string
  day: string
  movementType: string
  page: number
  size: number
  total: number
  lines: StockConsoleSapLine[]
}

/** SAP's material document on a SAP ledger line. `item` is SAP's line number in the document. */
export interface StockConsoleSapDocument {
  materialDocument: string
  year: string
  item: string
}

/** The till's store, transaction and line on a till ledger line. */
export interface StockConsoleTillDocument {
  store: string
  transaction: string
  line: string
}

/** One line of our ledger (`StockConsoleMovementLine`, SIS.Stock 079 passed through). */
export interface StockConsoleLedgerLine {
  /** The ledger id (a ULID). */
  id: string
  /** The time in the id, local. */
  time: string
  /** 'Sap' | 'Pos' (Pos = till), read defensively. */
  feed: string
  movementType: string
  /** Signed. */
  quantity: number
  batch: string
  storageLocation: string
  /** null on a till line. */
  sapDocument: StockConsoleSapDocument | null
  /** null on a SAP line. */
  tillDocument: StockConsoleTillDocument | null
  postingDay: string
  /** Whether the ledger's writer has applied the line to the counters. */
  applied: boolean
  /** Its effect on the SAP counter and on the till-side counter, at its own storage location. */
  onSap: number
  onTill: number
  /** The writer's complementary leg at storage location "" (zero on a line without one). Not drawn. */
  complementaryOnSap: number
  complementaryOnTill: number
}

/** `GET …/Items/{item}/Movements?from=&to=&page=&size=` (`StockConsoleMovementsRead`): newest first; at most 7 days. */
export interface StockConsoleLedger {
  store: string
  item: string
  from: string
  to: string
  page: number
  size: number
  total: number
  lines: StockConsoleLedgerLine[]
}
