// The FHIR fact catalog (BackOffice spec 3271, 3262 V1; oms 692). Pure: no React, no http. In core because the guard
// and monitor editors both pick from it and the Fields page lists it.
//
// ⚠️ PROVISIONAL: no door ticket spells the catalog's row, so this shape is a guess that 711 reconciles.

import { factTestFor, shapeOfRow } from './fact-tests'
import type { FactCondition, Says } from './model'

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

/** The `fact` block's fields after a pick: its key, and the first test its type allows (693). `system` is always set, so a pick clears the last one's. */
export function pickedFact(r: FhirCatalogRow): Pick<FactCondition, 'path' | 'op' | 'value' | 'system'> {
  return { path: factKey(r), system: undefined, ...factTestFor(shapeOfRow(r)) }
}
