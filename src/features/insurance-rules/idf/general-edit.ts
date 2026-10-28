/**
 * One general item's group and priority, set or cleared with a reason, pure (BackOffice spec 3185, door 3192; oms
 * ticket 648). The general master has no draft: a single fix is `PUT IdfPriority/general/items/{itemNumber}
 * { idfNumber, priority, reason }` (an Edit of a listed row, or Set item for an item not yet in it) and a clear is
 * `DELETE IdfPriority/general/items/{itemNumber} { reason }`. Both apply at once; a refusal carries the server's
 * message, which the dialog shows.
 *
 * Shapes are the brief's sketch ("Spec 3185"); 654 reconciles them with the doors as built.
 */
import { reasonProblem } from './exceptions'
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

export type IdfGeneralEditProblem = 'itemRequired' | 'groupRequired' | 'priorityRequired' | 'priorityWholeNumber' | 'reasonRequired' | 'reasonTooLong'
export type IdfGeneralEditProblems = Partial<Record<keyof IdfGeneralEditForm, IdfGeneralEditProblem>>

/** An edit starts from the row's group and priority; the reason is always the user's own. */
export function generalFormFromRow(row: IdfEntryRow): IdfGeneralEditForm {
  return { itemNumber: row.itemNumber, idfNumber: row.idfNumber, priority: String(row.priority), reason: '' }
}

/** Why the form may not be sent yet: a group, a whole priority of 1 or more, a reason (≤ 400, as exceptions keep). */
export function generalEditProblems(f: IdfGeneralEditForm, mode: IdfGeneralEditMode): IdfGeneralEditProblems {
  const out: IdfGeneralEditProblems = {}
  if (mode === 'set' && !f.itemNumber.trim()) out.itemNumber = 'itemRequired'
  if (!f.idfNumber.trim()) out.idfNumber = 'groupRequired'
  const p = f.priority.trim()
  if (!p) out.priority = 'priorityRequired'
  else if (!/^\d+$/.test(p) || Number(p) < 1) out.priority = 'priorityWholeNumber'
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
