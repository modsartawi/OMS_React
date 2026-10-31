/**
 * The Aliases screen's doors (ticket 704; BackOffice door 3294).
 * Both writes need the insurance rules grant; a bare 403 is said in words, and HQ refuses an own approval itself.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import { aliasOf, liveAliases, type AliasDoorRow, type AliasForm, type AliasRow } from './alias-form'
import { REPINS_KEY } from '@/core/insurance-rules/registry-api'
import { affectedRows, draftOf, type AffectedRuleset, type LabelsDoorAffected, type RepinDoorAffected, type RepinDoorDraft, type RepinDraft } from './repin'

const ALIASES = `${INSURANCE_RULES_BASE}/Aliases`
const REPIN = `${INSURANCE_RULES_BASE}/Repin`

export const ALIASES_KEY = [...INSURANCE_RULES_KEY, 'aliases'] as const
export { REPINS_KEY }

/** 705's re-pin drafts (door 3294) and 708's labels-only ones (door 3297). */
export const repinApi = {
  /** `GET InsuranceRules/Repin/Affected` + `Repin/Labels/Affected` — each published ruleset still on an old form. */
  async affected(): Promise<AffectedRuleset[]> {
    const [paths, labels] = await Promise.all([
      api.get<RepinDoorAffected[] | null>(`${REPIN}/Affected`),
      api.get<LabelsDoorAffected[] | null>(`${REPIN}/Labels/Affected`),
    ])
    return affectedRows(paths, labels)
  },
  /** `POST InsuranceRules/Repin/Drafts { kind, keys }`, or `Repin/Labels/Drafts { kind }` → the draft, its back-test already run. */
  raise(row: Pick<AffectedRuleset, 'kind' | 'rulesetId' | 'changeId'>): Promise<RepinDraft> {
    const raised = row.kind === 'labels'
      ? api.post<RepinDoorDraft>(`${REPIN}/Labels/Drafts`, { kind: row.rulesetId })
      : api.post<RepinDoorDraft>(`${REPIN}/Drafts`, { kind: row.rulesetId, keys: [row.changeId] })
    return raised.then(draftOf)
  },
  /** `GET InsuranceRules/Repin/Drafts` lists what is pending; the door has no read of one draft. */
  async draft(id: string): Promise<RepinDraft> {
    const found = ((await api.get<RepinDoorDraft[] | null>(`${REPIN}/Drafts`)) ?? []).find((d) => d.id === id)
    if (!found) throw new Error('This re-pin draft is no longer pending.')
    return draftOf(found)
  },
  /** `POST InsuranceRules/Repin/Drafts/{id}/Approve` → the version published; the ruleset now runs on the new form. */
  approve(id: string): Promise<{ versionNo: number }> {
    return api.post<{ versionNo: number }>(`${REPIN}/Drafts/${encodeURIComponent(id)}/Approve`, {})
  },
}

export const aliasesApi = {
  /** `GET InsuranceRules/Aliases` — every alias, proposed and approved. */
  async list(): Promise<AliasRow[]> {
    return liveAliases(await api.get<AliasDoorRow[] | null>(ALIASES))
  },
  /** `POST InsuranceRules/Aliases` → the alias proposed. */
  propose(body: AliasForm): Promise<AliasRow> {
    return api.post<AliasDoorRow>(ALIASES, body).then(aliasOf)
  },
  /** `POST InsuranceRules/Aliases/{id}/Approve` → the alias approved. */
  approve(id: string): Promise<AliasRow> {
    return api.post<AliasDoorRow>(`${ALIASES}/${encodeURIComponent(id)}/Approve`, {}).then(aliasOf)
  },
}
