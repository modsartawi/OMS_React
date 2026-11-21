/**
 * The price command center's server calls (oms 934–939, BackOffice spec 4127), all through `@/core/api` (`api-envelope`)
 * to the `PriceWatch/*` doors. Wire types in `@/core/models/price-watch`.
 *
 * 🔀 One object per tab, each in its own section in strip order, so the tab tickets landing in parallel each add their
 * own block rather than editing a shared one. The page wraps every call in TanStack Query.
 */
import { api } from '@/core/api'
import type { DismissAlertBody, PriceAlertQuery, PriceAlertView, PriceWatchCoverage } from '@/core/models/price-watch'
import type { AlertScope } from './alerts'
// Feed health (939)
import type { PriceSource, PriceWatchCompetitorSetting, PriceWatchFeedHealth, SetAuthoritativeSourceBody } from '@/core/models/price-watch'
import type { AnalyticsQueryResult, AnalyticsSemanticQuery } from '@/core/models/analytics' // Index (938)
import type { PriceGridPage, PriceGridQuery } from '@/core/models/price-watch' // Grid (935)
// Matching (937)
import type {
  ComparableMatchBody,
  ConfirmByUrlBody,
  ConfirmByUrlResult,
  DiscoveryResult,
  MatchingQueue,
  NotCarriedResult,
  NotTheSameResult,
  PriceWatchMatch,
} from '@/core/models/price-watch'

// ── Shared ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export const priceWatchSharedApi = {
  /** `GET PriceWatch/Matching/Coverage` (View) — one row per competitor: the cheapest competitor list there is. */
  coverage(): Promise<PriceWatchCoverage[]> {
    return api.get<PriceWatchCoverage[]>('PriceWatch/Matching/Coverage')
  },
}

// ── Alerts (934) ───────────────────────────────────────────────────────────────────────────────────────────────────

export const priceAlertsApi = {
  /** `GET PriceWatch/Alerts/Mine` or `GET PriceWatch/Alerts` (View) — ranked by value at risk by the server. */
  list(scope: AlertScope, query: PriceAlertQuery): Promise<PriceAlertView[]> {
    return api.get<PriceAlertView[]>(scope === 'mine' ? 'PriceWatch/Alerts/Mine' : 'PriceWatch/Alerts', { ...query })
  },
  /** `POST PriceWatch/Alerts/{alertId}/Accept` (Manage), no body → the alert as it now stands. */
  accept(alertId: string): Promise<PriceAlertView> {
    return api.post<PriceAlertView>(`PriceWatch/Alerts/${encodeURIComponent(alertId)}/Accept`, {})
  },
  /** `POST PriceWatch/Alerts/{alertId}/Dismiss` (Manage) — WRONG_MATCH also breaks the product match. */
  dismiss(alertId: string, body: DismissAlertBody): Promise<PriceAlertView> {
    return api.post<PriceAlertView>(`PriceWatch/Alerts/${encodeURIComponent(alertId)}/Dismiss`, body)
  },
}

// ── Grid (935) ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const priceGridApi = {
  /** ⚠ GUESSED (BO 4129, not built): `GET PriceWatch/Grid` (View) — one server page of the product grid. */
  page(query: PriceGridQuery): Promise<PriceGridPage> {
    return api.get<PriceGridPage>('PriceWatch/Grid', { ...query })
  },
}

// ── Drill-down (936) ───────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 936)

// ── Matching (937) ─────────────────────────────────────────────────────────────────────────────────────────────────

const candidatePath = (candidateId: string, verb: string) => `PriceWatch/Matching/Candidates/${encodeURIComponent(candidateId)}/${verb}`
const competitorPath = (competitor: string, verb: string) => `PriceWatch/Matching/${encodeURIComponent(competitor)}/${verb}`

export const priceMatchingApi = {
  /** `GET PriceWatch/Matching/{competitor}/Queue?take=` (View) — our sales order, best candidate first. */
  queue(competitor: string, take?: number): Promise<MatchingQueue> {
    return api.get<MatchingQueue>(competitorPath(competitor, 'Queue'), { take })
  },
  /** `POST …/Candidates/{candidateId}/Exact` (Manage), no body. */
  exact(candidateId: string): Promise<PriceWatchMatch> {
    return api.post<PriceWatchMatch>(candidatePath(candidateId, 'Exact'), {})
  },
  /** `POST …/Candidates/{candidateId}/Comparable` (Manage) — an empty body lets the server read both sizes. */
  comparable(candidateId: string, body: ComparableMatchBody = {}): Promise<PriceWatchMatch> {
    return api.post<PriceWatchMatch>(candidatePath(candidateId, 'Comparable'), body)
  },
  /** `POST …/Candidates/{candidateId}/NotTheSame` (Manage), no body. */
  notTheSame(candidateId: string): Promise<NotTheSameResult> {
    return api.post<NotTheSameResult>(candidatePath(candidateId, 'NotTheSame'), {})
  },
  /** `POST PriceWatch/Matching/{competitor}/NotCarried` (Manage) `{ material }`. */
  notCarried(competitor: string, material: string): Promise<NotCarriedResult> {
    return api.post<NotCarriedResult>(competitorPath(competitor, 'NotCarried'), { material })
  },
  /** `POST PriceWatch/Matching/{competitor}/Discovery` (Manage) — per competitor; the server's default `take` (200). */
  discovery(competitor: string): Promise<DiscoveryResult> {
    return api.post<DiscoveryResult>(competitorPath(competitor, 'Discovery'), {})
  },
  /** `POST PriceWatch/Matches/ConfirmByUrl` (Manage) — an exact product match made by a person. */
  confirmByUrl(body: ConfirmByUrlBody): Promise<ConfirmByUrlResult> {
    return api.post<ConfirmByUrlResult>('PriceWatch/Matches/ConfirmByUrl', body)
  },
}

// ── Index (938) ────────────────────────────────────────────────────────────────────────────────────────────────────

export const priceIndexApi = {
  /**
   * `POST Analytics/Query` (gated `Analytics:03`, not PriceWatch) with an inline definition — the price index and the
   * lowest-price score live in Cube (BO 4132). Called from this feature's own api, never through the boards feature's.
   */
  query(query: AnalyticsSemanticQuery): Promise<AnalyticsQueryResult> {
    return api.post<AnalyticsQueryResult>('Analytics/Query', { definition: { chart: { type: 'table' }, query } })
  },
}

// ── Feed health (939) ──────────────────────────────────────────────────────────────────────────────────────────────

export const priceFeedHealthApi = {
  /** `GET PriceWatch/FeedHealth` (View) — shipped; BO 4131's per-source runs and cross-check ride it as optional fields. */
  read(): Promise<PriceWatchFeedHealth> {
    return api.get<PriceWatchFeedHealth>('PriceWatch/FeedHealth')
  },
  /** ⚠ GUESSED (BO 4128): `PUT PriceWatch/Competitors/{competitor}/AuthoritativeSource` (Manage) `{ source }`. */
  setAuthority(competitorCode: string, source: PriceSource): Promise<PriceWatchCompetitorSetting> {
    const body: SetAuthoritativeSourceBody = { source }
    return api.put<PriceWatchCompetitorSetting>(`PriceWatch/Competitors/${encodeURIComponent(competitorCode)}/AuthoritativeSource`, body)
  },
}
