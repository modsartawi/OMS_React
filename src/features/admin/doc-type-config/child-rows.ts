/**
 * A document type's child rows (BackOffice spec 3148 stories 21-25, 58; ticket 3151): its item-category assignment
 * rows and its plant network rows. One set of rules for both tables, as pure functions the dialog renders: a row's key
 * is locked once it exists (a different key is a remove and an add), a key the type already has is refused before the
 * server sees it (the server refuses it too: SDC-00021 / SDC-00025), the required columns must be filled, and every
 * write carries a reason (the core rule, 1-200 characters) and — for a change or remove — the row as it was loaded,
 * so a row someone else changed since is refused (SDC-00004) instead of overwritten. Pure: no React, no `t`.
 */
import { reasonField, type ReasonCheck } from '@/core/reason/reason'
import type { ChildRowChangeRequest, ItemCategoryAssignmentRow, PlantNetworkRow } from './types'

export type ChildRowMode = 'add' | 'edit' | 'remove'

/** Where a column's choices come from: the item categories, the plant networks, or typed. */
export type ChildColumnSource = 'itemCategory' | 'plantNetwork' | 'text'

export interface ChildColumn<R> {
  field: Exclude<keyof R, 'documentType'> & string
  /** The column's width (DDL): the input never lets through more. */
  maxLength: number
  source: ChildColumnSource
}

export interface ChildRowSpec<R> {
  /** The i18n sub-key: `childRows.<id>.*`. */
  id: 'itemCategoryAssignments' | 'plantNetworks'
  /** The key columns, after the owning type, in key order. */
  keyFields: readonly ChildColumn<R>[]
  valueFields: readonly ChildColumn<R>[]
  required: readonly (keyof R & string)[]
}

export const ITEM_CATEGORY_ASSIGNMENT: ChildRowSpec<ItemCategoryAssignmentRow> = {
  id: 'itemCategoryAssignments',
  keyFields: [
    { field: 'itemCategoryGroup', maxLength: 4, source: 'text' },
    { field: 'itemUsage', maxLength: 4, source: 'text' },
  ],
  valueFields: [
    { field: 'defaultItemCategory', maxLength: 4, source: 'itemCategory' },
    { field: 'manualItemCategory1', maxLength: 4, source: 'itemCategory' },
    { field: 'manualItemCategory2', maxLength: 4, source: 'itemCategory' },
    { field: 'manualItemCategory3', maxLength: 4, source: 'itemCategory' },
    { field: 'manualItemCategory4', maxLength: 4, source: 'itemCategory' },
  ],
  required: ['defaultItemCategory'],
}

export const PLANT_NETWORK: ChildRowSpec<PlantNetworkRow> = {
  id: 'plantNetworks',
  keyFields: [{ field: 'plantNetworkId', maxLength: 6, source: 'plantNetwork' }],
  valueFields: [{ field: 'plantCode', maxLength: 4, source: 'text' }],
  required: ['plantNetworkId', 'plantCode'],
}

type Row = { documentType: string }

const code = (v: unknown) => String(v ?? '').trim().toUpperCase()

/** The row's key as the server matches it (trimmed, case-blind) and logs it after the type, joined by `|`. */
export function childRowKey<R extends Row>(spec: ChildRowSpec<R>, row: R): string {
  return spec.keyFields.map((c) => code(row[c.field])).join('|')
}

/** A blank row of the type, every column ''. */
export function emptyChildRow<R extends Row>(spec: ChildRowSpec<R>, documentType: string): R {
  const row: Record<string, string> = { documentType }
  for (const c of [...spec.keyFields, ...spec.valueFields]) row[c.field] = ''
  return row as unknown as R
}

/** The draft with one column set — or the very same draft for a key column of an existing row (locked). */
export function setChildField<R extends Row>(spec: ChildRowSpec<R>, mode: ChildRowMode, draft: R, field: keyof R & string, value: string): R {
  if (mode !== 'add' && spec.keyFields.some((c) => c.field === field)) return draft
  return { ...draft, [field]: value }
}

export type ChildRowBlocker = 'missing' | 'duplicate' | 'noChange' | 'reason'

export interface ChildColumnChange {
  field: string
  before: string
  after: string
}

export interface ChildRowState {
  /** The columns that differ from the loaded row (a change), or every filled column (an add). */
  changes: ChildColumnChange[]
  /** Required columns left blank. */
  missing: string[]
  reason: ReasonCheck
  canSave: boolean
  /** Why Save is disabled, or `null` when it may be pressed. */
  blocker: ChildRowBlocker | null
}

export function childRowState<R extends Row>(
  spec: ChildRowSpec<R>,
  mode: ChildRowMode,
  loaded: R | null,
  draft: R,
  existing: readonly R[],
  reasonText: string,
): ChildRowState {
  const reason = reasonField(reasonText)
  const columns = [...spec.keyFields, ...spec.valueFields]
  const before = (f: keyof R) => (loaded ? code(loaded[f]) : '')
  const changes =
    mode === 'remove'
      ? []
      : columns.flatMap(({ field }) => (code(draft[field]) === before(field) ? [] : [{ field, before: before(field), after: code(draft[field]) }]))
  const missing = mode === 'remove' ? [] : spec.required.filter((f) => code(draft[f]) === '')
  const key = childRowKey(spec, draft)
  const duplicate = mode === 'add' && existing.some((r) => childRowKey(spec, r) === key)

  const blocker: ChildRowBlocker | null =
    missing.length > 0
      ? 'missing'
      : duplicate
        ? 'duplicate'
        : mode === 'edit' && changes.length === 0
          ? 'noChange'
          : reason.problem !== null
            ? 'reason'
            : null
  return { changes, missing, reason, canSave: blocker === null, blocker }
}

/** What the door receives: an add sends the after-state, a remove the loaded row, a change both. */
export function childRowRequest<R>(mode: ChildRowMode, loaded: R | null, draft: R, reasonText: string): ChildRowChangeRequest<R> {
  const reason = reasonField(reasonText).reason
  if (mode === 'add') return { after: draft, reason }
  if (mode === 'remove') return { before: loaded ?? draft, reason }
  return { before: loaded ?? draft, after: draft, reason }
}
