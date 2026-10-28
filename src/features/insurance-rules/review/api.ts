/**
 * The Review list's and HQ exceptions' doors (BackOffice 3134, 3135, 3141; oms ticket 614).
 *
 * As BUILT (oms 618 reconciled 3135 / 3141; the replies read by `./model`'s `reviewIn` / `exceptionIn` / `logIn`):
 *   GET  InsuranceRules/Review?kind&pharmacist&store&rule&reason   → ReviewReply[] (at most 500, newest first)
 *   POST InsuranceRules/Review/{id}               { mark: ok|questioned, note } → { mark, note, by, at }
 *   GET  InsuranceRules/Exceptions?patientKey=    → ONE patient's exceptions (a 10-digit key is required: 400 otherwise)
 *   POST InsuranceRules/Exceptions                { patientKey, ruleId|null, scope, validUntil, reason, note } → the exception
 *   POST InsuranceRules/Exceptions/{id}/Revoke    { note } (required) → the exception, revoked
 *   GET  InsuranceRules/Exceptions/{id}/Log       → [{ at, by, action, note, checkId, channel, sourceRef, line, ruleId, severity, store }]
 *   (the reason codes, `GET Guards/Reasons`, are read through core `guardReasonsQuery` — 616 reads them too.
 *   ⚠️ That door is api-key only in BackOffice 3134: a browser session is answered a bare 403 — on 618's list.)
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import type { IssueExceptionBody } from './exception'
import { exceptionIn, logIn, reviewIn, type ExceptionLogEntry, type ExceptionLogReply, type ExceptionReply, type GuardException, type ReviewMark, type ReviewReply, type ReviewRow } from './model'
import type { ReviewQuery } from './review-query'

export const reviewApi = {
  async review(q: ReviewQuery): Promise<ReviewRow[]> {
    return (
      (await api.get<ReviewReply[] | null>(`${INSURANCE_RULES_BASE}/Review`, {
        pharmacist: q.pharmacist,
        store: q.store,
        rule: q.rule,
        reason: q.reason,
        kind: q.kind,
      })) ?? []
    ).map(reviewIn)
  },
  mark(id: string, body: { mark: ReviewMark; note: string }): Promise<unknown> {
    return api.post<unknown>(`${INSURANCE_RULES_BASE}/Review/${encodeURIComponent(id)}`, body)
  },
  /** One patient's exceptions, newest first, revoked / expired ones included. */
  async exceptions(patientKey: string): Promise<GuardException[]> {
    return ((await api.get<ExceptionReply[] | null>(`${INSURANCE_RULES_BASE}/Exceptions`, { patientKey })) ?? []).map(exceptionIn)
  },
  async issue(body: IssueExceptionBody): Promise<GuardException> {
    return exceptionIn(await api.post<ExceptionReply>(`${INSURANCE_RULES_BASE}/Exceptions`, body))
  },
  async revoke(id: string, note: string): Promise<GuardException> {
    return exceptionIn(await api.post<ExceptionReply>(`${INSURANCE_RULES_BASE}/Exceptions/${encodeURIComponent(id)}/Revoke`, { note }))
  },
  async log(id: string): Promise<ExceptionLogEntry[]> {
    return ((await api.get<ExceptionLogReply[] | null>(`${INSURANCE_RULES_BASE}/Exceptions/${encodeURIComponent(id)}/Log`)) ?? []).map(logIn)
  },
}

export const REVIEW_KEY = [...INSURANCE_RULES_KEY, 'review'] as const
export const EXCEPTIONS_KEY = [...INSURANCE_RULES_KEY, 'exceptions'] as const
