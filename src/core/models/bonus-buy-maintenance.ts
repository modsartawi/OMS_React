/**
 * Wire shapes of the `BbyMaintainWeb` door family (BackOffice spec 2374, tickets 2376–2382).
 *
 * Reconciled at ticket 417 against the SHIPPED DTOs — `BbyMaintainModels.cs` and
 * `BbyMaintainWebEndpoints.cs` in BackOffice (merge 2abd345d5). Ticket 416 had built from the
 * spec's reading (`en`/`ar`, `text`/`status`, `bonusBuyCount`); those names were wrong and are
 * gone. SIS.Api serialises camelCase; dates arrive as `yyyy-MM-ddTHH:mm:ss` local.
 */

/** GET BbyMaintainWeb/Access — the screen grant `BackOfficeScreen[BbyMaintain,03]`. */
export interface BbyMaintainAccessResult {
  screenAllowed: boolean
  /**
   * The tester grant `BackOfficeScreen[BbyMaintain,04]` (spec 2396): Mark Tested is offered only
   * when this is `true`. Spec 2396 reading, reconcile when BackOffice 2397 ships — optional because
   * a server without it must read as "no grant" (fail closed).
   */
  canTest?: boolean
}

/**
 * SAP's `KONBBYH.STATUS` as `BbyHeader.BbyStatus`: blank = Activated, `1` = Planned,
 * `2` = Deactivated, `3` = Tested (spec 2396, ADR 0063 — OMS only). Typed `string` because it is
 * the server's code, read through `overviewStatus` rather than trusted to be one of the four.
 */
export type BbyStatusCode = string

/**
 * The test mark (`BbyTestMark`, spec 2396): who marked a bonus buy Tested, when, and their optional
 * note. Null when untested; Back to Planned clears it. Spec 2396 reading, reconcile when BackOffice
 * 2397 ships: the spec names the fields on GET BonusBuy/{n} and the overview rows, not where they sit.
 */
export interface BbyTestMark {
  testedBy?: string | null
  testedAt?: string | null
  testNote?: string | null
}

/** One row of a promotion's Bonus Buys – Overview grid (`BbyPromotionBonusBuy`), with its test mark. */
export interface BbyOverviewRow extends BbyTestMark {
  bbyNumber: string
  description: string | null
  validFrom: string | null
  validTo: string | null
  bbyStatus: BbyStatusCode | null
}

/**
 * GET Promotion/{number} and each row of GET Promotion/List (`BbyPromotionDocument`): the
 * promotion with its bonus buys. A number that names no promotion is an in-band
 * `status: 'notFound'`, never an HTTP 404.
 */
export interface BbyPromotion {
  status?: 'found' | 'notFound' | string | null
  promoNumber: string
  name: string
  salesFrom: string | null
  salesTo: string | null
  createdBy?: string | null
  createdAt?: string | null
  changedBy?: string | null
  changedAt?: string | null
  bonusBuys: BbyOverviewRow[]
}

/** POST Promotion/Save. No `promoNumber` → the server mints `P` + 9 digits. */
export interface BbyPromotionSave {
  promoNumber: string | null
  name: string
  salesFrom: string
  salesTo: string
}

/**
 * One refusal or warning from the validator (`BbyMaintainMessage`): a stable `BBY-` code
 * plus its text in both languages (spec 2374, "every refusal at once, in English and Arabic").
 */
export interface BbyRefusal {
  code: string
  english: string
  arabic: string
}

/** One bonus buy inside a promotion-level activate/deactivate (`BbyMaintainItemResult`). */
export interface BbyMaintainItemResult {
  number: string
  status: string
  refusals: BbyRefusal[]
  warnings: BbyRefusal[]
}

/** The in-band outcome every write answers with a 200 (`BbyMaintainResult`). `valid` is a
 *  dry run (`BonusBuy/Validate`) that passed. */
export type BbyMaintainStatus = 'saved' | 'valid' | 'refused' | 'deleted' | 'notFound'

export interface BbyMaintainOutcome {
  status: BbyMaintainStatus
  number: string | null
  refusals: BbyRefusal[]
  warnings: BbyRefusal[]
  /** A promotion-level flip only: each bonus buy it flipped, or refused. */
  bonusBuys?: BbyMaintainItemResult[]
}

