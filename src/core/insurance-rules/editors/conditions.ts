import {
  ELIGIBILITY_BOUNDS,
  ELIGIBILITY_DATE_TESTS,
  eligibilityTests,
  type EligibilityCondition,
  type EligibilityTest,
  type GuardList,
  type Says,
} from '@/core/insurance-rules/model'
import type { RegistryField } from '@/core/insurance-rules/registry'
import { fieldOfPath } from '@/core/insurance-rules/registry-facts'

// The pure parts of the coverage IF editor's item-list and eligibility rows (oms 674). The editor itself is
// `./RuleConditions`; the words are the page's (`insurance-coverage` `conditions.*`).

/** One attribute filter of an item list as the row words it: the field (by its registry name when it has one) and its codes. */
export interface ListAttributePart {
  field: string
  label: Says | null
  op: 'anyOf' | 'noneOf'
  codes: string[]
}

/** What an item list filters on, filter by filter (any filter matches), so a rule reads without opening the list. */
export interface ListSummary {
  filters: { attributes: ListAttributePart[]; articles: number; categories: number }[]
  include: string[]
  exclude: string[]
}

/** A list of the document, summarised; an attribute's field is named by the registry's item field of that key, else as written. */
export function listSummary(list: GuardList, fields: readonly RegistryField[]): ListSummary {
  return {
    filters: (list.filters ?? []).map((f) => ({
      attributes: (f.attributes ?? []).map((a) => {
        const label = fieldOfPath(fields, `$item.${a.field}`)?.label ?? null
        return a.noneOf ? { field: a.field, label, op: 'noneOf' as const, codes: a.noneOf } : { field: a.field, label, op: 'anyOf' as const, codes: a.anyOf ?? [] }
      }),
      articles: (f.articles ?? []).length,
      categories: (f.categories ?? []).length,
    })),
    include: list.include ?? [],
    exclude: list.exclude ?? [],
  }
}

/** The family a test switches within: a bound to another bound, a day test to another day test; `anyOf` and `is` alone. */
function family(test: EligibilityTest): readonly EligibilityTest[] {
  if ((ELIGIBILITY_BOUNDS as readonly string[]).includes(test)) return ELIGIBILITY_BOUNDS
  if ((ELIGIBILITY_DATE_TESTS as readonly string[]).includes(test)) return ELIGIBILITY_DATE_TESTS
  return [test]
}

/** The operators one test of the block may become: its family, less the ones another test of the block already uses. */
export function testChoices(c: EligibilityCondition, test: EligibilityTest): EligibilityTest[] {
  const others = eligibilityTests(c).filter((k) => k !== test)
  return family(test).filter((k) => !others.includes(k))
}

/** The block with one test's operator changed IN PLACE (its value kept), so every other key keeps its order. */
export function renameTest(c: EligibilityCondition, from: EligibilityTest, to: EligibilityTest): EligibilityCondition {
  if (from === to || !(from in c) || to in c) return c
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k === from ? to : k, v])) as unknown as EligibilityCondition
}
