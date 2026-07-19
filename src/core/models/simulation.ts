// Wire shapes for the Pricing/* endpoints (BackOffice map 484 / spec 503; server
// slice BackOffice 509, contract 486). Field casing is the camelCase ASP.NET Core
// emits. The POS Simulation screen is gated by its OWN grant (POS_SIMULATION_ADMIN).
//
// Ticket 013 (the tracer) uses: the access probe, the request shape, and the
// header totals + per-item result fields the results grid renders. The raw
// `conditions` rows (aggregated client-side, ticket 014), bonus buys (015) and
// pricing elements (015) are additive extensions of these types their tickets add.

/** GET Pricing/Access — the screen-open grant probe (show/hide only; server enforces per call). */
export interface SimulationAccessResult {
  canOpen: boolean
}

/** GET Pricing/CacheAccess — the pricing-cache-admin grant probe (spec 022). A DISTINCT
 *  privilege from opening the screen: clearing the shared cache evicts every user's warm
 *  pricing, so it rides its own grant. Cookie-only, not grant-gated — show/hide the
 *  Clear-cache button only; the server enforces the grant on the clear call itself. */
export interface SimulationCacheAccessResult {
  canClear: boolean
}

/** POST Pricing/ClearCache — the whole-pricing-cache clear (spec 022, ticket 052). Evicts
 *  the entire server-side "Pricing" FusionCache on the serving instance. The server's
 *  rate-limit rejects a too-soon repeat as a `success:false` business envelope (surfaced
 *  client-side, never retried). */
export interface SimulationClearCacheResult {
  cleared: boolean
}

// ---- request (SimulateRequest, bound verbatim by the endpoint) --------------

/** Header inputs feeding the engine's procedure determination. Empty loyalty
 *  fields go as `null`; a blank `pricingDate` lets the engine use "now". */
export interface SimulateHeaderInput {
  plant: string
  salesOrganization: string
  distributionChannel: string
  pricingDate: string
  documentPricingProcedureKey: string
  loyGroups: string | null
  loyTier: string | null
  isPromotionApplicable: boolean
}

/** One basket line. `itemNumber` is assigned SERVER-side by array order
 *  ((index+1)*10) — the client sends items in order and never sets it (486). */
export interface SimulateItemInput {
  materialNumber: string
  quantity: number
  qtyUnit: string
  itemConditionControl: string | null
}

/** An operator-entered condition. `itemNumber` references the server's
 *  (position)*10 scheme, or 0 for a header/group condition (ticket 016). */
export interface ManualConditionInput {
  itemNumber: number
  conditionType: string
  rate: number
  rateUnit: string
}

export interface SimulateRequest {
  header: SimulateHeaderInput
  items: SimulateItemInput[]
  manualConditions?: ManualConditionInput[]
  includeConditions: boolean
  includePricingElements: boolean
}

// ---- result (SimulationResult, minus the nulled diagnostic fields) ----------

export interface SimulationResultHeader {
  currency: string
  netValue: number
  taxValue: number
  grossValue: number
  netTotal: number
  totalDiscount: number
  salesDiscount: number
  promotionDiscount: number
  headerDiscount: number
  receivableValue: number
  payment: number
}

/** Per-item pricing status: 'E' error / 'W' warning / '' ok. Rides the 200
 *  result (a bad line never blanks the run) — drives the red/amber/green dot. */
export type PricingStatus = 'E' | 'W' | '' | (string & {})

/** One RAW condition row on a priced line (contract 486). The client aggregates
 *  these into cards (ticket 014, `aggregateConditions`) — the endpoint stays a
 *  pass-through and never groups. `conditionOrigin` drives the badge/category
 *  (P|B → promotion, M → manual, H → header); `isStatistics` rows hide behind a
 *  toggle. Bonus-buy fields feed the bonus-buy tabs (ticket 015). */
export interface SimulationResultCondition {
  stepNumber: number
  conditionCounter: number
  conditionType: string
  description: string
  conditionRate: number
  conditionRateUnit: string
  conditionValue: number
  conditionBaseValue: number
  isStatistics: boolean
  conditionOrigin: string
  isBonusBuy: boolean
  bbyNumber: string | null
  /** The buy↔get role/link the engine stamps on `PcCondition` and the applied-BBY
   *  projection (ticket 044) surfaces. Optional so a pre-projection response still
   *  types; `promoView` (045) reads them when present and degrades when absent.
   *  `isPrerequisite` = a buy line, `isCondition` = a get/reward line (a buy-line
   *  set-price is both); `conditionKey` is the per-fired-application join. */
  isPrerequisite?: boolean
  isCondition?: boolean
  conditionKey?: string | null
  bbyItemIndex?: number | null
}

