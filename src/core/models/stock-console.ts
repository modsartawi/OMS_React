/**
 * The stock console (BackOffice spec 4157; oms 940–945) — wire shapes, camelCase, as SIS.Api's `StockConsole/*` routes
 * answer them (BackOffice 4158–4163; Stock Visibility's rows are passed through and SIS.Api adds what it owns: the
 * status flags, the reserved state, the item names and the GS1 scan).
 *
 * ⚠️ Built ahead of the server (BO 4158 not landed): every shape here follows the spec's contract, and the names it does
 * not state are guesses kept in ONE place — this file and the feature's `api.ts` normalisers — so the reconcile is one
 * change, not one per tab.
 *
 * - `GET StockConsole/Stores` → `StockConsoleStores`, behind `BackOfficeScreen[StockConsole, 03]` (role
 *   `STOCK_CONSOLE_VIEWER`). Every route of the console is behind the same grant; there is no `Access` probe (oms 914).
 *
 * The server judges; the page draws. Enums are strings typed as their union but read defensively: an unknown value
 * draws, it never throws.
 *
 * ⚠️ Times are the estate's local wall-clock, `"yyyy-MM-ddTHH:mm:ss"` with no offset; they stay strings and are never
 * shifted. Quantities are base units; a figure that may be absent is `number | null`, and null is never drawn as 0.
 */

// ── 940 ─────────────────────────────────────────────────────────────────────────────────────────────

/** Reserved's three states, judged by SIS.Api (spec 4157 "Reserved has three states"). */
export type ReservedState = 'Computed' | 'Stale' | 'NeverComputed'

/** A store's status: the worst of its flags. */
export type StoreStatus = 'Ok' | 'Watch' | 'Problem'

export type FlagLevel = 'Watch' | 'Problem'

/** The six flags (spec 4157 "A store's summary row and its status"). Codes are PascalCase of the spec's names [guess]. */
export const STOCK_CONSOLE_FLAGS = [
  'SapQuiet',
  'BelowZero',
  'OldHold',
  'SalesNotApplied',
  'ComparisonDiffers',
  'PlaceholderStock',
] as const
export type StockConsoleFlagCode = (typeof STOCK_CONSOLE_FLAGS)[number]

/** One flag, with its measured value and its limit (BO 4158 `{ code, level, value, limit }`). */
export interface StockConsoleFlag {
  /** A `StockConsoleFlagCode`, read defensively. */
  code: string
  /** A `FlagLevel`, read defensively. */
  level: string
  /** The measured value in the flag's own unit [guess]: SapQuiet hours, BelowZero items, OldHold days,
   *  SalesNotApplied hours, ComparisonDiffers batches, PlaceholderStock base units. */
  value: number | null
  /** The limit in the same unit; null for "any" (ComparisonDiffers, PlaceholderStock) [guess]. */
  limit: number | null
}

/** Stock Visibility's page, passed through by SIS.Api [guess: SIS.Api keeps SV's names]. */
export interface StockConsolePage<T> {
  /** The whole match, not this page. */
  total: number
  /** 1-based. */
  page: number
  size: number
  rows: T[]
}

/** A fleet fact that is a problem now (BO 4160) — the one line above the stores list. Ticket 942 draws it [guess shape]. */
export interface StockConsoleFleetProblem {
  /** 'FeedLate' | 'ReservedNeverRun' | 'ReservedStale' | 'ReaderBehind' | 'TakesFailing' [guess]. */
  fact: string
  /** e.g. the feed name [guess]. */
  subject: string | null
  value: number | null
  limit: number | null
  since: string | null
}

