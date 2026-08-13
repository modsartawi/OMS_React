import { roundMoney } from '@/core/money'
import type { SettlementCancelResult, SettlementEntry } from '@/core/models/settlement'

/**
 * **The correction decision** — which single button an entry shows, and what a
 * cancel that lost its race turns into (ticket 272, spec 267 D5).
 *
 * 🔑 **The screen never offers both acts, and that is the whole module.** A menu
 * carrying *Cancel* and *Write off* side by side is a menu on which someone
 * eventually cancels a consumed entry — so the entry decides, here, once, and the
 * component renders whatever single affordance comes back. There is deliberately no
 * function returning *"can this be cancelled"* and no second one returning *"can
 * this be written off"*: two predicates a caller could ask independently are two
 * predicates a caller can ask **both** of.
 *
 * ⚠️ **The rule is the server's; this is its shadow.** The real predicate lives
 * inside the server's guarded UPDATE (`remaining == amount`), which is why nothing
 * here is authoritative and why `afterRefusedCancel` exists at all — the screen can
 * be right at render time and stale by the time the button is pressed.
 *
 * 🚩 Pure: no React, no `t()`, no network, no clock. Every figure is a number and
 * every outcome is a tagged union; the words are the component's, through the
 * `settlement` namespace.
 */

/**
 * Why an entry offers no correction at all.
 *
 * Four statuses, three of which are already finished — and they are distinguished
 * rather than collapsed into *"closed"*, because the sentence beside a missing
 * button is the only thing telling a reader whether the money went to a till, was
 * withdrawn, or was forgiven. That is a different fact in each case, and it is the
 * one the branch will ask about.
 */
export type NoCorrectionReason =
  | 'consumed'
  | 'cancelled'
  | 'written-off'
  /** `OPEN` with nothing left on it — a state the server should not produce, and
   *  which must not be met with a write-off of zero. See `correctionFor`. */
  | 'nothing-left'

/**
 * The one affordance an entry offers.
 *
 * 🔑 `cancel` and `write-off` are **cases of one union**, not two flags, so there is
 * no representable state in which a component could draw both.
 */
export type CorrectionOffer =
  /** Untouched: `OPEN`, and remaining is still the full amount. */
  | { kind: 'cancel'; amount: number }
  /** Partly consumed: `OPEN`, and a till has taken some of it. The figure is the
   *  server's own `remainingAmount`, never `amount − remaining` — this feature
   *  computes no differences (269's rule 3, and the reason it is written down). */
  | { kind: 'write-off'; remaining: number }
  | { kind: 'none'; because: NoCorrectionReason }

/**
 * Which single button, from status and remaining.
 *
 * The four statuses, and what each one answers:
 *
 * | status | affordance | why |
 * |---|---|---|
 * | `OPEN`, remaining == amount | **Cancel** | nothing was ever taken, so it can be withdrawn as though it never happened |
 * | `OPEN`, remaining < amount | **Write off the remaining** | a receipt is already in a collector's hands; it is never retro-voided |
 * | `CONSUMED` | none | a till took all of it — there is nothing left to correct |
 * | `CANCELLED` / `CLOSED_OUT` | none | already corrected once, and an entry is not corrected twice |
 *
 * ⚠️ **Equality is tested at the scale money is HELD at**, not at the branch's
 * display precision. A BHD entry of `95.250` partly consumed by `0.001` is a
 * different entry from an untouched one, and rounding that away at 2 decimals would
 * offer *Cancel* on an entry the server will refuse to cancel — which is the exact
 * race this ticket spends its recovery path on, manufactured by the client for no
 * reason.
 *
 * ⚠️ `remaining > amount` is not reachable through any server path, and it is
 * **not** treated as untouched: whatever produced it, the cancel's predicate would
 * not hold, so the honest affordance is the one that can actually succeed.
 */
export function correctionFor(
  entry: Pick<SettlementEntry, 'status' | 'amount' | 'remainingAmount'> | null | undefined,
): CorrectionOffer {
  if (!entry) return { kind: 'none', because: 'nothing-left' }

  switch (entry.status) {
    case 'CONSUMED':
      return { kind: 'none', because: 'consumed' }
    case 'CANCELLED':
      return { kind: 'none', because: 'cancelled' }
    case 'CLOSED_OUT':
      return { kind: 'none', because: 'written-off' }
    case 'OPEN':
      break
  }

  const amount = roundMoney(entry.amount)
  const remaining = roundMoney(entry.remainingAmount)

  if (remaining === amount) return { kind: 'cancel', amount }
  // 🚩 An `OPEN` entry with nothing left is a server inconsistency (the consume
  // that emptied it should have set `CONSUMED`), and the one thing the screen must
  // not do with it is offer to write off zero — an act with no effect, whose audit
  // row would say an accountant forgave nothing.
  if (remaining <= 0) return { kind: 'none', because: 'nothing-left' }
  return { kind: 'write-off', remaining }
}

