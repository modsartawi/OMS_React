/**
 * The Fields screen's own doors (BackOffice spec 3126; door 3132, oms ticket 610). Adding and retiring a field
 * need the master-data grant; there is no probe until 618, so a bare 403 on either is said in words. The read
 * (`GET InsuranceRules/Fields`) is `@/core/insurance-rules/registry-api`, which the guard palette shares.
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`, section 610): no door here has met a real SIS.Api.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE } from '@/core/insurance-rules/api'
import type { NewRegistryField, RegistryField } from '@/core/insurance-rules/registry'

export const fieldsApi = {
  /** `POST InsuranceRules/Fields` → the field added. A key in use is refused. */
  add(body: NewRegistryField): Promise<RegistryField> {
    return api.post<RegistryField>(`${INSURANCE_RULES_BASE}/Fields`, body)
  },
  /** `POST InsuranceRules/Fields/{key}/Retire` — never a delete: rules that name it keep reading it. */
  retire(key: string): Promise<unknown> {
    return api.post<unknown>(`${INSURANCE_RULES_BASE}/Fields/${encodeURIComponent(key)}/Retire`, {})
  },
}
