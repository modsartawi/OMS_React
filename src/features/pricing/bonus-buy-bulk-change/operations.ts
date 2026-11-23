/**
 * The engine-rules form ↔ the bulk change's operations (BackOffice spec 4190, oms 958). Pure.
 *
 * Every field defaults to **Leave**, and a Leave field is never sent: the server changes only what
 * the request names (story 24). Number fields take Set, stackable Yes/No, the time window Set/Clear,
 * the six lists Replace/Add/Remove/Clear. The outcome is never computed here: the preview is the
 * server's dry run.
 *
 * `fromOperations` is the way back — a preset (oms 960) holds operations, not a form, and starts the
 * form from them.
 */
import {
  BBY_BULK_LIST_FIELDS,
  type BbyBulkListField,
  type BbyBulkListOperation,
  type BbyBulkOperations,
} from '@/core/models/bonus-buy-bulk'

export type NumberOp = 'leave' | 'set'
export type StackableOp = 'leave' | 'yes' | 'no'
export type TimeOp = 'leave' | 'set' | 'clear'
export type ListOp = 'leave' | 'replace' | 'add' | 'remove' | 'clear'

export const NUMBER_OPS: readonly NumberOp[] = ['leave', 'set']
export const STACKABLE_OPS: readonly StackableOp[] = ['leave', 'yes', 'no']
export const TIME_OPS: readonly TimeOp[] = ['leave', 'set', 'clear']
export const LIST_OPS: readonly ListOp[] = ['leave', 'replace', 'add', 'remove', 'clear']

/** The form as typed: values are the inputs' strings, times `HH:mm` or `HH:mm:ss` (`<input type="time">`). */
export interface BulkForm {
  score: { op: NumberOp; value: string }
  maxValue: { op: NumberOp; value: string }
  isStackable: StackableOp
  timeWindow: { op: TimeOp; from: string; to: string }
  lists: Record<BbyBulkListField, { op: ListOp; value: string }>
}

/** A field whose operation is chosen but whose value cannot be sent. */
export type FormProblem = 'score' | 'maxValue' | 'timeWindow' | BbyBulkListField

const LEAVE_LIST = { op: 'leave', value: '' } as const

export const EMPTY_FORM: BulkForm = {
  score: { op: 'leave', value: '' },
  maxValue: { op: 'leave', value: '' },
  isStackable: 'leave',
  timeWindow: { op: 'leave', from: '', to: '' },
  lists: {
    includes: LEAVE_LIST,
    excludes: LEAVE_LIST,
    originFilter: LEAVE_LIST,
    stackingExcludes: LEAVE_LIST,
    loyGroups: LEAVE_LIST,
    loyTiers: LEAVE_LIST,
  },
}

/** The server's list separators (`BbyCodeList`): `, ; |`, space, tab and new lines. */
const SEPARATORS = /[,;| \t\r\n]+/

/** The codes a list value holds, as the server will split them. */
export function splitCodes(value: string): string[] {
  return value.split(SEPARATORS).filter((c) => c.length > 0)
}

/** `HH:mm` or `HH:mm:ss` → `HHmmss`, or null when it is not a time of day. */
export function toWireTime(value: string): string | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value.trim())
  return m ? `${m[1]}${m[2]}${m[3] ?? '00'}` : null
}

/** `HHmmss` → `HH:mm:ss` (what `<input type="time" step={1}>` shows); anything else as it came. */
export function fromWireTime(value: string | null | undefined): string {
  const v = (value ?? '').trim()
  return /^\d{6}$/.test(v) ? `${v.slice(0, 2)}:${v.slice(2, 4)}:${v.slice(4, 6)}` : v
}

/** A plain non-negative decimal: `12`, `12.5`, `12.` or `.5` (never a sign, an exponent or hex). */
const NUMBER = /^(\d+(\.\d*)?|\.\d+)$/

/** The operations the form names, and the fields that cannot be sent as typed (those are left out). */
export function toOperations(form: BulkForm): { operations: BbyBulkOperations; problems: FormProblem[] } {
  const operations: BbyBulkOperations = {}
  const problems: FormProblem[] = []

  if (form.score.op === 'set') {
    const v = form.score.value.trim()
    if (/^\d+$/.test(v)) operations.score = { op: 'set', value: Number(v) }
    else problems.push('score')
  }
  if (form.maxValue.op === 'set') {
    const v = form.maxValue.value.trim()
    if (NUMBER.test(v)) operations.maxValue = { op: 'set', value: Number(v) }
    else problems.push('maxValue')
  }
  if (form.isStackable !== 'leave') operations.isStackable = { op: 'set', value: form.isStackable === 'yes' }

  if (form.timeWindow.op === 'clear') operations.timeWindow = { op: 'clear' }
  else if (form.timeWindow.op === 'set') {
    const from = toWireTime(form.timeWindow.from)
    const to = toWireTime(form.timeWindow.to)
    if (from && to) operations.timeWindow = { op: 'set', from, to }
    else problems.push('timeWindow')
  }

  for (const field of BBY_BULK_LIST_FIELDS) {
    const { op, value } = form.lists[field]
    if (op === 'leave') continue
    if (op === 'clear') {
      operations[field] = { op: 'clear' }
      continue
    }
    if (splitCodes(value).length === 0) problems.push(field)
    else operations[field] = { op, value }
  }

  return { operations, problems }
}

/** True when the operations change anything at all. */
export function hasOperations(operations: BbyBulkOperations): boolean {
  return Object.values(operations).some((o) => o != null)
}

/** The form a set of operations stands for: every absent key is Leave. */
export function fromOperations(operations: BbyBulkOperations): BulkForm {
  const listForm = (o: BbyBulkListOperation | undefined) =>
    !o ? LEAVE_LIST : o.op === 'clear' ? { op: 'clear' as const, value: '' } : { op: o.op, value: o.value }
  const t = operations.timeWindow
  return {
    score: operations.score ? { op: 'set', value: String(operations.score.value) } : EMPTY_FORM.score,
    maxValue: operations.maxValue ? { op: 'set', value: String(operations.maxValue.value) } : EMPTY_FORM.maxValue,
    isStackable: operations.isStackable ? (operations.isStackable.value ? 'yes' : 'no') : 'leave',
    timeWindow: !t
      ? EMPTY_FORM.timeWindow
      : t.op === 'clear'
        ? { op: 'clear', from: '', to: '' }
        : { op: 'set', from: fromWireTime(t.from), to: fromWireTime(t.to) },
    lists: Object.fromEntries(BBY_BULK_LIST_FIELDS.map((f) => [f, listForm(operations[f])])) as BulkForm['lists'],
  }
}