/** One store's summary row: Stock Visibility's row with SIS.Api's gap, held, reserved state, free and flags added. */
export interface StockConsoleStoreRow {
  /** The store code (Stock Visibility's name; route params still say `{store}`) [guess: not renamed]. */
  plant: string
  city: string
  /** 'Shadow' | 'Seeding' | 'Seeded' | 'Blocking', as Stock/StoreStages answers. */
  stage: string
  /** Rows with either counter not zero. */
  itemsWithStock: number
  /** SUM of the SAP counter. */
  sapStock: number
  /** SUM of the till-side counter — the store's "stock". */
  tillStock: number
  /** sapStock − tillStock: sold at the till, not in SAP yet. */
  gap: number
  heldStanding: number
  /** "Sold not applied". */
  heldSold: number
  /** heldStanding + heldSold. */
  held: number
  /** null = never computed / no row — NEVER 0. */
  reserved: number | null
  /** A `ReservedState`, read defensively. */
  reservedState: string
  /** The recompute's last success, for "stale since" [guess name]. */
  reservedAt: string | null
  /** till − held − reserved, not floored (reserved taken as 0 when never computed). */
  free: number
  /** false when reserved is not in `free` → "reserved not included". */
  reservedIncluded: boolean
  /** Items below zero on the till-side counter. */
  belowZero: number
  /** The newest change of the store's rows. */
  lastUpdate: string | null
  oldestStandingAt: string | null
  oldestSoldAt: string | null
  /** The SAP feed's place = "last SAP document applied". */
  sapPlace: string | null
  sapLastAttempt: string | null
  /** The till feed's place = "last till read". */
  tillPlace: string | null
  tillLastAttempt: string | null
  /** The nightly comparison's differing batches — counted stores only (null otherwise). */
  driftBatches: number | null
  driftRanAt: string | null
  /** Stock on placeholder batches — counted stores only. */
  placeholderStock: number | null
  flags: StockConsoleFlag[]
  /** A `StoreStatus`, read defensively. */
  status: string
}

/** `GET StockConsole/Stores` — the whole list (under a thousand rows); tiles, search and sort run in the browser. */
export interface StockConsoleStores {
  /** When SIS.Api read it (its copy is at most 60 s old). */
  readAt: string
  stores: StockConsoleStoreRow[]
  /** Added by BO 4160 (ticket 942); an absent list reads as none. */
  fleet: StockConsoleFleetProblem[]
}

// ── 941 ─────────────────────────────────────────────────────────────────────────────────────────────
// `GET StockConsole/Stores/{store}` answers a `StockConsoleStoreRow`, read fresh (never the 60 s copy); `NoStore` on
// an unknown store. `…/Items` and `…/Batches` answer a `StockConsolePage` of the rows below (BO 4159, SV 076).

/** The Items list's filters, as the wire names them; `all` is the default. */
export const ITEM_FILTERS = ['all', 'withStock', 'belowZero', 'held', 'differ'] as const
/** The Items list's sorts; `item` is the default. Held and gap largest first, till-side lowest first (server). */
export const ITEM_SORTS = ['item', 'held', 'till', 'gap'] as const

/** The seven stock types other than unrestricted (SV 076/078); the item page shows them when not zero (943). */
export interface StockConsoleOtherStock {
  quality: number
  blocked: number
  returnsBlocked: number
  restricted: number
  inTransit: number
  inTransferPlant: number
  inTransferLocation: number
}

/** One item at the store: Stock Visibility's row, with HQ's names and SIS.Api's gap, held and free added. */
export interface StockConsoleItemRow extends StockConsoleOtherStock {
  /** As Stock Visibility stores it (no leading zeros). Never a number. */
  item: string
  /** From HQ's item master; '' when it does not know the number. */
  nameEn: string
  nameAr: string
  sapStock: number
  tillStock: number
  gap: number
  heldStanding: number
  heldSold: number
  held: number
  /** null = never computed — NEVER 0. */
  reserved: number | null
  /** A `ReservedState`, read defensively. */
  reservedState: string
  free: number
  reservedIncluded: boolean
  lastUpdate: string | null
}

