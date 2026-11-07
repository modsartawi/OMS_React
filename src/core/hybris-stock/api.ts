import { api } from '@/core/api'
import type { HybrisStockAccessResult, HybrisStockStatus } from '@/core/models/hybris-stock'

// The Hybris stock area's shared reads (BackOffice spec 3447; oms 847). They live in `@/core/`
// because the three pages (stores 847, materials 848, pushes 849) and the menu read each one, and a
// feature may never import another (.claude/rules/feature-structure.md):
//
// - the access probe — ONE key, ONE call, read through `./access`;
// - `Status` — the rail's mode banner on every page, and the push log's line retention.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** The ONE cache key the menu leaves and every Hybris stock page share. */
export const HYBRIS_STOCK_ACCESS_KEY = ['hybris-stock', 'access'] as const

export const HYBRIS_STOCK_STATUS_KEY = ['hybris-stock', 'status'] as const

/** Every push-log page (849). Here, not in the pushes feature, because the stores page's push now (850)
 *  refreshes it too, and a feature may not import another. */
export const HYBRIS_STOCK_PUSHES_KEY = ['hybris-stock', 'pushes'] as const

export const hybrisStockApi = {
  /**
   * GET HybrisStockWeb/Access → `{ canView, canManage }`.
   *
   * ⚠️ **Fails closed, deliberately** (the Deliverect / HungerStation precedent): the door
   * (BackOffice 3453) is not built yet, and a probe that degraded to *shown* while its endpoint was
   * missing would advertise screens nobody can hold the grant for.
   */
  access(): Promise<HybrisStockAccessResult> {
    return api.get<HybrisStockAccessResult>('HybrisStockWeb/Access')
  },

  /** GET HybrisStockWeb/Status — the rail's mode (off / shadow / live) and its settings. View grant. */
  status(): Promise<HybrisStockStatus> {
    return api.get<HybrisStockStatus>('HybrisStockWeb/Status')
  },
}

/** The probe's query options, passed WHOLE by every page gate (`retry: false`, `staleTime: Infinity`). */
export function hybrisStockAccessQuery() {
  return {
    queryKey: HYBRIS_STOCK_ACCESS_KEY,
    queryFn: () => hybrisStockApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** The status query — the mode is a setting and changes on cutover day only. */
export function hybrisStockStatusQuery() {
  return {
    queryKey: HYBRIS_STOCK_STATUS_KEY,
    queryFn: () => hybrisStockApi.status(),
    staleTime: 60_000,
    retry: false,
  } as const
}
