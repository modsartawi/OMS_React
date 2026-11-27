/**
 * The sourcing advisor's planner data on the wire (oms-react ticket 968, BackOffice spec 4354 §2, §5, §8, §10, §19),
 * reconciled with BackOffice at pricing2 35a4e56be. Three families of doors, each with its own shape:
 *
 * - BO 4375 `PlannerStockEndpoints` — buffer overrides and a store's hand-set stock confidence (`PlannerStockService.cs`);
 * - BO 4362 `ProductRuleEndpoints` — the product rule rows and the restricted and bulky lists (`ProductRuleService.cs`);
 * - BO 4361 `PlannerTableEndpoints` — the store-by-mode table, the carrier contracts, the slot rules (`PlannerTableService.cs`,
 *   `PlannerRowShapes.cs`).
 *
 * Every list reads under the simulator's run grant; every change under its family's grant. A row is never changed in
 * place: a change ends it and writes the next. Times are local wall clock `yyyy-MM-dd HH:mm:ss`, days `yyyy-MM-dd`; a
 * null is left out (the serializer writes none), so every nullable field is optional. Request bodies are read strictly:
 * a field the server does not know is refused.
 */

/** The six delivery modes (spec §2), in the advise door's codes. */
export const PLANNER_MODES = ['DAWAA_NOW', 'SLOT', 'CARRIER_SAME_DAY', 'CARRIER_NEXT_DAY', 'BEYOND_BORDER', 'PICK_UP'] as const
export type PlannerMode = (typeof PLANNER_MODES)[number]

// ── BO 4375: buffer overrides and stock confidence ───────────────────────────────────────────────────────────────────

/** The four override levels, most specific first (`OverrideLevels`). */
export const OVERRIDE_LEVELS = ['STORE_ITEM', 'ITEM', 'CATEGORY', 'STORE'] as const
export type OverrideLevel = (typeof OVERRIDE_LEVELS)[number]

/** One row of `GET SourcingAdvisor/BufferOverrides[?withEnded=true]` (`BufferOverrideView`). */
export interface BufferOverrideView {
  id: string
  level: OverrideLevel
  /** Only the keys of the level are kept; the others are empty. */
  store: string
  item: string
  category: string
  keepUnits?: number | null
  keepDays?: number | null
  firstDay: string
  lastDay?: string | null
  reason: string
  createdBy: string
  createdAt: string
  replaces?: string | null
  ended: boolean
  endedBy?: string | null
  endedAt?: string | null
  endReason?: string | null
  replacedBy?: string | null
  /** In force, but past its last day. */
  expired: boolean
}

/** `POST SourcingAdvisor/BufferOverrides/Save` — a new override, or a change of the live row `replaces`. */
export interface BufferOverrideRequest {
  replaces: string | null
  level: OverrideLevel
  store: string | null
  item: string | null
  category: string | null
  keepUnits: number | null
  keepDays: number | null
  firstDay: string
  lastDay: string | null
  reason: string
}

/** One row of `GET SourcingAdvisor/StoreConfidences[?withEnded=true]` (`StoreConfidenceView`). */
export interface StoreConfidenceView {
  id: string
  store: string
  confidence: number
  reason: string
  endsOn: string
  createdBy: string
  createdAt: string
  ended: boolean
  endedBy?: string | null
  endedAt?: string | null
  endReason?: string | null
  /** In force, but past its end date: the store reads 1.0 again. */
  pastEndDate: boolean
}

/** `POST SourcingAdvisor/StoreConfidences/Set` — the store's confidence from today; a live one is ended and replaced. */
export interface StoreConfidenceRequest {
  store: string
  confidence: number
  reason: string
  endsOn: string
}

/** `POST …/BufferOverrides/End` (`id`: the override's) and `POST …/StoreConfidences/End` (`id`: the store's code). */
export interface EndPlannerRowRequest {
  id: string
  reason: string
}

// ── BO 4362: product rules and lists ─────────────────────────────────────────────────────────────────────────────────

/** What a rule row's item group is (`ProductRuleGroups`). */
export const RULE_GROUPS = ['A_CLASS', 'COLD_CHAIN', 'SAP_STATUS', 'LIST', 'ITEM'] as const
export type RuleGroup = (typeof RULE_GROUPS)[number]

