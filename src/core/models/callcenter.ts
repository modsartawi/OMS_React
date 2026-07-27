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

/**
 * What the offer GIVES, as facts rather than a phrase — the discount
 * *definition* 130's consequence put on the wire in place of the savings total
 * spec 574 US26 ruled out. The console words it with `@/core/promotions`'
 * rule (ticket 161); nothing here is money and nothing here is a total.
 *
 * 🚩 **Optional and additive** (§9). The frozen v1.1 fixtures do not carry it —
 * `BuildSimulationResult` has the facts, the projection has not been asked for
 * them yet — so the client degrades while it is absent and the server's own
 * `description` carries the card. Same pattern as `AppliedBonusBuy.applications?`.
 */
export interface NearMissDiscount {
  /** The clean discount code — `N` / `%` / `R` / `P` (taxonomy 040). */
  discountType?: string | null
  /** What the code says it is: a PERCENTAGE for `%`, an amount for `R`/`P`, a
   *  free quantity for `N`. 🚩 Never money, whatever the kind — the unit rides
   *  the code, which is the defect ticket 161 ended. */
  value?: number | null
  /** How many pieces a set price covers (`2 PC for 29.95` → 2). */
  quantity?: number | null
  /** Which piece free goods land on (`3rd free`). */
  nthFree?: number | null
}

export interface NearMiss {
  offerId: string
  description: string
  isReady: boolean
  progress: { have: number; need: number }
  /** `null` where the offer was never evaluated — fixture 03's `NOT_DISCOVERED`
   *  entry carries no prerequisite at all, because nothing loaded it. */
  prereq: NearMissPrereq | null
  skipReason: SkipReason | null
  discount?: NearMissDiscount | null
}

/**
 * One item that would satisfy a near-miss's prerequisite, as
 * `GET CallCenterWeb/ResolvePrereq` answers it (CONTRACT.md §3.3).
 *
 * 🚩 **The set is the server's, ranked and ATP-filtered at the order's plant** —
 * rows with no availability are not returned, and `atp: null` is a degraded
 * stock read on a 200 rather than a zero (the same rule the item search follows).
 * Nothing client-side re-ranks or re-filters this, and nothing slices it: the
 * handful the card shows is `topN`, server-side (138 finding 1).
 *
 * Field names are the resolution's own — `itemNumber` / `description` /
 * `description2`, not the item search's `materialNumber` / `descriptionEn` /
 * `descriptionAr`. Two reads, two projections; the console maps one onto the
 * other rather than pretending the wire agrees with itself.
 */
export interface PrereqItem {
  /** What `addItem` is given. The client sends an item number and a quantity,
   *  and never a price (law 1). */
  itemNumber: string
  description: string
  /** The Arabic name. It rides the row's **meta line** (138's ruling), which is
   *  what made carrying it cost zero pixels. Nullable: the master has rows with
   *  none. */
  description2: string | null
  /** 🚩 Not money — the material-master estimate, before VAT, exactly as the
   *  search row's is (135 amendment 1). It never enters a money column. */
  estimatePriceExVat: number | null
  /** Availability at the ORDER's plant. `null` = unknown, distinct from `0`. */
  atp: number | null
}

/**
 * `GET CallCenterWeb/ResolvePrereq?transactionId=&offerId=` (CONTRACT.md §3.3) —
 * the **on-demand** half of the guidance surface.
 *
 * 🚩 **Never inline.** Resolving every near-miss on every add would pay a
 * grouping expansion plus a stock read per keystroke, to populate cards the agent
 * mostly never opens. 🚩 And never on `Bby/*` — this read lives on the
 * call-center door, which is what keeps 134's one-grant ruling true.
 */
