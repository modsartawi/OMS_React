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

// ---- request (SimulateRequest, bound verbatim by the endpoint) --------------

/** Header inputs feeding the engine's procedure determination. Empty loyalty
 *  fields go as `null`; a blank `pricingDate` lets the engine use "now". */
export interface SimulateHeaderInput {
  plant: string
  salesOrganization: string
  distributionChannel: string
  pricingDate: string
  documentPricingProcedureKey: string
  loyId: string | null
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
}

export interface SimulationResult {
  header: SimulationResultHeader
  items: SimulationResultItem[]
}
