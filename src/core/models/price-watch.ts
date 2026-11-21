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
//
// ⚠ GUESSED (BO 4129) — the product grid door is NOT built yet. Shape guessed from the BO 4129 ticket text and the
// existing PriceWatch DTO style (camelCase, string code enums, `PWT-` codes, null stamps), per the 4127 contract notes.
// Reconcile owed once 4129 ships: route, paging spelling (`page`/`pageSize` vs `skip`/`take`), cell keying, and field
// names are all guesses. Nothing here has met a live server.

/** The `PWT-` refusal codes the Grid tab reads by name. GUESSED: 4129 adds none we know of; the shared ones apply. */
export const PRICE_GRID_ERRORS = {
  /** Unknown competitor code in the `competitor` filter. */
  competitorUnknown: 'PWT-00003',
} as const

/** A competitor cell's state (BO 4129 ticket text, exact codes). Stale is a flag beside it, not a state. */
export const PRICE_GRID_CELL_STATES = ['PRICED', 'OOS', 'NOT_CARRIED', 'NO_MATCH', 'COMPARABLE_ONLY'] as const
export type PriceGridCellState = (typeof PRICE_GRID_CELL_STATES)[number]

/** A price's source (BO 4128): the scraper or Mindsite. */
export type PriceWatchSource = 'SCRAPER' | 'MINDSITE'

/** The grid's sort: our trailing-30-day units (default) or the widest gap first. */
export const PRICE_GRID_SORTS = ['units', 'gap'] as const
export type PriceGridSort = (typeof PRICE_GRID_SORTS)[number]

/** One grid column: a competitor, in the server's column order. */
export interface PriceGridCompetitor {
  competitorCode: string
  name: string
  /** `pharmacy` | `marketplace` (free text in the DB). A marketplace cell names its seller. */
  kind: string
  authoritativeSource: PriceWatchSource
}

/** One competitor's cell in a row. Prices are the authoritative source's only. */
export interface PriceGridCell {
  competitorCode: string
  state: PriceGridCellState
  /** offer ?? regular. OOS keeps its LAST price here; NOT_CARRIED / NO_MATCH / COMPARABLE_ONLY carry null. */
  paidPrice: number | null
  regularPrice: number | null
  offerPrice: number | null
  /** (regular − offer) ÷ regular × 100. */
  offerPercent: number | null
  sellerName: string
  isPlatformSeller: boolean
  inStock: boolean
  observedAt: string | null
  /** No price within the stale window (36 h default). */
  isStale: boolean
  /** The (tied-)cheapest price of the row — ours takes part through `row.isCheapest`. */
  isCheapest: boolean
  /** Comparison sense: NEGATIVE = the competitor is cheaper. */
  gapPercent: number | null
  source: PriceWatchSource
}

/** One watched material. */
export interface PriceGridRow {
  materialNumber: string
  title: string
  brand: string
  aLevel: string
  bLevel: string
  currency: string
  basicPrice: number | null
  effectivePrice: number | null
  isPriced: boolean
  dealText: string
  appliedDealText: string
  thirtyDayUnits: number
  /** OUR price is the (tied-)cheapest of the row. */
  isCheapest: boolean
  widestGapPercent: number | null
  /** One per `competitors[]` entry; read by `competitorCode`, never by position. */
  cells: PriceGridCell[]
}

/** `GET PriceWatch/Grid` answer: one page of rows, the column order, and the total. */
export interface PriceGridPage {
  total: number
  page: number
  pageSize: number
  competitors: PriceGridCompetitor[]
  rows: PriceGridRow[]
}

/** `GET PriceWatch/Grid` query — blanks are dropped by `buildQuery`. */
export interface PriceGridQuery {
  aLevel?: string
  bLevel?: string
  brand?: string
  competitor?: string
  /** true = only rows where a competitor's authoritative paid price is below our effective price. */
  competitorCheaper?: boolean
  sort: PriceGridSort
  /** 1-based. */
  page: number
  pageSize: number
}

// ── Drill-down (936) ───────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 936)

// ── Matching (937) ─────────────────────────────────────────────────────────────────────────────────────────────────
// The product-matching doors (BO 3501, shipped): `Matching/{competitor}/Queue`, the candidate decisions, `NotCarried`,
// `Discovery`, `Matches/ConfirmByUrl`. Coverage is the shared `PriceWatchCoverage` above.

