/**
 * The registry READS more than one insurance-rules feature needs (BackOffice 3132 + 3133; oms ticket 610): the
 * Fields (610's Lists + Fields pages, 608's palette, 617's eligibility facts), a code field's values for a
 * picker, and the patient / policy lists a condition names by id. Writes stay in the feature that makes them
 * (`features/insurance-rules/{fields,lists}/api.ts`). Every key under `['insurance-rules']`.
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`, section 610): no door here has met a real SIS.Api.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from './api'
import type { FieldValue, KeyedList, KeyedListKind, RegistryField } from './registry'

/** `PatientLists` / `PolicyLists` — the path segment of a keyed list kind. */
export const keyedListsPath = (kind: KeyedListKind): string => `${INSURANCE_RULES_BASE}/${kind === 'patient' ? 'PatientLists' : 'PolicyLists'}`

export const registryApi = {
  /** `GET InsuranceRules/Fields` — every field, retired ones included (flagged). */
  async fields(): Promise<RegistryField[]> {
    return (await api.get<RegistryField[] | null>(`${INSURANCE_RULES_BASE}/Fields`)) ?? []
  },
  /** `GET InsuranceRules/Fields/{key}/Values?q=` — code + description, for the picker. */
  async fieldValues(key: string, q: string): Promise<FieldValue[]> {
    return (await api.get<FieldValue[] | null>(`${INSURANCE_RULES_BASE}/Fields/${encodeURIComponent(key)}/Values`, { q })) ?? []
  },
  /** ⚠️ PROVISIONAL `GET InsuranceRules/PatientLists` | `PolicyLists` — the lists of a kind. */
  async keyedLists(kind: KeyedListKind): Promise<KeyedList[]> {
    return (await api.get<KeyedList[] | null>(keyedListsPath(kind))) ?? []
  },
}

export const FIELDS_KEY = [...INSURANCE_RULES_KEY, 'fields'] as const
export const fieldValuesKey = (key: string, q: string) => [...FIELDS_KEY, key, 'values', q] as const
export const keyedListsKey = (kind: KeyedListKind) => [...INSURANCE_RULES_KEY, 'keyed-lists', kind] as const

export function fieldsQuery() {
  return { queryKey: FIELDS_KEY, queryFn: () => registryApi.fields(), retry: false } as const
}

export function fieldValuesQuery(key: string, q: string) {
  return { queryKey: fieldValuesKey(key, q), queryFn: () => registryApi.fieldValues(key, q), retry: false, staleTime: 60_000 } as const
}

export function keyedListsQuery(kind: KeyedListKind) {
  return { queryKey: keyedListsKey(kind), queryFn: () => registryApi.keyedLists(kind), retry: false } as const
}
