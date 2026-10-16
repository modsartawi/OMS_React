// The fix dialog's pure rules (ticket 497, brief 2691 "The fix dialog" and
// "POST PickSupport/Delivery/{deliveryNo}/Fix"). No React, no `t`.
//
// 🚩 The server re-checks (rule 3): whether a fix still applies is decided under the delivery's
// lock, never here. These rules only say when Confirm may be pressed, what the one request
// carries, and how its answer is read.

import type { PickSupportDiagnosis, PickSupportFixRequest, PickSupportFixResult, PickSupportShape } from '@/core/models/pick-support'
import { pickSupportFailure } from './failure'

/** The reason's width on the donor request's `SUPPORT_FIX` event (`DonorRequestEvent.Widths`). */
export const FIX_REASON_MAX = 512
/** The complaint reference's width, on both events. */
export const FIX_REFERENCE_MAX = 40

/** Confirm stays off until both the reason and the reference carry text once trimmed (rule 4). */
export function canConfirmFix(reason: string, complaintRef: string): boolean {
  return reason.trim() !== '' && complaintRef.trim() !== ''
}

/**
 * The one request: the shape, the reason and the reference — trimmed, as the server would — and
 * nothing else. No actor field: the server takes the signed-in user from the cookie session.
 */
export function fixBody(shape: PickSupportShape, reason: string, complaintRef: string): PickSupportFixRequest {
  return { shape, reason: reason.trim(), complaintRef: complaintRef.trim() }
}

/**
 * How the fix's answer reads:
 * - `fixed` — the fix stands. The panel takes `diagnosis`; when it is `null` (the re-read after the
 *   commit failed) it is STILL a success and `reread` asks the panel to GET the delivery again.
 *   There is never a retry of a fix that stood: it would be refused `PICK-00224`.
 * - `denied` — a bodiless 403: the session lacks `PickSupport,06`. Pressing again cannot help.
 * - `refused` — the server's sentence with its code. `PICK-00224` (no longer in that shape) offers
 *   Refresh diagnosis instead of a second press; the others (`PICK-00225` a blank field,
 *   `PICK-00003`, `PICK-00002`) leave Confirm available with the agent's input kept.
 */
export type FixOutcome =
  | { kind: 'fixed'; tellTheStoreEn: string; tellTheStoreAr: string; diagnosis: PickSupportDiagnosis | null; reread: boolean }
  | { kind: 'denied' }
  | { kind: 'refused'; code: string | null; message: string; offerRefresh: boolean; canResend: boolean }

const NO_LONGER_IN_SHAPE = 'PICK-00224'

export function fixOutcome(settled: { result: PickSupportFixResult | null | undefined } | { error: unknown }, fallback: string): FixOutcome {
  if ('result' in settled) {
    // A 200 is a fix that stood, even one whose `data` came back empty: read the delivery again.
    const { tellTheStoreEn, tellTheStoreAr, diagnosis } = settled.result ?? {}
    const d = diagnosis ?? null
    return { kind: 'fixed', tellTheStoreEn: tellTheStoreEn ?? '', tellTheStoreAr: tellTheStoreAr ?? '', diagnosis: d, reread: d === null }
  }
  const failure = pickSupportFailure(settled.error, fallback)
  if (failure.kind === 'denied') return failure
  const stale = failure.code === NO_LONGER_IN_SHAPE
  return { ...failure, offerRefresh: stale, canResend: !stale }
}
