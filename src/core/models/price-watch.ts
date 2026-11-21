// The PriceWatch web doors (BackOffice spec 4127 — the price command center; oms tickets 934–939).
//
// Read from BackOffice `pricing2` on 2026-11-21: `Services/SIS.Api/Endpoints/PriceWatch/PriceWatchWebEndpoints.cs` and
// `Sartawi.Retail.Data/Modules/PriceWatch/` (services, `Data/*.cs` code constants, `PriceWatchErrorCodes.cs`).
// `PriceWatch/` prefix, cookie auth; every GET behind `BackOfficeScreen[PriceWatch, 03]` (View), every write behind
// `[PriceWatch, 06]` (Manage) — a missing grant is a BARE 403. JSON is camelCase. A refusal is HTTP 400, `success:false`,
// an English-only `message` and a `PWT-xxxxx` code in `errors[0].errorCode`. Stamps are local KSA wall-clock
// `yyyy-MM-ddTHH:mm:ss(.fffffff)`, no offset; a non-nullable DateTime carries `0001-01-01T00:00:00` for "never".
// Money is VAT-inclusive, with `currency` beside it.
//
// 🔀 One section per tab ticket, in strip order, so the tickets landing in parallel each add their own block:
//   Shared · Alerts (934) · Grid (935) · Drill-down (936) · Matching (937) · Index (938) · Feed health (939).
// A contract not yet shipped by BackOffice goes in its own block headed `⚠ GUESSED (BO 41xx)`.

// ── Shared ─────────────────────────────────────────────────────────────────────────────────────────────────────────

// Refusal codes: each tab declares its own `PRICE_<TAB>_ERRORS` in its section (no shared map to merge into).

/**
 * `GET PriceWatch/Matching/Coverage` row (all ints, unbroken matches only). Shared: the alert filter (934) reads it as the
 * competitor list, the Matching tab (937) as coverage. Declared once, here.
 */
export interface PriceWatchCoverage {
  competitorCode: string
  competitorName: string
  watched: number
  exact: number
  comparable: number
  notCarried: number
  open: number
}

// ── Alerts (934) ───────────────────────────────────────────────────────────────────────────────────────────────────

/** The `PWT-` refusal codes the Alerts tab reads by name (`PriceWatchErrorCodes.cs`). */
export const PRICE_ALERT_ERRORS = {
  /** Bad `status` filter on the alert list. */
  alertStatusUnknown: 'PWT-00030',
  /** Accept / Dismiss: no such price alert. */
  alertUnknown: 'PWT-00034',
  /** Accept / Dismiss: the price alert is no longer OPEN. */
  alertNotOpen: 'PWT-00035',
  /** Dismiss: the reason is missing or unknown. */
  dismissReasonRequired: 'PWT-00036',
  /** Dismiss: OTHER needs a note. */
  dismissNoteRequired: 'PWT-00037',
  /** Accept / Dismiss: the price alert moved since it was read — reload and decide again. */
  alertChanged: 'PWT-00040',
} as const

/** A price alert's state (`PriceWatchAlertStatuses`); all but RESOLVED are live. */
export type PriceAlertStatus = 'OPEN' | 'ACCEPTED' | 'DISMISSED' | 'RESOLVED'

/** The list's `status` query (`live` default, case-insensitive; else PWT-00030). */
export type PriceAlertListStatus = 'live' | 'resolved' | 'all'

/** A dismissal's reason (`PriceWatchDismissReasons`). WRONG_MATCH also breaks the product match; OTHER needs a note. */
export const DISMISS_REASONS = ['WRONG_MATCH', 'FLASH_SALE', 'STRATEGIC', 'OTHER'] as const
export type DismissReason = (typeof DISMISS_REASONS)[number]

/** A dismissal note's ceiling (`PwPriceAlertEvent.Widths.Note`). */
export const DISMISS_NOTE_MAX = 500

