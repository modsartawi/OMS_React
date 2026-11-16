import { REASON_MAX } from '@/core/reason/reason'
import type { LocalDate } from '@/core/util/date-window'
import type { KeyedListKind } from '@/core/insurance-rules/registry'

/**
 * Adding an entry to a patient, policy or class list (ticket 610; BackOffice 3133 + 3172). A patient is keyed by
 * National ID (`1…`) or Iqama (`2…`), ten digits; a policy by its SubscriberId; a class by its policy class code
 * (up to 29, no `|`, kept upper case), with an optional insurer (its SAP customer id, up to 10; blank = any
 * insurer). Every entry carries a reason; the expiry is optional and, when given, the last LOCAL day it counts —
 * today or later.
 * `addedBy` is the server's.
 *
 * BackOffice 3982 — a patient entry (BR-7's blocked patients, BR-4's patient) also carries the finding's kind (abuse |
 * fraud, required where the list asks for it), the payer that reported it (a note: it never narrows the block), a
 * reference (up to 500) and a start day (inclusive; blank = the day it is added; a backdated start is accepted).
 */
export interface EntryForm {
  key: string
  reason: string
  /** `yyyy-MM-dd` from a date input, or '' for no expiry. */
  expiresOn: string
  /** Class lists: the insurer's SAP customer id, or '' for any insurer. Patient lists: the reporting payer. Absent = ''. */
  payer?: string
  /** Patient lists: `abuse` | `fraud`, or '' for none. */
  reasonKind?: ReasonKind | ''
  /** Patient lists: payer email, PA numbers and the like. */
  reference?: string
  /** Patient lists: `yyyy-MM-dd`, or '' for the day it is added. */
  startsOn?: string
}

export const REASON_KINDS = ['abuse', 'fraud'] as const
export type ReasonKind = (typeof REASON_KINDS)[number]

/** HQ's widths (BackOffice 3982, `InsuranceList.Widths`): a reporting payer up to 40, a reference up to 500. */
export const PAYER_NOTE_MAX = 40
export const REFERENCE_MAX = 500

export type EntryProblem =
  | 'keyMissing'
  | 'keyInvalid'
  | 'payerInvalid'
  | 'reasonMissing'
  | 'reasonTooLong'
  | 'expiryInvalid'
  | 'expiryPast'
  | 'reasonKindMissing'
  | 'referenceTooLong'
  | 'startInvalid'
  | 'startAfterExpiry'

/** What the list itself asks of an entry (BackOffice 3982). */
export interface EntryRules {
  reasonKindRequired?: boolean
}

const PATIENT_KEY = /^[12]\d{9}$/
const SUBSCRIBER_ID = /^\S{1,40}$/
const CLASS_CODE = /^[^|]{1,29}$/
const PAYER = /^\S{1,10}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

const KEY_RULE: Record<KeyedListKind, RegExp> = { patient: PATIENT_KEY, policy: SUBSCRIBER_ID, class: CLASS_CODE }

/** The key as HQ keeps it: trimmed; a class code upper case. */
const keyOf = (form: EntryForm, kind: KeyedListKind) => (kind === 'class' ? form.key.trim().toUpperCase() : form.key.trim())
const payerOf = (form: EntryForm, kind: KeyedListKind) => (kind === 'class' ? (form.payer ?? '').trim() : '')
/** A patient entry's reporting payer (a note, not part of the key). */
const notePayerOf = (form: EntryForm, kind: KeyedListKind) => (kind === 'patient' ? (form.payer ?? '').trim() : '')

/**
 * What makes an entry one: its key, and on a class list its insurer too (the same class with and without a payer
 * are two entries). `listed` passed to `entryAction` holds these.
 */
export const entryIdentity = (key: string, payer?: string | null): string => `${key}|${payer ?? ''}`

/**
 * What the POST does (3133, 3172): a key (+ insurer, on a class list) not on the list is added; one already there has
 * its reason and expiry REPLACED (HQ logs it `change`, and `addedBy` becomes the session's user).
 */
export function entryAction(form: EntryForm, kind: KeyedListKind, listed: readonly string[]): 'add' | 'change' {
  return listed.includes(entryIdentity(keyOf(form, kind), payerOf(form, kind))) ? 'change' : 'add'
}

