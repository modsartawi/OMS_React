/**
 * A prescription that already has an open order, confirmed before submit (ticket 1009, spec 1006
 * D5).
 *
 * OMS already holding an active prescription for this patient and reference is a **warning**, not
 * a block: submit stops with the open order's number and a `confirmToken`, and the agent either
 * goes back or places the order anyway. It is the same two-phase protocol as the plant rebind and
 * the below-availability acceptance (CONTRACT.md §5) — the same three functions
 * (`confirm-action.ts`) and the same modal (`ConfirmSheet`). A third mechanism would be a defect.
 *
 * 🚩 **The submit is the one verb whose answer is not a `SessionState`.** A pending ask on it must
 * never reach `readSubmitResult`, which would draw *Order placed* over an order that has no number.
 * `submitAsk` is read FIRST, and a `confirmationRequired` answer it cannot state is never a success.
 *
 * Contract v1.15 is PROPOSED (BackOffice 4488 open); the shapes read here are guesses recorded in
 * ticket 1009's Comments.
 */
import type { TFunction } from 'i18next'
import type { PendingConfirmation, SubmitAnswer } from '@/core/models/callcenter'
import { fsi } from '@/core/util/bidi'
import { committing, type ConfirmableAction } from './confirm-action'

/** One press of *Place order*: its id (kept through the confirm re-send, law 3), the order
 *  version it was made against, and the token while it is committing an ask. */
export interface SubmitPress extends ConfirmableAction {
  version: number
}

/** What the agent is asked: the token that commits the order, and the open order's number. */
export interface ActivePrescriptionAsk {
  confirmToken: string
  /** `null` where the ask named no number — the sheet still asks, in words without one. */
  documentNo: string | null
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null)

/** The `pendingConfirmation` block, projected — `null` for any other kind, or one with no token. */
export function activePrescriptionAsk(pending: PendingConfirmation | null | undefined): ActivePrescriptionAsk | null {
  if (!pending || pending.kind !== 'activePrescription' || !pending.confirmToken) return null
  return { confirmToken: pending.confirmToken, documentNo: str(asRecord(pending.detail).documentNo) }
}

/** The ask a submit answer carries, read off its (unchanged) state — `null` on a placed order. */
export function submitAsk(answer: SubmitAnswer): ActivePrescriptionAsk | null {
  return activePrescriptionAsk(answer.state?.pendingConfirmation)
}

/** The sheet's words. The order number is a machine value inside a sentence, so it is isolated
 *  whole with `fsi` (bidi rule: a `t()` interpolation is a string-only sink). */
export function activePrescriptionCopy(
  ask: ActivePrescriptionAsk,
  t: TFunction,
): { title: string; body: string; keep: string; confirm: string; working: string } {
  return {
    title: t('activePrescription.title'),
    body: ask.documentNo
      ? t('activePrescription.body', { documentNo: fsi(ask.documentNo) })
      : t('activePrescription.bodyNoNumber'),
    keep: t('activePrescription.keep'),
    confirm: t('activePrescription.confirm'),
    working: t('activePrescription.working'),
  }
}

/**
 * *Place anyway*: the same press — the same `requestId` (law 3) — re-sent with the token.
 *
 * 🚩 `null` means **send nothing**: while the commit is in flight (a double click must not send the
 * token twice), once the ask is gone (*Go back*, or the commit already answered), and with no press
 * behind it. `inFlight` is the caller's synchronous guard, not the mutation's re-rendered flag.
 */
export function placeAnyway<T extends ConfirmableAction>(
  press: T | null,
  ask: ActivePrescriptionAsk | null,
  inFlight: boolean,
): T | null {
  if (!press || !ask || inFlight) return null
  return committing(press, ask.confirmToken)
}