/**
 * One price alert (`PriceWatchAlertView`). ⚠ No product title, brand or B-level is on this wire (BO ask, 934 Comments).
 *
 * 🔑 Sign: `gapAmount` and `gapPercent` are POSITIVE when the competitor is cheaper (ours − theirs) — the OPPOSITE sense
 * to the drill-down's comparison `gapPercent` (negative = competitor cheaper). The client keeps each wire's own sense and
 * names it at the point of display; never mix the two in one figure.
 */
export interface PriceAlertView {
  alertId: string
  materialNumber: string
  competitorCode: string
  matchId: string
  listingId: string
  status: PriceAlertStatus
  isLive: boolean
  /** A-level (`ItemInfo.ACode`), '' when none. */
  categoryCode: string
  thresholdPercent: number
  currency: string
  ourBasicPrice: number
  ourEffectivePrice: number
  ourPriceDay: string
  theirRegularPrice: number
  theirOfferPrice: number | null
  /** `theirOfferPrice ?? theirRegularPrice`. */
  theirPrice: number
  sellerName: string
  observedAt: string
  previousObservedAt: string | null
  /** ours − theirs per unit: positive = the competitor is cheaper. */
  gapAmount: number
  /** gapAmount ÷ ourEffectivePrice × 100, 2 dp: positive = the competitor is cheaper. */
  gapPercent: number
  thirtyDayUnits: number
  unitsSource: string
  /** gapAmount × thirtyDayUnits — the list is ranked by it. */
  valueAtRisk: number
  /** The lowest alertable competitor price and its competitor. NOT floored: never a profitability verdict. */
  recommendedPrice: number
  recommendedFrom: string
  /** `NOT_SET` only until BO 3507 → the recommended price reads "awaiting cost". */
  floorStatus: string
  /** Server English literal ("floor not set") — never displayed. */
  floorText: string
  openedAt: string
  updatedAt: string
  resolvedAt: string | null
  /** `GAP_CLOSED` | `MATCH_BROKEN` | '' while live. */
  resolvedReason: string
  /** 0 = never dismissed. */
  dismissedAtGapPercent: number
  /** Mine list only, else ''. */
  categoryManager: string
  /** Mine list only, else ''. */
  ownerUserId: string
}

/** `GET PriceWatch/Alerts[/Mine]` query — every field optional; `buildQuery` drops blanks. */
export interface PriceAlertQuery {
  status?: PriceAlertListStatus
  competitor?: string
  /** A-level code, exact. */
  category?: string
  /** 1..500, server default 100. No paging, no total. */
  take?: number
}

/** `POST PriceWatch/Alerts/{alertId}/Dismiss` body. */
export interface DismissAlertBody {
  reason: DismissReason
  note: string
}

// ── Grid (935) ─────────────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 935)

// ── Drill-down (936) ───────────────────────────────────────────────────────────────────────────────────────────────

/** The `PWT-` refusal codes the material drill-down reads by name (`PriceWatchErrorCodes.cs`). */
export const PRICE_DRILLDOWN_ERRORS = {
  /** Comparison: blank material. */
  materialRequired: 'PWT-00001',
  /** Break: no such product match. */
  matchUnknown: 'PWT-00025',
  /** Break: the product match is already broken. */
  matchAlreadyBroken: 'PWT-00026',
} as const

/** How a product match pairs our material with a listing (`PriceWatchMatchKinds`, ⚠ PascalCase). */
export type PriceMatchKind = 'Exact' | 'Comparable'
/** Who made a product match (`PriceWatchMatchMadeBy`). */
export type PriceMatchMadeBy = 'Barcode' | 'Person'
/** A comparable match's per-unit basis (`PriceWatchUnits`); '' on an exact match. */
export type PerUnitBasis = '' | 'g' | 'ml' | 'piece'

/** A competitor price's source (BO 4128, ⚠ GUESSED codes from the ticket text). */
export const PRICE_SOURCES = ['SCRAPER', 'MINDSITE'] as const
export type PriceSource = (typeof PRICE_SOURCES)[number]

/**
 * `GET PriceWatch/Materials/{material}/Comparison` (View) — our price today at the reference store, and one side per
 * UNBROKEN product match. Shipped fields as read from `PriceWatchComparisonService.cs`; the optional ones are BO 4128's.
 */
