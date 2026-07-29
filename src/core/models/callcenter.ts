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
   * v1.6 (§3.4) — **`canAddItem`'s own predicate**: a caller attached AND a store
   * somebody chose (§2.3), projected under its own name because it gates a
   * different surface — the *about this item* panel.
   *
   * 🚩 It is the gate on **quoting**, and that is a sharper thing than the gate
   * on adding. A price check is read out loud with no basket line beside it to
   * correct it, so quoting at a store nobody chose
   * ([797](C:\Work\DMSCO\BackOffice\.issues\797-resume-drops-pcheader-plant.md)'s
   * seeded plant) is a silent wrong price the caller acts on. Absent on a pre-1.6
   * server, and the console reads it **strictly** — no panel rather than a panel
   * quoting from a store nobody picked.
   */
  canPriceCheck?: boolean
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
 * The body of `POST CallCenterWeb/SignUpByBranch` — the caller who is not a
 * member yet, as contract §6.6 narrows the request (190).
 *
 * 🚩 **`branchId` is absent by construction.** The server writes it to the
 * member's `CreatedByBranchId` permanently and onto every member-action row, and
 * the validator does not require it — so a browser that could name the branch
 * could credit any pharmacy in the estate with an enrolment. The call centre's
 * own store code is stamped server-side, exactly as `CountryKey` / `LanguageKey`
 * / `AddressType` are stamped on the address capture.
 *
 * 🚩 **`mobile` is what the agent TYPED**, un-normalised. CC2 builds the enrolled
 * number itself out of a country list compiled into the WPF client; re-doing that
 * here would put one rule in two clients over the value the loyalty base is keyed
 * on. `signup-view.ts`'s `mobilePreview` is a display line and never this field.
 *
 * `preferredLanguage` is deliberately not sent: 132 ruled the form to two fields
 * and no more, and the server's own default is the honest answer to a question
 * the agent was never asked.
 */
export interface LoyaltySignupCapture {
  countryCode: string
  mobile: string
}

/** The body of `POST CallCenterWeb/ConfirmSignUpByBranch` — the same two values,
 *  plus the code the caller read back down the phone. Same two omissions, for
 *  the same two reasons. */
export interface LoyaltySignupConfirmCapture extends LoyaltySignupCapture {
  otp: string
}

/**
 * One entry of the caller's address book, as the door's read answers it
 * (`GET CallCenterWeb/CustomerAddresses` — BackOffice 801's session-scoped
 * sibling of `SdDocument/CustomerAddresses`, projecting `CustomerAddressBookModel`).
 *
 * 🚩 **Not part of the session contract** — like the loyalty lookup, it is how the
 * agent CHOOSES; `SessionState.header.address` is what the order actually holds,
 * and where the two could disagree the projection wins. Only what the picker and
 * the editor read is typed: the model nests a whole 25-field `BusinessAddress`,
 * and the postal codes, names and timestamps on it have no console surface —
 * unknown fields are ignored by rule.
 *
 * 🚩 The five fields below the composed line are here because **187's editor
 * seeds an edit from this row**. They are not drawn on the picker's list, and
 * the two GPS values are not drawn anywhere at all: they are round-tripped
 * because the service assigns them unconditionally, so an edit that dropped them
 * would write `0` over a real fix (BackOffice 878's one named gap).
 */
export interface AddressBookAddress {
  cityCode: string
  cityName: string | null
  districtCode: string
  districtName: string | null
  street1: string | null
  street2: string | null
  buildingNumber: string | null
  /** The DELIVERY phone — the driver's number, never the loyalty mobile. */
  phone1: string | null
  phone2: string | null
  /** The Saudi National Address, `^[A-Z]{4}[0-9]{4}$`. Format-only, unverified. */
  shortAddress: string | null
  gpsLat: number | null
  gpsLon: number | null
}

/**
 * The body of both address writes — `POST` (mints an `addressNumber`) and `PUT`
 * (names one), as BackOffice 878 §1's `CallCenterWebAddressCapture` takes it.
 *
 * 🚩 Exactly CC2's twelve captured values plus the label. `CountryKey`,
 * `LanguageKey` and `AddressType` are **stamped server-side** and are absent
 * here by construction — a client that can send `AddressType` can send `"B"`.
 *
 * 🚩 Every string is required and `''` is a real value: `UpdateCustomerAddress`
 * is a null-coalescing merge, so an omitted field is PRESERVED and a field can
 * never be emptied by omission. `address-capture.ts` is the only place this
 * shape is built.
 */
