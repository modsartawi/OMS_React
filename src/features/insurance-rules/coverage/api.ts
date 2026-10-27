/**
 * Insurance rules ▸ Insurers, Categories, Coverage (oms ticket 617; BackOffice 3144 / 3145 / 3146 as built). The
 * insurer settings doors are this feature's own; the category and coverage rulesets go through the guard document's
 * doors over their own documents (`rulesetDoors` in core `ruleset-draft`: `GET / PUT InsuranceRules/{Categories|
 * Coverage}/Draft`, Validate, Submit / Approve / SendBack, Versions / Restore).
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`, section 617); no door here has met a real SIS.Api.
 * No access probe: a session without the grant is answered a bare 403.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import type { InsuranceRuleKind, InsuranceRuleset } from '@/core/insurance-rules/coverage-model'
import { insurersKey } from '@/core/insurance-rules/registry-api'
import { rulesetDoors as coreRulesetDoors, type RulesetDraft } from '@/core/insurance-rules/ruleset-draft'
import type { InsurerSettings, SettingsLogRow } from './settings'

const settingsPath = (payer: string) => `${INSURANCE_RULES_BASE}/Insurers/${encodeURIComponent(payer)}/Settings`

/** Insurer-settings refusal codes (3144). */
export const INSURER_SETTINGS_NOT_FOUND = 'INSURER_SETTINGS_NOT_FOUND'

/** `GET InsuranceRules/Insurers` is core's `insurerSettingsQuery` (one cache entry with 610's class-list picker). */
export const insurersApi = {
  /** `GET InsuranceRules/Insurers/{payer}/Settings`; an unknown insurer is 404 `INSURER_SETTINGS_NOT_FOUND`. */
  settings(payer: string): Promise<InsurerSettings> {
    return api.get<InsurerSettings>(settingsPath(payer))
  },
  /**
   * `PUT InsuranceRules/Insurers/{payer}/Settings` — the whole settings with the author's `note`; creates the row
   * when there is none. Logged, not versioned. 400 `INSURER_SETTINGS_BAD_REQUEST`, one error per problem.
   */
  save(s: InsurerSettings): Promise<InsurerSettings> {
    return api.put<InsurerSettings>(settingsPath(s.payer), s)
  },
  /** `GET InsuranceRules/Insurers/{payer}/Settings/Log` — newest first. */
  async log(payer: string): Promise<SettingsLogRow[]> {
    return (await api.get<SettingsLogRow[] | null>(`${settingsPath(payer)}/Log`)) ?? []
  },
}

const DOORS = { category: 'Categories', coverage: 'Coverage' } as const
export const doorKind = (kind: InsuranceRuleKind) => DOORS[kind]

/** The draft doors of a category or coverage ruleset. */
export const rulesetDoors = (kind: InsuranceRuleKind) => coreRulesetDoors<InsuranceRuleset>(DOORS[kind])

export const INSURERS_KEY = insurersKey
export const settingsKey = (payer: string) => [...INSURERS_KEY, payer, 'settings'] as const
export const settingsLogKey = (payer: string) => [...INSURERS_KEY, payer, 'log'] as const
export const rulesetDraftKey = (kind: InsuranceRuleKind) => [...INSURANCE_RULES_KEY, kind, 'draft'] as const

export function rulesetDraftQuery(kind: InsuranceRuleKind) {
  return { queryKey: rulesetDraftKey(kind), queryFn: (): Promise<RulesetDraft<InsuranceRuleset>> => rulesetDoors(kind).draft(), retry: false as const }
}
