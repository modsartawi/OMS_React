/**
 * The create / edit IDF master form, pure (BackOffice spec 3157, doors 3161/3162; oms ticket 621). Kind is fixed
 * after create. An insurer master names a payer and may be scoped to a store list; a store master names a store
 * list. Both names are required. Thresholds read "hard above N, reminder above M", default to 4 and 1, are whole
 * numbers (0 allowed), and a reminder above the hard one is refused before anything is sent.
 */
import { DEFAULT_HARD_THRESHOLD, DEFAULT_REMINDER_THRESHOLD, type IdfMaster, type IdfMasterKind } from './masters'

/** What the dialog holds: the thresholds as typed, `''` where nothing is picked. */
export interface IdfMasterForm {
  kind: IdfMasterKind
  payerCode: string
  storeListId: string
  nameEn: string
  nameAr: string
  hard: string
  reminder: string
}

/** The body of `POST IdfPriority/masters` and `PUT …/{id}`. */
export interface IdfMasterBody {
  kind: IdfMasterKind
  payerCode: string | null
  storeListId: string | null
  nameEn: string
  nameAr: string
  hardThreshold: number
  reminderThreshold: number
}

export type IdfMasterFormField = 'payerCode' | 'storeListId' | 'nameEn' | 'nameAr' | 'hard' | 'reminder'
export type IdfMasterFormProblem = 'payerRequired' | 'storeListRequired' | 'nameRequired' | 'wholeNumber' | 'reminderAboveHard'
export type IdfMasterFormProblems = Partial<Record<IdfMasterFormField, IdfMasterFormProblem>>

/** The envelope code 3162 refuses an overlapping scope with. ⚠️ The brief leaves it unspelled: 628 reconciles. */
export const OVERLAPPING_SCOPE = 'OVERLAPPING_SCOPE'

export function newMasterForm(kind: IdfMasterKind = 'insurer'): IdfMasterForm {
  return { kind, payerCode: '', storeListId: '', nameEn: '', nameAr: '', hard: String(DEFAULT_HARD_THRESHOLD), reminder: String(DEFAULT_REMINDER_THRESHOLD) }
}

/**
 * Switching kind on create: the payer and the store list belong to the kind they were entered under, so both are
 * cleared — an insurer's optional scope never silently becomes a store master's list, nor a store master's list an
 * insurer's scope. The names and thresholds are kept. The same kind returns the form unchanged.
 */
export function withKind(form: IdfMasterForm, kind: IdfMasterKind): IdfMasterForm {
  return form.kind === kind ? form : { ...form, kind, payerCode: '', storeListId: '' }
}

/** Editing starts from the master as it is; a threshold it never sent shows its default. */
export function formFromMaster(m: IdfMaster): IdfMasterForm {
  return {
    kind: m.kind,
    payerCode: m.payerCode ?? '',
    storeListId: m.storeListId ?? '',
    nameEn: m.nameEn ?? '',
    nameAr: m.nameAr ?? '',
    hard: String(m.hardThreshold ?? DEFAULT_HARD_THRESHOLD),
    reminder: String(m.reminderThreshold ?? DEFAULT_REMINDER_THRESHOLD),
  }
}

const whole = (s: string): number | null => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null)

export function masterFormProblems(form: IdfMasterForm): IdfMasterFormProblems {
  const out: IdfMasterFormProblems = {}
  if (form.kind === 'insurer' && !form.payerCode.trim()) out.payerCode = 'payerRequired'
  if (form.kind === 'store' && !form.storeListId) out.storeListId = 'storeListRequired'
  if (!form.nameEn.trim()) out.nameEn = 'nameRequired'
  if (!form.nameAr.trim()) out.nameAr = 'nameRequired'
  const hard = whole(form.hard)
  const reminder = whole(form.reminder)
  if (hard === null) out.hard = 'wholeNumber'
  if (reminder === null) out.reminder = 'wholeNumber'
  else if (hard !== null && reminder > hard) out.reminder = 'reminderAboveHard'
  return out
}

/**
 * Only call on a form with no problems. A store master sends no payer; an unscoped insurer master no store list. The
 * store list sent is always one picked under the current kind: `withKind` clears it on a kind switch.
 */
export function masterBody(form: IdfMasterForm): IdfMasterBody {
  return {
    kind: form.kind,
    payerCode: form.kind === 'insurer' ? form.payerCode.trim().toUpperCase() : null,
    storeListId: form.storeListId || null,
    nameEn: form.nameEn.trim(),
    nameAr: form.nameAr.trim(),
    hardThreshold: Number(form.hard.trim()),
    reminderThreshold: Number(form.reminder.trim()),
  }
}

/** The clashing master's id an overlap refusal carries in its `data` (`{ clashingMasterId }`), or null. */
export function clashingMasterId(data: unknown): string | null {
  const id = typeof data === 'object' && data !== null ? (data as { clashingMasterId?: unknown }).clashingMasterId : null
  return typeof id === 'string' && id ? id : null
}
