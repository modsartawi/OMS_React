/**
 * The held-stock reports' server calls (BackOffice ticket 3873). Cookie-only and behind
 * `BackOfficeScreen[HeldStockReport, 03]`; the probe lives in `./access`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 *
 * 🚩 Both are read live from Stock Visibility and the pick tables on the request. Only a missing list is read as empty, so a
 * bare answer draws an empty grid, not a crash.
 */
import { api } from '@/core/api'
import type {
  HeldImpactReport,
  HeldImpactReportQuery,
  TakeRefusalReport,
  TakeRefusalReportQuery,
} from '@/core/models/held-stock-report'

export const heldStockReportApi = {
  /** `GET HeldStockReport/Refusals` → one day of refusals and would-be refusals, the multi-batch lines and last-resort takes. */
  async refusals(query: TakeRefusalReportQuery): Promise<TakeRefusalReport> {
    const data = await api.get<Partial<TakeRefusalReport> | null>('HeldStockReport/Refusals', { ...query })
    return {
      asOf: data?.asOf ?? '',
      day: data?.day ?? '',
      groups: data?.groups ?? [],
      rows: data?.rows ?? [],
      multiBatchLines: data?.multiBatchLines ?? [],
      lastResortTakes: data?.lastResortTakes ?? [],
      storesUnreached: data?.storesUnreached ?? [],
    }
  },

  /** `GET HeldStockReport/Held` → what held would take off the channels' figure, and the check's repairs per day. */
  async held(query: HeldImpactReportQuery): Promise<HeldImpactReport> {
    const data = await api.get<Partial<HeldImpactReport> | null>('HeldStockReport/Held', { ...query })
    return {
      asOf: data?.asOf ?? '',
      pairs: data?.pairs ?? [],
      sources: data?.sources ?? [],
      totals: data?.totals ?? { channelToday: 0, channelWithHeld: 0, takenOff: 0, held: 0, pairs: 0, pairsFallingToZero: 0 },
      repairsFrom: data?.repairsFrom ?? '',
      repairsTo: data?.repairsTo ?? '',
      repairs: data?.repairs ?? 0,
      repairsPerDay: data?.repairsPerDay ?? [],
    }
  },
}
