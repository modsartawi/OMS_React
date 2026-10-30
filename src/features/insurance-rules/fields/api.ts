/**
 * The Fields screen's own doors (BackOffice spec 3126; door 3132, oms ticket 610). Adding and retiring a field
 * need the master-data grant; there is no probe until 618, so a bare 403 on either is said in words. The read
 * (`GET InsuranceRules/Fields`) is `@/core/insurance-rules/registry-api`, which the guard palette shares.
 *
 * Reconciled with 3132 as built in oms 618: Add answers the field, Retire the retired field (409 `INSFIELDS_EXISTS`, 404
 * `INSFIELDS_NOT_FOUND`; master data `BackOfficeScreen[InsuranceRuleAuthoring, 01]`).
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE } from '@/core/insurance-rules/api'
import type { NewRegistryField, RegistryField } from '@/core/insurance-rules/registry'
import { FIELDS_KEY } from '@/core/insurance-rules/registry-api'
import type { CompileInput, CompileVerdict, FieldProposalBody, ProbeReply } from './raw-path'

/** Under `FIELDS_KEY`, so a proposal's arrival refreshes whatever reads the fields; 696's inbox reads it. */
export const FIELD_PROPOSALS_KEY = [...FIELDS_KEY, 'proposals'] as const

export const fieldsApi = {
  /** ⚠️ PROVISIONAL (oms 695; 711 reconciles): `POST InsuranceRules/Fields/Compile` — syntax, the refused functions, the type, the extension URLs, the case-only code. */
  async compile(input: CompileInput): Promise<CompileVerdict> {
    const r = await api.post<Partial<CompileVerdict> | null>(`${INSURANCE_RULES_BASE}/Fields/Compile`, input)
    return { refusals: r?.refusals ?? [], warnings: r?.warnings ?? [] }
  },
  /** ⚠️ PROVISIONAL (oms 695): `POST InsuranceRules/Fields/Probe` — the path over the kept bundles and samples, per payer. */
  async probe(input: CompileInput): Promise<ProbeReply> {
    const r = await api.post<Partial<ProbeReply> | null>(`${INSURANCE_RULES_BASE}/Fields/Probe`, input)
    return { payers: r?.payers ?? [], refusals: r?.refusals ?? [] }
  },
  /** ⚠️ PROVISIONAL (oms 695): `POST InsuranceRules/Fields/Proposals` — the row joins the inbox; the catalog only once someone else approves it. */
  propose(body: FieldProposalBody): Promise<unknown> {
    return api.post<unknown>(`${INSURANCE_RULES_BASE}/Fields/Proposals`, body)
  },
  /** `POST InsuranceRules/Fields` → the field added. A key in use is refused. */
  add(body: NewRegistryField): Promise<RegistryField> {
    return api.post<RegistryField>(`${INSURANCE_RULES_BASE}/Fields`, body)
  },
  /** `POST InsuranceRules/Fields/{key}/Retire` — never a delete: rules that name it keep reading it. */
  retire(key: string): Promise<unknown> {
    return api.post<unknown>(`${INSURANCE_RULES_BASE}/Fields/${encodeURIComponent(key)}/Retire`, {})
  },
}
