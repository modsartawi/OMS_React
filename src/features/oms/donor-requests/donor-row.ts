/**
 * A donor request as the list draws it (ticket 431, spec 430 D3/D9). Pure: no React, no `t`.
 *
 * Everything here is derived from the row's own times, over the `@/core/oms` donor-moments
 * helpers the Delivery timeline already uses — so a refused request reads amber and a cancelled
 * one muted on both screens. Nothing is asked of the server (D3).
 */
import type { DonorRequestModel } from '@/core/models/sd-document'
import { donorOutcome, elapsedSince, waitingOnDonor, type DonorOutcome, type Elapsed } from '@/core/oms/donor-moments'
import { entryTimeValue, realTime } from '@/core/oms/timeline'

/** `attention` = needs a decision (refused, expired); `muted` = cancelled. */
export type DonorTone = 'attention' | 'muted'

export interface DonorRowView {
  /** How it ended, when the server sent an outcome. */
  outcome: DonorOutcome | null
  tone: DonorTone | null
  /** How long an OPEN, unpicked request has waited on its donor; `null` for every other row. */
  waiting: Elapsed | null
  /** Cancelled after its units were picked: stock may be in motion, unlike a clean cancel. */
  cancelledAfterPicked: boolean
  /** Whole minutes from raised to picked; `null` until picked (or when the raise time is unset). */
  minutesToPick: number | null
}

const isCancelledState = (r: DonorRequestModel) => (r.state ?? '').trim().toUpperCase() === 'CANCELLED'

export function donorRow(r: DonorRequestModel, now: number): DonorRowView {
  const outcome = donorOutcome(r)
  // A cancelled state with no outcome sent reads as a cancel, as the timeline's `none` ink does.
  const cancelled = outcome === 'cancelled' || (outcome === null && isCancelledState(r))
  const tone: DonorTone | null = outcome === 'refused' || outcome === 'expired' ? 'attention' : cancelled ? 'muted' : null
  const picked = realTime(r.fulfilledAt)
  const raisedAt = entryTimeValue(r.raisedAt)
  const pickedAt = entryTimeValue(r.fulfilledAt)
  return {
    outcome,
    tone,
    waiting: waitingOnDonor([r]).length > 0 ? elapsedSince(r.raisedAt, now) : null,
    cancelledAfterPicked: cancelled && picked !== null,
    minutesToPick:
      Number.isFinite(raisedAt) && Number.isFinite(pickedAt) ? Math.floor(Math.max(0, pickedAt - raisedAt) / 60_000) : null,
  }
}
