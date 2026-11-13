/**
 * The pure rules of the Undispense page (ticket 898, BackOffice spec 3208, Nphies contract 1.2
 * §1.1 rows 19–21).
 *
 * **Undispensing** clears our own Nphies service's dispensed mark on an authorization, so another
 * store can dispense it after the patient returned the medicine. A full NewPos return queues it;
 * this page lists the queue, retries a failed request, and queues one by hand for an
 * authorization whose invoice is fully returned (either till).
 *
 * 🚩 Every rule here only decides what the page OFFERS. The two POSTs' own grant filter and the
 * server's "fully returned" read are the gate; a button shown by mistake meets a named refusal,
 * which the `*RefusalKey` functions turn into this page's words.
 *
 * Pure: no React, no i18n, no network.
 */
import { apiErrorCode, isBareDenial } from '@/core/api'
import type {
  NphiesUndispenseNoteRequest,
  NphiesUndispenseQueued,
  NphiesUndispenseRequest,
  NphiesUndispenseState,
} from '@/core/models/nphies'

/** The three states, in the order the filter shows them and the query sends them. */
export const UNDISPENSE_STATES: readonly NphiesUndispenseState[] = ['pending', 'failed', 'done']

/** Everything the list is filtered by (contract 1.2 §1.1 #19). Dates are `yyyy-mm-dd` days added,
 *  both inclusive; `''` = unbounded. */
export interface UndispenseCriteria {
  /** None = every state (the parameter is left off). */
  states: NphiesUndispenseState[]
  store: string
  from: string
  to: string
  authId: string
}

/** The list opens on what needs a person: pending and failed (BackOffice spec 3208 story 5). */
export function defaultUndispenseCriteria(): UndispenseCriteria {
  return { states: ['pending', 'failed'], store: '', from: '', to: '', authId: '' }
}

/**
 * The criteria a link opens on. `?authId=` comes from the Release approval number page's "undispense
 * it first" (751): that agent is asking about ONE authorization, so every state is shown — a done
 * request is the answer "it is already undispensed", which the default filter would hide.
 */
export function criteriaFromUrl(authId: string | null | undefined): UndispenseCriteria {
  const id = (authId ?? '').trim()
  return id === '' ? defaultUndispenseCriteria() : { ...defaultUndispenseCriteria(), states: [], authId: id }
}

/** Criteria → the `GET Nphies/Undispense` query, under the door's own names. */
export function buildUndispenseListParams(c: UndispenseCriteria): Record<string, string> {
  const params: Record<string, string> = {}
  const states = UNDISPENSE_STATES.filter((s) => c.states.includes(s))
  if (states.length > 0) params.state = states.join(',')
  const put = (key: string, raw: string) => {
    const value = raw.trim()
    if (value !== '') params[key] = value
  }
  put('store', c.store)
  put('from', c.from)
  put('to', c.to)
  put('authId', c.authId)
  return params
}

/** Retry shows on a FAILED row, with the undispense grant (`=== true`: a door that did not send the
 *  field is a no). A pending row is the worker's; a done row is never sent again. */
export function isRetryable(canUndispense: boolean | undefined, row: Pick<NphiesUndispenseRequest, 'state'>): boolean {
  return canUndispense === true && row.state === 'failed'
}

/** The dialog's confirm: a note is required (every manual undispense is logged with its reason),
 *  and nothing fires twice while one is in flight. */
export function canConfirmUndispense(note: string, busy: boolean): boolean {
  return note.trim() !== '' && !busy
}

/** The manual undispense body: `{ note }` alone. Who, origin and the return are the server's. */
export function undispenseBody(note: string): NphiesUndispenseNoteRequest {
  return { note: note.trim() }
}

/** How a manual undispense's answer reads. `created: false` means a request for that authorization
 *  and return already existed (the till's, or an earlier click); its state says what to do next. */
export type QueuedOutcome = 'queued' | 'alreadyPending' | 'alreadyFailed' | 'alreadyDone'

export function queuedOutcome(answer: Pick<NphiesUndispenseQueued, 'created' | 'request'>): QueuedOutcome {
  if (answer.created) return 'queued'
  const state = answer.request?.state
  return state === 'failed' ? 'alreadyFailed' : state === 'done' ? 'alreadyDone' : 'alreadyPending'
}

/** The codes contract 1.2 §6 names for the manual undispense. */
export const UNDISPENSE_REFUSAL_CODES = [
  'AUTH_NOT_FOUND',
  'INVOICE_NOT_FOUND',
  'INVOICE_NOT_FULLY_RETURNED',
  'NOTE_REQUIRED',
] as const

/** The codes contract 1.2 §6 names for Retry. */
export const RETRY_REFUSAL_CODES = ['UNDISPENSE_NOT_FOUND', 'UNDISPENSE_NOT_FAILED'] as const

/** The code contract 1.2 §6 names for the list. */
export const LIST_REFUSAL_CODES = ['UNDISPENSE_STATE_INVALID'] as const

const UNDISPENSE_KEYS: Record<(typeof UNDISPENSE_REFUSAL_CODES)[number], string> = {
  AUTH_NOT_FOUND: 'refusals.authNotFound',
  INVOICE_NOT_FOUND: 'refusals.invoiceNotFound',
  INVOICE_NOT_FULLY_RETURNED: 'refusals.notFullyReturned',
  NOTE_REQUIRED: 'refusals.noteRequired',
}

const RETRY_KEYS: Record<(typeof RETRY_REFUSAL_CODES)[number], string> = {
  UNDISPENSE_NOT_FOUND: 'refusals.retryNotFound',
  UNDISPENSE_NOT_FAILED: 'refusals.retryNotFailed',
}

function keyOf(err: unknown, keys: Record<string, string>): string | null {
  // A bare 403 is the undispense grant's filter (no envelope): the missing grant.
  if (isBareDenial(err)) return 'refusals.noGrant'
  const code = apiErrorCode(err)
  return code !== null && code in keys ? keys[code] : null
}

/** The page's own sentence for a manual-undispense refusal (an i18n key in `undispense`), or `null`
 *  when the failure is not one it knows — the caller then shows the server's own sentence. */
export function undispenseRefusalKey(err: unknown): string | null {
  return keyOf(err, UNDISPENSE_KEYS)
}

/** As `undispenseRefusalKey`, for Retry. */
export function retryRefusalKey(err: unknown): string | null {
  return keyOf(err, RETRY_KEYS)
}

/** The list's one named refusal (a state the door does not know), or `null`. Not `keyOf`: the list
 *  reads under the Nphies grant alone, so a bare 403 here is not the undispense grant. */
export function listRefusalKey(err: unknown): string | null {
  return apiErrorCode(err) === 'UNDISPENSE_STATE_INVALID' ? 'refusals.stateInvalid' : null
}

const ORIGINS = new Set(['return', 'support', 'callcenter'])

/** An origin's i18n key, or `null` for a value the contract does not name (shown as sent). */
export function originKey(origin: string | null | undefined): string | null {
  const value = (origin ?? '').trim().toLowerCase()
  return ORIGINS.has(value) ? `origin.${value}` : null
}
