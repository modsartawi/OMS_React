/**
 * Wire shapes of the bulk change of engine rules (BackOffice spec 4190, server tickets 4192–4194;
 * oms 958, 959).
 *
 * Reconciled to BackOffice pricing2 9317c4cd6: `BbyBulkChangeModels.cs` (request, list row, result,
 * operations) serialised by SIS.Api's camelCase web defaults. The contract record is
 * `.issues/4190-bulk-change-contract-guess.md`.
 *
 * The operations shape (`BbyBulkOperations`) is final per 4193, and presets (4195, oms 960) store it as
 * JSON. Every field is `{ op, value }` (`BbyRuleOperation<T>`); a field left out — or `null`, as the
 * server echoes it, or an op of `leave` / blank — is Leave.
 */
import type { BbyEngineRulesWire, BbyRefusal, BbyStatusCode } from './bonus-buy-maintenance'

/** One row of GET `BbyMaintainWeb/Bulk/List`: an OMS bonus buy under an OMS promotion, in any status. */
export interface BbyBulkListRow {
  bbyNumber: string
  description: string | null
  promoNumber: string
  promotionName?: string | null
  /** The promotion's sales area (spec 4096); blank when the promotion is missing → KSA (`readSalesArea`). */
  salesOrganization?: string | null
  distributionChannel?: string | null
  currency?: string | null
  /** SAP's status code, read through `readBbyStatus`. */
  bbyStatus: BbyStatusCode | null
  /** The server's lock: true for any status but Planned (it refuses such a row in a bulk change). */
  locked?: boolean
  /** The header's stamp (`yyyyMMddHHmmssfffffff`), opaque; the bulk acts send it back per row. */
  version: string | null
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

/**
 * A list field's operation. `value` is the codes as typed; the server splits them with `BbyCodeList`'s
 * separators. A Clear needs no value (the server echoes `value: null`).
 */
export type BbyBulkListOperation = { op: 'replace' | 'add' | 'remove'; value: string } | { op: 'clear'; value?: null }

/** The time-of-day window: both ends or neither (the validator's rule), `HHmmss` each. */
export interface BbyBulkTimeWindow {
  from: string
  to: string
}

/** The window's operation: Set carries `{ from, to }` as its value; Clear needs none. */
export type BbyBulkTimeOperation = { op: 'set'; value: BbyBulkTimeWindow } | { op: 'clear'; value?: null }

/** Every engine rule's operation. An absent (or null) key is **Leave**: that field stays as each bonus buy has it. */
export interface BbyBulkOperations {
  score?: { op: 'set'; value: number } | null
  maxValue?: { op: 'set'; value: number } | null
  isStackable?: { op: 'set'; value: boolean } | null
  timeWindow?: BbyBulkTimeOperation | null
  includes?: BbyBulkListOperation | null
  excludes?: BbyBulkListOperation | null
  originFilter?: BbyBulkListOperation | null
  stackingExcludes?: BbyBulkListOperation | null
  loyGroups?: BbyBulkListOperation | null
  loyTiers?: BbyBulkListOperation | null
}

/** One selected bonus buy, at the version the screen loaded (`BbyBulkTarget`). */
export interface BbyBulkTarget {
  bbyNumber: string
  version: string | null
}

/** POST `BbyMaintainWeb/Bulk/Change`. */
export interface BbyBulkChangeRequest {
  bonusBuys: BbyBulkTarget[]
  operations: BbyBulkOperations
  /** True: compute and validate every row, write nothing, return before and after. */
  dryRun: boolean
}

/**
 * A row's outcome: `saved` (written), `valid` (a dry run that would save), `skipped` (no field would
 * change: nothing written, version kept), `refused` or `notFound` (nothing written for it).
 */
export type BbyBulkRowStatus = 'saved' | 'valid' | 'skipped' | 'refused' | 'notFound'

/** One bonus buy's result (`BbyBulkRowResult`). Bulk Mark Tested fills no rules and no changed fields. */
export interface BbyBulkRowResult {
  number: string
  status: BbyBulkRowStatus | string
  refusals: BbyRefusal[]
  warnings: BbyRefusal[]
  /** The version after the act: the new one when saved, the stored one otherwise; null when not found. */
  version?: string | null
  /** The engine-rule fields the change alters on this row, PascalCase (`Score`, `ValidFromTime`, `Includes`…). */
  changedFields?: string[] | null
  /** The engine rules as stored; null when refused before they were read. */
  before?: BbyEngineRulesWire | null
  /** The engine rules as saved (or, on a dry run, as they would be); null when refused before computed. */
  after?: BbyEngineRulesWire | null
}

/** POST `BbyMaintainWeb/Bulk/MarkTested` (BackOffice 4194, tester grant `BbyMaintain:04`; oms 959). */
export interface BbyBulkMarkTestedRequest {
  bonusBuys: BbyBulkTarget[]
  /** Optional; null when the tester left it blank. The server appends ` (batch <ULID>)` to it. */
  note: string | null
}

/** Bulk Mark Tested's in-band 200: the bulk change's own shape (`BbyBulkResult`), rows `saved` or `refused`. */
export type BbyBulkMarkTestedResult = BbyBulkChangeResult

/**
 * A bulk act's in-band 200 (`BbyBulkResult`): `valid` for a dry run that ran, `saved` for an apply that
 * ran (each row its own outcome), `refused` for a batch refused whole (empty, over 200, mixed sales
 * areas) with top-level `refusals` and no rows.
 */
export interface BbyBulkChangeResult {
  status: 'saved' | 'valid' | 'refused' | string
  /** The apply's ULID; null on a dry run and on a batch refused whole. */
  batchId: string | null
  dryRun?: boolean
  saved?: number
  skipped?: number
  refused?: number
  refusals: BbyRefusal[]
  bonusBuys: BbyBulkRowResult[]
}
