/**
 * The Guards screen's own doors (BackOffice spec 3126; door 3139, oms ticket 607). 607 reads the list only;
 * the rule page reads the whole ruleset through `@/core/insurance-rules/api` (`guardDraftQuery`), which the
 * editor (608), templates (609) and approval (611) share. 608/609/611 add their Guards doors HERE
 * (Validate, Submit, Approve, SendBack, Promote, Versions, Folders, Templates).
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`): no door here has met a real SIS.Api.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import type { GuardRuleRow } from '@/core/insurance-rules/model'

export const guardsApi = {
  /** `GET InsuranceRules/Guards` — every guard rule with its state, severity, last fired and flags. */
  async list(): Promise<GuardRuleRow[]> {
    return (await api.get<GuardRuleRow[] | null>(`${INSURANCE_RULES_BASE}/Guards`)) ?? []
  },
}

export const GUARDS_KEY = [...INSURANCE_RULES_KEY, 'guards', 'list'] as const

export function guardsQuery() {
  return { queryKey: GUARDS_KEY, queryFn: () => guardsApi.list(), retry: false } as const
}
