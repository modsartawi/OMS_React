/**
 * One general item's group and priority, set or cleared with a reason, pure (BackOffice spec 3185, door 3192; oms
 * ticket 648). The general master has no draft: a single fix is `PUT IdfPriority/general/items/{itemNumber}
 * { idfNumber, priority, reason }` (an Edit of a listed row, or Set item for an item not yet in it) and a clear is
 * `DELETE IdfPriority/general/items/{itemNumber} { reason }`. Both apply at once; a refusal carries the server's
 * message, which the dialog shows.
 *
 * 654 reconciled with the doors as built (BackOffice 3192): each answers the item's row (a clear: `idfNumber ''`,
 * `priority 0`); refusals `IDF-00039` (unknown item), `IDF-00040` (not an IDF group — at most 8 characters — or a
 * priority that is not a whole number of 1 or more), `IDF-00041` (no reason, or one over 400 characters).
 */
import { reasonProblem } from './exceptions'
import { IDF_GROUP_NUMBER_MAX } from './groups'
import type { IdfEntryRow } from './items'

/** The body of `PUT IdfPriority/general/items/{itemNumber}`. */
export interface IdfGeneralSetBody {
  idfNumber: string
  priority: number
  reason: string
}

/** The body of `DELETE IdfPriority/general/items/{itemNumber}`. */
export interface IdfGeneralClearBody {
  reason: string
}

/** The dialog's fields, as typed. */
export interface IdfGeneralEditForm {
  itemNumber: string
  idfNumber: string
  priority: string
  reason: string
}

/** `set` — Set item, the item number typed; `edit` — a listed row, its item number fixed. */
export type IdfGeneralEditMode = 'set' | 'edit'

export const NEW_GENERAL_ITEM_FORM: IdfGeneralEditForm = { itemNumber: '', idfNumber: '', priority: '', reason: '' }

export type IdfGeneralEditProblem = 'itemRequired' | 'groupRequired' | 'groupTooLong' | 'priorityRequired' | 'priorityWholeNumber' | 'reasonRequired' | 'reasonTooLong'
export type IdfGeneralEditProblems = Partial<Record<keyof IdfGeneralEditForm, IdfGeneralEditProblem>>

/**
 * A typed priority as the doors take it — a whole number of 1 or more (digits only: no sign, decimal, hex or exponent)
 * — or null. The one rule for every IDF priority box (the general edit, the draft's add, add-a-group and re-rank).
 */
export function wholePriority(typed: string): number | null {
  const p = typed.trim()
  if (!/^\d+$/.test(p)) return null
  const n = Number(p)
  return n >= 1 ? n : null
}

/** An edit starts from the row's group and priority; the reason is always the user's own. */
export function generalFormFromRow(row: IdfEntryRow): IdfGeneralEditForm {
  return { itemNumber: row.itemNumber, idfNumber: row.idfNumber, priority: String(row.priority), reason: '' }
}

/** Why the form may not be sent yet: a group (≤ 8, an IDF group's width), a whole priority of 1 or more, a reason (≤ 400). */
export function generalEditProblems(f: IdfGeneralEditForm, mode: IdfGeneralEditMode): IdfGeneralEditProblems {
  const out: IdfGeneralEditProblems = {}
  if (mode === 'set' && !f.itemNumber.trim()) out.itemNumber = 'itemRequired'
  const group = f.idfNumber.trim()
  if (!group) out.idfNumber = 'groupRequired'
  else if (group.length > IDF_GROUP_NUMBER_MAX) out.idfNumber = 'groupTooLong'
  if (!f.priority.trim()) out.priority = 'priorityRequired'
  else if (wholePriority(f.priority) === null) out.priority = 'priorityWholeNumber'
  const reason = reasonProblem(f.reason)
  if (reason) out.reason = reason as IdfGeneralEditProblem
  return out
}

export function isGeneralEditValid(f: IdfGeneralEditForm, mode: IdfGeneralEditMode): boolean {
  return Object.keys(generalEditProblems(f, mode)).length === 0
}

export function generalEditBody(f: IdfGeneralEditForm): IdfGeneralSetBody {
  return { idfNumber: f.idfNumber.trim(), priority: Number(f.priority.trim()), reason: f.reason.trim() }
}
