/**
 * The guard doors an OMS order uses (BackOffice spec 3126: 3127/3128/3134 for the check, 3142/3143 for the
 * order; client ticket 616). In core because the guard dialog is drawn by the OMS document feature and the
 * list's guard state by the deliveries feature — a feature may not import another.
 *
 * As BUILT (oms 618): `Oms/Orders/{documentNo}/Guards/Recheck|Release` answer the order's guard row (read the order
 * again for its lines); `…/Guards/Reasons` is read by `reasonsIn`. `…/Guards/Answer` answers the order's own last check,
 * as the session's user. `Guards/Reasons` and `Guards/{checkId}/Answer` are the same doors behind the API key.
 */
import { api } from '@/core/api'
import { reasonsIn, type GuardAnswerBody, type GuardAnswerResult, type GuardReasons, type GuardReasonsReply, type GuardReleaseBody, type OrderGuardRow } from './guard-check'
import { INSURANCE_RULES_KEY } from './api'

const orderGuards = (documentNo: string) => `Oms/Orders/${encodeURIComponent(documentNo.trim())}/Guards`

export const orderGuardsApi = {
  /** `GET …/Guards/Reasons` → the NCPDP codes, what each rule accepts, and the reasons capped on the order's check. */
  async reasons(documentNo: string): Promise<GuardReasons> {
    return reasonsIn(await api.get<GuardReasonsReply | null>(`${orderGuards(documentNo)}/Reasons`))
  },
  /**
   * `POST …/Guards/Answer` `{ lineHash, answers }` → `{ decisionId }`; HQ takes the user from the session. Refused: an
   * OVERRIDE without `INS_GUARD`, a different `lineHash` (the order changed), a capped reason past its cap.
   */
  answer(documentNo: string, body: GuardAnswerBody): Promise<GuardAnswerResult> {
    return api.post<GuardAnswerResult>(`${orderGuards(documentNo)}/Answer`, body)
  },
  /** `POST …/Guards/Recheck` (no body) — runs the check again on the order as it is now → its guard row. */
  recheck(documentNo: string): Promise<OrderGuardRow> {
    return api.post<OrderGuardRow>(`${orderGuards(documentNo)}/Recheck`, {})
  },
  /** `POST …/Guards/Release { reason }` — `INS_GUARD[RELEASE]`; frees a `pending` order as `unchecked` → its guard row. */
  release(documentNo: string, body: GuardReleaseBody): Promise<OrderGuardRow> {
    return api.post<OrderGuardRow>(`${orderGuards(documentNo)}/Release`, body)
  },
}

export const GUARD_REASONS_KEY = [...INSURANCE_RULES_KEY, 'guards', 'reasons'] as const

/** The reason codes change only with HQ's master data: read once per page life (per check, for its capped reasons). */
export function guardReasonsQuery(documentNo: string, checkId: string) {
  return { queryKey: [...GUARD_REASONS_KEY, documentNo, checkId], queryFn: () => orderGuardsApi.reasons(documentNo), staleTime: Infinity, retry: false } as const
}