/**
 * 🔑 **What a cancel that lost its race becomes.**
 *
 * The server's predicate is inside its UPDATE, so between the screen drawing
 * *Cancel* and the accountant pressing it, a till at the branch can consume part of
 * the entry. The refusal arrives as a **200 with `accepted: false` and a true
 * remaining** (D8), and the whole of this ticket's 🔑 bullet is what happens next:
 * the screen comes back with *"a till consumed part of this — here is the new
 * remaining"* and the **write-off in reach**, never an error toast.
 *
 * ⚠️ **The recovery is the same rule applied to the server's newer truth**, not a
 * patch on the old one — `correctionFor` runs again over the returned remaining.
 * That is what stops the two paths drifting: there is one definition of *which
 * button*, and a raced entry gets it too.
 *
 * Three outcomes, because three genuinely different things can come back:
 *
 * - **`partly-consumed`** — the case the ticket is about. Carries the new remaining
 *   *and* the write-off it licenses.
 * - **`nothing-left`** — a till consumed **all** of it while the dialog was open.
 *   There is no write-off to offer, and offering one for zero would be an act with
 *   no effect. The entry is simply finished, and the screen says so.
 * - **`refused`** — the remaining did not move, so whatever the server objected to
 *   is not this race. Its own words are passed through as data. 🚩 It must **not**
 *   fall through to *Cancel* again: a button that reappears unchanged after a
 *   refusal is a button an accountant presses in a loop.
 */
export type CancelRefusal =
  | { kind: 'partly-consumed'; remaining: number; offer: Extract<CorrectionOffer, { kind: 'write-off' }> }
  | { kind: 'nothing-left' }
  | { kind: 'refused'; reason: string }

export function afterRefusedCancel(
  entry: Pick<SettlementEntry, 'status' | 'amount' | 'remainingAmount'>,
  result: Pick<SettlementCancelResult, 'refusalReason' | 'remainingAmount'> | null | undefined,
): CancelRefusal {
  const reason = result?.refusalReason ?? ''
  const returned = result?.remainingAmount

  // ⚠️ A refusal carrying no usable figure is a refusal, not a race: guessing a
  // remaining here would put a number on screen that no server ever sent, on the
  // one screen whose figures a branch is asked to hand money over against.
  if (typeof returned !== 'number' || !Number.isFinite(returned))
    return { kind: 'refused', reason }

  const next = correctionFor({ ...entry, status: 'OPEN', remainingAmount: returned })
  if (next.kind === 'write-off')
    return { kind: 'partly-consumed', remaining: next.remaining, offer: next }
  if (next.kind === 'none' && next.because === 'nothing-left') return { kind: 'nothing-left' }
  return { kind: 'refused', reason }
}

/**
 * What a refused **close-out** came back with.
 *
 * 🚩 **It lives here rather than in the component, and that is the point.** The
 * cancel's refusal got a tagged union in this tested module while the close-out's
 * was being reasoned about inline — with a `-1` standing in for *"no figure"*, which
 * is a magic number on a screen whose every other figure is money. Two refusal paths
 * on one panel reasoned about two different ways is exactly how the second one ends
 * up wrong and untested.
 *
 * ⚠️ **`remainingAmount` on a refusal is unambiguous** — nothing was forgiven, so
 * the only thing it can mean is what the entry has left. (On a *successful*
 * close-out it is genuinely ambiguous, which is why the confirmation names no figure
 * at all; see `.afk/HITL-272.md`.)
 *
 * ⚠️ D8 gives this answer **no `refusalReason`**, unlike cancel and repair — so
 * unlike `CancelRefusal` there are no server words to pass through, and every case
 * here reads through the namespace's own sentence.
 */
export type CloseOutRefusal =
  /** The entry still has a remainder; the server simply would not forgive it. */
  | { kind: 'refused'; remaining: number }
  /** A till took the rest while the panel was open — there is nothing to forgive. */
  | { kind: 'nothing-left' }
  /** No usable figure came back. The screen states none rather than inventing one. */
  | { kind: 'unstated' }

export function afterRefusedCloseOut(
  result: { remainingAmount?: number } | null | undefined,
): CloseOutRefusal {
  const returned = result?.remainingAmount
  if (typeof returned !== 'number' || !Number.isFinite(returned)) return { kind: 'unstated' }
  if (roundMoney(returned) <= 0) return { kind: 'nothing-left' }
  return { kind: 'refused', remaining: roundMoney(returned) }
}