export interface SimulationResultItem {
  itemNumber: number
  materialNumber: string
  materialDescription: string
  quantity: number
  unitOfMeasure: string
  netPrice: number
  netValue: number
  taxValue: number
  grossValue: number
  netTotal: number
  salesDiscount: number
  promotionDiscount: number
  pricingStatus: PricingStatus
  pricingStatusMessages: string[]
  /** Raw pricing-procedure rows, aggregated into cards client-side (ticket 014).
   *  Present when the request set `includeConditions:true` (the screen always does). */
  conditions: SimulationResultCondition[]
  /** Raw pricing-procedure trace rows for this line — the Pricing Elements tab
   *  (ticket 015) renders the SELECTED line's, mirroring the WPF. Populated only
   *  when the request set `includePricingElements`. */
  pricingElements?: PricingElement[]
}

export interface SimulationResult {
  header: SimulationResultHeader
  items: SimulationResultItem[]
  /** Promotions that fired — the Applied Bonus Buys grid (ticket 015). Server
   *  groups the bonus-buy conditions by bbyNumber; empty when none applied. */
  appliedBonusBuys: AppliedBonusBuy[]
  /** Promotions that could apply but did not — the Potential Bonus Buys grid
   *  (ticket 015); selecting a row drives its `prerequisites`. */
  potentialBonusBuys: PotentialBonusBuy[]
}

// ---- bonus buys + pricing elements (ticket 015) -----------------------------

/** One promotion that FIRED — a row in the Applied Bonus Buys grid. Built server-
 *  side by grouping the priced bonus-buy conditions by `bbyNumber`. */
export interface AppliedBonusBuy {
  bbyNumber: string
  promoNumber: string
  offerId: string
  description: string
  /** The raw SAP condition code (ZBxx / VKA0). The projection (ticket 044) also
   *  carries the normalised `discountKind` below; `promoView` prefers that and
   *  falls back to mapping this when only the raw code is present. */
  discountType: string
  totalDiscountValue: number
  affectedItemNumbers: number[]
  remainingUsage: number
  /** Each fired application split into its buy vs get basket lines, keyed by
   *  `conditionKey` — surfaced by the applied-BBY projection (ticket 044). Absent
   *  on a pre-projection response, where `promoView` degrades to the flat
   *  `affectedItemNumbers` (one undivided block, no buy→get split). */
  applications?: AppliedBonusBuyApplication[]
  /** The normalised discount kind (Free Goods `N` / Discount Percent `%` / Fixed
   *  `R` / Set Price `P`) — the taxonomy's four kinds, uniform with the potential
   *  side. Surfaced by the projection (044); when absent `promoView` maps the raw
   *  `discountType` SAP code. */
  discountKind?: 'N' | '%' | 'R' | 'P'
}

/** One fired application of a bonus buy: the buy (prerequisite) lines and the get
 *  (reward) lines that share one `conditionKey`. A buy-line set-price lists the same
 *  item number in both. */
export interface AppliedBonusBuyApplication {
  conditionKey: string
  buyItemNumbers: number[]
  getItemNumbers: number[]
}

/** One prerequisite line of a potential bonus buy: required vs found qty, min vs
 *  found value, and whether it is met. Drives the stacked Prerequisites grid. */
export interface PrereqStatus {
  prereqNumber: string
  materialNumber: string | null
  matGrouping: string
  requiredQty: number
  foundQty: number
  minValue: number
  foundValue: number
  isMet: boolean
}

/** The discount a potential bonus buy would grant were its prerequisites met. */
export interface PotentialDiscount {
  discountType: string
  value: number
  conditionType: string
}

/** One promotion that COULD apply but did not — a row in the Potential Bonus Buys
 *  grid. Selecting it drives the Prerequisites grid below. `skipReason` is set when
 *  accumulation blocked it (e.g. exhausted usage). */
export interface PotentialBonusBuy {
  bbyNumber: string
  promoNumber: string
  offerId: string
  description: string
  bbyStatus: string
  validFrom: string
  validTo: string
  minValue: number
  maxValue: number
  remainingUsage: number
  skipReason: string | null
  prerequisites: PrereqStatus[]
  discount: PotentialDiscount | null
}

/** One raw pricing-procedure trace row (a condition when `isSubtotal` is false, a
 *  running subtotal otherwise). Rendered verbatim in the Pricing Elements tab. */
export interface PricingElement {
  stepNumber: number
  conditionCounter: number
  conditionType: string
  description: string
  conditionRate: number
  conditionRateUnit: string
  conditionValue: number
  conditionBaseValue: number
  isStatistics: boolean
  conditionCategory: string
  conditionOrigin: string
  inactiveReason: string
  pricingUnit: number
  pricingQuantityUnit: string
  isBonusBuy: boolean
  bbyNumber: string | null
  isSubtotal: boolean
}
