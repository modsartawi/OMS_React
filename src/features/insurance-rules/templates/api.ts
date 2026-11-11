/**
 * The Templates gallery's doors (BackOffice spec 3126; door 3139, oms ticket 609). "Save as template" is the
 * Guards rule page's (`features/insurance-rules/guards/api`); the template shape is `@/core/insurance-rules/templates`.
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`, `// --- 609 ---`): no door here has met a real
 * SIS.Api. PROVISIONAL: `POST …/Templates/{id}/Create` takes `{ values: { [path]: value }, folder }` and answers
 * the created draft rule (HQ mints its id and adds it to the draft, whose revision moves on).
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, insuranceRulesApi } from '@/core/insurance-rules/api'
import type { GuardRule } from '@/core/insurance-rules/model'
import { GUARD_TEMPLATES_KEY, type GuardTemplate } from '@/core/insurance-rules/templates'

export const templatesApi = {
  /** `GET InsuranceRules/Guards/Templates` — phase-1 templates (with their conflict code) and team templates. */
  async list(): Promise<GuardTemplate[]> {
    return (await api.get<GuardTemplate[] | null>(`${INSURANCE_RULES_BASE}/Guards/Templates`)) ?? []
  },
  /**
   * `POST InsuranceRules/Guards/Templates/{id}/Create { revision, ruleId, folder?, values }` (3139) — the blanks'
   * values add an independent copy to the draft read at `revision`; HQ answers the draft, so the new rule is the
   * id sent. The id is the template's plus the first free `-n` (⚠️ HQ spells no id rule; the PUT checks it).
   */
  async create(id: string, values: Record<string, unknown>, folder: string): Promise<Pick<GuardRule, 'id'>> {
    const draft = await insuranceRulesApi.guardDraft()
    const taken = new Set(draft.rules.map((r) => r.id))
    let n = 1
    while (taken.has(`${id}-${n}`)) n++
    const ruleId = `${id}-${n}`
    await api.post<unknown>(`${INSURANCE_RULES_BASE}/Guards/Templates/${encodeURIComponent(id)}/Create`, {
      revision: draft.revision,
      ruleId,
      ...(folder ? { folder } : {}),
      values,
    })
    return { id: ruleId }
  },
}

export function templatesQuery() {
  return { queryKey: GUARD_TEMPLATES_KEY, queryFn: () => templatesApi.list(), retry: false } as const
}
