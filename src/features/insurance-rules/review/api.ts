/**
 * The Review list's and HQ exceptions' doors (BackOffice 3134, 3135, 3141; oms ticket 614).
 *
 *   GET  InsuranceRules/Review?pharmacist&store&rule&reason&kind  → ReviewRow[]
 *   POST InsuranceRules/Review/{decisionRowId}   { mark: ok|questioned, note }
 *   GET  InsuranceRules/Exceptions                → GuardException[]   (🚩 guessed: the brief spells no list door)
 *   POST InsuranceRules/Exceptions                { patientKey, ruleId|null, scope, validUntil, reason, note } → GuardException
 *   POST InsuranceRules/Exceptions/{id}/Revoke    {}                   (🚩 guessed empty body)
 *   GET  InsuranceRules/Exceptions/{id}/Log       → ExceptionLogEntry[]
 *   GET  Guards/Reasons                           → GuardReasons        (the reason codes, 3134; 616 reads it too)
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`, section 614): no door here has met a real SIS.Api.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import type { IssueExceptionBody } from './exception'
import type { ExceptionLogEntry, GuardException, GuardReasons, ReviewMark, ReviewRow } from './model'
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
  reasons(): Promise<GuardReasons> {
    return api.get<GuardReasons>('Guards/Reasons')
  },
}

export const REVIEW_KEY = [...INSURANCE_RULES_KEY, 'review'] as const
export const EXCEPTIONS_KEY = [...INSURANCE_RULES_KEY, 'exceptions'] as const
export const REASONS_KEY = [...INSURANCE_RULES_KEY, 'guard-reasons'] as const

export function reasonsQuery() {
  return { queryKey: REASONS_KEY, queryFn: () => reviewApi.reasons(), staleTime: 5 * 60_000, retry: false } as const
}
