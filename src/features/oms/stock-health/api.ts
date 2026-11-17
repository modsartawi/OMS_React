/**
 * The Stock health page's server call (oms 908, BackOffice 3992): SIS.Api's one `StockHealth` read, cookie-only, behind
 * `BackOfficeScreen[StockHealth, 03]`. The probe lives in `./access`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 */
import { api } from '@/core/api'
import type { StockHealth } from '@/core/models/stock-health'

export const stockHealthApi = {
  /** `GET StockHealth` → `{ readAt, signals[] }`, the signals in the spec's order. A missing list reads as none. */
  async read(): Promise<StockHealth> {
    const answer = await api.get<StockHealth>('StockHealth')
    return { readAt: answer?.readAt ?? '', signals: answer?.signals ?? [] }
  },
}
