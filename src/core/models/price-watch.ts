// The PriceWatch web doors (BackOffice spec 4127 — the price command center; oms tickets 934–939).
//
// Read from BackOffice `pricing2` on 2026-11-21: `Services/SIS.Api/Endpoints/PriceWatch/PriceWatchWebEndpoints.cs` and
// `Sartawi.Retail.Data/Modules/PriceWatch/` (services, `Data/*.cs` code constants, `PriceWatchErrorCodes.cs`).
// Reconciled 2026-11-22 to BO pricing2 merge `d099aac36` (tickets 4128–4132 + review fixes `16164d170`): the grid door
// (`PriceWatchGridService.cs`), the comparison's source + history, the authority door
// (`PriceWatchSourceAuthorityService.cs`), feed health per source + cross-check, and the Cube members. Only BO 4135
// (MINDSITE candidate origin, not built) is still GUESSED.
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
// `GET PriceWatch/Grid` (View) — BO 4129 as shipped (`PriceWatchGridService.cs`, d099aac36). One row per watched
// material (top sellers, additions and — 4130 — live exact matches), every competitor a column in code order (or only the
// `competitor` filtered on). Read only. A cell takes ONLY the competitor's authoritative source, and only an EXACT match
// prices it. A cell COUNTS (cheapest mark, "cheaper" filter, gap) when PRICED, priced, fresh and PLATFORM-SOLD.

/** The `PWT-` refusal codes the Grid tab reads by name (`PriceWatchErrorCodes.cs`). */
export const PRICE_GRID_ERRORS = {
  /** Unknown competitor code in the `competitor` filter. */
  competitorUnknown: 'PWT-00003',
  /** The sort is not UNITS or GAP (BO 4129). */
  gridSortUnknown: 'PWT-00070',
} as const

/** A competitor cell's state (`PriceWatchGridCellStates`). Stale is a flag beside it, not a state. */
export const PRICE_GRID_CELL_STATES = ['PRICED', 'OOS', 'NOT_CARRIED', 'NO_MATCH', 'COMPARABLE_ONLY'] as const
export type PriceGridCellState = (typeof PRICE_GRID_CELL_STATES)[number]

/**
 * The grid's sort (`PriceWatchGridSorts`: `UNITS` | `GAP`). The server trims and upper-cases what it is sent, so the
 * lower-case spelling is accepted as is; its answer echoes the upper-case code in `sort`.
 */
export const PRICE_GRID_SORTS = ['units', 'gap'] as const
export type PriceGridSort = (typeof PRICE_GRID_SORTS)[number]

/** One grid column: a competitor, in the server's column order. (No `kind` on this wire.) */
export interface PriceGridCompetitor {
  competitorCode: string
  competitorName: string
  isEnabled: boolean
  /** The only source whose prices fill this column. */
  authoritativeSource: PriceSource
}

/** One competitor's cell in a row. Prices are the authoritative source's only. */
export interface PriceGridCell {
  competitorCode: string
  state: PriceGridCellState
  /** The live match's listing; '' when there is none (NOT_CARRIED, NO_MATCH). */
  listingUrl: string
  /** offer ?? regular. OOS keeps its LAST price here; NOT_CARRIED / NO_MATCH / COMPARABLE_ONLY carry null. */
  paidPrice: number | null
  regularPrice: number | null
  offerPrice: number | null
  /** (regular − offer) ÷ regular × 100, 1 dp; null without an offer. */
  offerPercent: number | null
  sellerName: string
  /** false = a marketplace third party: shown with its seller, but it never counts. */
  isPlatformSeller: boolean
  inStock: boolean
  /** The latest authoritative observation; null when there is none. */
  observedAt: string | null
  /** When the price SHOWN was observed — `observedAt`, or earlier for an OOS cell showing its last price. */
  priceObservedAt: string | null
  /** The latest authoritative observation is older than the stale window, or there is none. */
  isStale: boolean
  /** The cheapest counting price of the row (ours takes part through `row.isOurCheapest`); a tie marks every tied cell. */
  isCheapest: boolean
  /** (paid − our effective) ÷ our effective × 100, 1 dp. NEGATIVE = the competitor is cheaper. */
  gapPercent: number | null
  /** The source of the price shown (always the authoritative one); '' with no price. */
  source: PriceSource | ''
}

/** One watched material. */
export interface PriceGridRow {
  materialNumber: string
  title: string
  brand: string
  aLevel: string
  aLevelName: string
  bLevel: string
  bLevelName: string
  /** Our latest priced night (14-day lookback) at the reference store; false = no price. */
  isPriced: boolean
  priceDay: string | null
  currency: string
  basicPrice: number | null
  effectivePrice: number | null
  dealText: string
  appliedDealText: string
  /** Our net units over the 30 days before today (the alerts' window). */
  units30: number
  /** OUR price is the (tied-)cheapest of the row, against at least one counting cell. */
  isOurCheapest: boolean
  /** A counting competitor is cheaper than our effective price. */
  competitorIsCheaper: boolean
  /** The most negative counting gap; null when nobody counts. */
  widestGapPercent: number | null
  /** One per `competitors[]` entry, same order; read by `competitorCode`, never by position. */
  cells: PriceGridCell[]
}

