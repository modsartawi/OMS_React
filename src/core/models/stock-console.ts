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
