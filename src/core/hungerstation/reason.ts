import { HUNGERSTATION_ERRORS } from '@/core/models/hungerstation'
import { fieldRefusal } from '@/core/reason/reason'

// The reason every HungerStation write carries (contract § Common "Writes", spec 3028; ticket 551):
// onboard and edit (551), remove (552), pause / resume and sync now (553), material import and
// change (555), retry (556). The rule is the shared one (`@/core/reason/reason`); this module binds
// the HungerStation refusal code, DHS-00008. Pure: no React, no `t`.

export { REASON_MAX, fieldRefusal, reasonField } from '@/core/reason/reason'
export type { FieldRefusal, ReasonCheck, ReasonProblem } from '@/core/reason/reason'

/**
 * The server's own sentence when a write was refused for its reason (DHS-00008), else `null`.
 * Shown inline under the reason field, never as a toast.
 */
export function reasonRefusal(err: unknown, fallback: string): string | null {
  return fieldRefusal(err, [HUNGERSTATION_ERRORS.reasonInvalid], fallback)?.message ?? null
}
