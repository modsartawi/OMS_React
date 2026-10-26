/**
 * The insurance-rules doors more than one feature reads (BackOffice spec 3126; doors 3139). The guard
 * ruleset is ONE document (`GET / PUT InsuranceRules/Guards/Draft`, with `revision`; a stale PUT is a 409):
 * the rule page (607), the editor (608), templates (609), item lists (610) and approval (611) all read it,
 * and a feature may not import another, so its read lives here. Each feature keeps its OWN doors in its
 * own `api.ts` (the Guards list's `GET InsuranceRules/Guards` is `features/insurance-rules/guards/api`).
 *
 * ⚠️ Stubbed until oms 618: no door here has met a real SIS.Api. `tools/insurance-rules-stubs.mjs` serves
 * the brief's shapes; a spelling a BackOffice ticket changes is recorded in the brief and reconciled in 618.
 * No access probe yet — the doors answer a session without the grant a bare 403 (618 adds the probe).
 */
import { api } from '@/core/api'
import type { GuardRuleset } from './model'

export const INSURANCE_RULES_BASE = 'InsuranceRules'

export const insuranceRulesApi = {
  /** `GET InsuranceRules/Guards/Draft` — the whole guard ruleset with its `revision`. */
  guardDraft(): Promise<GuardRuleset> {
    return api.get<GuardRuleset>(`${INSURANCE_RULES_BASE}/Guards/Draft`)
  },
}

/** Every insurance-rules query key starts here, so a write can invalidate the area at once. */
export const INSURANCE_RULES_KEY = ['insurance-rules'] as const
/** The guard draft's key; 608's save, 609's create from template and 611's restore invalidate it. */
export const GUARD_DRAFT_KEY = [...INSURANCE_RULES_KEY, 'guards', 'draft'] as const

export function guardDraftQuery() {
  return { queryKey: GUARD_DRAFT_KEY, queryFn: () => insuranceRulesApi.guardDraft(), retry: false } as const
}
