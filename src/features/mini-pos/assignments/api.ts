/**
 * The Mini POS assignments screen's server calls (oms 927, BackOffice 4074): SIS.Api's `MiniPosAdmin/Assignments` and
 * `MiniPosAdmin/Promoters/{loginId}/EndNow`. Reads behind `MiniPosAdmin:03`, writes behind `MiniPosAdmin:06`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its. A refusal is a business
 * `ApiError` whose code and `data` the screen reads (`./assignments`).
 */
import { api } from '@/core/api'
import type { MiniPosAssignment, MiniPosAssignmentRequest, MiniPosEndPromoterResult } from '@/core/models/mini-pos'

export const miniPosAssignmentsApi = {
  /** `GET MiniPosAdmin/Assignments/Today` → who is where today (rows covering today, not ended). */
  async today(): Promise<MiniPosAssignment[]> {
    return (await api.get<MiniPosAssignment[] | null>('MiniPosAdmin/Assignments/Today')) ?? []
  },

  /** `GET MiniPosAdmin/Assignments?promoter=&store=&includeHistory=` → a promoter's or a pharmacy's rows, newest first. */
  async find(filter: { promoter: string; store: string; includeHistory: boolean }): Promise<MiniPosAssignment[]> {
    return (
      (await api.get<MiniPosAssignment[] | null>('MiniPosAdmin/Assignments', {
        promoter: filter.promoter,
        store: filter.store,
        includeHistory: filter.includeHistory ? 'true' : '',
      })) ?? []
    )
  },

  /** `POST MiniPosAdmin/Assignments` → the new row. An overlap is refused `MINIPOS_ASSIGNMENT_OVERLAP`, the clash in `data`. */
  add(request: MiniPosAssignmentRequest): Promise<MiniPosAssignment> {
    return api.post<MiniPosAssignment>('MiniPosAdmin/Assignments', request)
  },

  /** `POST MiniPosAdmin/Assignments/{id}/End` → the ended row (kept). Applies at the promoter's next sign-in. */
  end(assignmentId: string): Promise<MiniPosAssignment> {
    return api.post<MiniPosAssignment>(`MiniPosAdmin/Assignments/${encodeURIComponent(assignmentId)}/End`, {})
  },

  /** `POST MiniPosAdmin/Promoters/{loginId}/EndNow` → every current and future row ended, the phone's sessions revoked. */
  endPromoterNow(loginId: string): Promise<MiniPosEndPromoterResult> {
    return api.post<MiniPosEndPromoterResult>(`MiniPosAdmin/Promoters/${encodeURIComponent(loginId)}/EndNow`, {})
  },
}
