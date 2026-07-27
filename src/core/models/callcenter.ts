/**
 * The web call-center session API — client-side model of the frozen contract
 * v1.1 (`.issues/assets/136-cc-contract/CONTRACT.md`). The contract is the single
 * source of truth for both tracks; this file is its TypeScript projection and
 * must not add, rename or re-mean a field on its own.
 *
 * Only what slice 0 (ticket 162) renders is typed here in full — `SessionState`,
 * `OpenResult`, and everything `SessionState` transitively holds. The verbs that
 * mutate it arrive with their own tickets; they all return `SessionState`, so
 * this file is what they will already have.
 *
 * Two rules of the contract show up as type shapes and are worth naming:
 *   - **Unknown fields are ignored by rule** (§9). An additive server change is a
 *     minor bump that ships server-first, so these interfaces are deliberately
 *     not exhaustive-by-assertion anywhere.
 *   - **Money is one-way, engine → client** (law 1). Nothing here is an input to
 *     a verb; no verb in the contract accepts an amount.
 */

/** `header.plant` provenance — `derivedFromAddress` is what makes a store the
 *  agent did not choose read as explained rather than arbitrary (135). */
export type PlantSource = 'derivedFromAddress' | 'operatorOverride'

/** v1.1 (§2.2). Both modes are phase 1; the flip never moves the plant. */
export type DeliveryType = 'Delivery' | 'PickInStore'

export type SessionStatus = 'open' | 'submitted' | 'abandoned'

export interface SessionCustomer {
  customerId: string
  name: string
  mobile: string
  loyaltyAttached: boolean
}

export interface SessionAddress {
  addressNumber: string
  label: string
  cityCode: string
  cityName: string
  districtCode: string
  districtName: string
  line: string
}

export interface SessionSlot {
  slotId: string
  from: string
  to: string
  isActive: boolean
}

export interface SessionHeader {
  /** v1.1 — absent on a v1.0 server, which a client renders as `Delivery`. */
  deliveryType?: DeliveryType
  plant: string
  plantName: string
  plantSource: PlantSource
  origin: string
  documentType: string
  register: string
  operatorId: string
  entryStore: string
  openedAt: string
  customer: SessionCustomer | null
  address: SessionAddress | null
  slot: SessionSlot | null
  documentSource: string | null
  sourceReference: string | null
  /** Any line added or re-frozen below availability — the BackOffice fraud signal. */
  hasBelowAtp: boolean
}

/** Availability as **frozen at add** (§2.1) — never live. `known:false` is a
 *  degraded stock read and must never render like a zero. */
export interface AtpAtScan {
  quantity: number | null
  frozenAt: string | null
  known: boolean
}

export interface MoneyPair {
  net: number
  gross: number
}

export interface LineCondition {
  type: string
  description: string
  value: number
  isStatistical: boolean
}

export interface LinePromotion {
  offerId: string
  description: string
  amount: number
}

export interface SessionLine {
  lineId: string
  itemNumber: string
  description: string
  description2: string
  qty: number
  uom: string
  uomOptions: string[]
  unitPrice: MoneyPair
  lineTotal: MoneyPair
  conditions: LineCondition[]
  promotions: LinePromotion[]
  atpAtScan: AtpAtScan
  belowAtpAtScan: boolean
  warnings: string[]
}

export interface DeliveryFee {
  amount: number
  /** An outcome the console shows, never a control (156 — no manual waiver). */
  waived: boolean
  thresholdGross: number
  conditionType: string
}

/** Engine truth. The console never sums `lines` (§2.1). */
export interface SessionTotals {
  net: number
  vat: number
  gross: number
  deliveryFee: DeliveryFee
  payable: number
}

export interface FiredPromotion {
  offerId: string
  description: string
  amount: number
  lineIds: string[]
}

/** §3.2 — why a candidate offer was not evaluated. An unknown category is a
 *  minor-version addition and must degrade, not throw. */