/** `GET PriceWatch/Grid` answer: one page of rows, the column order, and the total. */
export interface PriceGridPage {
  readAt: string
  referenceStore: string
  staleAfterHours: number
  /** The sort applied, upper-case (`UNITS` | `GAP`). */
  sort: string
  page: number
  pageSize: number
  /** Rows after the filters, across every page. */
  total: number
  competitors: PriceGridCompetitor[]
  rows: PriceGridRow[]
}

/** `GET PriceWatch/Grid` query — blanks are dropped by `buildQuery`. Filters are exact, case-insensitive. */
export interface PriceGridQuery {
  aLevel?: string
  bLevel?: string
  brand?: string
  competitor?: string
  /** true = only rows where a counting competitor is cheaper than our effective price. */
  competitorCheaper?: boolean
  sort: PriceGridSort
  /** 1-based; ≤ 0 = 1. */
  page: number
  /** 1..200; ≤ 0 = 50. */
  pageSize: number
}

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

// A competitor price's source (BO 4128, `PriceWatchSources`): `PRICE_SOURCES` / `PriceSource` are declared once, in the Feed health section (939).

/**
 * `GET PriceWatch/Materials/{material}/Comparison` (View) — our price today at the reference store, and one side per
 * UNBROKEN product match (`PriceWatchComparisonService.cs`, BO 4128 as shipped at d099aac36).
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
  /**
   * ⚠ NOT PROVIDED by BO pricing2 d099aac36: 4128 shipped no history of OUR price (only today's `basicPrice` /
   * `effectivePrice` above). Kept optional so a later BO door lights the chart's our-price lines; absent today.
   */
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
  // BO 4128 (shipped): the current price above (regular / offer / observedAt / gap / stale) is the AUTHORITATIVE
  // source's latest observation only; the history carries every source, labelled.
  /** The competitor's authoritative price source. */
  authoritativeSource: PriceSource
  /** The source of the current price shown; '' when the authoritative source has no observation. */
  source: PriceSource | ''
  /** The listing's observations from EVERY source over the last 30 days, latest first, at most 100. */
  history: PriceObservation[]
  // ⚠ NOT PROVIDED by BO pricing2 d099aac36: the side carries no product-match id and no who/when (4128 did not add
  // them), so the drill-down cannot Break a match nor say who made it. Kept optional so a later BO change lights them
  // up; absent today → the Break column says "no match id" and who/when is blank. A BO ask.
  /** The product match's id, for Break. */
  matchId?: string
  matchedByUser?: string
  /** Wall-clock stamp; a year-1 stamp means none. */
  matchedAt?: string
}

/** One competitor price observation in a side's history, with the source that read it (`PriceWatchObservation`). */
export interface PriceObservation {
  observedAt: string
  regularPrice: number | null
  offerPrice: number | null
  sellerName: string
  isPlatformSeller: boolean
  inStock: boolean
  source: PriceSource
  /** The source is the competitor's authoritative one: only these count (alerts, index, current price). */
  isAuthoritative: boolean
}

/** Our price on one day — ⚠ NOT PROVIDED by BO pricing2 d099aac36 (see `ourHistory`). */
export interface OurPriceDay {
  priceDay: string
  isPriced: boolean
  basicPrice: number | null
  effectivePrice: number | null
}

/**
 * `POST PriceWatch/Matches/{matchId}/Break` (Manage) answer — the `MatchWire` (`PriceWatchMatchService.cs`). Breaking
 * closes the pair's live price alert (MATCH_BROKEN) and sends the material back to matching. Refusals PWT-00025/00026.
 * The wire is declared once, as the Matching section's `PriceWatchMatch` (937).
 */
export type BrokenMatchWire = PriceWatchMatch

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
// No PriceWatch door: the Index tab reads Cube through `POST Analytics/Query` (gated `BackOfficeScreen[Analytics, 03]`),
// so its wire types are `AnalyticsSemanticQuery` / `AnalyticsQueryResult` (`@/core/models/analytics`).
// BO 4132 as shipped (d099aac36; Cube image build + release still the owner's): view `price_index` (flipped, unit
// `share`, 1.10 = index 110) and view `price_lowest_score` — see `features/analytics/price-command-center/index-tab.ts`.

/** The `ANALYTICS-` refusals the Index tab reads by name (the Analytics query door, not `PriceWatchErrorCodes.cs`). */
export const PRICE_INDEX_ERRORS = {
  /** A member the model does not hold (e.g. the lowest-price score before the 4132 image): the definition is refused. */
  definitionInvalid: 'ANALYTICS-406',
  /** The area is not loaded on this server yet. */
  areaUnavailable: 'ANALYTICS-410',
} as const