/** The `PWT-` refusal codes the Matching tab reads by name (`PriceWatchErrorCodes.cs`). */
export const PRICE_MATCHING_ERRORS = {
  /** Confirm by URL / Not carried: blank material. */
  materialRequired: 'PWT-00001',
  /** Confirm by URL: not an absolute https URL of at most 800 characters. */
  urlInvalid: 'PWT-00002',
  /** Unknown competitor code. */
  competitorUnknown: 'PWT-00003',
  /** The listing is already matched to another material (break that product match first). */
  listingAlreadyMatched: 'PWT-00004',
  /** No such candidate. */
  candidateUnknown: 'PWT-00020',
  /** The candidate was already decided — the queue moved since it was read. */
  candidateClosed: 'PWT-00021',
  /** The material already holds an unbroken product match at that competitor. */
  materialAlreadyMatched: 'PWT-00022',
  /** The material is marked not carried at that competitor. */
  materialNotCarried: 'PWT-00023',
  /** Comparable needs both sizes in comparable units (g / ml / piece). */
  sizesNotComparable: 'PWT-00024',
} as const

/** Confirm by URL: the URL's ceiling (`PWT-00002`). */
export const MATCH_URL_MAX = 800

/** Our side of a queued material. `imageUrl` is always '' today (no product images on our side). */
export interface MatchingOurSide {
  title: string
  brand: string
  sizeValue: number
  sizeUnit: string
  imageUrl: string
  barcodes: string[]
  basicPrice: number | null
  effectivePrice: number | null
  currency: string
  priceDay: string | null
}

/**
 * ⚠ GUESSED (BO 4135) — a candidate's origin. Codes mirror the price-source codes; a pre-4135 server sends no origin at
 * all, which reads as the scraper's. A less likely spelling is `candidateOrigin`; both are read.
 */
export type MatchingCandidateOrigin = 'SCRAPER' | 'MINDSITE'

/** One competitor listing offered for a material, best rank first. */
export interface MatchingCandidate {
  candidateId: string
  rank: number
  listingId: string
  url: string
  title: string
  brand: string
  sizeText: string
  sizeValue: number
  sizeUnit: string
  imageUrl: string
  barcodes: string[]
  regularPrice: number | null
  offerPrice: number | null
  currency: string
  observedAt: string | null
  sellerName: string
  isPlatformSeller: boolean
  inStock: boolean
  foundAt: string
  /** ⚠ GUESSED (BO 4135): absent until 4135 ships. */
  origin?: string
  /** ⚠ GUESSED (BO 4135): the less likely spelling of `origin`. */
  candidateOrigin?: string
}

/** One material in the queue, in our sales order. `candidates: []` = discovery found none (confirm a URL instead). */
export interface MatchingQueueItem {
  materialNumber: string
  salesRank: number
  netSalesValue: number
  isAddition: boolean
  ours: MatchingOurSide
  candidates: MatchingCandidate[]
}

/** `GET PriceWatch/Matching/{competitor}/Queue?take=` (View). `open` counts every open material, not just this page. */
export interface MatchingQueue {
  competitorCode: string
  competitorName: string
  open: number
  items: MatchingQueueItem[]
}

/** A product match (`MatchWire`) — the answer to Exact, Comparable and Break. `brokenAt` is year-1 while unbroken. */
export interface PriceWatchMatch {
  matchId: string
  materialNumber: string
  listingId: string
  competitorCode: string
  matchKind: 'Exact' | 'Comparable'
  madeBy: 'Barcode' | 'Person'
  matchedByUser: string
  matchedAt: string
  candidateId: string
  ourSizeValue: number
  ourSizeUnit: string
  theirSizeValue: number
  theirSizeUnit: string
  mayAlert: boolean
  isBroken: boolean
  brokenBy: string
  brokenAt: string
}

/** `POST …/Candidates/{candidateId}/Comparable` optional body: omitted / ≤ 0 = the server reads the sizes itself. */
export interface ComparableMatchBody {
  ourSizeValue?: number
  ourSizeUnit?: string
  theirSizeValue?: number
  theirSizeUnit?: string
}

/** `POST …/Candidates/{candidateId}/NotTheSame` answer. */
export interface NotTheSameResult {
  candidateId: string
  materialNumber: string
  competitorCode: string
  listingId: string
  outcome: 'NOT_SAME'
  outcomeBy: string
  outcomeAt: string
}

/** `POST PriceWatch/Matching/{competitor}/NotCarried` answer (idempotent: keeps the first mark). */
export interface NotCarriedResult {
  materialNumber: string
  competitorCode: string
  markedBy: string
  markedAt: string
}

/** `POST PriceWatch/Matching/{competitor}/Discovery` answer — how many materials were asked of the scraper. */
export interface DiscoveryResult {
  requested: number
}

/** `POST PriceWatch/Matches/ConfirmByUrl` body. */
export interface ConfirmByUrlBody {
  material: string
  competitorCode: string
  url: string
}

/** `POST PriceWatch/Matches/ConfirmByUrl` answer (idempotent for the same material). */
export interface ConfirmByUrlResult {
  matchId: string
  materialNumber: string
  listingId: string
  competitorCode: string
  matchKind: 'Exact'
  madeBy: 'Person'
}

// ── Index (938) ────────────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 938)

// ── Feed health (939) ──────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 939)
