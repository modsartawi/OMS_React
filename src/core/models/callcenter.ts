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

/**
 * `header.plant` provenance — `derivedFromAddress` is what makes a store the
 * agent did not choose read as explained rather than arbitrary (135).
 *
 * v1.3 (§2.3) added the two ends: `seededAtOpen` is the one value that means
 * **nobody chose this**, and `chosenForPickup` is `setStore` under
 * `PickInStore`. Exactly one of the four shuts the item gate.
 */
export type PlantSource =
  | 'seededAtOpen'
  | 'derivedFromAddress'
  | 'operatorOverride'
  | 'chosenForPickup'

/**
 * v1.4 (§2.4) — how the money will be collected. **Not a tender**: nothing is
 * paid on the console; `Online` tells OMS to send the caller a gateway link.
 *
 * `Receivable` is **reserved** — no phase-1 path produces or accepts it. It is
 * named so the day the business wants it is a data change rather than a §9
 * major, and a client that never receives it is never wrong.
 */
export type PaymentType = 'CashOnDelivery' | 'Online' | 'Receivable'

/** v1.5 (§2.5) — which branch of the fee policy fell away. Non-null exactly
 *  when `waived` is true. An unknown category degrades (§9), never throws. */
export type WaivedReason =
  | 'ThresholdReached'
  | 'PromotionalWindow'
  | 'ConfiguredOverride'
  | (string & {})

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
  /** v1.4 — absent on a pre-1.4 server, which a client renders as the default
   *  the order actually carries there (`CashOnDelivery`, §2.4). */
  paymentType?: PaymentType
  /** v1.4 — `null` while the agent may choose; a typed code when the server has
   *  decided for them. 🚩 **`null` on every phase-1 order** (§2.4): the forcing
   *  rule is a *kind* rule and every forcing kind is out of scope. */
  paymentTypeForcedReason?: string | null
  /** v1.3 — CC2's `OrderNote`. Free text, never price-affecting. */
  orderNote?: string | null
  /**
   * v1.8 (176) — the LABEL of the address the sidecar is holding while the order
   * collects. Non-null only under `PickInStore`, and only where an address was
   * ever picked.
   *
   * 🚩 **The label, never the address.** It is not a field the agent acts on and
   * not one they read to the caller — it exists so that *switching back to
   * delivery may move the store* is a thing the agent already knows when the
   * confirmation arrives. Shipping the whole address here would be a second copy
   * of PII on a projection that deliberately dropped it.
   */
  retainedAddressLabel?: string | null
  /**
   * v1.10 (159) — the coupons the order holds.
   *
   * 🚩 **The map's one verb with no projection.** `applyCoupon` shipped in v1.0
   * and the server built it end-to-end, but the only coupon-aware line in the
   * whole `SessionState` projection is the one that HIDES it: the `COUP` voucher
   * line is dropped from `lines[]` (correctly — its money is already flattened
   * onto the product line, and two lines for one discount is worse). Nothing
   * replaced it, so an applied coupon moved the totals and named itself nowhere.
   * The agent could only discover one by applying it again and reading
   * `COUPON_ALREADY_APPLIED`.
   *
   * An ARRAY, not a field: the engine holds a list (`_coupons`) and the server's
   * duplicate check is per-code, so a second, different code is accepted today.
   * A single-valued field would have been a client-side rule about the engine.
   *
   * Empty on an order with none — never `null`, so the chip's own emptiness is
   * the only *not set* this has to draw.
   */
  coupons?: AppliedCoupon[]
  /** Any line added or re-frozen below availability — the BackOffice fraud signal. */
  hasBelowAtp: boolean
}

/**
 * v1.10 (159) — one redeemed coupon, as the engine and the coupon service
 * between them know it.
 */
