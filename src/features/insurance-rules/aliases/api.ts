/**
 * The Aliases screen's doors (ticket 704; BackOffice door 3294, unbuilt: the paths and shapes are guessed, 711 reconciles).
 * Both writes need the insurance rules grant; a bare 403 is said in words, and HQ refuses an own approval itself.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import type { AliasForm, AliasRow } from './alias-form'

const ALIASES = `${INSURANCE_RULES_BASE}/Aliases`

export const ALIASES_KEY = [...INSURANCE_RULES_KEY, 'aliases'] as const

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
