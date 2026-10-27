/**
 * A change-log row's field-level diff (BackOffice spec 3148 story 51, ticket 3152), computed when read from the row's
 * before / after JSON snapshots — the server stores whole rows by column name (`SdConfigChangeLog.BeforeJson` /
 * `AfterJson`), never the diff. Pure: no React, no `t`.
 *
 * 🔑 Generic over the entity type (document type, its child rows, delivery types, action types, sources): it knows
 * nothing of any one shape, so 3154–3156 mount the same History tab unchanged.
 *
 * The rule, shared with the server's Excel export (`SdConfigChangeLogWorkbook.Changes`): one line per field whose
 * value differs, in the snapshot's own order (after's fields, then any only before has); strings compare trimmed,
 * amounts by value, a missing field reads as blank. So an update lists what changed, a create or copy every field it
 * set, a delete every field it removed.
 */

import { wireField } from './field-meta'

export type DiffValue = string | number | boolean | null

export interface DiffLine {
  /** The column name, as the snapshot spells it (`IsPickedOnOrder`). */
  column: string
  /** Absent on a create / copy (no before) and for a field the before snapshot lacks. */
  before: DiffValue | undefined
  /** Absent on a delete (no after) and for a field the after snapshot lacks. */
  after: DiffValue | undefined
}

export type DiffKind = 'create' | 'copy' | 'update' | 'delete' | 'unreadable'

export interface FieldDiff {
  kind: DiffKind
  lines: DiffLine[]
}

export interface DiffSource {
  action: string
  beforeJson: string
  afterJson: string
}

type Snapshot = Record<string, DiffValue>

/** '' is no snapshot (no fields); anything that is not a JSON object is unreadable (null). */
function parse(json: string): Snapshot | null {
  if (!json || json.trim() === '') return {}
  try {
    const value: unknown = JSON.parse(json)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Snapshot) : null
  } catch {
    return null
  }
}

/** What a value compares as: blank for none, strings trimmed, everything else itself. */
const norm = (v: DiffValue | undefined): string | number | boolean => (v === undefined || v === null ? '' : typeof v === 'string' ? v.trim() : v)

const KINDS: Record<string, DiffKind> = { Create: 'create', Copy: 'copy', Update: 'update', Delete: 'delete' }

export function fieldDiff(row: DiffSource): FieldDiff {
  const before = parse(row.beforeJson)
  const after = parse(row.afterJson)
  if (before === null || after === null) return { kind: 'unreadable', lines: [] }

  const columns = [...Object.keys(after), ...Object.keys(before).filter((c) => !(c in after))]
  const lines = columns.flatMap((column): DiffLine[] => {
    const b = column in before ? before[column] : undefined
    const a = column in after ? after[column] : undefined
    return norm(b) === norm(a) ? [] : [{ column, before: b, after: a }]
  })
  return { kind: KINDS[row.action] ?? 'update', lines }
}

/** The screen field a column labels: `IsPickedOnOrder` → `isPickedOnOrder` (the camelCase the doors emit) — the field
 *  metadata's own `wireField`, one rule for both. */
export const columnField = wireField
