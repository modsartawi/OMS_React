import { DELIVERECT_ERRORS } from '@/core/models/deliverect'
import { fieldRefusal } from '@/core/reason/reason'

// The reason rule every Deliverect write carries (contract § Common "Writes", spec 2615; ticket
// 477). Every write in 477–482 sends one — onboard, move, remove, pause, busy/close/reopen,
// whitelist import and edit, exclusions, platforms, terms.
//
// Since ticket 551 the rule itself (`reasonField`, `fieldRefusal`) is the shared one in
// `@/core/reason/reason`, which the HungerStation area reads too; this module re-exports it, so
// every Deliverect call site is unchanged, and binds Deliverect's own refusal code, DLV-00009.
// Pure: no React, no `t`.

export { REASON_MAX, fieldRefusal, reasonField } from '@/core/reason/reason'
export type { FieldRefusal, ReasonCheck, ReasonProblem } from '@/core/reason/reason'

/**
 * The server's own sentence when a write was refused for its reason (DLV-00009), else `null`.
 * Shown inline under the reason field, never as a toast.
 */
export function reasonRefusal(err: unknown, fallback: string): string | null {
  return fieldRefusal(err, [DELIVERECT_ERRORS.reasonInvalid], fallback)?.message ?? null
}
