import type { CategoryGroup, CategorySimulateResult, CategorySource } from '@/core/insurance-rules/coverage-model'
import type { SimulateBody } from './simulate'

// Which category each simulated line got and who set it (story 61; review 3126 P6a), read from BackOffice 3145's
// built `POST InsuranceRules/Categories/Simulate { request, document? }` → `{ version, lines: [{ line, item,
// insuranceItemCategory, group, source: rule|default|none, ruleId, version, defaultCategory, unknowns }] }`, called
// beside the guard Simulate on the same typed request. No `document`: HQ runs the saved category draft, else the
// newest published one. Pure.

export interface CategorySimulateBody {
  request: Omit<SimulateBody['request'], 'lines'> & { lines: (SimulateBody['request']['lines'][number] & { line: number })[] }
}

/** The guard Simulate's request, each line numbered from 1 (the patient key is not the category's business). */
export function categorySimulateBody(body: SimulateBody): CategorySimulateBody {
  return { request: { ...body.request, lines: body.request.lines.map((l, i) => ({ line: i + 1, ...l })) } }
}

export interface LineCategory {
  source: CategorySource
  group: CategoryGroup | null
  /** The category rule that set it (`source: rule`). */
  ruleId: string | null
  /** The category as stamped: a rule's word, or the default's own spelling (Brand-IR …). */
  category: string | null
}

/** Line `line`'s category, or null when there is no answer or no row for it. */
export function lineCategory(answer: CategorySimulateResult | undefined, line: number): LineCategory | null {
  const row = answer?.lines.find((l) => l.line === line)
  if (!row) return null
  return { source: row.source, group: row.group ?? null, ruleId: row.source === 'rule' ? row.ruleId : null, category: row.insuranceItemCategory ?? row.defaultCategory ?? null }
}
