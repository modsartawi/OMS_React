/**
 * A reviewer's mark on a case (oms 922; BackOffice 4053 `POST …/Cases/{caseId}/Marks`): the status set and the note
 * that says why. Pure: the form reads its problem from here, and the call sends only a body this module made.
 */
import type { PatternMarkBody, PatternMarkStatus } from '@/core/models/insurance-patterns'

/** The statuses a reviewer can set, in the order the form offers them. `open` is the job's, never a reviewer's. */
export const MARK_STATUSES: readonly PatternMarkStatus[] = ['watching', 'cleared', 'confirmed', 'closed']

/**
 * The longest note sent. GUESSED: BackOffice 4053 stores it as `NVARCHAR` (`StringMaxType`) and clamps it; the client
 * refuses past this rather than let the server cut a note short silently. Reconcile with 4053's clamp.
 */
export const NOTE_MAX = 500

/** The form as typed: no status chosen yet is `''`. */
export interface MarkDraft {
  status: PatternMarkStatus | ''
  note: string
}

/** Why a draft cannot be sent, or null when it can. */
export type MarkProblem = 'status' | 'note' | 'tooLong'

export function markProblem(draft: MarkDraft): MarkProblem | null {
  if (!(MARK_STATUSES as readonly string[]).includes(draft.status)) return 'status'
  const note = draft.note.trim()
  if (note === '') return 'note'
  if (note.length > NOTE_MAX) return 'tooLong'
  return null
}

/** The body sent for a draft: the status and the trimmed note, or null when the draft has a problem. */
export function markBody(draft: MarkDraft): PatternMarkBody | null {
  if (markProblem(draft)) return null
  return { status: draft.status as PatternMarkStatus, note: draft.note.trim() }
}

/**
 * The form once a mark is saved (review 8): empty when it still holds what was sent; what the reviewer typed while the
 * mark was saving otherwise — a save never wipes words it did not send.
 */
export function draftAfterSave(current: MarkDraft, sent: MarkDraft): MarkDraft {
  return current.status === sent.status && current.note === sent.note ? { status: '', note: '' } : current
}
