/**
 * The Aliases screen's doors (ticket 704; BackOffice door 3294, unbuilt: the paths and shapes are guessed, 711 reconciles).
 * Both writes need the insurance rules grant; a bare 403 is said in words, and HQ refuses an own approval itself.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import type { AliasForm, AliasRow } from './alias-form'
import type { AffectedRuleset, RepinDraft } from './repin'

const ALIASES = `${INSURANCE_RULES_BASE}/Aliases`
const REPINS = `${INSURANCE_RULES_BASE}/RepinDrafts`

export const ALIASES_KEY = [...INSURANCE_RULES_KEY, 'aliases'] as const
export const REPINS_KEY = [...INSURANCE_RULES_KEY, 'repins'] as const

/** 705's re-pin drafts (door 3294, unbuilt: guessed as above). */
export const repinApi = {
  /** `GET InsuranceRules/RepinDrafts/Affected` — each published ruleset still on an old form. */
  async affected(): Promise<AffectedRuleset[]> {
    return (await api.get<AffectedRuleset[] | null>(`${REPINS}/Affected`)) ?? []
  },
  /** `POST InsuranceRules/RepinDrafts` → the draft, its back-test started. */
  raise(row: Pick<AffectedRuleset, 'rulesetId' | 'changeId'>): Promise<RepinDraft> {
    return api.post<RepinDraft>(REPINS, { rulesetId: row.rulesetId, changeId: row.changeId })
  },
  /** `GET InsuranceRules/RepinDrafts/{id}` — polled while its back-test runs. */
  draft(id: string): Promise<RepinDraft> {
    return api.get<RepinDraft>(`${REPINS}/${encodeURIComponent(id)}`)
  },
  /** `POST InsuranceRules/RepinDrafts/{id}/Approve` → the draft approved; the ruleset now runs on the new form. */
  approve(id: string): Promise<RepinDraft> {
    return api.post<RepinDraft>(`${REPINS}/${encodeURIComponent(id)}/Approve`, {})
  },
}

export const aliasesApi = {
  /** `GET InsuranceRules/Aliases` — every alias, proposed and approved. */
  async list(): Promise<AliasRow[]> {
    return (await api.get<AliasRow[] | null>(ALIASES)) ?? []
  },
  /** `POST InsuranceRules/Aliases` → the alias proposed. */
  propose(body: AliasForm): Promise<AliasRow> {
    return api.post<AliasRow>(ALIASES, body)
  },
  /** `POST InsuranceRules/Aliases/{id}/Approve` → the alias approved. */
  approve(id: string): Promise<AliasRow> {
    return api.post<AliasRow>(`${ALIASES}/${encodeURIComponent(id)}/Approve`, {})
  },
}
