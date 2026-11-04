/**
 * The pure rules of the Release approval number page (ticket 751, BackOffice spec 3342).
 *
 * **Releasing an approval number** appends `_` to an authorization's `PreAuthRef`, so the
 * Nphies service's duplicate guard no longer matches it and the pharmacist can submit a new
 * approval with that number. Nothing else on the authorization changes.
 *
 * 🚩 Every rule here only decides what the page OFFERS. The release POST's own filter and the
 * service's re-read inside its transaction are the gate; a button shown by mistake meets a
 * named refusal, which `refusalKey` turns into this page's words.
 *
 * Pure: no React, no i18n, no network.
 */
import { apiErrorCode, apiErrorKind, isBareDenial, ApiError } from '@/core/api'
import type { NphiesReleaseApprovalNumberRequest } from '@/core/models/nphies'

/** The two facts of an authorization the offer reads. */
export interface ReleaseSource {
  preAuthRef: string | null | undefined
  /** `undefined` = the door did not say (the detail route does not answer it today). */
  isDispensed?: boolean
}

/** Why the Release button is not shown. `null` = it is. */
export type ReleaseWithheld = 'dispensed' | 'alreadyReleased' | 'empty' | 'noGrant'

export interface ReleaseOffer {
  offered: boolean
  reason: ReleaseWithheld | null
}

/** The suffix a release appends. A value already ending with it is already released. */
export const RELEASE_SUFFIX = '_'

/**
 * Whether the Release button shows, and if not, why.
 *
 * The row's own facts come before the grant, because they are true for every reader: a user
 * without the grant who is looking at a dispensed row learns the more useful thing. Dispensed
 * comes first of all — it is the one that needs an act elsewhere ("undispense it first").
 *
 * The grant is `=== true`: a probe that did not send the field (a 1.0 door) is a no.
 */
export function releaseOffer(canRelease: boolean | undefined, row: ReleaseSource): ReleaseOffer {
  const value = (row.preAuthRef ?? '').trim()
  const reason: ReleaseWithheld | null =
    row.isDispensed === true
      ? 'dispensed'
      : value === ''
        ? 'empty'
        : value.endsWith(RELEASE_SUFFIX)
          ? 'alreadyReleased'
          : canRelease !== true
            ? 'noGrant'
            : null
  return { offered: reason === null, reason }
}

/** The dialog's confirm: a note is required (a release is never logged without a reason), and
 *  nothing fires twice while one is in flight. */
export function canConfirmRelease(note: string, busy: boolean): boolean {
  return note.trim() !== '' && !busy
}

/** The release body: exactly `{ authId, note }`. The user is the session's (spec 3342 story 16);
 *  a who-field here would be the browser asserting an identity. */
export function releaseBody(authId: string, note: string): NphiesReleaseApprovalNumberRequest {
  return { authId: authId.trim(), note: note.trim() }
}

/** The refusal codes contract 1.1 §6 names for the release. `AUTH_ALREADY_DISPENSED` is the
 *  service's `AUTH_DISPENSED`, put under the door's existing code (BackOffice 3343). */
export const RELEASE_REFUSAL_CODES = [
  'AUTH_NOT_FOUND',
  'AUTH_ALREADY_DISPENSED',
  'APPROVAL_NUMBER_EMPTY',
  'APPROVAL_NUMBER_ALREADY_RELEASED',
  'NOTE_REQUIRED',
] as const

const REFUSAL_KEYS: Record<(typeof RELEASE_REFUSAL_CODES)[number], string> = {
  AUTH_NOT_FOUND: 'refusals.notFound',
  AUTH_ALREADY_DISPENSED: 'refusals.dispensed',
  APPROVAL_NUMBER_EMPTY: 'refusals.empty',
  APPROVAL_NUMBER_ALREADY_RELEASED: 'refusals.alreadyReleased',
  NOTE_REQUIRED: 'refusals.noteRequired',
}

/**
 * The page's own sentence for a refusal, as an i18n key in the `approval-release` namespace, or
 * `null` when the failure is not one this page knows — the caller then shows the server's own
 * sentence through `apiErrorMessage`, rather than guessing.
 *
 * A bare 403 (the release grant's filter, no envelope) is the missing release grant.
 */
export function refusalKey(err: unknown): string | null {
  if (isBareDenial(err)) return 'refusals.noGrant'
  const code = apiErrorCode(err)
  return code !== null && code in REFUSAL_KEYS ? REFUSAL_KEYS[code as keyof typeof REFUSAL_KEYS] : null
}

export type LookupState = 'idle' | 'loading' | 'notFound' | 'error' | 'found'

/**
 * What the summary area shows for the searched bundle Id. 🚩 An unknown id is `notFound`, its
 * own state — never an empty card and never the generic error. SIS.Api answers it as
 * `AUTH_NOT_FOUND` (404); a bare 404 means the same.
 */
export function lookupState(q: { id: string; isPending: boolean; error: unknown; hasData: boolean }): LookupState {
  if (q.id.trim() === '') return 'idle'
  // An answer already on screen outlives a failed background re-read: the summary (and an open
  // dialog showing a refusal) must not vanish because a refetch behind it failed.
  if (q.hasData) return 'found'
  if (q.error) {
    const notFound =
      apiErrorCode(q.error) === 'AUTH_NOT_FOUND' ||
      (q.error instanceof ApiError && q.error.statusCode === 404 && apiErrorKind(q.error) !== 'network')
    return notFound ? 'notFound' : 'error'
  }
  return q.isPending ? 'loading' : 'idle'
}

/** A refusal that means the row on screen is out of date — someone dispensed it, released it, or
 *  it is gone. Only these justify re-reading the (heavy) authorization behind the dialog. */
export function isStaleRowRefusal(err: unknown): boolean {
  const code = apiErrorCode(err)
  return code === 'AUTH_ALREADY_DISPENSED' || code === 'APPROVAL_NUMBER_ALREADY_RELEASED' || code === 'AUTH_NOT_FOUND'
}
