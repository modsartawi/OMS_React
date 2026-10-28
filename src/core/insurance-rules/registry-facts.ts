import { liveFields, type RegistryField } from './registry'

// The facts a condition can read, out of the Fields registry (BackOffice 3132 / 3144; oms 617). The guard
// palette (608's `fact` and `line` blocks) and 617's category and coverage editors offer what the registry
// holds — item, request, patient and eligibility fields — so a field the team adds appears in every picker at
// once, and an eligibility fact (`coverage.periodEnd`, a benefit's copay) is just a field of scope `eligibility`.
//
// The `$`-path is the editor's name for a fact, `$<scope>.<key>` (`$eligibility.coverage.periodEnd`, `$patient.age`);
// on the wire it is the engine's block of that scope, `{ check: <scope>, field: <key>, … }` (`./guard-wire`, oms 618).

/** `$<scope>.<key>`. */
export const factPath = (f: Pick<RegistryField, 'scope' | 'key'>): string => `$${f.scope}.${f.key}`

/** The registry field a `$`-path reads (retired ones too, so an old rule still names its fact). */
export const fieldOfPath = (fields: readonly RegistryField[], path: string): RegistryField | undefined => fields.find((f) => factPath(f) === path)

/** How a condition compares a field: a number with its unit, a day after / before, or codes any of / none of. */
export type FactKind = 'number' | 'date' | 'codes'
export const factKind = (f: Pick<RegistryField, 'type'>): FactKind => (f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'codes')

/**
 * The `fact` block's fields: every live field that is not a day (a day is the `line` block's "after") and not an
 * ITEM field — SIS.Rules reads an item-master field only as an item list's attribute filter (3132), never as a block
 * of its own, so it is offered in the Lists screen, not here (oms 618).
 */
export const factFields = (fields: readonly RegistryField[]): RegistryField[] =>
  liveFields(fields).filter((f) => f.scope !== 'item' && factKind(f) !== 'date')

/** The days a line's supply end can be compared with ("after the coverage end"). */
export const dateFields = (fields: readonly RegistryField[]): RegistryField[] => liveFields(fields).filter((f) => factKind(f) === 'date')

/**
 * The `line` block's numeric fields: the line facts HQ's registry holds (scope `line`, 3171's `idfPriority`) and any
 * request number. ⚠️ The registry seeds none of the engine's own line fields (`daysSupply`, `quantity`, `price`) —
 * listed on oms 618 for BackOffice.
 */
export const lineFields = (fields: readonly RegistryField[]): RegistryField[] =>
  liveFields(fields).filter((f) => (f.scope === 'line' || f.scope === 'request') && factKind(f) === 'number')

/** A unit as the locales name it (`editor.unit.*` / `sentence.fact.unit.*`), or null to show it as written. */
export function unitKey(unit: string | null | undefined): 'days' | 'years' | 'units' | 'sar' | 'percent' | null {
  const u = (unit ?? '').trim().toLowerCase()
  if (u === 'days' || u === 'years' || u === 'units') return u
  if (u === 'sar') return 'sar'
  if (u === '%' || u === 'percent') return 'percent'
  return null
}