export interface PriceWatchComparison {
  material: string
  /** Default '1001'. */
  referenceStore: string
  pricedAt: string
  isPriced: boolean
  unpricedReason: string
  currency: string
  /** Ours, one unit at the reference store, today (live engine). */
  basicPrice: number
  effectivePrice: number
  /** One per unbroken product match, by competitor code then matched-at; [] when none. */
  competitors: PriceWatchCompetitorSide[]
  /** ⚠ GUESSED (BO 4128): our price per day, from `PwEffectivePrice`. Absent on a pre-4128 server. */
  ourHistory?: OurPriceDay[]
}

/** One competitor's side of the comparison: its LATEST observation (authoritative source only) and the product match. */
export interface PriceWatchCompetitorSide {
  competitorCode: string
  competitorName: string
  matchKind: PriceMatchKind
  madeBy: PriceMatchMadeBy
  listingUrl: string
  listingTitle: string
  hasPrice: boolean
  regularPrice: number | null
  offerPrice: number | null
  observedAt: string | null
  sellerName: string
  isPlatformSeller: boolean
  inStock: boolean
  /** No price within StaleAfterHours (36 by default). */
  isStale: boolean
  /** The listing page is gone (404/410). */
  isGone: boolean
  /**
   * (theirs − ourEffective) ÷ ourEffective × 100, 1 dp, per unit on a comparable match.
   * 🔑 NEGATIVE = the competitor is cheaper — the OPPOSITE sense to the price alert's `gapPercent`. Read it only through
   * the drill-down's `comparisonGap`, which names the cheaper side.
   */
  gapPercent: number | null
  /** Exact matches only. */
  mayAlert: boolean
  perUnitBasis: PerUnitBasis
  /** 4 dp, comparable only. */
  ourPricePerUnit: number | null
  theirPricePerUnit: number | null
  // ⚠ GUESSED (BO 4128) — not on the wire today (no history, no match id, no who/when). Optional so a pre-4128 server
  // reads as "no history, no Break" rather than a crash. Reconcile against BO 4128 as shipped.
  /** The product match's id, for Break. */
  matchId?: string
  matchedByUser?: string
  /** Wall-clock stamp; a year-1 stamp means none. */
  matchedAt?: string
  /** The competitor's authoritative price source. */
  authoritativeSource?: PriceSource
  /** The source of the latest authoritative observation (the current price). */
  source?: PriceSource
  /** Every observation in the window, from both sources. */
  history?: PriceObservation[]
}

/** ⚠ GUESSED (BO 4128): one competitor price observation, with its source. */
export interface PriceObservation {
  priceId: string
  observedAt: string
  source: PriceSource
  isAuthoritative: boolean
  regularPrice: number | null
  offerPrice: number | null
  sellerName: string
  inStock: boolean
}

/** ⚠ GUESSED (BO 4128): our price on one day. */
export interface OurPriceDay {
  priceDay: string
  isPriced: boolean
  basicPrice: number | null
  effectivePrice: number | null
}

/**
 * `POST PriceWatch/Matches/{matchId}/Break` (Manage) answer — the `MatchWire` (`PriceWatchMatchService.cs`). Breaking
 * closes the pair's live price alert (MATCH_BROKEN) and sends the material back to matching. Refusals PWT-00025/00026.
 */
export interface BrokenMatchWire {
  matchId: string
  materialNumber: string
  listingId: string
  competitorCode: string
  matchKind: PriceMatchKind
  madeBy: PriceMatchMadeBy
  matchedByUser: string
  matchedAt: string
  /** '' for a barcode or URL match. */
  candidateId: string
  ourSizeValue: number
  ourSizeUnit: string
  theirSizeValue: number
  theirSizeUnit: string
  mayAlert: boolean
  isBroken: boolean
  brokenBy: string
  /** Year-1 while unbroken. */
  brokenAt: string
}

// ── Matching (937) ─────────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 937)

// ── Index (938) ────────────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 938)

// ── Feed health (939) ──────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 939)
