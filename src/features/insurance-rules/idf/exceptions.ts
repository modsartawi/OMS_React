/**
 * IDF exceptions, pure (BackOffice spec 3157, door 3166; oms ticket 624). A row keys an order by its document type,
 * sub-document type or Nphies claim type and says how IDF priority handles it: skip it, only remind, or use a named
 * master. Every add, edit and delete carries a reason (non-blank, at most 400; the delete's rides in its body).
 *
 * Doors as built (3166): `keyKind` is `documentType` (the key is a document type NAME, e.g. `InsuranceOrder`) |
 * `subDocumentType` (free text, matched case-blind) | `nphiesClaimType` (a whole number); `handling` is `skip |
 * reminder | master` (`masterId` only for `master`). `allStores` false (the default) applies the row on the IDF tiers'
 * pilot stores only; true applies it at every store (the seeded SABIC skip). One row per key kind + key; the list
 * reads most specific key kind first. Refusals `IDF-00021`..`IDF-00027`.
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
  /** false = the IDF tiers' pilot stores only; true = every store. */
  allStores?: boolean | null
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
  allStores: boolean
  reason: string
}

/** The body of `POST IdfPriority/exceptions` and `PUT …/{id}`. */
export interface IdfExceptionBody {
  keyKind: IdfExceptionKeyKind
  key: string
  handling: IdfExceptionHandling
  masterId: string | null
  allStores: boolean
  reason: string
}

/** The body of `DELETE IdfPriority/exceptions/{id}`. */
export interface IdfExceptionDeleteBody {
  reason: string
}

/** The longest reason 3166 keeps. */
export const EXCEPTION_REASON_MAX = 400

export const EMPTY_EXCEPTION_FORM: IdfExceptionForm = { keyKind: 'documentType', key: '', handling: 'skip', masterId: '', allStores: false, reason: '' }

export type IdfExceptionProblem = 'keyRequired' | 'keyWholeNumber' | 'masterRequired' | 'reasonRequired' | 'reasonTooLong'
export type IdfExceptionProblems = Partial<Record<'key' | 'masterId' | 'reason', IdfExceptionProblem>>

/** A reason, whatever else the change is. Delete asks for this alone. */
export function reasonProblem(reason: string): IdfExceptionProblem | null {
  const r = reason.trim()
  return !r ? 'reasonRequired' : r.length > EXCEPTION_REASON_MAX ? 'reasonTooLong' : null
}

export function exceptionFormProblems(form: IdfExceptionForm): IdfExceptionProblems {
  const out: IdfExceptionProblems = {}
  const reason = reasonProblem(form.reason)
  if (reason) out.reason = reason
  if (!form.key.trim()) out.key = 'keyRequired'
  else if (form.keyKind === 'nphiesClaimType' && !/^\d+$/.test(form.key.trim())) out.key = 'keyWholeNumber'
  if (form.handling === 'master' && !form.masterId) out.masterId = 'masterRequired'
  return out
}

export function exceptionBody(form: IdfExceptionForm): IdfExceptionBody {
  return {
    keyKind: form.keyKind,
    key: form.key.trim(),
    handling: form.handling,
    masterId: form.handling === 'master' ? form.masterId : null,
    allStores: form.allStores,
    reason: form.reason.trim(),
  }
}

/** Editing starts from the row, with a blank reason: the change asks for its own. */
export function formFromException(e: IdfException): IdfExceptionForm {
  return { keyKind: e.keyKind, key: e.key, handling: e.handling, masterId: e.masterId ?? '', allStores: e.allStores === true, reason: '' }
}
