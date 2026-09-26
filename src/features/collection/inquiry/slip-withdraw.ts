/**
 * Withdraw a wrong slip (ticket 323, BackOffice 2035's `## Web contract`): who may,
 * the reasons, when confirm is live, the body, and what each answer means.
 *
 * Pure: no React, no network, no i18n. The words are the drawer's `t()` keys; this
 * only decides which, and when.
 *
 * 🔑 **Final, with no restore (C7).** A mistake is fixed by adding the file again,
 * and nothing here can undo one. There is no collection cutoff either (C3): a
 * collected Collections row withdraws as readily as a Ready row.
 */
import { ApiError, apiErrorCode, apiErrorKind } from '@/core/api'
import type { AttachmentAccess } from '@/core/models/collection'
import { CASH_CLOSE, canSeeSlips, holdsCategory } from './slips'

/**
 * May this session withdraw a day-close slip? The withdraw grant
 * (`AttachmentsCashCloseWithdraw`, `COLLECTION_ACCOUNTANT` and
 * `ACCOUNTANT_SUPERVISOR` only) is what `withdrawCategories` reports.
 *
 * Fails closed like `canSeeSlips`, and through the same array membership: a pending
 * or refused probe, a missing field, an empty list and a bare string `"CASH_CLOSE"`
 * are all "no". It also needs the read grant (`categories`), since the drawer that
 * carries the action is only open to a reader; the server answers a withdraw
 * category only when read is held too, so the two agree. For drawing only: the
 * route checks the grant again, and a bare 403 from it takes the action away.
 */
export function canWithdrawSlips(access: AttachmentAccess | null | undefined): boolean {
  return canSeeSlips(access) && holdsCategory(access?.withdrawCategories, CASH_CLOSE)
}

/** The reason codes, in the order the contract lists them (`AttachmentWithdrawReasons.All`). */
export const WITHDRAW_REASON_CODES = ['WRONG_STORE_DAY', 'UNREADABLE', 'DUPLICATE', 'NOT_ECR_SLIP', 'OTHER'] as const
export type WithdrawReasonCode = (typeof WITHDRAW_REASON_CODES)[number]

/** The one reason that needs a note, so the audit trail always says why. */
export const WITHDRAW_OTHER: WithdrawReasonCode = 'OTHER'

/**
 * The picker's list: each code and the key of its label. The label's VALUE holds
 * the English beside the Arabic, drafted in ticket 323 and waiting on the owner's
 * read, so the wording can change without touching code. The Withdrawn list never
 * reads these: it shows the server's `reasonLabel` / `reasonLabelArabic`.
 */
export const WITHDRAW_REASONS: readonly { code: WithdrawReasonCode; labelKey: string }[] = WITHDRAW_REASON_CODES.map(
  (code) => ({ code, labelKey: `slips.withdraw.reasons.${code}` }),
)

/** The note the server keeps: the first 200 characters (`OmsAttachment.Widths.WithdrawNote`). */
export const WITHDRAW_NOTE_MAX = 200

/** Does this code need a note? */
export function needsWithdrawNote(code: string | null | undefined): boolean {
  return code === WITHDRAW_OTHER
}

/**
 * May confirm be pressed (in-flight aside, which the dialog adds)? A reason must be
 * picked, and Other needs a note with something in it: blank and whitespace both
 * keep it disabled. Every other code confirms with or without a note.
 */
export function canConfirmWithdraw(code: string | null | undefined, note: string): boolean {
  if (!WITHDRAW_REASON_CODES.includes(code as WithdrawReasonCode)) return false
  return !needsWithdrawNote(code) || note.trim().length > 0
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
  reasonCode: WithdrawReasonCode
  note: string
}

export function withdrawBody(reasonCode: WithdrawReasonCode, note: string): WithdrawBody {
  return { reasonCode, note: withdrawNote(note) }
}

/**
 * What a withdraw's answer means for the drawer:
 * - `withdrawn`: 200. The slip is withdrawn now, or it already was and came back
 *   unchanged. Either way: close the dialog, drop its preview, re-read ByOwner and
 *   mark the grids stale.
 * - `invalid`: 400 `reasonCode` / `note`. The server's message in the dialog, and
 *   the user's input kept.
 * - `gone`: 404 `NOT_FOUND`. No longer a stored slip this session may withdraw: say
 *   so, close the dialog, re-read ByOwner.
 * - `forbidden`: a bare 403. The session lacks the grant: say so and take the action
 *   away for this drawer (the probe and the server disagree, and the server wins).
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

/** The answers that close the dialog: they leave nothing to edit or press again. The drawer acts on them. */
export type WithdrawClosingAnswer = Extract<WithdrawAnswer, 'withdrawn' | 'gone' | 'forbidden'>

/** Does this answer close the dialog? */
export function withdrawClosesDialog(answer: WithdrawAnswer): answer is WithdrawClosingAnswer {
  return answer === 'withdrawn' || answer === 'gone' || answer === 'forbidden'
}

/** May confirm be pressed again after this answer? Not after `NOT_SET_UP`: a retry cannot help. */
export function withdrawCanResend(answer: WithdrawAnswer): boolean {
  return answer === 'invalid' || answer === 'failed'
}