// ── the editor (ticket 417) ───────────────────────────────────────────────────────────

/** A local material grouping (`BbyGrouping`, SAP's `GRPNR`): an id of at most 12 and its materials. */
export interface BbyGroupingWire {
  id: string
  materials: string[]
}

/** The Engine Rules tab (`BbyEngineRules`): the fields the engine reads and SAP's screen lacks. */
export interface BbyEngineRulesWire {
  includes: string | null
  excludes: string | null
  originFilter: string | null
  stackingExcludes: string | null
  loyGroups: string | null
  loyTiers: string | null
  isStackable: boolean
  maxValue: number
  score: number
  /** `HHmmss`; both or neither. */
  validFromTime: string | null
  validToTime: string | null
}

/** A Buy-panel line (`BbyBuyLine`): a material or a grouping, never both. */
export interface BbyBuyLineWire {
  material: string | null
  grouping: string | null
  quantity: number
  uom: string | null
  discountType?: string | null
}

/** A Get-panel line (`BbyGetLine`). `condNumber` is the read's on a change, null on a new line. */
export interface BbyGetLineWire {
  condNumber: string | null
  material: string | null
  grouping: string | null
  quantity: number
  uom: string | null
  /** `A` From · `B` Up To · `C` Equal. */
  scaleType: string | null
  /** `P` price (VAT-exclusive) · `R` amount · `%` percent. Ignored under a Total Discount. */
  discountType: string | null
  value: number
  requirement?: string | null
}

/** The Get panel's Total Discount (`BbyTotalReward`). */
export interface BbyTotalRewardWire {
  /** Over the whole basket only (an empty Get grid): the read's get-total condition number. */
  condNumber: string | null
  discountType: string | null
  value: number
  requirement?: string | null
}

/**
 * The `BonusBuy/Save` and `BonusBuy/Validate` body, and the `bonusBuy` a read returns
 * (`BbyBonusBuyRequest`). It never carries a typed number: `bbyNumber` and each `condNumber`
 * are only ever the ones a read returned.
 */
export interface BbyBonusBuyWire {
  bbyNumber: string | null
  version: string | null
  promoNumber: string | null
  description: string | null
  validFrom: string | null
  validTo: string | null
  limitNumber: number
  /** Total Minimum Value; 0 = none. */
  minValue: number
  linkCategoryBuy: string | null
  linkCategoryGet: string | null
  engineRules: BbyEngineRulesWire
  /** Null when the Get panel's Total Discount is off. */
  totalDiscount: BbyTotalRewardWire | null
  plants?: string[]
  customerCard?: string | null
  buy: BbyBuyLineWire[]
  get: BbyGetLineWire[]
  groupings: BbyGroupingWire[]
}

/** GET BonusBuy/{number} (`BbyBonusBuyDocument`): the whole bonus buy, SAP read-only, with its test mark. */
export interface BbyBonusBuyDocument extends BbyTestMark {
  status: 'found' | 'notFound' | string
  number: string
  bonusBuy: BbyBonusBuyWire | null
  bbyStatus: BbyStatusCode | null
  /** True for a SAP bonus buy: displayed, copied, never saved. */
  readOnly: boolean
  /** The header's last-written stamp, opaque; a change sends it back. */
  version: string | null
  changedBy: string | null
  changedAt: string | null
}

/**
 * POST BonusBuy/MarkTested (spec 2396, grant `04`). Spec 2396 reading, reconcile when BackOffice
 * 2397 ships. ⚠️ `number`, not the `bbyNumber` the shipped Activate/Deactivate/Delete take: the
 * spec writes it so, and the client sends what the spec says.
 */
export interface BbyMarkTestedRequest {
  number: string
  /** Optional; null when the tester left it blank. `BbyTestMark.Note` is `NVARCHAR(200)`. */
  note: string | null
}

/** POST BonusBuy/BackToPlanned (spec 2396). Spec 2396 reading, reconcile when BackOffice 2398 ships. */
export interface BbyBackToPlannedRequest {
  number: string
}