export interface AppliedCoupon {
  /** The code the agent typed, as the coupon service accepted it. Server-supplied
   *  text — passed through as data, never worded by the console. */
  code: string
  /** The campaign's own description, when the engine has one. Null is ordinary:
   *  the console then shows the code alone rather than an invented phrase. */
  description: string | null
  /**
   * The coupon-attributed slice of the basket's discount — `PromotionCouponDiscount`
   * summed over the lines carrying this code, negative like every other discount.
   *
   * 🚩 It is engine money and it stays OUT of the chip row. The owner ruled the
   * coupon a chip rather than a receipt row, so this draws inside the chip's own
   * modal and nowhere else; the receipt keeps reporting the engine's totals
   * exactly as it did before, with no coupon line of its own.
   */
  amount: number
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
  /**
   * v1.5 — **why** it fell away. 🚩 The console must never infer this by
   * comparing `gross` against `thresholdGross`: that is the client recomputing a
   * server rule, and it is wrong the day `ConfiguredOverride` becomes reachable.
   * Absent (pre-1.5 server) degrades to the bare word, which is v1.4's behaviour.
   */
  waivedReason?: WaivedReason | null
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
  /**
   * `material` · `grouping` · `condition` — and, PROPOSED at v1.10 (159),
   * **`coupon`**.
   *
   * 🚩 That fourth kind exists because capture 02 already contains the hole.
   * Its near-miss is `T173 COUPON-GATED BBY`, `have 0 / need 1`, with
   * `kind: "material", materialNumber: "COUPT173"` — a **coupon SKU**, the
   * campaign material `AddCouponAsync` scans. Drawn as an ordinary material
   * prerequisite it becomes *add 1 more* with 172's one-click add behind it,
   * and `BonusBuySession.Prepare` filters only `!IsDeleted` — there is no
   * line-type filter on prerequisite matching, and `IsCoupon` is read solely
   * for attribution (`SetCouponAttribution`) and the stacking carve-out. So a
   * plain `addItem("COUPT173")` qualifies the same bonus buy a redeemed coupon
   * does, while burning nothing at the coupon service: the discount is given
   * away for free.
   *
   * (It may instead be REFUSED — a zero-priced coupon SKU trips the no-price
   * scan back-out, which is the very thing `AddCouponAsync` bypasses by forcing
   * a manual-condition line. Then the guidance strip is offering an add that
   * always fails. Which of the two happens depends on whether the campaign SKU
   * carries a price; both are wrong, and neither is a thing the console should
   * be offering.)
   *
   * A client cannot tell a coupon SKU from any other material — that is server
   * knowledge — so the kind has to come down the wire.
   */
  kind: string
  groupingId?: string
  eligibleCount?: number
  /** The prerequisite material, where the wire names one. */
  materialNumber?: string
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
  /** v1.1 — true whenever `status` is open. 🚩 …and false when the order's
   *  `documentSource` is delivery-only (`DocumentSourcePolicyService`'s
   *  `SupportsPickInStore`) — the one rule in phase 1 that can shut this axis. */
  canChangeFulfilment?: boolean
  /** v1.4 — open AND `paymentTypeForcedReason == null` (§2.4). */
  canChangePaymentType?: boolean
  /** v1.3 — the one-click *Yes, collect here*, `PickInStore` only (§2.3). */
  canConfirmSeededStore?: boolean
  /**
   * v1.10 (159) — **the same predicate as `canAddItem`**, and for a sharper
   * reason than symmetry.
   *
   * `applyCoupon` redeems before it adds, and the redemption is stamped with
   * `storeCode: scope.Plant` in the coupon service's own ledger — permanently.
   * 129 ruled a plant rebind a *documented non-event* for coupons (the `"C"`
   * re-price keeps the line, the sticky `C000` origin keeps the template
   * matching), which is true of the ORDER and false of the ledger row: the burn
   * does not move. So redeeming against a store the agent has not chosen yet
   * (175's `seededAtOpen`) writes a real coupon against a store the order will
   * not ship from. Gating on `canAddItem`'s predicate closes it, and makes the
   * caller — whose id the redeemer also sends — always known.
   */
  canApplyCoupon?: boolean
  /**
   * v1.10 (159) — open AND the order holds at least one coupon.
   *
   * 🚩 The removal is NOT `voidLine`: the voucher line is not on the wire, and
   * the void alone would strand the burn. See `removeCoupon` — reverse first,
   * void only if the reverse landed (issue 211's rule, which the till already
   * defends).
   */
  canRemoveCoupon?: boolean
  /**
   * 🚩 **PROPOSED, ticket 176 — not on the frozen contract.** Why a `can*` above
   * is false, keyed by its own name (`canChangeFulfilment`), valued as a typed
   * code the client words. [153](.issues/153-console-keyboard-grammar.md) named
   * this as the tidier answer to the same problem from the palette's side and
   * deliberately did not mint it; 176 needs it for exactly one live rule, so it
   * is drawn here to be argued from.
   *
   * The alternative is a per-capability sibling field (`fulfilmentLockedReason`),
   * which is one field per rule forever.
   */
  capabilityReasons?: Record<string, string>
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
 * §8.3 — the answer to `submit`, and the only place an order number exists.
 *
 * 🚩 **Both outcomes are successes and mean the same thing.** Once-only is
 * `(OrderNo, DocumentType)` with `OrderNo := TransactionId`, so a second submit
 * of the same transaction answers `alreadySubmitted` carrying the FIRST order
 * number — and the server still completes the local tail on that path (133).
 * `outcome` is therefore server-side provenance and **not a client branch**: any
 * code that makes the two look different to the agent is the defect
 * ([174](.issues/174-placing-the-order.md)). `submit-outcome.ts` is where that
 * stops being a convention.
 *
 * `refused` and `unavailable` are the error path (§7), not values of this field.
 */
export interface SubmitResult {
  outcome: 'submitted' | 'alreadySubmitted'
  /** The order number the agent reads to the caller — carried on BOTH successes
   *  (the replay's is the first submit's). */
  documentNo: string
  /** The order as at submit — `status: 'submitted'` (law 2, like every verb). */
  state: SessionState | null
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

/**
 * One document source the AGENT may use, as `GET CallCenterWeb/MyDocumentSources`
 * answers it (BackOffice 801's session-scoped sibling of
 * `SdDocument/DocumentSourceUsers/{userId}`, projecting `DocumentSourceModel`).
 *
 * 🚩 **It takes no user id.** The original reads a client-supplied `userId` off
 * the path, which on a per-agent door would let any agent read any other agent's
 * source list — browser-supplied identity is exactly what the cookie branch
 * exists to distrust (137's second deliberate break with *delegates verbatim*).
 * So there is nothing to pass, and nothing the console could pass that would
 * widen what it may read: the sources offered are the agent's own, derived from
 * the session.
 *
 * 🚩 **Not part of the session contract** — like the loyalty and address-book
 * reads, it is how the agent CHOOSES; `SessionState.header.documentSource` is
 * what the order actually holds, and where the two could disagree the projection
 * wins.
 */
export interface AgentDocumentSource {
  /** The code `setDocumentSource` is given, and what the header holds. */
  documentSource: string
  description: string
  documentSourceCategory: string
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
