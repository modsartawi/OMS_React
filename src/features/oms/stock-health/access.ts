/**
 * The Stock health page's access probe (oms 908, BackOffice 3992 / grant 3994) — apart from `./api` so the OMS menu leaf,
 * which imports it eagerly, costs the main bundle only this.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { StockHealthAccess } from '@/core/models/stock-health'

/** The ONE cache key the menu leaf and the page's gate share, so the probe costs one call. */
export const STOCK_HEALTH_ACCESS_KEY = ['oms', 'stock-health', 'access'] as const

/** The one set of options every reader passes: a refusal is an answer, and a grant does not change in a page life. */
export function stockHealthAccessQuery() {
  return {
    queryKey: STOCK_HEALTH_ACCESS_KEY,
    queryFn: () => stockHealthAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** The probe's one predicate, read by the menu leaf and the page's gate. `=== true`, so a malformed answer is a denial. */
export const canOpenStockHealth = (r: StockHealthAccess | null | undefined): boolean => r?.screenAllowed === true

export const stockHealthAccessApi = {
  /**
   * `GET StockHealth/Access` → `{ screenAllowed }`, cookie only, not grant-gated.
   *
   * 🚩 **Fails closed** — no 404-tolerant catch: a probe that degraded to *shown* would advertise a screen nobody can hold
   * the grant for (`BackOfficeScreen[StockHealth, 03]`, role `STOCK_HEALTH_VIEWER`).
   */
  access(): Promise<StockHealthAccess> {
    return api.get<StockHealthAccess>('StockHealth/Access')
  },
}
