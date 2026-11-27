/**
 * The sourcing advisor's planner data (oms-react ticket 968, BackOffice spec 4354 §2, §5, §8, §10, §19): the eight
 * tables every advisor run reads as they stand — buffer overrides and a store's hand-set stock confidence (BO 4375),
 * the product rule rows with the restricted and bulky lists (BO 4362), the store-by-mode table, the carrier contracts
 * and the slot rule table (BO 4361).
 *
 * The three server tickets are open and name the content of each table, never a door, a field or a code. So:
 * 🚩 PROVISIONAL (spec 4354: not specified) — every type, field and value code in this file. The shape follows what
 * the tickets ask of every table: a change never edits a row in place, it ends the row and writes a new one, and the
 * history keeps who, when, the old value and the new one (plus a reason for the BO 4375 tables, the only ones that
 * keep one). Reconcile with BO 4361 / 4362 / 4375 as built.
 */

/** The eight planner tables. PROVISIONAL (spec 4354: not specified) — the keys, also the door's path segment's source. */
export type PlannerTableKey =
  | 'overrides'
  | 'confidence'
  | 'rules'
  | 'restricted'
  | 'bulky'
  | 'storeModes'
  | 'contracts'
  | 'slots'

/** One field's value as the wire carries it (a store-list field is a list of store codes). */
export type PlannerValue = string | number | boolean | readonly string[] | null

/** A row's values, by field name (the field names per table live in the feature's table registry). */
export type PlannerValues = Readonly<Record<string, PlannerValue>>

/**
 * One version of a planner row. PROVISIONAL (spec 4354: not specified) — every field. `names` carries the display
 * name of each code field (`store`, `item`, `category`, `code`, `group` for one item) as the server knows it, so the
 * screen never looks a name up.
 */
export interface PlannerRow {
  /** This version's id. A change writes a new version with a new id (`replaces` points back). */
  id: string
  values: PlannerValues
  names?: Readonly<Record<string, string>> | null
  /** `yyyy-MM-dd HH:mm:ss`, local wall clock (BO 4379). */
  setAt: string
  setBy: string
  replaces?: string | null
  endedAt?: string | null
  endedBy?: string | null
  /** A row a planner may not change here: `SAP` — fed by SAP's "Restricted Drugs" status (BO 4362). */
  lockedBy?: 'SAP' | null
}

/** `GET SourcingAdvisor/Planner/<Table>` — the rows in force (and, asked, the rows ended without a successor). */
export interface PlannerTableReply {
  rows: PlannerRow[]
}

/** What a logged change did. PROVISIONAL (spec 4354: not specified) — the codes. */
export type PlannerChangeAction = 'ADD' | 'CHANGE' | 'END' | 'SWITCH_ON' | 'SWITCH_OFF'

export interface PlannerDiff {
  field: string
  old: PlannerValue
  new: PlannerValue
}

/** One logged change: who, when, old and new, and the reason where the table keeps one (BO 4375). */
export interface PlannerChange {
  id: string
  /** The version the change wrote (for an end, the version it ended). */
  rowId: string
  action: PlannerChangeAction
  diffs: PlannerDiff[]
  reason?: string | null
  by: string
  at: string
}

/** `GET SourcingAdvisor/Planner/<Table>/History?rowId=` — every version of the row, newest first, and its changes. */
export interface PlannerHistoryReply {
  versions: PlannerRow[]
  changes: PlannerChange[]
}

/** `POST SourcingAdvisor/Planner/<Table>/Add`. `reason` only for a table that keeps one. */
export interface PlannerAddRequest {
  values: PlannerValues
  reason?: string
}

/** `POST SourcingAdvisor/Planner/<Table>/Change` — ends `rowId` and writes the new version. */
export interface PlannerChangeRequest {
  rowId: string
  values: PlannerValues
  reason?: string
}

/** `POST SourcingAdvisor/Planner/<Table>/End`. */
export interface PlannerEndRequest {
  rowId: string
  reason?: string
}

export interface PlannerCodeName {
  code: string
  name: string
}

/** `GET SourcingAdvisor/Planner/Choices` — what the forms pick from. Items are typed by code (no item list is sent). */
export interface PlannerChoicesReply {
  stores: PlannerCodeName[]
  categories: PlannerCodeName[]
  subCategories: PlannerCodeName[]
}

/** The six delivery modes (spec §2), in the advise door's codes (BO 4281). */
export const PLANNER_MODES = ['DAWAA_NOW', 'SLOT', 'CARRIER_SAME_DAY', 'CARRIER_NEXT_DAY', 'BEYOND_BORDER', 'PICK_UP'] as const
export type PlannerMode = (typeof PLANNER_MODES)[number]

/** The four override levels, most specific first (spec §5). PROVISIONAL (spec 4354: not specified) — the codes. */
export const OVERRIDE_LEVELS = ['STORE_ITEM', 'ITEM', 'CATEGORY', 'STORE'] as const
export type OverrideLevel = (typeof OVERRIDE_LEVELS)[number]

/** What a product rule's item group is (spec §8). PROVISIONAL (spec 4354: not specified) — the codes. */
export const RULE_GROUP_KINDS = ['A_CLASS', 'COLD_CHAIN', 'SAP_STATUS', 'NAMED_LIST', 'ITEM'] as const
export type RuleGroupKind = (typeof RULE_GROUP_KINDS)[number]

/** A rule row says "not by this mode" or "only from named stores" (spec §8). PROVISIONAL — the codes. */
export const RULE_KINDS = ['NOT_BY_MODE', 'ONLY_FROM_STORES'] as const
export type RuleKind = (typeof RULE_KINDS)[number]