// ── Feed health (939) ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The `PWT-` refusal codes the Feed health tab reads by name (`PriceWatchErrorCodes.cs`; the authority door, BO 4128).
 */
export const PRICE_FEED_HEALTH_ERRORS = {
  /** Authority change: no such competitor. */
  competitorUnknown: 'PWT-00003',
  /** Authority change: the source is not SCRAPER or MINDSITE. */
  sourceUnknown: 'PWT-00050',
} as const

/** A competitor price's source (`PriceWatchSources`, BO 4128): our scraper or Mindsite. */
export const PRICE_SOURCES = ['SCRAPER', 'MINDSITE'] as const
export type PriceSource = (typeof PRICE_SOURCES)[number]

/** A scrape run's pass (`PriceWatchPassKinds`). */
export type ScrapePassKind = 'DAILY' | 'INTRADAY' | 'MANUAL'

/** One scrape run (`PriceWatchRunSummary`): a competitor's `lastRun` and each entry of its `lastRunBySource`. */
export interface FeedRunSummary {
  scrapeRunId: string
  passKind: ScrapePassKind | string
  passSlotAt: string | null
  startedAt: string
  /** null = still running. */
  finishedAt: string | null
  listingsRead: number
  pricesWritten: number
  failures: number
  listingsGone: number
  isBlocked: boolean
  blockReason: string
  /** BO 4131: the source that ran the pass (a blank stored source reads SCRAPER). */
  source: PriceSource
  /** BO 4131: why the pass ended badly (e.g. a Mindsite quota or auth refusal); '' when it did not. */
  errorMessage: string
}

/**
 * One competitor on `GET PriceWatch/FeedHealth` (`PriceWatchFeedHealthService.cs`). ⚠ No door clears a block (the
 * scraper / an operator clears it in the database) — the tab shows the block and its reason only.
 */
export interface FeedHealthCompetitor {
  competitorCode: string
  name: string
  /** `pharmacy` | `marketplace` (free text in the DB). */
  kind: string
  isEnabled: boolean
  isBlocked: boolean
  blockedAt: string | null
  blockReason: string
  blockClearedAt: string | null
  blockClearedBy: string
  matchedListings: number
  staleListings: number
  goneListings: number
  /** The latest run of any source. */
  lastRun: FeedRunSummary | null
  /** BO 4131: the one source whose prices count for this competitor. */
  authoritativeSource: PriceSource
  /** BO 4131: the latest run of each source that EVER ran here, ordered by source; a source that never ran is absent. */
  lastRunBySource: FeedRunSummary[]
  /** BO 4131: where the two sources disagree on this competitor's exact matches. */
  crossCheck: FeedCrossCheck
}

/** `GET PriceWatch/FeedHealth` (View). */
export interface PriceWatchFeedHealth {
  at: string
  staleAfterHours: number
  competitors: FeedHealthCompetitor[]
  /** BO 4131: two sources' paid prices differing by MORE than this % of the authoritative one count as a disagreement. */
  crossCheckMarginPercent: number
  /** BO 4131: the nightly effective-price job's last run on or before today; null = never ran. */
  effectivePriceJob: EffectivePriceJobRun | null
}

/** One exact match whose two sources disagreed above the margin (`PriceWatchCrossCheckExample`). */
export interface FeedCrossCheckExample {
  materialNumber: string
  listingId: string
  /** The latest day both sources read it, inside the stale window. */
  day: string
  scraperPaidPrice: number
  mindsitePaidPrice: number
  /** |scraper − Mindsite| as a % of the AUTHORITATIVE source's paid price, 2 dp. */
  differencePercent: number
}

/** Where the two sources disagree at one competitor (`PriceWatchCrossCheck`): platform-sold, fresh, same-day readings. */
export interface FeedCrossCheck {
  /** Exact matches both sources read fresh on the same day. */
  compared: number
  disagreements: number
  /** At most 20, widest first. */
  examples: FeedCrossCheckExample[]
}

/** The nightly effective-price job's last run (`PriceWatchJobRunSummary`). */
export interface EffectivePriceJobRun {
  runId: string
  runDay: string
  referenceStore: string
  startedAt: string
  finishedAt: string | null
  isFinished: boolean
  /** The watched count (4130's match-only materials included). */
  materials: number
  priced: number
  unpriced: number
  failures: number
  durationSeconds: number
  hasError: boolean
  errorMessage: string
}

/** `PUT PriceWatch/Competitors/{competitor}/Authority` (Manage) body (BO 4128; case and spaces ignored). */
export interface SetAuthoritativeSourceBody {
  source: PriceSource
}

/**
 * A competitor's authority (`PriceWatchCompetitorAuthority`): the answer of the PUT above and each row of
 * `GET PriceWatch/Competitors/Authority` (View). `setAt` is year-1 when nobody ever changed it.
 */
export interface PriceWatchCompetitorAuthority {
  competitorCode: string
  competitorName: string
  isEnabled: boolean
  authoritativeSource: PriceSource
  setBy: string
  setAt: string
}