/** The Batches list's filters; `all` is the default; `expiring` = expires within 90 days. Sorted item, expiry (server). */
export const BATCH_FILTERS = ['all', 'withStock', 'belowZero', 'held', 'placeholder', 'expired', 'expiring'] as const

/** One batch of one item at the store (SV 076). A batch has no last-update time: the day first received instead. */
export interface StockConsoleBatchRow {
  item: string
  nameEn: string
  nameAr: string
  /** Our batch. */
  batch: string
  /** The vendor's batch (lot) [guess: nullable]. */
  vendorBatch: string | null
  /** A day — `yyyy-MM-dd`, or with a midnight time [guess: form]; compared on its first ten characters. */
  expiry: string | null
  sapStock: number
  tillStock: number
  /** Holds on this batch not released. */
  held: number
  /** tillStock − held: what the take door may give from it (reserved is not taken off). */
  freeForTheDoor: number
  firstReceivedOn: string | null
  /** Stock Visibility's own placeholder-batch rule, not re-derived. */
  placeholder: boolean
}

// ── 942 ─────────────────────────────────────────────────────────────────────────────────────────────
// `…/Holds` and `…/Takes` answer a page (searched); `…/Feeds` and `…/Stage` are read on opening their tab;
// `StockConsole/Fleet` on opening Feeds and switches (BO 4160, SV 077). Every name not stated by the tickets is a guess.

/** The Holds list's state filter, as the wire names it; `open` (standing and sold not applied) is the default;
 *  `released` = released in the last 7 local days. The web's `filter` goes out as `state`. */
export const HOLD_STATES = ['open', 'standing', 'sold', 'released'] as const

/** One hold at the store (SV 077). Nothing is joined from OMS: no customer order, no customer, no patient. */
export interface StockConsoleHoldRow {
  takeId: string
  item: string
  nameEn: string
  nameAr: string
  /** May be blank: a hold on no batch. */
  batch: string
  quantity: number
  takenAt: string
  /** 'Held' (standing) | 'Sold' (sold not applied) | 'Released' — Stock Visibility's StockHold.State [guess values]. */
  state: string
  /** The picking source, the till, DRS — drawn as it came. */
  source: string
  /** A picking hold's document and line. */
  documentNo: string | null
  lineNumber: number | null
  /** A till sale's store and transaction. */
  soldStore: string | null
  soldTrx: string | null
  updatedAt: string | null
  /** Only on a released hold. */
  releasedAt: string | null
  releaseReason: string | null
}

/** The Takes list's outcome filter; `all` is the default. The web's `filter` goes out as `outcome`. */
export const TAKE_OUTCOMES = ['all', 'granted', 'refused', 'failed'] as const

interface StockConsoleTakeRowBase {
  takeId: string
  /** The row's time [guess name]. */
  at: string
}

/** A granted take: the batches it took, from its holds [guess shape]. */
export interface StockConsoleTakeGranted extends StockConsoleTakeRowBase {
  kind: 'granted'
  item: string
  nameEn: string
  nameAr: string
  quantity: number
  code: string | null
  available: number | null
  stage: string | null
  scannedVendorBatch: string | null
  scannedExpiry: string | null
  enteredBatch: string | null
  batches: { batch: string; quantity: number }[]
}

/** A refused take: its reason, and the batch the door named instead [guess name]. */
export interface StockConsoleTakeRefused extends StockConsoleTakeRowBase {
  kind: 'refused'
  item: string
  nameEn: string
  nameAr: string
  namedBatch: string | null
  asked: number
  available: number | null
  code: string | null
  reason: string | null
  isShadow: boolean
  stage: string | null
}

/** A failed call: the request log has no item, only its status (SV 077). */
export interface StockConsoleTakeFailed extends StockConsoleTakeRowBase {
  kind: 'failed'
  durationMs: number | null
  statusCode: number | null
  instance: string | null
}

export type StockConsoleTakeRow = StockConsoleTakeGranted | StockConsoleTakeRefused | StockConsoleTakeFailed

