/**
 * HQ's daily list of holds that should have ended: its server call (BackOffice ticket 3872). Cookie-only and behind
 * `BackOfficeScreen[HoldDailyList, 03]`; the probe lives in `./access`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 *
 * 🚩 The list is read from the daily fill (`PickHoldDailyList`), never computed on the request. Only a missing list is read
 * as empty, so a bare answer draws an empty grid, not a crash.
 */
import { api } from '@/core/api'
import type { HoldDailyListQuery, HoldDailyListReport } from '@/core/models/hold-daily-list'

export const holdDailyListApi = {
  /** `GET HoldDailyList` → the list as the last fill left it: each held unit, and the rows per kind and store. */
  async list(query: HoldDailyListQuery): Promise<HoldDailyListReport> {
    const data = await api.get<Partial<HoldDailyListReport> | null>('HoldDailyList', { ...query })
    return {
      asOf: data?.asOf ?? '',
      filledAt: data?.filledAt ?? null,
      counts: data?.counts ?? [],
      rows: data?.rows ?? [],
    }
  },
}
