import { REASON_MAX } from '@/core/reason/reason'
import type { LocalDate } from '@/core/util/date-window'
import type { KeyedListKind } from '@/core/insurance-rules/registry'

/**
 * Adding an entry to a patient list or a policy list (ticket 610; BackOffice 3133). A patient is keyed by
 * National ID (`1…`) or Iqama (`2…`), ten digits; a policy by its SubscriberId. Every entry carries a reason;
 * the expiry is optional and, when given, a LOCAL day after today. `addedBy` is the server's.
 */
export interface EntryForm {
  key: string
  reason: string
  /** `yyyy-MM-dd` from a date input, or '' for no expiry. */
  expiresOn: string
}

export type EntryProblem = 'keyMissing' | 'keyInvalid' | 'keyListed' | 'reasonMissing' | 'reasonTooLong' | 'expiryInvalid' | 'expiryPast'

const PATIENT_KEY = /^[12]\d{9}$/
const SUBSCRIBER_ID = /^\S{1,40}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

export function entryProblems(form: EntryForm, kind: KeyedListKind, listed: readonly string[], today: LocalDate): EntryProblem[] {
  const out: EntryProblem[] = []
  const key = form.key.trim()
  if (!key) out.push('keyMissing')
  else if (!(kind === 'patient' ? PATIENT_KEY : SUBSCRIBER_ID).test(key)) out.push('keyInvalid')
  else if (listed.includes(key)) out.push('keyListed')
  const reason = form.reason.trim()
  if (!reason) out.push('reasonMissing')
  else if (reason.length > REASON_MAX) out.push('reasonTooLong')
  if (form.expiresOn) {
    if (!DAY.test(form.expiresOn)) out.push('expiryInvalid')
    else if (form.expiresOn <= today) out.push('expiryPast')
  }
  return out
}

/** `POST InsuranceRules/{Patient|Policy}Lists/{id}/Entries` body. */
export interface EntryBody {
  key: string
  reason: string
  expiresOn?: string
}

export function entryBody(form: EntryForm): EntryBody {
  const body: EntryBody = { key: form.key.trim(), reason: form.reason.trim() }
  if (form.expiresOn) body.expiresOn = form.expiresOn
  return body
}
