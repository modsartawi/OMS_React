/**
 * The SAP export console's access probe (BackOffice spec 2579, ticket 461) — apart from
 * `./api` so the Reports menu leaf, which imports it eagerly, costs the main bundle only this.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { SapExportAccess } from '@/core/models/sap-export'

/**
 * The ONE cache key the Reports menu leaf and the console's own in-page gate share, so the
 * probe costs one call — exported rather than re-spelled, because a typo would silently split
 * the entry and let the nav and the screen disagree. Its own key: the console's grant is not
 * the IDoc inspector's, though they share an area.
 */
export const SAP_EXPORT_ACCESS_KEY = ['reports', 'sap-export', 'access'] as const

/**
 * …and the one set of options every reader passes. `retry: false` because a refusal is an
 * answer, not an outage; `staleTime: Infinity` because a grant does not change inside a page life.
 */
export function sapExportAccessQuery() {
  return {
    queryKey: SAP_EXPORT_ACCESS_KEY,
    queryFn: () => sapExportAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/**
 * The probe's one predicate, read by BOTH the nav leaf and the page's gate. `=== true` and
 * nothing looser, so a malformed answer is a denial.
 */
export const canOpenSapExport = (r: SapExportAccess | null | undefined): boolean => r?.screenAllowed === true

export const sapExportAccessApi = {
  /**
   * `GET SapExport/Access` → `{ screenAllowed }`, cookie only, no grant.
   *
   * 🚩 **Fails closed** — no 404-tolerant catch, on the sync console's precedent: the door
   * (BackOffice 2580) is not deployed anywhere yet, and a probe that degraded to *shown* would
   * advertise a screen nobody can hold the grant for. The shell already hides a leaf whose probe
   * is pending or errored, so failing closed is the absence of a catch, not code.
   */
  access(): Promise<SapExportAccess> {
    return api.get<SapExportAccess>('SapExport/Access')
  },
}