export type SkipReason =
  | 'ORIGIN_FILTERED'
  | 'PLANT_FILTERED'
  | 'VALIDITY_WINDOW'
  | 'CUSTOMER_SEGMENT'
  | 'NOT_DISCOVERED'
  | (string & {})

export interface NearMissPrereq {
  kind: string
  groupingId?: string
  eligibleCount?: number
}

export interface NearMiss {
  offerId: string
  description: string
  isReady: boolean
  progress: { have: number; need: number }
  prereq: NearMissPrereq
  skipReason: SkipReason | null
}

/** §5 — "are you sure" arrives on the SUCCESS path with the UNCHANGED state. */
export interface PendingConfirmation {
  kind: 'storeChange' | 'belowAtp'
  confirmToken: string
  expiresInMs: number
  detail: unknown
}

/** §2 — advisory-but-authoritative. The console never re-implements a server
 *  predicate: a control is disabled because `capabilities` said so. */
export interface SessionCapabilities {
  canAddItem: boolean
  canSubmit: boolean
  canChangeStore: boolean
  canOpenAddressBook: boolean
  /** v1.1 — true whenever `status` is open. */
  canChangeFulfilment?: boolean
  /** Names the reason submit is refused; the console shows it, never derives it. */
  submitBlockers: string[]
}

/** The whole projection the console renders. Every mutating verb returns one. */
export interface SessionState {
  contractVersion: string
  transactionId: string
  /** Engine header version, strictly increasing. A response carrying a LOWER one
   *  than the rendered state is discarded (§2.1) — see `applyState`. */
  version: number
  etag: string
  status: SessionStatus
  replayed: boolean
  header: SessionHeader
  lines: SessionLine[]
  totals: SessionTotals
  firedPromotions: FiredPromotion[]
  nearMisses: NearMiss[]
  pendingConfirmation: PendingConfirmation | null
  capabilities: SessionCapabilities
}

/** §8.1 — the identity of an order the agent already has open. */
export interface ExistingOrder {
  transactionId: string
  customerName: string | null
  lineCount: number
  openedAt: string
  plant: string
}

/**
 * §8.1 — `refusedExisting` is a **choice on the success path**, not a failure:
 * one active order per agent (law 9), and the agent picks resume or
 * abandon-and-open-fresh. Never a silent auto-resume.
 */
export interface OpenResult {
  outcome: 'opened' | 'refusedExisting'
  state: SessionState | null
  existing: ExistingOrder | null
}

/**
 * §8.2 — the answer to `abandon`. **No state comes back**: `VoidTransactionAsync`
 * has run and there is nothing left to render, which is precisely why abandoning
 * must be followed by a decision about what the agent lands on
 * ([163](.issues/163-order-already-open.md) — never nowhere).
 *
 * Coupon reversal rides for free on `CollectReversalContexts()`, server-side.
 * Nothing on this side of the wire reverses anything.
 */
export interface AbandonResult {
  outcome: 'abandoned'
  transactionId: string
}

/**
 * A loyalty member as the door's lookup answers it
 * (`GET CallCenterWeb/MemberByMobile/{mobile}` — BackOffice 801's verbatim
 * delegation to `LoyEndpoints.GetLoyMemberByMobile`, projecting `LoyMemberModel`).
 *
 * 🚩 **This is NOT part of the session contract** — it precedes attach, which is
 * why 801 could not session-scope it. It is how the agent FINDS the caller;
 * `SessionState.header.customer` is what the order actually holds, and where the
 * two could disagree the projection wins. Only what the rail reads is typed: the
 * model carries a dozen more fields (points factors, join date, profile flags)
 * that no console surface has a use for, and unknown fields are ignored by rule.
 */
export interface LoyaltyMember {
  /** The loyalty id — what `attachCustomer` is given as `customerId`. */
  loyId: string
  mobile: string
  fullName: string
  tier: string | null
  pointsBalance: number | null
  email: string | null
}

/** The screen-access probe (134 §6). One boolean; open implies act. */
export interface CallCenterAccessResult {
  canOpenConsole: boolean
}
