/**
 * The registry READS more than one insurance-rules feature needs (BackOffice 3132 + 3133; oms ticket 610): the
 * Fields (610's Lists + Fields pages, 608's palette, 617's eligibility facts), a code field's values for a
 * picker, and the patient / policy / class lists a condition names by id, and the insurers a class-list entry names. Writes stay in the feature that makes them
 * (`features/insurance-rules/{fields,lists}/api.ts`). Every key under `['insurance-rules']`.
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`, section 610): no door here has met a real SIS.Api.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from './api'
import type { Says } from './model'
import type { FieldValue, KeyedList, KeyedListKind, RegistryField } from './registry'

const KEYED_LIST_DOOR: Record<KeyedListKind, string> = { patient: 'PatientLists', policy: 'PolicyLists', class: 'ClassLists' }

/** `PatientLists` / `PolicyLists` / `ClassLists` — the path of a keyed list kind's doors. */
export const keyedListsPath = (kind: KeyedListKind): string => `${INSURANCE_RULES_BASE}/${KEYED_LIST_DOOR[kind]}`

/**
 * An insurer, as a class-list entry names one by its SAP customer id (`payer`). `GET InsuranceRules/Insurers` is
 * 3144's door as BUILT: every insurer's settings row (617's `InsurerSettings`), the estate default `*` among them,
 * and no name — so `name` is read only when HQ ever sends one, and the payer alone is shown otherwise.
 */
export interface Insurer {
  payer: string
  name?: Says | null
}

/** The estate default's `{payer}` (3144) — a settings row, not an insurer a class-list entry can name. */
export const ESTATE_DEFAULT_PAYER = '*'

export const registryApi = {
  /** `GET InsuranceRules/Fields` — every field, retired ones included (flagged). */
  async fields(): Promise<RegistryField[]> {
    return (await api.get<RegistryField[] | null>(`${INSURANCE_RULES_BASE}/Fields`)) ?? []
  },
  /** `GET InsuranceRules/Fields/{key}/Values?q=` — code + description, for the picker. */
  async fieldValues(key: string, q: string): Promise<FieldValue[]> {
    return (await api.get<FieldValue[] | null>(`${INSURANCE_RULES_BASE}/Fields/${encodeURIComponent(key)}/Values`, { q })) ?? []
  },
  /** `GET InsuranceRules/{Patient|Policy|Class}Lists` (3133 / 3172) — the lists of a kind. */
  async keyedLists(kind: KeyedListKind): Promise<KeyedList[]> {
    return (await api.get<KeyedList[] | null>(keyedListsPath(kind))) ?? []
  },
  /** `GET InsuranceRules/Insurers` — every insurer's row, the estate default `*` among them (`insurersQuery` drops it). */
  async insurers(): Promise<Insurer[]> {
    return (await api.get<Insurer[] | null>(`${INSURANCE_RULES_BASE}/Insurers`)) ?? []
  },
}

export const FIELDS_KEY = [...INSURANCE_RULES_KEY, 'fields'] as const
export const fieldValuesKey = (key: string, q: string) => [...FIELDS_KEY, key, 'values', q] as const
export const keyedListsKey = (kind: KeyedListKind) => [...INSURANCE_RULES_KEY, 'keyed-lists', kind] as const
/** The same key 617's Insurers page reads the same door under, so the two share one cache entry (raw rows; the
 * picker's `select` drops `*`). */
export const insurersKey = [...INSURANCE_RULES_KEY, 'insurers'] as const

export function fieldsQuery() {
  return { queryKey: FIELDS_KEY, queryFn: () => registryApi.fields(), retry: false } as const
}

export function fieldValuesQuery(key: string, q: string) {
  return { queryKey: fieldValuesKey(key, q), queryFn: () => registryApi.fieldValues(key, q), retry: false, staleTime: 60_000 } as const
}

export function keyedListsQuery(kind: KeyedListKind) {
  return { queryKey: keyedListsKey(kind), queryFn: () => registryApi.keyedLists(kind), retry: false } as const
}

export function insurersQuery() {
  return {
    queryKey: insurersKey,
    queryFn: () => registryApi.insurers(),
    // The insurers a class-list entry may name: never the estate default.
    select: (rows: Insurer[]) => rows.filter((i) => i.payer !== ESTATE_DEFAULT_PAYER),
    retry: false,
    staleTime: 60_000,
  } as const
}
