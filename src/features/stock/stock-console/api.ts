/**
 * The stock console's server calls (oms 940–945, BackOffice spec 4157): SIS.Api's `StockConsole/*` reads, cookie-only,
 * behind `BackOfficeScreen[StockConsole, 03]`. The gate lives in `./access`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its. Each answer is normalised
 * here — an absent list reads as none — so a shape the server has not settled yet is reconciled in one place.
 * Every query key starts with `STOCK_CONSOLE_KEY`; later tickets append their reads below a divider.
 */
import { queryOptions } from '@tanstack/react-query'
import { api, apiErrorKind } from '@/core/api'
import type { StockConsoleStoreRow, StockConsoleStores } from '@/core/models/stock-console'

export const STOCK_CONSOLE_KEY = ['stock', 'stock-console'] as const

/** A row as drawn: an absent flag list reads as none. */
const storeRow = (r: StockConsoleStoreRow): StockConsoleStoreRow => ({ ...r, flags: r.flags ?? [] })

export const stockConsoleApi = {
  // ── 940 ──
  /** `GET StockConsole/Stores` → every store's row (SIS.Api's copy, at most 60 s old), whole. */
  async stores(): Promise<StockConsoleStores> {
    const d = await api.get<Partial<StockConsoleStores> | null>('StockConsole/Stores')
    return { readAt: d?.readAt ?? '', stores: (d?.stores ?? []).map(storeRow), fleet: d?.fleet ?? [] }
  },
}

/** The stores list, read once on opening; Refresh re-reads it. SIS.Api keeps a 60 s copy, so 30 s here is fresh enough. */
export const storesQuery = () =>
  queryOptions({
    queryKey: [...STOCK_CONSOLE_KEY, 'stores'] as const,
    queryFn: () => stockConsoleApi.stores(),
    staleTime: 30_000,
    retry: retryUnlessAnswered,
  })

/** A coded refusal (`ConsoleBusy`, `NoStore`, …) is an answer, not a blip: only an outage is retried, once. */
export const retryUnlessAnswered = (failures: number, err: unknown): boolean =>
  apiErrorKind(err) !== 'business' && failures < 1