export interface CustomerAddressCapture {
  labelCode: string
  address: {
    cityCode: string
    cityName: string
    districtCode: string
    districtName: string
    street1: string
    street2: string
    buildingNumber: string
    phone1: string
    phone2: string
    shortAddress: string
    gpsLat: number
    gpsLon: number
  }
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
  /** Always `'C'` — the call-centre category IS the filter the server applies. */
  documentSourceCategory: string
  /**
   * 🚩 **The agent's own default, flagged on the row rather than named beside the
   * list** — so it cannot name a source the picker has no option for.
   *
   * Two tables answer this route, and conflating them is what left the picker
   * empty for every agent in the estate: `SdDocumentSource` (category `'C'`) is
   * what may be CHOSEN, `SdDocumentSourceUser` is what is chosen FOR them. At
   * most one row carries the flag — that table is keyed by user id alone — and
   * for an agent with no row of their own, none do.
   *
   * It is a **pre-selection, not a lock**: it seeds the form when the order names
   * no source yet, and the agent may still pick another. CC2 instead collapses
   * the list to the configured row; whether the web should too is an open ruling
   * (BackOffice, owner 2026-07-29), and locking is additive to this shape.
   */
  isDefault: boolean
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

/**
 * One offer on a price-checked item (§3.4). It is a `NearMiss` **minus its
 * prerequisite**: a one-item pricing run knows what the offer needs in the
 * aggregate (`progress`) but has no basket to name a prerequisite against, so
 * there is no `prereq` block and the panel offers no add.
 *
 * 🚩 **No `wouldSave`, and nothing here is money.** Same promise language as the
 * guidance strip (138): the discount *definition*, `progress`, `isReady`. The
 * offers region can guarantee it holds no figure formatted as money absolutely,
 * because it holds no engine money at all (§3.4 rule 6).
 */
export interface PriceCheckOffer {
  offerId: string
  /** The offer's own words, server text — passed through, never re-worded. It is
   *  the one field here that may legitimately contain a currency word (`"2 PC for
   *  29.95 SR"` is in this repo's own captures), which is why the no-money rule is
   *  asserted in its narrow form. */
  description: string
  isReady: boolean
  progress: { have: number; need: number }
  skipReason: SkipReason | null
  /**
   * ⚠ **Not on §3.4's shape, and not in fixture 12.** It is the same optional,
   * additive block `NearMiss.discount` is (§9), carried here because the offers
   * region is the guidance strip's own projection and a definition is what a card
   * says an offer GIVES. While the wire sends none — which is today — every card
   * degrades to the server's `description` as its headline, exactly as the strip
   * already does. It is a PROPOSAL to the contract, not something it promises.
   */
  discount?: NearMissDiscount | null
}

/**
 * `GET CallCenterWeb/PriceCheck?transactionId=&itemNumber=` (CONTRACT.md §3.4,
 * v1.6) — **what an item costs, without adding it.**
 *
 * 🚩 **It is engine money, and that is the whole point.** `unitPrice.gross` comes
 * from a real pricing run at the ORDER's own plant, origin, customer and loyalty,
 * VAT-inclusive, at quantity one — so it is §2.1 money, rendered in a money column
 * with `SAR`, and it **equals the basket line's `unitPrice.gross`** for the same
 * item under the same header. Adding the item must never contradict what the
 * agent just said out loud.
 *
 * 🚩 **It is not `ItemSearchRow.estimatePriceExVat`, and must never silently
 * become it.** The estimate reads ~13% under what the caller pays; a price check
 * exists to be READ OUT LOUD, with no basket line beside it to correct it. A
 * pricing failure is therefore a typed refusal (`ITEM_NOT_FOUND`,
 * `ITEM_NOT_SELLABLE`, `NO_PRICE_AT_PLANT`, `NO_CUSTOMER_ATTACHED`,
 * `STORE_NOT_CHOSEN` — no new codes), never a fall back to the estimate. The two
 * numbers coexist on one screen and never swap places (168's spatial rule).
 *
 * 🚩 **It takes no claim.** Like `getState` this is a pure read, priced in a
 * throwaway context that is never persisted — so it cannot collide with the
 * agent's own basket and never queues behind the 15-second lease (§6.1). It is the
 * only read on this contract with that property, and it is why *"how much is
 * that?"* never pauses order entry.
 *
 * 🚩 **The request carries `transactionId` and `itemNumber` and nothing else** —
 * no quantity (always one unit, owner ruling), no plant, no sales org, no
 * condition. Map note 4 is enforced by the wire having no other field, which is
 * also why `Pricing/Simulate` may not be reused: its body carries manual
 * conditions and a sales org that would beat the plant's.
 */
export interface PriceCheckResult {
  contractVersion: string
  itemNumber: string
  description: string
  /** The Arabic name. Nullable: the master has rows with none. */
  description2: string | null
  uom: string
  /** WHERE it was priced — the order's own fulfilment store, never a plant the
   *  client asked for. `plantName` is what the panel says out loud. */
  plant: string
  plantName: string
  pricedAt: string
  /** ENGINE money, quantity one. §2.1's rules apply to `gross`. */
  unitPrice: MoneyPair
  /** The conditions behind that price — the store price and VAT as separate
   *  things, exactly as a basket line carries them. */
  conditions: LineCondition[]
  offers: PriceCheckOffer[]
  /**
   * 🚩 **130's blindness, made visible.** A one-item pricing run of a *"buy X get
   * Y"* whose X is the priced item never loads the promotion at all — BBY lookup
   * keys on the condition-side access tables — so this is `false` until BackOffice
   * 787-C lands and the panel says *offers were not fully checked* rather than
   * letting silence read as *no offer exists*. It flips to `true` with **no client
   * change**.
   */
  offersComplete: boolean
}

/**
 * One store that can supply the item, on `StockElsewhereResult` (§3.5, v1.7).
 *
 * 🚩 **`atp` is the search row's own definition** — `UnrestrictedPos − active
 * orders (11 days)`, one formula, one source. The WPF till's grid shows on-hand
 * in the adjacent column; this contract carries ATP alone, because two
 * availability numbers read down a phone is how the larger one gets promised.
 */
export interface StockElsewhereStore {
  plant: string
  city: string
  areaName: string
  address: string
  atp: number
  /**
   * 🚩 **`null` is a value, never a missing store.** The origin plant or this row
   * may have no coordinate; the store still appears and its distance draws blank.
   * A store is never omitted for want of a coordinate, and `0` is never written
   * here to stand for *unknown*.
   */
  distanceKm: number | null
}

/**
 * `GET CallCenterWeb/StockElsewhere?transactionId=&itemNumber=` (CONTRACT.md
 * §3.5, v1.7) — **who else has this item.**
 *
 * 🚩 **A separate call from `priceCheck`, and that is the design.** The price is a
 * lock-free engine run inside SIS.Api's own process; this is the only read on the
 * whole contract that is a **remote HTTP hop out of SIS.Api**. Different failure
 * modes, different budgets — so the two share the *about this item* panel and the
 * `canPriceCheck` gate, and **fail independently**: a stock outage must not cost
 * the agent the price they asked for.
 *
 * 🚩 **Read-only by ruling, not omission.** No field here moves the order. A store
 * change re-prices every line, re-freezes every ATP and refuses atomically — a
 * blast radius that cannot live inside a per-item disclosure — and the list is
 * ranked *from* the order's plant, so a one-click rebind would invalidate the list
 * it was clicked from. The store moves through `setStore` and §5.1's confirm, and
 * the panel may name that path in words.
 */
export interface StockElsewhereResult {
  contractVersion: string
  itemNumber: string
  /** The order's own plant — excluded from `stores`, because its number is
   *  already on the search row and one number belongs in one place. */
  originPlant: string
  /**
   * 🚩 **`false` ⇒ the whole list is honestly unranked.** The origin plant has no
   * coordinate, so every `distanceKm` is `null` and the order is by store code —
   * never a plausible ranking measured from `(0,0)`, a fiction this estate
   * already refuses by name.
   */
  distanceKnown: boolean
  /**
   * 🚩 **`false` means UNKNOWN, never empty.** The stock hop did not answer, so
   * `stores` is `[]` and means *we could not check* — which the console must
   * render differently from *nobody has it* (135's three-way ATP rule).
   */
  available: boolean
  /** Nearest first (or by code, unranked), `atp <= 0` dropped, own plant
   *  excluded, capped at 10. */
  stores: StockElsewhereStore[]
  /** The honest total with stock BEFORE the cap. */
  withStock: number
  /** `withStock > stores.length`. */
  truncated: boolean
}
