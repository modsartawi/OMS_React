/**
 * The serial refusal report's access probe (ticket 573, BackOffice 3054) — apart from `./api` so the OMS menu leaf,
 * which imports it eagerly, costs the main bundle only this.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { SerialRefusalAccess } from '@/core/models/serial-refusal'

/** The ONE cache key the menu leaf and the page's gate share, so the probe costs one call. */
export const SERIAL_REFUSAL_ACCESS_KEY = ['oms', 'serial-refusals', 'access'] as const

/** The one set of options every reader passes: a refusal is an answer, and a grant does not change in a page life. */
export function serialRefusalAccessQuery() {
  return {
    queryKey: SERIAL_REFUSAL_ACCESS_KEY,
    queryFn: () => serialRefusalAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** The probe's one predicate, read by BOTH the menu leaf and the page's gate. `=== true`, so a malformed answer is a denial. */
export const canOpenSerialRefusals = (r: SerialRefusalAccess | null | undefined): boolean => r?.screenAllowed === true

export const serialRefusalAccessApi = {
  /**
   * `GET SerialRefusal/Access` → `{ screenAllowed }`, cookie only, not grant-gated.
   *
   * 🚩 **Fails closed** — no 404-tolerant catch: a probe that degraded to *shown* would advertise a screen nobody can
   * hold the grant for (`BackOfficeScreen[SerialRefusal, 03]`).
   */
  access(): Promise<SerialRefusalAccess> {
    return api.get<SerialRefusalAccess>('SerialRefusal/Access')
  },
}
