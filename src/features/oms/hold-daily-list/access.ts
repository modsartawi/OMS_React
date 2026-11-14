/**
 * HQ's daily list of holds that should have ended: its access probe (BackOffice ticket 3872) — apart from `./api` so the OMS menu leaf,
 * which imports it eagerly, costs the main bundle only this.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { HoldDailyListAccess } from '@/core/models/hold-daily-list'

/** The ONE cache key the menu leaf and the page's gate share, so the probe costs one call. */
export const HOLD_DAILY_LIST_ACCESS_KEY = ['oms', 'hold-daily-list', 'access'] as const

/** The one set of options every reader passes: a refusal is an answer, and a grant does not change in a page life. */
export function holdDailyListAccessQuery() {
  return {
    queryKey: HOLD_DAILY_LIST_ACCESS_KEY,
    queryFn: () => holdDailyListAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** The probe's one predicate, read by BOTH the menu leaf and the page's gate. `=== true`, so a malformed answer is a denial. */
export const canOpenHoldDailyList = (r: HoldDailyListAccess | null | undefined): boolean =>
  r?.screenAllowed === true

export const holdDailyListAccessApi = {
  /**
   * `GET HoldDailyList/Access` → `{ screenAllowed }`, cookie only, not grant-gated.
   *
   * 🚩 **Fails closed** — no 404-tolerant catch: a probe that degraded to *shown* would advertise a screen nobody can
   * hold the grant for (`BackOfficeScreen[HoldDailyList, 03]`, role HOLD_DAILY_LIST_VIEWER).
   */
  access(): Promise<HoldDailyListAccess> {
    return api.get<HoldDailyListAccess>('HoldDailyList/Access')
  },
}
