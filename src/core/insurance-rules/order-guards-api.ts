/**
 * The guard doors an OMS order uses (BackOffice spec 3126: 3127/3128/3134 for the check, 3142/3143 for the
 * order; client ticket 616). In core because the guard dialog is drawn by the OMS document feature and the
 * list's guard state by the deliveries feature — a feature may not import another.
 *
 * As BUILT (oms 618): `Oms/Orders/{documentNo}/Guards/Recheck|Release` answer the order's guard row (read the order
 * again for its lines); `GET Guards/Reasons?checkId=` is read by `reasonsIn`.
 * ⚠️ `Guards/Reasons` and `Guards/{checkId}/Answer` are API-KEY doors in BackOffice 3134 (`GuardEndpoints`, no
 * `AllowCookieSession`): a browser session is answered a bare 403, so the dialog cannot answer a guard until
 * BackOffice opens them to the cookie session (or adds an order door for it) — on 618's list.
 */
import { api } from '@/core/api'
import { reasonsIn, type GuardAnswerBody, type GuardAnswerResult, type GuardReasons, type GuardReasonsReply, type GuardReleaseBody, type OrderGuardRow } from './guard-check'
import { INSURANCE_RULES_KEY } from './api'

const orderGuards = (documentNo: string) => `Oms/Orders/${encodeURIComponent(documentNo.trim())}/Guards`

export const orderGuardsApi = {
  /** `GET Guards/Reasons[?checkId=]` → the NCPDP codes, what each rule accepts, and the reasons capped on this check. */
  async reasons(checkId?: string | null): Promise<GuardReasons> {
    return reasonsIn(await api.get<GuardReasonsReply | null>('Guards/Reasons', { checkId: checkId ?? undefined }))
  },
  /**
   * `POST Guards/{checkId}/Answer` `{ lineHash, user, answers }` → `{ decisionId }`. Refused: an OVERRIDE
   * without `INS_GUARD`, a different `lineHash` (the order changed), a capped reason past its cap.
   */
  answer(checkId: string, body: GuardAnswerBody): Promise<GuardAnswerResult> {
    return api.post<GuardAnswerResult>(`Guards/${encodeURIComponent(checkId)}/Answer`, body)
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
export function guardReasonsQuery(checkId?: string | null) {
  return { queryKey: [...GUARD_REASONS_KEY, checkId ?? ''], queryFn: () => orderGuardsApi.reasons(checkId), staleTime: Infinity, retry: false } as const
}
