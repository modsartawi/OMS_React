/**
 * Wire shapes of the bulk change of engine rules (BackOffice spec 4190, server tickets 4192 + 4193;
 * oms 958).
 *
 * 🚩 GUESSED CONTRACT. 4192/4193 were unbuilt when this was written: every name here is read off spec
 * 4190 and the shipped `BbyMaintainWeb` conventions (`BbyMaintainModels.cs`, camelCase, in-band
 * outcomes, bilingual `BbyMaintainMessage`). The reasoning for each guess is in the contract note of
 * ticket 958. Reconcile when BackOffice 4192/4193 ship.
 *
 * The operations shape (`BbyBulkOperations`) is final per 4193, and presets (BackOffice 4195, oms 960)
 * store it as JSON — so it is a plain object keyed by field, every key optional: an absent key is Leave.
 */
import type { BbyEngineRulesWire, BbyRefusal, BbyStatusCode } from './bonus-buy-maintenance'

/** One row of GET `BbyMaintainWeb/BonusBuy/BulkList`: an OMS bonus buy in any status, with its engine rules. */
export interface BbyBulkListRow {
  bbyNumber: string
  description: string | null
  promoNumber: string
  promotionName?: string | null
  /** The promotion's sales area (spec 4096); absent on an old server → KSA (`readSalesArea`). */
  salesOrganization?: string | null
  distributionChannel?: string | null
  currency?: string | null
  /** SAP's status code, read through `readBbyStatus`. */
  bbyStatus: BbyStatusCode | null
  /** The header's last-written stamp, opaque; the bulk change sends it back per row. */
  version: string | null
  validFrom?: string | null
  validTo?: string | null
  engineRules: BbyEngineRulesWire | null
}

/** The six engine-rule lists (`BbyEngineRules`), in the editor's order. */
export type BbyBulkListField = 'includes' | 'excludes' | 'originFilter' | 'stackingExcludes' | 'loyGroups' | 'loyTiers'

export const BBY_BULK_LIST_FIELDS: readonly BbyBulkListField[] = [
  'includes',
  'excludes',
  'originFilter',
  'stackingExcludes',
  'loyGroups',
  'loyTiers',
]

/** A list field's operation. `value` is the codes as typed; the server splits them with `BbyCodeList`'s separators. */
export type BbyBulkListOperation = { op: 'replace' | 'add' | 'remove'; value: string } | { op: 'clear' }

/** The time-of-day window: both ends or neither (the validator's rule), `HHmmss` each. */
export type BbyBulkTimeOperation = { op: 'set'; from: string; to: string } | { op: 'clear' }

/** Every engine rule's operation. An absent key is **Leave**: that field stays as each bonus buy has it. */
export interface BbyBulkOperations {
  score?: { op: 'set'; value: number }
  maxValue?: { op: 'set'; value: number }
  isStackable?: { op: 'set'; value: boolean }
  timeWindow?: BbyBulkTimeOperation
  includes?: BbyBulkListOperation
  excludes?: BbyBulkListOperation
  originFilter?: BbyBulkListOperation
  stackingExcludes?: BbyBulkListOperation
  loyGroups?: BbyBulkListOperation
  loyTiers?: BbyBulkListOperation
}

/** One selected bonus buy, at the version the screen loaded. */
export interface BbyBulkTarget {
  bbyNumber: string
  version: string | null
}

/** POST `BbyMaintainWeb/BonusBuy/BulkChange`. */
export interface BbyBulkChangeRequest {
  bonusBuys: BbyBulkTarget[]
  operations: BbyBulkOperations
  /** True: compute and validate every row, write nothing, return old and new values. */
  dryRun: boolean
}

/**
 * A row's outcome: `saved` (written), `valid` (a dry run that would save), `skipped` (no field would
 * change: nothing written, version kept) or `refused` (bilingual refusals; nothing written for it).
 */
export type BbyBulkRowStatus = 'saved' | 'valid' | 'skipped' | 'refused'

/** One bonus buy's result — `BbyMaintainItemResult` plus its engine rules before and after. */
export interface BbyBulkRowResult {
  number: string
  status: BbyBulkRowStatus | string
  refusals: BbyRefusal[]
  warnings: BbyRefusal[]
  /** The stored engine rules; null when the row was refused before it was read (unknown number). */
  oldRules?: BbyEngineRulesWire | null
  /** The rules the operations make; null on a refused row the server could not compute. */
  newRules?: BbyEngineRulesWire | null
  /** The new version after a save; the old one otherwise. */
  version?: string | null
}

/**
 * POST `BbyMaintainWeb/BonusBuy/BulkMarkTested` (BackOffice 4194, tester grant `BbyMaintain:04`; oms 959).
 * 🚩 GUESSED: the targets are the bulk change's own pairs; the note is the single Mark Tested's
 * (`BbyMarkTestedRequest.note`). The server appends the batch reference and clamps to `BbyTestMark.Note`'s width.
 */
export interface BbyBulkMarkTestedRequest {
  bonusBuys: BbyBulkTarget[]
  /** Optional; null when the tester left it blank. */
  note: string | null
}

/**
 * Bulk Mark Tested's in-band 200: "the same shape as the bulk change" (4194). A row is `saved` (the
 * test mark was written, as the single Mark Tested answers) or `refused`; there are no rule values.
 */
export type BbyBulkMarkTestedResult = BbyBulkChangeResult

/**
 * The bulk change's in-band 200 (`BbyMaintainResult`-shaped). A batch refused whole (mixed sales
 * areas, over the cap, nothing selected) is `refused` with top-level `refusals` and no rows.
 */
export interface BbyBulkChangeResult {
  status: 'saved' | 'valid' | 'refused' | string
  dryRun?: boolean
  /** The apply's ULID batch id; null on a dry run and on a batch refused whole. */
  batchId: string | null
  refusals: BbyRefusal[]
  warnings: BbyRefusal[]
  bonusBuys: BbyBulkRowResult[]
}
