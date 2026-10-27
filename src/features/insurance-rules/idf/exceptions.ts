/**
 * IDF exceptions, pure (BackOffice spec 3157, door 3166; oms ticket 624). A row keys an order by its document type,
 * sub-document type or Nphies claim type and says how IDF priority handles it: skip it, only remind, or use a named
 * master. Every add, edit and delete carries a reason.
 *
 * Spec 3157 OQ2 may add key kinds or handlings; until 3166 says so these are the brief's three and three.
 */

export const IDF_EXCEPTION_KEY_KINDS = ['documentType', 'subDocumentType', 'nphiesClaimType'] as const
export type IdfExceptionKeyKind = (typeof IDF_EXCEPTION_KEY_KINDS)[number]

export const IDF_EXCEPTION_HANDLINGS = ['skip', 'reminder', 'master'] as const
export type IdfExceptionHandling = (typeof IDF_EXCEPTION_HANDLINGS)[number]

/** A row of `GET IdfPriority/exceptions`. `at` is local wall-clock, no `Z`. */
export interface IdfException {
  exceptionId: string
  keyKind: IdfExceptionKeyKind
  key: string
  handling: IdfExceptionHandling
  masterId?: string | null
  reason: string
  by: string
  at: string
}

/** What the add / edit dialog holds. `masterId` is `''` when none is picked. */
export interface IdfExceptionForm {
  keyKind: IdfExceptionKeyKind
  key: string
  handling: IdfExceptionHandling
  masterId: string
  reason: string
}

/** The body of `POST IdfPriority/exceptions` and `PUT …/{id}`. */
export interface IdfExceptionBody {
  keyKind: IdfExceptionKeyKind
  key: string
  handling: IdfExceptionHandling
  masterId: string | null
  reason: string
}

export const EMPTY_EXCEPTION_FORM: IdfExceptionForm = { keyKind: 'documentType', key: '', handling: 'skip', masterId: '', reason: '' }

export type IdfExceptionProblem = 'keyRequired' | 'masterRequired' | 'reasonRequired'
export type IdfExceptionProblems = Partial<Record<'key' | 'masterId' | 'reason', IdfExceptionProblem>>

/** A reason, whatever else the change is. Delete asks for this alone. */
export function reasonProblem(reason: string): IdfExceptionProblem | null {
  return reason.trim() ? null : 'reasonRequired'
}

export function exceptionFormProblems(form: IdfExceptionForm): IdfExceptionProblems {
  const out: IdfExceptionProblems = {}
  const reason = reasonProblem(form.reason)
  if (reason) out.reason = reason
  if (!form.key.trim()) out.key = 'keyRequired'
  if (form.handling === 'master' && !form.masterId) out.masterId = 'masterRequired'
  return out
}

export function exceptionBody(form: IdfExceptionForm): IdfExceptionBody {
  return {
    keyKind: form.keyKind,
    key: form.key.trim(),
    handling: form.handling,
    masterId: form.handling === 'master' ? form.masterId : null,
    reason: form.reason.trim(),
  }
}

/** Editing starts from the row, with a blank reason: the change asks for its own. */
export function formFromException(e: IdfException): IdfExceptionForm {
  return { keyKind: e.keyKind, key: e.key, handling: e.handling, masterId: e.masterId ?? '', reason: '' }
}
