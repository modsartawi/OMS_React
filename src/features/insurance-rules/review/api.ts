/**
 * The Review list's and HQ exceptions' doors (BackOffice 3134, 3135, 3141; oms ticket 614).
 *
 *   GET  InsuranceRules/Review?pharmacist&store&rule&reason&kind  → ReviewRow[]
 *   POST InsuranceRules/Review/{decisionRowId}   { mark: ok|questioned, note }
 *   GET  InsuranceRules/Exceptions                → GuardException[]   (🚩 guessed: the brief spells no list door)
 *   POST InsuranceRules/Exceptions                { patientKey, ruleId|null, scope, validUntil, reason, note } → GuardException
 *   POST InsuranceRules/Exceptions/{id}/Revoke    {}                   (🚩 guessed empty body)
 *   GET  InsuranceRules/Exceptions/{id}/Log       → ExceptionLogEntry[]
 *   (the reason codes, `GET Guards/Reasons`, are read through core `guardReasonsQuery` — 616 reads them too)
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`, section 614): no door here has met a real SIS.Api.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import type { IssueExceptionBody } from './exception'
import type { ExceptionLogEntry, GuardException, ReviewMark, ReviewRow } from './model'
import type { ReviewQuery } from './review-query'

export const reviewApi = {
  async review(q: ReviewQuery): Promise<ReviewRow[]> {
    return (
      (await api.get<ReviewRow[] | null>(`${INSURANCE_RULES_BASE}/Review`, {
        pharmacist: q.pharmacist,
        store: q.store,
        rule: q.rule,
        reason: q.reason,
        kind: q.kind,
      })) ?? []
    )
  },
  mark(id: string, body: { mark: ReviewMark; note: string }): Promise<unknown> {
    return api.post<unknown>(`${INSURANCE_RULES_BASE}/Review/${encodeURIComponent(id)}`, body)
  },
  async exceptions(): Promise<GuardException[]> {
    return (await api.get<GuardException[] | null>(`${INSURANCE_RULES_BASE}/Exceptions`)) ?? []
  },
  issue(body: IssueExceptionBody): Promise<GuardException> {
    return api.post<GuardException>(`${INSURANCE_RULES_BASE}/Exceptions`, body)
  },
  revoke(id: string): Promise<unknown> {
    return api.post<unknown>(`${INSURANCE_RULES_BASE}/Exceptions/${encodeURIComponent(id)}/Revoke`, {})
  },
  async log(id: string): Promise<ExceptionLogEntry[]> {
    return (await api.get<ExceptionLogEntry[] | null>(`${INSURANCE_RULES_BASE}/Exceptions/${encodeURIComponent(id)}/Log`)) ?? []
  },
}

export const REVIEW_KEY = [...INSURANCE_RULES_KEY, 'review'] as const
export const EXCEPTIONS_KEY = [...INSURANCE_RULES_KEY, 'exceptions'] as const
