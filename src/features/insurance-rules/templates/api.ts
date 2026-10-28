/**
 * The Templates gallery's doors (BackOffice spec 3126; door 3139, oms ticket 609). "Save as template" is the
 * Guards rule page's (`features/insurance-rules/guards/api`); the template shape is `@/core/insurance-rules/templates`.
 *
 * As BUILT (oms 618): `GET …/Templates` sends `origin` and blank PATHS (read by `templateIn`); `POST
 * …/Templates/{id}/Create { revision, ruleId, name?, folder?, values }` adds the rule the client names to the draft at
 * `revision` (409 `GUARDS_DRAFT_STALE` when it moved on) and answers the draft. The stubs serve the same shapes.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE } from '@/core/insurance-rules/api'
import type { GuardRuleset, Says } from '@/core/insurance-rules/model'
import { draftIn, type RulesetDraft } from '@/core/insurance-rules/ruleset-draft'
import { GUARD_TEMPLATES_KEY, templateIn, type GuardTemplate, type GuardTemplateReply } from '@/core/insurance-rules/templates'

export interface CreateFromTemplate {
  /** The draft's revision (0 when there is none). */
  revision: number
  /** The new rule's id, minted by the client (`nextGuardId`). */
  ruleId: string
  name?: Says
  folder: string
  /** Blank path → value; a blank not given keeps the template's value. */
  values: Record<string, unknown>
}

export const templatesApi = {
  /** `GET InsuranceRules/Guards/Templates` — phase-1 templates (with their conflict code) and team templates. */
  async list(): Promise<GuardTemplate[]> {
    return ((await api.get<GuardTemplateReply[] | null>(`${INSURANCE_RULES_BASE}/Guards/Templates`)) ?? []).map(templateIn)
  },
  /** `POST InsuranceRules/Guards/Templates/{id}/Create` — the blanks' values make an independent draft rule → the draft. */
  async create(id: string, body: CreateFromTemplate): Promise<RulesetDraft<GuardRuleset>> {
    const reply = await api.post<RulesetDraft<unknown>>(`${INSURANCE_RULES_BASE}/Guards/Templates/${encodeURIComponent(id)}/Create`, body)
    return draftIn<GuardRuleset>(reply, 'Guards')
  },
}

export function templatesQuery() {
  return { queryKey: GUARD_TEMPLATES_KEY, queryFn: () => templatesApi.list(), retry: false } as const
}
