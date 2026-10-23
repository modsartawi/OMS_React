import { apiErrorCode } from '@/core/api'
import { CALLOUT_LOCK_ERRORS, RELEASE_REASONS, type ReleaseLockRequest, type ReleaseReason } from '@/core/models/dispatch-board'

// The Release lock form's rules (BackOffice 2959, oms ticket 541). In `@/core/` because two features
// release a lock: the dispatch board's inspector (541) and Delivery details' action (542) — and a
// feature may never import another. Pure: no React, no `t`.

/** Why the form may not be sent yet. */
export type ReleaseProblem = 'reasonMissing' | 'noteMissing'

export interface ReleaseForm {
  ready: boolean
  problem: ReleaseProblem | null
  /** The body to send, when ready. */
  body: ReleaseLockRequest | null
}

const isReason = (value: string): value is ReleaseReason => (RELEASE_REASONS as readonly string[]).includes(value)

/**
 * Check the form as the door will (`CalloutLocks.ValidateRelease`): a known reason, and for `Other` a
 * note that is not white space. The note is sent trimmed, and left off when blank.
 */
export function releaseForm(input: { reason: string; note: string }, deliveryNumber = ''): ReleaseForm {
  const reason = input.reason.trim()
  const note = input.note.trim()
  if (!isReason(reason)) return { ready: false, problem: 'reasonMissing', body: null }
  if (reason === 'Other' && note === '') return { ready: false, problem: 'noteMissing', body: null }
  const body: ReleaseLockRequest = note === '' ? { deliveryNumber, reason } : { deliveryNumber, reason, note }
  return { ready: true, problem: null, body }
}

const REFUSAL_KEYS: Record<string, string> = {
  [CALLOUT_LOCK_ERRORS.reasonRequired]: 'release.refusal.reasonMissing',
  [CALLOUT_LOCK_ERRORS.noteRequired]: 'release.refusal.noteMissing',
  [CALLOUT_LOCK_ERRORS.notLocked]: 'release.refusal.notLocked',
}

/**
 * The lock's own refusal (`CALLOUT-102/103/104`) as its sentence key (in the `dispatch-board`
 * namespace) and its code, else `null` — any other failure is shown as the server's message.
 */
export function releaseRefusal(err: unknown): { key: string; code: string } | null {
  const code = apiErrorCode(err)
  return code !== null && code in REFUSAL_KEYS ? { key: REFUSAL_KEYS[code], code } : null
}
