/**
 * The held-stock reports' access probe (BackOffice ticket 3873) — apart from `./api` so the OMS menu leaves, which import it
 * eagerly, cost the main bundle only this. Both reports share the one grant, so both leaves and both pages read this probe.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { HeldStockReportAccess } from '@/core/models/held-stock-report'

/** The ONE cache key the two menu leaves and the two pages' gates share, so the probe costs one call. */
export const HELD_STOCK_REPORT_ACCESS_KEY = ['oms', 'held-stock-report', 'access'] as const

/** The one set of options every reader passes: a refusal is an answer, and a grant does not change in a page life. */
export function heldStockReportAccessQuery() {
  return {
    queryKey: HELD_STOCK_REPORT_ACCESS_KEY,
    queryFn: () => heldStockReportAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** The probe's one predicate, read by the menu leaves and the pages' gates. `=== true`, so a malformed answer is a denial. */
export const canOpenHeldStockReport = (r: HeldStockReportAccess | null | undefined): boolean => r?.screenAllowed === true

export const heldStockReportAccessApi = {
  /**
   * `GET HeldStockReport/Access` → `{ screenAllowed }`, cookie only, not grant-gated.
   *
   * 🚩 **Fails closed** — no 404-tolerant catch: a probe that degraded to *shown* would advertise screens nobody can hold
   * the grant for (`BackOfficeScreen[HeldStockReport, 03]`, role `HELD_STOCK_REPORT_VIEWER`).
   */
  access(): Promise<HeldStockReportAccess> {
    return api.get<HeldStockReportAccess>('HeldStockReport/Access')
  },
}