export function entryProblems(form: EntryForm, kind: KeyedListKind, today: LocalDate, rules: EntryRules = {}): EntryProblem[] {
  const out: EntryProblem[] = []
  const key = keyOf(form, kind)
  const payer = payerOf(form, kind)
  if (!key) out.push('keyMissing')
  else if (!KEY_RULE[kind].test(key)) out.push('keyInvalid')
  if (payer && !PAYER.test(payer)) out.push('payerInvalid')
  if (notePayerOf(form, kind).length > PAYER_NOTE_MAX) out.push('payerInvalid')
  const reason = form.reason.trim()
  if (!reason) out.push('reasonMissing')
  else if (reason.length > REASON_MAX) out.push('reasonTooLong')
  if (kind === 'patient' && rules.reasonKindRequired && !form.reasonKind) out.push('reasonKindMissing')
  if (kind === 'patient' && (form.reference ?? '').trim().length > REFERENCE_MAX) out.push('referenceTooLong')
  const expiryOk = !!form.expiresOn && DAY.test(form.expiresOn)
  if (form.expiresOn) {
    if (!expiryOk) out.push('expiryInvalid')
    // The last day it counts, inclusive: today is allowed (3133).
    else if (form.expiresOn < today) out.push('expiryPast')
  }
  const start = kind === 'patient' ? (form.startsOn ?? '') : ''
  if (start) {
    // The first day it counts, inclusive (3982): before today is accepted (a backdated finding), after the end is not.
    if (!DAY.test(start)) out.push('startInvalid')
    else if (expiryOk && start > form.expiresOn) out.push('startAfterExpiry')
  }
  return out
}

/**
 * `POST InsuranceRules/{Patient|Policy|Class}Lists/{id}/Entries` body — `payer` on a class list (the insurer) or a
 * patient list (the reporting payer); `reasonKind`, `reference`, `startsOn` on a patient list (3982).
 */
export interface EntryBody {
  key: string
  payer?: string
  reason: string
  reasonKind?: ReasonKind
  reference?: string
  startsOn?: string
  expiresOn?: string
}

export function entryBody(form: EntryForm, kind: KeyedListKind = 'patient'): EntryBody {
  const payer = payerOf(form, kind) || notePayerOf(form, kind)
  const body: EntryBody = { key: keyOf(form, kind), ...(payer ? { payer } : {}), reason: form.reason.trim() }
  if (kind === 'patient') {
    if (form.reasonKind) body.reasonKind = form.reasonKind
    const reference = (form.reference ?? '').trim()
    if (reference) body.reference = reference
    if (form.startsOn) body.startsOn = form.startsOn
  }
  if (form.expiresOn) body.expiresOn = form.expiresOn
  return body
}

/** A new patient, policy or class list (3133 / 3172): its id and its name in both languages. */
export interface NewListForm {
  id: string
  en: string
  ar: string
  /** Patient lists (3982): every entry must name its reason kind (BR-4's and BR-7's lists). */
  reasonKindRequired?: boolean
}

export type NewListProblem = 'idInvalid' | 'idTaken' | 'nameMissing'

const LIST_ID = /^[A-Za-z0-9._-]{1,40}$/

export function newListProblems(form: NewListForm, taken: readonly string[]): NewListProblem[] {
  const out: NewListProblem[] = []
  const id = form.id.trim()
  if (!LIST_ID.test(id)) out.push('idInvalid')
  else if (taken.includes(id)) out.push('idTaken')
  if (!form.en.trim() || !form.ar.trim()) out.push('nameMissing')
  return out
}

/** `POST InsuranceRules/{Patient|Policy|Class}Lists` body. */
export interface NewListBody {
  id: string
  name: { en: string; ar: string }
  reason: string
  reasonKindRequired?: boolean
}

export const newListBody = (form: NewListForm, reason: string): NewListBody => ({
  id: form.id.trim(),
  name: { en: form.en.trim(), ar: form.ar.trim() },
  reason,
  ...(form.reasonKindRequired ? { reasonKindRequired: true } : {}),
})
