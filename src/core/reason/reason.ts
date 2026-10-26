import { apiErrorCode, apiErrorMessage } from '@/core/api'

// The reason rule a delivery-rail write carries — extracted from `@/core/deliverect/reason` (ticket
// 477) by ticket 551, when the HungerStation area became its second reader. Both door contracts
// say the same thing ("a mandatory `reason`, 1–200 characters, unicode"); only the refusal CODE the
// server answers differs (Deliverect DLV-00009, HungerStation DHS-00008), so the rule lives here and
// each area binds its own code (`@/core/deliverect/reason`, `@/core/hungerstation/reason`).
// Pure: no React, no `t`.

/** The contracts' ceiling: 1–200 characters, unicode. */
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
 * Check a reason as the server will.
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
 * slot. Its `errorMessage` is `"<English> / <Arabic>"` and is displayed as server text.
 */
export function fieldRefusal(err: unknown, codes: readonly string[], fallback: string): FieldRefusal | null {
  const code = apiErrorCode(err)
  return code !== null && codes.includes(code) ? { message: apiErrorMessage(err, fallback), code } : null
}
