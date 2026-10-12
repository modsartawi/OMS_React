import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { DELIVERECT_ERRORS } from '@/core/models/deliverect'

// The reason rule every Deliverect write carries (contract § Common "Writes", spec 2615; ticket
// 477). It lives in `@/core/` because EVERY write in 477–482 sends one — onboard, move, remove,
// pause, busy/close/reopen, whitelist import and edit, exclusions, platforms, terms — and a feature
// may never import another. Pure: no React, no `t`.

/** The contract's ceiling: 1–200 characters, unicode. */
export const REASON_MAX = 200

/** What is wrong with a reason as typed, or `null` when it may be sent. */
export type ReasonProblem = 'empty' | 'tooLong'

export interface ReasonCheck {
  /** The reason as it is sent: trimmed at both ends, nothing else touched. */
  reason: string
  /** Its length as the server counts it (see {@link reasonField}). */
  length: number
  problem: ReasonProblem | null
}

/**
 * Check a reason as the server will (DLV-00009).
 *
 * - Trimmed at both ends — white space alone is no reason. Inside, nothing is touched: Arabic,
 *   diacritics, line breaks and emoji are all sent as typed (unicode kept).
 * - Its length is counted in UTF-16 code units — JavaScript's `.length`, and .NET's
 *   `string.Length`, which is what the door compares with 200. An emoji therefore counts two, so
 *   the client never lets through a reason the server would refuse.
 */
export function reasonField(text: string): ReasonCheck {
  const reason = text.trim()
  const length = reason.length
  const problem: ReasonProblem | null = length === 0 ? 'empty' : length > REASON_MAX ? 'tooLong' : null
  return { reason, length, problem }
}

/** A refusal shown inline at the field it is about: the server's own sentence and its code. */
export interface FieldRefusal {
  message: string
  code: string
}

/**
 * The refusal `err` carries when its code is one of `codes`, else `null` — for a field's inline
 * slot (onboard's DLV-00002 at the store, DLV-00003 at the account). Its `errorMessage` is
 * `"<English> / <Arabic>"` and is displayed as server text.
 */
export function fieldRefusal(err: unknown, codes: readonly string[], fallback: string): FieldRefusal | null {
  const code = apiErrorCode(err)
  return code !== null && codes.includes(code) ? { message: apiErrorMessage(err, fallback), code } : null
}

/**
 * The server's own sentence when a write was refused for its reason (DLV-00009), else `null`.
 * Shown inline under the reason field, never as a toast.
 */
export function reasonRefusal(err: unknown, fallback: string): string | null {
  return fieldRefusal(err, [DELIVERECT_ERRORS.reasonInvalid], fallback)?.message ?? null
}
