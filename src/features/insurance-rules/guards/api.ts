/**
 * The Guards screen's own doors (BackOffice spec 3126; door 3139, oms ticket 607). 607 reads the list only;
 * the rule page reads the whole ruleset through `@/core/insurance-rules/api` (`guardDraftQuery`), which the
 * editor (608), templates (609) and approval (611) share. 608/609/611 add their Guards doors HERE
 * (Validate, Submit, Approve, SendBack, Promote, Versions, Folders, Templates).
 *
 * `GET InsuranceRules/Guards` as BUILT (3139 / 3141): `{ id, name, folder, state, severity, group, shadowSince,
 * shadowFires, inDraft, lastFired, flags: [{ kind, since }] }` — the screens read the 607 fields of `GuardRuleRow`.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import type { GuardRuleRow, Says } from '@/core/insurance-rules/model'
import { templateIn, type GuardTemplate, type GuardTemplateReply } from '@/core/insurance-rules/templates' // 609

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
// As BUILT (BackOffice 3139; oms 618):
// - `GET …/Folders` → `{ folders: [{ path, rules }] }` (every path, made by the team or in use; `rules` = rules sitting
//   directly in it);
// - `POST …/Folders { path }` makes one; `PUT …/Folders { from, to }` renames one (its rules and folders under it
//   follow) or `{ ruleId, folder }` moves ONE rule (blank folder = the root); each answers the tree again;
// - `POST …/Templates { id, name: { en, ar }, ruleId, blanks: [path] }` → the saved team template.

type FolderTreeReply = { folders?: { path: string; rules: number }[] } | null
const folderPathsOf = (reply: FolderTreeReply): string[] => (reply?.folders ?? []).map((f) => f.path)
const FOLDERS = `${INSURANCE_RULES_BASE}/Guards/Folders`

export const guardFoldersApi = {
  async list(): Promise<string[]> {
    return folderPathsOf(await api.get<FolderTreeReply>(FOLDERS))
  },
  async create(path: string): Promise<string[]> {
    return folderPathsOf(await api.post<FolderTreeReply>(FOLDERS, { path }))
  },
  async rename(from: string, to: string): Promise<string[]> {
    return folderPathsOf(await api.put<FolderTreeReply>(FOLDERS, { from, to }))
  },
  /** One rule to a folder ('' = no folder). */
  async move(ruleId: string, folder: string): Promise<string[]> {
    return folderPathsOf(await api.put<FolderTreeReply>(FOLDERS, { ruleId, folder }))
  },
  async saveAsTemplate(body: { id: string; ruleId: string; name: Says; blanks: string[] }): Promise<GuardTemplate> {
    return templateIn(await api.post<GuardTemplateReply>(`${INSURANCE_RULES_BASE}/Guards/Templates`, body))
  },
}

export const GUARD_FOLDERS_KEY = [...INSURANCE_RULES_KEY, 'guards', 'folders'] as const

export function guardFoldersQuery() {
  return { queryKey: GUARD_FOLDERS_KEY, queryFn: () => guardFoldersApi.list(), retry: false } as const
}
