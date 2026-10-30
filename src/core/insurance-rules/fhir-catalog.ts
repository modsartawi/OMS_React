// The FHIR fact catalog (BackOffice spec 3271, 3262 V1; oms 692). Pure: no React, no http. In core because the guard
// and monitor editors both pick from it and the Fields page lists it.
//
// ⚠️ PROVISIONAL: no door ticket spells the catalog's row, so this shape is a guess that 711 reconciles.

import type { Says } from './model'

/** The messages a fact reads, in the order the catalog shows them (story 1). */
export const FHIR_MESSAGES = ['eligibility', 'claim', 'claimResponse', 'communication', 'payment'] as const
export type FhirMessage = (typeof FHIR_MESSAGES)[number]

export const FHIR_LEVELS = ['message', 'line'] as const
export type FhirLevel = (typeof FHIR_LEVELS)[number]

/** A catalog type: the registry's four, and the three a FHIR value adds (F8-F12; 693 gives them their operators). */
export type FhirFactType = 'text' | 'number' | 'date' | 'flag' | 'code' | 'money' | 'quantity'

/** How often a channel answers a field (J14). */
export const CHANNEL_ANSWERS = ['answers', 'sometimes', 'never'] as const
export type ChannelAnswer = (typeof CHANNEL_ANSWERS)[number]

export interface ChannelRate {
  /** `nphies`, `bupa`, … as HQ names it. */
  channel: string
  answer: ChannelAnswer
}

/** A field whose CodeSystem Nphies removed (V5). 694 draws it. */
export interface FhirLegacy {
  /** Local day. */
  removedOn: string
  /** The catalog key that replaces it. */
  replacement: string
}

/** One field of `GET InsuranceRules/Fields/Catalog`. */
export interface FhirCatalogRow {
  /** As stored after its scope: `coverage.class`, `copay`. A parameterised key holds `[*]` where the code goes. */
  key: string
  label: Says
  /** Which message it reads. */
  moment: FhirMessage
  /** A line field is written once against the line's own `Claim.item`, never with a sequence number. */
  level: FhirLevel
  type: FhirFactType
  unit: string | null
  fhirPath: string
  cardinality: 'single' | 'list'
  /** The declared code system of a code field. */
  system: string | null
  channels: ChannelRate[]
  /** What fills the key's `[*]` (`category`); null when it has none. 694 offers its list. */
  parameter: string | null
  /** The FHIR choice types the field converts (C5); null when it is not a choice. */
  choice: string[] | null
  legacy: FhirLegacy | null
  retired: boolean
}

/** The rule key a pick stores (story 17): `$claim.total`, `$line.claimResponse.copay`. */
export const factKey = (r: Pick<FhirCatalogRow, 'moment' | 'level' | 'key'>): string => `$${r.level === 'line' ? 'line.' : ''}${r.moment}.${r.key}`

/** The key a parameterised field stores once a code is chosen (story 4): `$eligibility.benefit[66].copayPct`. */
export const codedFactKey = (r: Pick<FhirCatalogRow, 'moment' | 'level' | 'key'>, code: string): string => factKey(r).replace('[*]', `[${code}]`)

/** Whether a `$`-path sits on a FHIR message, so the catalog could hold it. A patient or request fact never can. */
export const mayBeCatalogKey = (path: string): boolean => /^\$(line\.)?(claim|claimResponse)\.|^\$(eligibility|communication|payment)\./.test(path)

/** The catalog's field for a stored key, with the code the key names (`null` when it names none). */
export function catalogEntryOf(rows: readonly FhirCatalogRow[], path: string): { row: FhirCatalogRow; code: string | null } | null {
  const code = /\[([^\]*]+)\]/.exec(path)?.[1] ?? null
  const wild = code === null ? path : path.replace(`[${code}]`, '[*]')
  const row = rows.find((r) => factKey(r) === wild)
  return row ? { row, code } : null
}

/**
 * ⚠️ PROVISIONAL (oms 694; 711 reconciles): one code of a parameter's list, from the workbook's CodeSystem (V2).
 * `census` is how many payers the census saw send it; 0 is a code nobody has sent, which a rule may still name.
 */
export interface FhirParameterCode {
  code: string
  label: Says
  census: number
}

export interface ParameterOption extends FhirParameterCode {
  seen: 'seen' | 'never' | 'unlisted'
}

/** The list as the door gives it, none hidden. A code the rule already names and the list lost stays, marked. */
export function parameterOptions(list: readonly FhirParameterCode[], current: string | null): ParameterOption[] {
  const options = list.map((c): ParameterOption => ({ ...c, seen: c.census > 0 ? 'seen' : 'never' }))
  if (current === null || list.some((c) => c.code === current)) return options
  return [{ code: current, label: { en: '', ar: '' }, census: 0, seen: 'unlisted' }, ...options]
}

export interface CatalogLevelGroup {
  level: FhirLevel
  rows: FhirCatalogRow[]
}
export interface CatalogGroup {
  message: FhirMessage
  levels: CatalogLevelGroup[]
}

/** By message, then message-level against line-level. A message or level with no field is left out. */
export function groupCatalog(rows: readonly FhirCatalogRow[]): CatalogGroup[] {
  return FHIR_MESSAGES.map((message) => ({
    message,
    levels: FHIR_LEVELS.map((level) => ({ level, rows: rows.filter((r) => r.moment === message && r.level === level) })).filter((g) => g.rows.length > 0),
  })).filter((g) => g.levels.length > 0)
}

/** The `fact` block's fields after a pick. Every type starts as a number bound or codes until 693 gives it its own. */
export function pickedFact(r: FhirCatalogRow, code?: string): { path: string; op: 'atLeast'; value: number } | { path: string; op: 'anyOf'; value: string[] } {
  const path = code === undefined ? factKey(r) : codedFactKey(r, code)
  return r.type === 'number' || r.type === 'money' || r.type === 'quantity' ? { path, op: 'atLeast', value: 0 } : { path, op: 'anyOf', value: [] }
}
