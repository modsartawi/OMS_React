/**
 * Insurance rules ▸ Insurers, Categories, Coverage (oms ticket 617; BackOffice 3144 / 3145 / 3146). The insurer
 * settings doors are this feature's own; the category and coverage rulesets go through the SAME draft doors as
 * the guards (`rulesetDraftDoors` in core: `GET / PUT InsuranceRules/{Categories|Coverage}/Draft` with
 * `revision`, a stale PUT a 409; `POST …/Validate`).
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`, section 617); no door here has met a real SIS.Api.
 * No access probe: a session without the insurance grant is answered a bare 403.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY, rulesetDraftDoors } from '@/core/insurance-rules/api'
import type { InsuranceRuleKind, InsuranceRuleset } from '@/core/insurance-rules/coverage-model'
import type { InsurerRow, InsurerSettings, SettingsLogRow } from './settings'

const settingsPath = (payer: string) => `${INSURANCE_RULES_BASE}/Insurers/${encodeURIComponent(payer)}/Settings`

export const insurersApi = {
  /** ⚠️ PROVISIONAL `GET InsuranceRules/Insurers` → `[{ payer, name }]` (the brief spells no list door). */
  async list(): Promise<InsurerRow[]> {
    return (await api.get<InsurerRow[] | null>(`${INSURANCE_RULES_BASE}/Insurers`)) ?? []
  },
  /** `GET InsuranceRules/Insurers/{payer}/Settings`. */
  settings(payer: string): Promise<InsurerSettings> {
    return api.get<InsurerSettings>(settingsPath(payer))
  },
  /** `PUT InsuranceRules/Insurers/{payer}/Settings` — the whole settings; logged, not versioned. Answers the saved settings. */
  save(s: InsurerSettings): Promise<InsurerSettings> {
    return api.put<InsurerSettings>(settingsPath(s.payer), s)
  },
  /** `GET InsuranceRules/Insurers/{payer}/Settings/Log` — newest first. */
  async log(payer: string): Promise<SettingsLogRow[]> {
    return (await api.get<SettingsLogRow[] | null>(`${settingsPath(payer)}/Log`)) ?? []
  },
}

const DOORS = { category: 'Categories', coverage: 'Coverage' } as const

/** The draft doors of a category or coverage ruleset. */
export const rulesetDoors = (kind: InsuranceRuleKind) => rulesetDraftDoors<InsuranceRuleset>(DOORS[kind])

export const INSURERS_KEY = [...INSURANCE_RULES_KEY, 'insurers'] as const
export const settingsKey = (payer: string) => [...INSURERS_KEY, payer, 'settings'] as const
export const settingsLogKey = (payer: string) => [...INSURERS_KEY, payer, 'log'] as const
export const rulesetDraftKey = (kind: InsuranceRuleKind) => [...INSURANCE_RULES_KEY, kind, 'draft'] as const

export function rulesetDraftQuery(kind: InsuranceRuleKind) {
  return { queryKey: rulesetDraftKey(kind), queryFn: () => rulesetDoors(kind).read(), retry: false as const }
}
