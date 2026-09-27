/**
 * Withdraw a wrong file (spec 319's ticket 323, lifted by ticket 325): when confirm
 * is live, the body, and what each answer means. Every caller's reasons come in as
 * data — the slip drawer passes its own five codes, and nothing here names one.
 *
 * Pure: no React, no network, no i18n. The words are the caller's `t()` keys; this
 * only decides which, and when.
 *
 * 🔑 **Final, with no restore (C7).** A mistake is fixed by adding the file again,
 * and nothing here can undo one.
 */
import { ApiError, apiErrorCode, apiErrorKind } from '@/core/api'

/** What the confirm rule reads of a reason: its code, and whether it needs a note. */
export interface WithdrawReasonRule {
  code: string
  /** True for a reason the audit trail cannot explain on its own (the slip's Other). */
  noteRequired: boolean
}

/**
 * One reason as the panel's picker shows it (ticket 326): the rule, and the words.
 * The caller hands the list in as data, in the order it is to be shown:
 * - the slip drawer resolves its five bundle keys (`label` holds English beside Arabic
 *   in one value, so it sends no `labelArabic`);
 * - the order tab (331) passes the server's `withdrawReasons` as sent.
 */
export interface WithdrawReason extends WithdrawReasonRule {
  label: string
  /** The server's Arabic label, shown beside `label` when there is one. */
  labelArabic?: string
}

/** The note the server keeps: the first 200 characters (`OmsAttachment.Widths.WithdrawNote`). */
export const WITHDRAW_NOTE_MAX = 200

/** Does this code need a note, in this reason list? An unknown code needs none (and cannot confirm). */
export function needsWithdrawNote(reasons: readonly WithdrawReasonRule[], code: string | null | undefined): boolean {
  return reasons.some((reason) => reason.code === code && reason.noteRequired)
}

/**
 * May confirm be pressed (in-flight aside, which the dialog adds)? A reason from the
 * list must be picked, and one that needs a note needs a note with something in it:
 * blank and whitespace both keep it disabled. Every other reason confirms with or
 * without a note.
 */
export function canConfirmWithdraw(
  reasons: readonly WithdrawReasonRule[],
  code: string | null | undefined,
  note: string,
): boolean {
  if (!reasons.some((reason) => reason.code === code)) return false
  return !needsWithdrawNote(reasons, code) || note.trim().length > 0
}

/** The note as sent: trimmed, then cut to 200, never splitting a surrogate pair. */
export function withdrawNote(note: string): string {
  const text = note.trim()
  if (text.length <= WITHDRAW_NOTE_MAX) return text
  const high = text.charCodeAt(WITHDRAW_NOTE_MAX - 1)
  const end = high >= 0xd800 && high <= 0xdbff ? WITHDRAW_NOTE_MAX - 1 : WITHDRAW_NOTE_MAX
  return text.slice(0, end)
}

/** `POST AttachmentWeb/{attachmentId}/Withdraw`'s body — exactly these two fields. */
export interface WithdrawBody {
  reasonCode: string
  note: string
}

export function withdrawBody(reasonCode: string, note: string): WithdrawBody {
  return { reasonCode, note: withdrawNote(note) }
}

/**
 * What a withdraw's answer means for the panel:
 * - `withdrawn`: 200. The file is withdrawn now, or it already was and came back
 *   unchanged. Either way: close the dialog, drop its preview, re-read ByOwner and
 *   tell the caller.
 * - `invalid`: 400 `reasonCode` / `note`. The server's message in the dialog, and
 *   the user's input kept.
 * - `gone`: 404 `NOT_FOUND`. No longer a stored file this session may withdraw: say
 *   so, close the dialog, re-read ByOwner.
 * - `forbidden`: a bare 403. The session lacks the grant: say so and take the action
 *   away (the probe and the server disagree, and the server wins).
 * - `not-set-up`: 503 `NOT_SET_UP`. The message, and no retry.
 * - `failed`: anything else (a network failure, a crash). The message; pressing
 *   again is safe, since a repeat withdrawal answers 200 unchanged.
 */
export type WithdrawAnswer = 'withdrawn' | 'invalid' | 'gone' | 'forbidden' | 'not-set-up' | 'failed'

/** The two field codes a 400 names (`AttachmentWithdrawResult`). */
const FIELD_CODES = new Set(['reasonCode', 'note'])

/**
 * The answer for a settled withdraw: `null` for a 200, else the error it threw.
 *
 * 🚩 Branched on the CODE, except for one case. The withdraw filter's 403 has NO
 * body, so core reads it as kind `unknown` with no code, and its status is the only
 * thing that tells it apart. That is the one place a status branch is right. A
 * coded 403 is not the grant filter, so it falls to `failed` and shows its message.
 */
export function withdrawAnswer(error: unknown): WithdrawAnswer {
  if (error === null || error === undefined) return 'withdrawn'
  const code = apiErrorCode(error)
  if (code !== null && FIELD_CODES.has(code)) return 'invalid'
  if (code === 'NOT_FOUND') return 'gone'
  if (code === 'NOT_SET_UP') return 'not-set-up'
  if (code === null && apiErrorKind(error) === 'unknown' && (error as ApiError).statusCode === 403) return 'forbidden'
  return 'failed'
}

/** The answers that close the dialog: they leave nothing to edit or press again. The panel acts on them. */
export type WithdrawClosingAnswer = Extract<WithdrawAnswer, 'withdrawn' | 'gone' | 'forbidden'>

/** Does this answer close the dialog? */
export function withdrawClosesDialog(answer: WithdrawAnswer): answer is WithdrawClosingAnswer {
  return answer === 'withdrawn' || answer === 'gone' || answer === 'forbidden'
}

/** May confirm be pressed again after this answer? Not after `NOT_SET_UP`: a retry cannot help. */
export function withdrawCanResend(answer: WithdrawAnswer): boolean {
  return answer === 'invalid' || answer === 'failed'
}