export interface StockConsoleTakes extends StockConsolePage<StockConsoleTakeRow> {
  /** True when an item or a batch was searched: failed calls carry no item, so they were left out. */
  failedLeftOut: boolean
}

/** A store's feeds, from its own console row (BO 4160) [guess: the summary row's names]. */
export interface StockConsoleStoreFeeds {
  plant: string
  sapPlace: string | null
  sapLastAttempt: string | null
  tillPlace: string | null
  tillLastAttempt: string | null
  /** To say "not a counted store" when there is no comparison. */
  stage: string
  /** The nightly comparison's differing batches; null = none (not counted, or not run yet). */
  driftBatches: number | null
  driftRanAt: string | null
}

/** One stage move (mirrors SV 064 / BO StoreStageMove, with the mover's name). Declared fresh: no store-stage import. */
export interface StockConsoleStageMove {
  store: string
  from: string
  to: string
  mover: string
  who: string
  whoName?: string | null
  why: string
  movedAt: string
}

/** The store's last seed run (a subset of BO StoreSeedStatus). */
export interface StockConsoleSeedRun {
  state: string
  kind: string
  reason: string
  askedAt: string | null
  endedAt: string | null
  batchRows: number
}

/** One measured gate (SV StoreGateModel). */
export interface StockConsoleGate {
  gate: string
  holds: boolean
  figure: string
}

/** The gates toward the next stage (SV StoreGatesModel). */
export interface StockConsoleGates {
  from: string
  to: string
  hold: boolean
  measured: StockConsoleGate[]
  confirmed: string[]
  notConfirmed: string[]
}

/** A store's stage and count (BO 4160), under the console grant. Read-only. */
export interface StockConsoleStoreStage {
  store: string
  stage: string
  updatedAt: string | null
  /** Newest first. */
  moves: StockConsoleStageMove[]
  lastSeed: StockConsoleSeedRun | null
  /** null when the gates read did not answer [guess]. */
  gates: StockConsoleGates | null
}

/** A feed's last full pass (SV FeedAgeModel). */
export interface StockConsoleFeedPass {
  feed: string
  lastCompletePassAt: string | null
  ageSeconds: number | null
}

/** The reserved recompute's run (a subset of SV ReservedRunState). */
export interface StockConsoleReservedRun {
  lastStartedAt: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  consecutiveFailures: number
  lastError: string | null
  lastNetting: string | null
}

/** The held-served switch (SV HeldServingModel). */
export interface StockConsoleHeldServed {
  served: boolean
  changedAt: string | null
  netting: string
  subtractsHeld: boolean
  fellBackAt: string | null
}

/** The hold ledger reader (a subset of SV HoldLedgerStatusModel). */
export interface StockConsoleLedgerReader {
  lastPassAt: string | null
  lagSeconds: number | null
  readThroughAt: string | null
}

/** Today's take door figures (BO TakeDoorToday) [guess: + day]. */
export interface StockConsoleTakesToday {
  day: string
  takes: number
  failed: number
  skipped: number | null
}

/**
 * The facts that belong to no store (BO 4160). Each null = **no answer** (a route an older Stock Visibility does not
 * have, or one that did not answer) — drawn as no answer, never as healthy. All names [guess].
 */
export interface StockConsoleFleet {
  readAt: string
  feeds: StockConsoleFeedPass[] | null
  reservedRun: StockConsoleReservedRun | null
  heldServed: StockConsoleHeldServed | null
  ledgerReader: StockConsoleLedgerReader | null
  takesToday: StockConsoleTakesToday | null
}

// ── 944 ──

/** What `StockConsole/Scan` took the code for (BO 4162). Read defensively: an unknown kind is "not a code we know". */
export type ScanKind = 'Gs1' | 'Barcode' | 'Unknown'