/** Why a row keeps a line off (`ProductRuleReasons.OfRows`): it picks the simulator's sentence. */
export const RULE_REASONS = ['COLD', 'RESTRICTED', 'BULKY', 'OUT_OF_RANGE', 'NAMED_STORES'] as const
export type RuleReason = (typeof RULE_REASONS)[number]

/** The two lists (`ProductRuleLists`) and what a bulky entry names (`BulkyKinds`). */
export type ProductListName = 'RESTRICTED' | 'BULKY'
export const BULKY_KINDS = ['ITEM', 'SUB_CATEGORY'] as const
export type BulkyKind = (typeof BULKY_KINDS)[number]

/** A rule row (`ProductRuleRow`): in force, or with history, ended. `rule` is the rule's id across its rows. */
export interface ProductRuleRow {
  rule: string
  group: RuleGroup
  value: string
  /** Empty for a row that names stores and no mode. */
  mode: string
  onlyFrom: string[]
  reason: RuleReason
  on: boolean
  note: string
  startedBy: string
  startedAt: string
  ended: boolean
  endedBy?: string | null
  endedAt?: string | null
}

/** A restricted-list entry (kind `ITEM`) or a bulky-list entry (`ITEM` or `SUB_CATEGORY`) (`ProductListRow`). */
export interface ProductListRow {
  list: ProductListName
  kind: BulkyKind
  code: string
  note: string
  startedBy: string
  startedAt: string
  ended: boolean
  endedBy?: string | null
  endedAt?: string | null
}

/** `GET SourcingAdvisor/ProductRules[?withHistory=true]` (`ProductRuleListing`). */
export interface ProductRuleListing {
  rules: ProductRuleRow[]
  lists: ProductListRow[]
}

/** `POST SourcingAdvisor/ProductRules/Change` — a rule's next row; no `rule` writes a new rule. Answers the new row. */
export interface ProductRuleChange {
  rule?: string
  group: RuleGroup
  value: string
  mode: string
  onlyFrom: string[]
  reason: RuleReason
  on: boolean
  note: string
}

/** `POST SourcingAdvisor/ProductRules/Lists/Add` and `…/Lists/Remove` (`ProductListChange`). */
export interface ProductListChange {
  list: ProductListName
  kind: BulkyKind
  code: string
  note?: string
}

// ── BO 4361: the three planner tables ────────────────────────────────────────────────────────────────────────────────

/** The doors' `table` (`PlannerTableNames`). */
export type PlannerTableName = 'storeModes' | 'carrierContracts' | 'slotRules'

/** A store-by-mode row: the store ships by the mode, or (Dawaa Now and pick-up only) is excluded from it (`StoreModeRow`). */
export interface StoreModeRow {
  store: string
  mode: PlannerMode
  gives: boolean
}

/** A carrier contract row (`InputCarrierContract`); its key is `contract`. */
export interface CarrierContractRow {
  contract: string
  mode: 'CARRIER_SAME_DAY' | 'CARRIER_NEXT_DAY'
  courier: string
  /** City codes; `*` is every city. */
  cities: string[]
  /** Local `HH:mm`. */
  cutOff: string
  daysToDeliver: number
  deliverBy: string
  rate: number
  collectAt: string
  keepsCold: boolean
  assumed: boolean
}

/** A slot rule row (`InputSlotRule`): a `SLOT` from–to, or `NEXT_DAY_AFTER` from; its key is `kind|from`. */
export interface SlotRuleRow {
  kind: 'SLOT' | 'NEXT_DAY_AFTER'
  from: string
  to?: string | null
}

export type PlannerTableRowShape = StoreModeRow | CarrierContractRow | SlotRuleRow

/**
 * One row of `GET SourcingAdvisor/PlannerTables?table=` (the current rows) or `GET …/History?table=&key=` (every row the
 * key carried) (`PlannerRowReply`).
 */
export interface PlannerRowReply<R = PlannerTableRowShape> {
  id: string
  key: string
  row: R
  addedBy: string
  addedAt: string
  ended: boolean
  endedBy?: string | null
  endedAt?: string | null
  replaces?: string | null
  note: string
}

/** `POST SourcingAdvisor/PlannerTables/Save` — a new key, or the key's next row. Answers the row written. */
export interface SavePlannerTableRowRequest {
  table: PlannerTableName
  row: PlannerTableRowShape
  note: string
}

/** `POST SourcingAdvisor/PlannerTables/End` — the key's current row ends with no successor. */
export interface EndPlannerTableRowRequest {
  table: PlannerTableName
  key: string
}
