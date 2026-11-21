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
// (lands with 936)

// ── Matching (937) ─────────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 937)

// ── Index (938) ────────────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 938)

// ── Feed health (939) ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The `PWT-` refusal codes the Feed health tab reads by name. ⚠ `sourceUnknown` is GUESSED (BO 4128 not shipped):
 * the authority door's "source is SCRAPER or MINDSITE" refusal.
 */
export const PRICE_FEED_HEALTH_ERRORS = {
  /** Authority change: no such competitor. */
  competitorUnknown: 'PWT-00003',
  /** ⚠ GUESSED (BO 4128): the source is not SCRAPER or MINDSITE. */
  sourceUnknown: 'PWT-00050',
} as const

/** A scrape run's pass (`PriceWatchPassKinds`). */
export type ScrapePassKind = 'DAILY' | 'INTRADAY' | 'MANUAL'

/** One scrape run, as `GET PriceWatch/FeedHealth` sends a competitor's `lastRun` (shipped). */
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
}

/**
 * One competitor on `GET PriceWatch/FeedHealth` (shipped: `PriceWatchFeedHealthService.cs`). ⚠ No door clears a block
 * (the scraper / an operator clears it in the database) — the tab shows the block and its reason only.
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
  /** The latest run of any source. A pre-4131 server says nothing of its source. */
  lastRun: FeedRunSummary | null
  // ⚠ GUESSED (BO 4131) — optional, so today's FeedHealth still renders:
  authoritativeSource?: PriceSource
  runsBySource?: FeedSourceRuns[]
  crossCheck?: FeedCrossCheck
}

/** `GET PriceWatch/FeedHealth` (View). */
export interface PriceWatchFeedHealth {
  at: string
  staleAfterHours: number
  competitors: FeedHealthCompetitor[]
  // ⚠ GUESSED (BO 4131) — optional:
  /** Two sources disagreeing above this many percent on one exact match and day count against the competitor. */
  crossCheckMarginPercent?: number
  /** The nightly effective-price job's last run (`PwPriceJobRun` of kind EFFECTIVEPRICE); null = never ran. */
  effectivePriceJob?: EffectivePriceJobRun | null
}

// ⚠ GUESSED (BO 4128 / 4131) ───────────────────────────────────────────────────────────────────────────────────────
// Read off the BO ticket text and the shipped DTO style (camelCase, string codes, null stamps); nothing live yet. A
// reconcile ticket diffs this block against the shipped doors.

/** A competitor price's source (BO 4128): our scraper or Mindsite. */
export const PRICE_SOURCES = ['SCRAPER', 'MINDSITE'] as const
export type PriceSource = (typeof PRICE_SOURCES)[number]

/** A run as `runsBySource` sends it: the shipped summary plus its error and whether it was a quota or auth refusal. */
export interface FeedSourceRun extends FeedRunSummary {
  errorMessage: string
  isQuotaOrAuthError: boolean
}

/** One source's latest run at one competitor; null = that source never ran there. */
export interface FeedSourceRuns {
  source: PriceSource
  lastRun: FeedSourceRun | null
}

/** One material whose two sources disagreed above the margin. */
export interface FeedCrossCheckExample {
  materialNumber: string
  day: string
  scraperPaidPrice: number
  mindsitePaidPrice: number
  differencePercent: number
}

/** Where the two sources disagree at one competitor (≤ 20 examples). */
export interface FeedCrossCheck {
  disagreements: number
  examples: FeedCrossCheckExample[]
}

/** The nightly effective-price job's last run. */
export interface EffectivePriceJobRun {
  runId: string
  runDay: string
  referenceStore: string
  startedAt: string
  finishedAt: string | null
  isFinished: boolean
  /** The watched count. */
  materials: number
  priced: number
  unpriced: number
  failures: number
  durationSeconds: number
  hasError: boolean
  errorMessage: string
}

/** `PUT PriceWatch/Competitors/{competitor}/AuthoritativeSource` (Manage) body — ⚠ GUESSED route and body (BO 4128). */
export interface SetAuthoritativeSourceBody {
  source: PriceSource
}

/** The competitor setting the authority door answers with — ⚠ GUESSED (BO 4128). */
export interface PriceWatchCompetitorSetting {
  competitorCode: string
  name: string
  kind: string
  isEnabled: boolean
  authoritativeSource: PriceSource
  authoritativeSourceChangedBy: string
  authoritativeSourceChangedAt: string | null
}
