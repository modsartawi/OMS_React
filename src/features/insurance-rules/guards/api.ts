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
import type { GuardRuleRow, Says } from '@/core/insurance-rules/model'
import type { GuardTemplate } from '@/core/insurance-rules/templates' // 609

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

// ── 609 · folders (authoring only, no approval) and "Save as template" ──────────────────────────
// ⚠️ PROVISIONAL bodies (609), 618 reconciles — the brief names `GET / POST / PUT …/Folders` ("path tree") and
// `POST …/Templates` ("from a rule, `blanks: [path]`") only:
// - `GET …/Folders` → every folder path (`string[]`), an empty one included;
// - `POST …/Folders` `{ path }` makes one; `PUT …/Folders` `{ from, to }` renames one (its rules and folders
//   under it follow) or `{ rules: [id], to }` moves rules; each answers the paths again;
// - `POST …/Templates` `{ ruleId, name: {en, ar}, blanks: [path] }` → the saved team template.

export const guardFoldersApi = {
  async list(): Promise<string[]> {
    return (await api.get<string[] | null>(`${INSURANCE_RULES_BASE}/Guards/Folders`)) ?? []
  },
  async create(path: string): Promise<string[]> {
    return (await api.post<string[] | null>(`${INSURANCE_RULES_BASE}/Guards/Folders`, { path })) ?? []
  },
  async rename(from: string, to: string): Promise<string[]> {
    return (await api.put<string[] | null>(`${INSURANCE_RULES_BASE}/Guards/Folders`, { from, to })) ?? []
  },
  async move(rules: string[], to: string): Promise<string[]> {
    return (await api.put<string[] | null>(`${INSURANCE_RULES_BASE}/Guards/Folders`, { rules, to })) ?? []
  },
  saveAsTemplate(body: { ruleId: string; name: Says; blanks: string[] }): Promise<GuardTemplate> {
    return api.post<GuardTemplate>(`${INSURANCE_RULES_BASE}/Guards/Templates`, body)
  },
}

export const GUARD_FOLDERS_KEY = [...INSURANCE_RULES_KEY, 'guards', 'folders'] as const

export function guardFoldersQuery() {
  return { queryKey: GUARD_FOLDERS_KEY, queryFn: () => guardFoldersApi.list(), retry: false } as const
}