export interface PrereqResolution {
  offerId: string
  /** The prerequisite the items satisfy — the same block the near-miss carries. */
  prereq: NearMissPrereq | null
  /** The ranked, availability-filtered handful. `eligibleCount` on the near-miss
   *  is the population this is the top of; the difference is the route to the
   *  rest (`Search the other 994`). */
  items: PrereqItem[]
  /** The population had more rows than the cap returned. */
  truncated: boolean
  /** The server's cap. Read as data — the console never slices `items` itself. */
  topN: number
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

/**
 * One entry of the caller's address book, as the door's read answers it
 * (`GET CallCenterWeb/CustomerAddresses` — BackOffice 801's session-scoped
 * sibling of `SdDocument/CustomerAddresses`, projecting `CustomerAddressBookModel`).
 *
 * 🚩 **Not part of the session contract** — like the loyalty lookup, it is how the
 * agent CHOOSES; `SessionState.header.address` is what the order actually holds,
 * and where the two could disagree the projection wins. Only what the picker
 * reads is typed: the model carries GPS, phones, postal codes and timestamps that
 * no console surface has a use for, and unknown fields are ignored by rule.
 */
export interface AddressBookAddress {
  cityCode: string
  cityName: string | null
  districtCode: string
  districtName: string | null
  street1: string | null
  street2: string | null
  buildingNumber: string | null
}

export interface CustomerAddressBookEntry {
  addressNumber: string
  labelCode: string | null
  labelNameEn: string | null
  isDefault: boolean
  /** The address proper. Nullable because the wire model nests it and a book row
   *  with no address behind it is a data fault, not a crash. */
  address: AddressBookAddress | null
}

/** The screen-access probe (134 §6). One boolean; open implies act. */
export interface CallCenterAccessResult {
  canOpenConsole: boolean
}

/**
 * One catalogue row as `GET CallCenterWeb/ItemSearch` answers it (BackOffice
 * [799](C:\Work\DMSCO\BackOffice\.issues\799-cc-item-search-endpoint.md)).
 *
 * 🚩 **Not part of the session contract**, like the loyalty and address-book
 * reads: it is how the agent FINDS an item, and `SessionState.lines` is what the
 * order actually holds. Only what a search row renders is typed — the wire also
 * carries six merchandising categories (`otcList`, `brand`, `salesCategory3`,
 * `materialType`, `materialStatus`, `materialGroup`) that no console surface has
 * a use for, and unknown fields are ignored by rule (§9).
 *
 * 🚩 **`estimatePriceExVat` is not money.** It is `Item.UnitPrice`, a
 * material-master column served as an estimate BEFORE VAT, and because VAT is a
 * separate 15% condition it reads ~13% under the basket line beside it. The wire
 * field is named so the omission cannot be silent, and the console's whole job
 * with it is to keep it out of the money register (135 amendment 1) — which is
 * `item-search.ts`'s, not a component's.
 *
 * 🚩 **`atp: null` is UNKNOWN, and never a zero.** A degraded stock read
 * degrades to `null` on every row with `atpAvailable: false`, on a 200 — never a
 * non-200 (map note 8, preserving 287's rule). They are opposite decisions for
 * the agent, so nothing may collapse one onto the other.
 */
export interface ItemSearchRow {
  /** What `addItem` is given. The client sends an item number and a quantity,
   *  and never a price (map note 3 / law 1). */
  materialNumber: string
  descriptionEn: string
  /** The Arabic name — `Item.Description2`, which WPF never searched or showed.
   *  Nullable: the master has rows that carry none. */
  descriptionAr: string | null
  estimatePriceExVat: number | null
  /** Availability at the ORDER's plant. `null` = unknown, distinct from `0`. */
  atp: number | null
}

/**
 * `GET CallCenterWeb/ItemSearch?transactionId=&query=` (CONTRACT.md §1.1).
 *
 * **No paging by design.** An agent scanning results at call pace retypes rather
 * than pages, and keyset paging over a relevance-ordered set is unstable under
 * re-ranking — so the answer is a cap plus `truncated`, and the console's
 * affordance for it is *narrow your search*, never *next page*.
 */
export interface ItemSearchResult {
  /** The underlying match had more rows than the cap returned. */
  truncated: boolean
  /** `false` ⇒ the stock service failed and EVERY row's `atp` is `null`. The
   *  search still succeeded: unknown availability never gates order entry. */
  atpAvailable: boolean
  rows: ItemSearchRow[]
}
