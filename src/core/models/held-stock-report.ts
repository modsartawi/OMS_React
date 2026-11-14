/**
 * HQ's two reports read before a held-stock switch is moved (BackOffice ticket 3873, spec 3849) — wire shapes mirrored
 * field for field, camelCase, from BackOffice `Sartawi.Retail.Data\Modules\Pick\Reports\HeldStockReportModels.cs`. A shape
 * change goes there first, then here.
 *
 * - **The refusal report** (`GET HeldStockReport/Refusals`): one day of the take door's refusals and a shadow store's
 *   would-be refusals, by store, material and batch, with the feed ages; the lines that span more than one batch; and each
 *   take of last-resort stock (`DUMMY`, or the store's own `DM` + store).
 * - **The held report** (`GET HeldStockReport/Held`): what held would take off the channels' figure (Stock Visibility's ATP),
 *   per store and material and per picking source type (DRS on its own line), with the check on held's repairs per day as
 *   its last line.
 *
 * Both behind one grant, `BackOfficeScreen[HeldStockReport, 03]` (role `HELD_STOCK_REPORT_VIEWER`).
 *
 * ⚠️ Timestamps are the estate's local wall-clock, `"yyyy-MM-ddTHH:mm:ss"` with no offset; they stay strings and are
 * formatted through `@/core/util/date-format`. Feed ages are whole seconds; null where the row carried none.
 */

export interface HeldStockReportAccess {
  screenAllowed: boolean
}

// ----- the refusal report -----

/** The refusal report's query: one local day (`yyyy-MM-dd`; absent = today) and the stores (blank = every open store). */
export interface TakeRefusalReportQuery {
  day?: string
  /** Comma-separated store codes. */
  stores?: string
}

/** The refusals of one store, material and batch on the day (`isShadow`: would-be refusals, nothing was refused). */
export interface TakeRefusalGroup {
  store: string
  material: string
  /** Blank when the refusal named no batch. */
  batch: string
  isShadow: boolean
  count: number
  quantityAsked: number
  /** The quantity available at the group's latest refusal. */
  quantityAvailable: number
  /** The reasons seen, comma-separated. */
  reasons: string
  /** The oldest SAP feed age of the group's rows, in seconds. */
  sapFeedAgeSeconds: number | null
  /** The oldest POS feed age of the group's rows, in seconds. */
  posFeedAgeSeconds: number | null
  firstAt: string
  lastAt: string
}

/** One row of the refusal log, with the feed ages it was logged with. */
export interface TakeRefusalRow {
  takeId: string
  store: string
  material: string
  batch: string
  quantityAsked: number
  quantityAvailable: number
  code: string
  reason: string
  batchWithStock: string
  batchWithStockExpiry: string | null
  batchWithStockQuantity: number | null
  expiredQuantity: number | null
  document: string
  user: string
  isShadow: boolean
  stage: string
  sapFeedAgeSeconds: number | null
  posFeedAgeSeconds: number | null
  loggedAt: string
}

/** The lines of one store on the day that span more than one batch. */
export interface MultiBatchLineCount {
  store: string
  lines: number
}

/** One unit that took last-resort stock. */
export interface LastResortTake {
  store: string
  documentNo: string
  sourceType: string
  sourceKey: string
  lineNumber: number
  pickIndex: number
  material: string
  batch: string
  quantity: number
  takeId: string
  pickedBy: string
  pickedAt: string
}

export interface TakeRefusalReport {
  asOf: string
  day: string
  groups: TakeRefusalGroup[]
  rows: TakeRefusalRow[]
  multiBatchLines: MultiBatchLineCount[]
  lastResortTakes: LastResortTake[]
  /** The stores whose log Stock Visibility did not answer: their rows are missing, not zero. */
  storesUnreached: string[]
}

// ----- the held report -----

/** The held report's query: the stores (blank = the fleet) and the repairs' range (absent = the last 7 days). */
export interface HeldImpactReportQuery {
  stores?: string
  repairsFrom?: string
  repairsTo?: string
}

export interface HeldBySource {
  sourceType: string
  units: number
}

/** One store and material with a standing hold on an open picking document. */
export interface HeldImpactPair {
  store: string
  material: string
  /** What the channels get today: Stock Visibility's ATP. */
  channelToday: number
  /** Held, as Stock Visibility stands it. */
  held: number
  /** ATP with held subtracted, never below zero. */
  channelWithHeld: number
  takenOff: number
  fallsToZero: boolean
  bySource: HeldBySource[]
  /** Held minus the open picking documents' held units; negative when Stock Visibility is behind the pick tables. */
  heldBeyondOpenPicks: number
}

/** One source type's held units over the fleet, and the pairs it holds on. */
export interface HeldImpactSource {
  sourceType: string
  units: number
  pairs: number
}

export interface HeldImpactTotals {
  channelToday: number
  channelWithHeld: number
  takenOff: number
  held: number
  pairs: number
  pairsFallingToZero: number
}

export interface HeldImpactRepairDay {
  day: string
  repairs: number
  holdsReleased: number
  holdsAdded: number
}

export interface HeldImpactReport {
  asOf: string
  pairs: HeldImpactPair[]
  sources: HeldImpactSource[]
  totals: HeldImpactTotals
  repairsFrom: string
  repairsTo: string
  repairs: number
  /** The report's last line: the check on held's repairs per day, fleet-wide. */
  repairsPerDay: HeldImpactRepairDay[]
}
