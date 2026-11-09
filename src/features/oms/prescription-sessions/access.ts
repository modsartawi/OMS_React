/**
 * The HQ prescription sessions access probe (BackOffice 3459, oms 852) — apart from `./api` so the OMS menu leaf,
 * which imports it eagerly, costs the main bundle only this. It stays with its feature: the leaf and the page are
 * its only readers. Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { PrescriptionSessionAccess } from '@/core/models/prescription-session'

/** The ONE cache key the menu leaf and any page gate share, so the probe costs one call. */
export const PRESCRIPTION_SESSION_ACCESS_KEY = ['oms', 'prescription-sessions', 'access'] as const

/** …and the one set of options every reader passes. */
export function prescriptionSessionAccessQuery() {
  return {
    queryKey: PRESCRIPTION_SESSION_ACCESS_KEY,
    queryFn: () => prescriptionSessionAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** `BackOfficeScreen[PrescriptionSessionHq]` — the leaf's predicate. Only an explicit `true` grants. */
export const canViewPrescriptionSessions = (r: Partial<PrescriptionSessionAccess> | null | undefined): boolean =>
  typeof r === 'object' && r !== null && r.canView === true

export const prescriptionSessionAccessApi = {
  /**
   * `GET PrescriptionSessionWeb/Access` → `{ canView, canWriteOff }`, cookie only.
   * 🚩 Fails closed: no 404-tolerant catch — until 3459 is deployed the door 404s and the leaf hides.
   */
  access(): Promise<PrescriptionSessionAccess> {
    return api.get<PrescriptionSessionAccess>('PrescriptionSessionWeb/Access')
  },
}
