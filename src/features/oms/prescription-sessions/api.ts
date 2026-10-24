/**
 * The HQ prescription-session doors (BackOffice spec 2994, ticket 3015;
 * `Services/SIS.Api/Endpoints/PrescriptionSessions/PrescriptionSessionWebEndpoints.cs`). Cookie-only,
 * each behind `BackOfficeScreen[PrescriptionSessionHq, 03]`. There is NO access probe: a session
 * without the grant gets a BARE 403, which the page names through `isBareDenial`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 * 🚩 The doors are on BackOffice branch `spec2994`, not deployed — stubbed until ticket 549.
 *
 * 546 (`ToOpen`), 547 (`Ended`) and 548 (`WriteOff`) add their calls to this object.
 */
import { api } from '@/core/api'
import type { PrescriptionSessionHqList } from '@/core/models/prescription-session'
import { openRequest, type OpenFilter } from './open-filter'

export const prescriptionSessionsApi = {
  /**
   * `GET PrescriptionSessionWeb/Sessions` (or `…/Sessions/Owed` for the Owed view) — the open
   * sessions across stores, oldest idle first, with the flag counts over every matched row. A bad
   * filter is the business refusal `PSES-00223`.
   */
  async open(filter: OpenFilter): Promise<PrescriptionSessionHqList> {
    const { path, params } = openRequest(filter)
    const data = await api.get<PrescriptionSessionHqList | null>(path, params)
    return {
      rows: data?.rows ?? [],
      total: data?.total ?? 0,
      stalled: data?.stalled ?? 0,
      aboutToLapse: data?.aboutToLapse ?? 0,
      owed: data?.owed ?? 0,
      isTruncated: data?.isTruncated === true,
    }
  },
}
