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
import type { PrescriptionSessionHqToOpen } from '@/core/models/prescription-session'
import { toOpenRequest, type ToOpenFilter } from './to-open'
import type { PrescriptionSessionHqEndedRow } from '@/core/models/prescription-session'
import { endedRequest, type EndedFilter } from './ended-filter'

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

  /**
   * `GET PrescriptionSessionWeb/ToOpen?store` (ticket 546) — the unopened prescription orders, one
   * group per store; each group's `orders` capped across the read, its `count` exact.
   */
  async toOpen(filter: ToOpenFilter): Promise<PrescriptionSessionHqToOpen> {
    const { path, params } = toOpenRequest(filter)
    const data = await api.get<PrescriptionSessionHqToOpen | null>(path, params)
    return {
      stores: (data?.stores ?? []).map((s) => ({ ...s, orders: s.orders ?? [] })),
      total: data?.total ?? 0,
      byUpload: data?.byUpload === true,
    }
  },

  /**
   * `GET PrescriptionSessionWeb/Ended?from&to&store&state` (ticket 547) — the sessions that ended
   * in the range (by `endedAt`, earliest first), each with its sales and after-close events. A bare
   * list, capped at 2,000 rows server-side with no flag. A bad range is `PSES-00223`; the tab checks
   * the range first (`endedRangeProblem`) so that is a backstop.
   */
  async ended(filter: EndedFilter): Promise<PrescriptionSessionHqEndedRow[]> {
    const { path, params } = endedRequest(filter)
    const data = await api.get<PrescriptionSessionHqEndedRow[] | null>(path, params)
    return Array.isArray(data) ? data : []
  },
}
