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
// (lands with 935)

// ── Drill-down (936) ───────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 936)

// ── Matching (937) ─────────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 937)

// ── Index (938) ────────────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 938)

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
