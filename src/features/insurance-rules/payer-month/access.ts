/**
 * The payer-month screen's access probe (oms 896, BackOffice 1628). In the feature, not `@/core/`: its only
 * readers are this page and the nav leaf, and `layout/` may reach into a feature (the prescription-sessions
 * precedent). It is NOT the Insurance rules area's probe — the screen has its own one grant (D36).
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { InsurancePayerMonthAccess } from '@/core/models/insurance-payer-month'

/** The ONE cache key the nav leaf and the page's gate share, so the screen costs one probe call. */
export const PAYER_MONTH_ACCESS_KEY = ['insurance-payer-month', 'access'] as const

export const payerMonthAccessApi = {
  /**
   * `GET InsurancePayerMonthWeb/Access` → `{ canManage }`, cookie only. 🚩 Fails closed: no 404-tolerant
   * catch, so until the door is on the host the leaf hides.
   */
  access(): Promise<InsurancePayerMonthAccess> {
    return api.get<InsurancePayerMonthAccess>('InsurancePayerMonthWeb/Access')
  },
}

/** The ONE reading of the probe: the nav leaf and the page's gate both pass this. 🚩 Only an explicit `true`. */
export const canManagePayerMonths = (r: Partial<InsurancePayerMonthAccess> | null | undefined): boolean =>
  typeof r === 'object' && r !== null && r.canManage === true

/** …and the one set of options every reader passes (`ScreenGate`'s contract). */
export function payerMonthAccessQuery() {
  return {
    queryKey: PAYER_MONTH_ACCESS_KEY,
    queryFn: () => payerMonthAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}
