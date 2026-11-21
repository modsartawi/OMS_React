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
// Drill-down (936)
import type { BrokenMatchWire, PriceWatchComparison } from '@/core/models/price-watch'

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

export const priceDrillDownApi = {
  /**
   * `GET PriceWatch/Materials/{material}/Comparison` (View) — our price and one side per unbroken product match.
   * ⚠ GUESSED (BO 4128): the history, match id and who/when ride this door as optional fields; a pre-4128 server
   * answers without them. PWT-00001 on a blank material.
   */
  comparison(material: string): Promise<PriceWatchComparison> {
    return api.get<PriceWatchComparison>(`PriceWatch/Materials/${encodeURIComponent(material)}/Comparison`)
  },
  /** `POST PriceWatch/Matches/{matchId}/Break` (Manage), no body — closes the pair's live price alert. PWT-00025/00026. */
  breakMatch(matchId: string): Promise<BrokenMatchWire> {
    return api.post<BrokenMatchWire>(`PriceWatch/Matches/${encodeURIComponent(matchId)}/Break`, {})
  },
}

// ── Matching (937) ─────────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 937)

// ── Index (938) ────────────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 938)

// ── Feed health (939) ──────────────────────────────────────────────────────────────────────────────────────────────
// (lands with 939)
