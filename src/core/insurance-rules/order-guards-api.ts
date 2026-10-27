/**
 * The guard doors an OMS order uses (BackOffice spec 3126: 3127/3128/3134 for the check, 3142/3143 for the
 * order; client ticket 616). In core because the guard dialog is drawn by the OMS document feature and the
 * list's guard state by the deliveries feature — a feature may not import another.
 *
 * ⚠️ Stubbed until oms 618. SPELLING GUESS: the brief writes the order doors `Oms/Orders/{id}/Guards/…`;
 * every existing OMS order door is `SdDocumentWeb/*` (`features/oms/document/api.ts`), with an order's own
 * reads under `SdDocumentWeb/Document/{no}/…` (a delivery number is read through its order). The doors are
 * spelled to fit those: `SdDocumentWeb/Document/{no}/Guards/Recheck|Release`. 618 reconciles.
 */
import { api } from '@/core/api'
import type { GuardAnswerBody, GuardAnswerResult, GuardReasons, GuardReleaseBody, OrderGuards } from './guard-check'
import { INSURANCE_RULES_KEY } from './api'

const orderGuards = (documentNo: string) => `SdDocumentWeb/Document/${encodeURIComponent(documentNo.trim())}/Guards`

export const orderGuardsApi = {
  /** `GET Guards/Reasons` → the NCPDP intervention / outcome / reason codes, `accepts` and `caps`. */
  reasons(): Promise<GuardReasons> {
    return api.get<GuardReasons>('Guards/Reasons')
  },
  /**
   * `POST Guards/{checkId}/Answer` `{ lineHash, user, answers }` → `{ decisionId }`. Refused: an OVERRIDE
   * without `INS_GUARD`, a different `lineHash` (the order changed), a capped reason past its cap.
   */
  answer(checkId: string, body: GuardAnswerBody): Promise<GuardAnswerResult> {
    return api.post<GuardAnswerResult>(`Guards/${encodeURIComponent(checkId)}/Answer`, body)
  },
  /** `POST …/Guards/Recheck` — runs the check again on the order as it is now. GUESS: answers the new `guards`. */
  recheck(documentNo: string): Promise<OrderGuards | null> {
    return api.post<OrderGuards | null>(`${orderGuards(documentNo)}/Recheck`, {})
  },
  /** `POST …/Guards/Release` `{ reason }` — the release grant; the order goes on without its guard check. */
  release(documentNo: string, body: GuardReleaseBody): Promise<unknown> {
    return api.post<unknown>(`${orderGuards(documentNo)}/Release`, body)
  },
}

export const GUARD_REASONS_KEY = [...INSURANCE_RULES_KEY, 'guards', 'reasons'] as const

/** The reason codes change only with HQ's master data: read once per page life. */
export function guardReasonsQuery() {
  return { queryKey: GUARD_REASONS_KEY, queryFn: () => orderGuardsApi.reasons(), staleTime: Infinity, retry: false } as const
}