/**
 * `GET StockConsole/Scan?code=` (BO 4162, shape verbatim): the GS1 box's code read by HQ's barcode master. A GS1 code
 * gives the item (from its GTIN), the lot to search as the vendor batch, the expiry and the serial; a plain barcode the
 * item alone. The code is not stored anywhere.
 */
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
  /** AI 17 as a day (`yyyy-MM-dd`), or the month's first day when the code's day is 00. */
  expiry: string | null
  /** False when the code's day is 00: the expiry compares by month. */
  expiryDayKnown: boolean
  /** AI 21. */
  serial: string | null
}

// ── 943 ──
// `GET StockConsole/Stores/{store}/Items/{item}` answers the item's figures (BO 4161, SV 078) — the operands of its sums,
// flat; the web writes the lines out (`item-sum.ts`). Its four tabs: `…/Items/{item}/Batches|Holds|Takes` answer the
// store lists' shapes (a page) and `StockConsole/Items/{item}/Stores` a page of the item at every store.
// `GET StockConsole/Find` answers a batch page or an items page, by what was sent. `NoRow`: no stock row at the store.

/** What the channels are answered for this store and item now, and which rule made it (SV 078). */
export interface StockConsoleAnsweredNow {
  /** NOT floored. */
  quantity: number
  /** `'HeldServed' | 'LiveOrders'`, read defensively. */
  rule: string
  /** The open orders subtracted — only under the live-orders rule. */
  liveOrders: number | null
}

/** One item at one store, with HQ's names and SIS.Api's gap, held and free added (BO 4161). */
export interface StockConsoleItem extends StockConsoleOtherStock {
  plant: string
  item: string
  nameEn: string
  nameAr: string
  /** The SAP counter. */
  sapStock: number
  /** The till-side counter. */
  tillStock: number
  /** sapStock − tillStock: sold at the till, not in SAP yet. */
  gap: number
  heldStanding: number
  heldSold: number
  held: number
  /** Holds on a blank or unknown batch (SV 078). */
  heldOnNoBatch: number
  /** null = never computed — NEVER 0. */
  reserved: number | null
  /** A `ReservedState`, read defensively. */
  reservedState: string
  /** The recompute's time for this figure [guess: SV `reservedComputedAt` renamed]. */
  reservedAt: string | null
  /** till − held − reserved, never floored (reserved left out when never computed). */
  free: number
  reservedIncluded: boolean
  lastUpdate: string | null
  /** null = the answer did not carry it (normalised in `api.ts`); drawn as no answer. */
  answeredNow: StockConsoleAnsweredNow | null
  /** MAX(0, till − held − reserved): the change feed's figure. */
  changeFeed: number
}

/** The item at one store of the fleet (SV 078). SIS.Api may add the store list's figures [guess]; read `?? derived`. */
export interface StockConsoleItemStoreRow {
  plant: string
  city: string
  stage: string
  sapStock: number
  tillStock: number
  heldStanding: number
  heldSold: number
  reserved: number | null
  lastUpdate: string | null
  gap?: number
  held?: number
  free?: number
  reservedState?: string
  reservedIncluded?: boolean
}

/** Find with a batch: one row per store, item and batch (SV 078), names added. */
export interface StockConsoleFindBatchRow {
  plant: string
  city: string
  item: string
  nameEn: string
  nameAr: string
  batch: string
  vendorBatch: string | null
  expiry: string | null
  sapStock: number
  tillStock: number
  held: number
}

/** Find without a batch: items from HQ's item master (BO 4161). */
export interface StockConsoleFindItemRow {
  item: string
  nameEn: string
  nameAr: string
}

/** Find's answer. `kind` [guess] is only a cross-check: the web picks the answer by what it sent. */
export type StockConsoleFind =
  | ({ kind: 'Batch'; stores: number } & StockConsolePage<StockConsoleFindBatchRow>)
  | ({ kind: 'Item' } & StockConsolePage<StockConsoleFindItemRow>)
