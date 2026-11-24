/**
 * The bulk change's answer, read for the preview (dry run) and the apply report (BackOffice spec 4190
 * stories 25–27, 31; oms 958). Pure.
 *
 * The outcome is the server's: the preview IS the dry run, so nothing here decides what would save.
 * It only lays each row's old and new engine rules side by side, field by field, keeping the fields
 * that differ.
 */
import type { BbyEngineRulesWire, BbyRefusal } from '@/core/models/bonus-buy-maintenance'
import { BBY_BULK_LIST_FIELDS, type BbyBulkChangeResult, type BbyBulkListField } from '@/core/models/bonus-buy-bulk'
import { formatRange } from '@/core/util/bidi'
import { fromWireTime, splitCodes } from './operations'

/** The engine rules in the form's order; the time window is one field (both ends or neither). */
export type EngineField = 'score' | 'isStackable' | 'maxValue' | 'timeWindow' | BbyBulkListField

export const ENGINE_FIELDS: readonly EngineField[] = ['score', 'isStackable', 'maxValue', 'timeWindow', ...BBY_BULK_LIST_FIELDS]

export type RuleValue = string | number | boolean

export interface FieldChange {
  field: EngineField
  before: RuleValue
  after: RuleValue
  /** A list field only: the codes the change adds and removes (case-insensitive, in their own order). */
  added?: string[]
  removed?: string[]
}

/** `save` is written (apply) or would be (dry run); `skip` changes nothing; `refuse` is not written. */
export type RowOutcome = 'save' | 'skip' | 'refuse' | 'unknown'

export interface ResultRow {
  number: string
  outcome: RowOutcome
  changes: FieldChange[]
  refusals: BbyRefusal[]
  warnings: BbyRefusal[]
}

export interface BulkResultReading {
  dryRun: boolean
  batchId: string | null
  /** The whole batch was refused before any row was touched (mixed sales areas, over the cap). */
  refusedWhole: boolean
  batchRefusals: BbyRefusal[]
  rows: ResultRow[]
  counts: Record<RowOutcome, number>
}

function outcomeOf(status: string): RowOutcome {
  if (status === 'saved' || status === 'valid') return 'save'
  if (status === 'skipped') return 'skip'
  if (status === 'refused' || status === 'notFound') return 'refuse'
  return 'unknown'
}

/** The server's `changedFields` names (`BbyEngineRules` properties, PascalCase) → the form's fields. */
const CHANGED_FIELD: Record<string, EngineField> = {
  score: 'score',
  isstackable: 'isStackable',
  maxvalue: 'maxValue',
  validfromtime: 'timeWindow',
  validtotime: 'timeWindow',
  includes: 'includes',
  excludes: 'excludes',
  originfilter: 'originFilter',
  stackingexcludes: 'stackingExcludes',
  loygroups: 'loyGroups',
  loytiers: 'loyTiers',
}

/** The fields the server says the change alters, or null when it named none (then every differing field shows). */
function namedFields(changedFields: string[] | null | undefined): Set<EngineField> | null {
  if (!changedFields || changedFields.length === 0) return null
  const named = new Set<EngineField>()
  for (const f of changedFields) {
    const field = CHANGED_FIELD[f.toLowerCase()]
    if (field) named.add(field)
  }
  return named
}

const list = (v: string | null | undefined) => splitCodes(v ?? '').join(',')
const lower = (codes: string[]) => new Set(codes.map((c) => c.toLowerCase()))
const minus = (a: string[], b: string[]) => {
  const not = lower(b)
  return a.filter((c) => !not.has(c.toLowerCase()))
}

function valueOf(field: EngineField, r: BbyEngineRulesWire): RuleValue {
  switch (field) {
    case 'score':
      return r.score
    case 'maxValue':
      return r.maxValue
    case 'isStackable':
      return r.isStackable
    case 'timeWindow':
      return formatRange(fromWireTime(r.validFromTime), fromWireTime(r.validToTime))
    default:
      return list(r[field])
  }
}

/** The fields whose value differs between the two rule sets, in `ENGINE_FIELDS` order. */
export function changesBetween(before: BbyEngineRulesWire | null | undefined, after: BbyEngineRulesWire | null | undefined): FieldChange[] {
  if (!before || !after) return []
  const changes: FieldChange[] = []
  for (const field of ENGINE_FIELDS) {
    const b = valueOf(field, before)
    const a = valueOf(field, after)
    if (b === a) continue
    if (typeof b === 'string' && typeof a === 'string' && field !== 'timeWindow') {
      const bc = splitCodes(b)
      const ac = splitCodes(a)
      changes.push({ field, before: b, after: a, added: minus(ac, bc), removed: minus(bc, ac) })
    } else {
      changes.push({ field, before: b, after: a })
    }
  }
  return changes
}

/**
 * `dryRun` is the request's flag, and it wins: a dry run refused whole may come back with no flag and
 * a `refused` status, and must still read as a preview, never as an apply.
 */
export function readBulkResult(result: BbyBulkChangeResult, dryRun: boolean): BulkResultReading {
  const rows: ResultRow[] = (result.bonusBuys ?? []).map((r) => {
    const outcome = outcomeOf(r.status)
    // The server names the fields its operations change; the validator may reshape others in `after`
    // (normalising), which the change did not make, so only the named ones are laid out.
    const named = namedFields(r.changedFields)
    const changes = outcome === 'save' ? changesBetween(r.before, r.after) : []
    return {
      number: r.number,
      outcome,
      changes: named ? changes.filter((c) => named.has(c.field)) : changes,
      refusals: r.refusals ?? [],
      warnings: r.warnings ?? [],
    }
  })
  const counts: Record<RowOutcome, number> = { save: 0, skip: 0, refuse: 0, unknown: 0 }
  for (const r of rows) counts[r.outcome]++
  return {
    dryRun,
    batchId: result.batchId ?? null,
    refusedWhole: result.status === 'refused' && rows.length === 0,
    batchRefusals: result.refusals ?? [],
    rows,
    counts,
  }
}
