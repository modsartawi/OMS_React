/**
 * Adding beyond what the store has, as one action from the first send to the
 * commit (ticket 169).
 *
 * Availability is a **soft gate**: an agent may take an order for more than the
 * store has, but the acceptance has to be theirs and has to be recorded as
 * theirs. So an add (or a quantity raise) beyond availability answers `200` with
 * the **unchanged** state and a `belowAtp` confirmation (CONTRACT.md §5.2), and
 * the re-send carrying that token commits — the same protocol as the plant
 * rebind and, deliberately, the same three functions (`confirm-action.ts`) and
 * the same modal (`ConfirmSheet`). A second confirmation mechanism would be a
 * defect.
 *
 * Three rules live here rather than in the page, because they are rules rather
 * than rendering:
 *
 * 1. 🚩 **Unknown availability raises nothing at all.** Where the stock read
 *    degraded there is no number to accept, and unknown ATP has never gated
 *    order entry (§5.2, 287's rule) — so `belowAtpAsk` answers `null` at any
 *    quantity. A console that confirmed here would turn a degraded service into
 *    a workflow, on the verb the agent presses most.
 * 2. 🚩 **The token IS the audit record.** It proves the agent was shown the
 *    number they accepted, which a client-set boolean never could (§5.2,
 *    BackOffice 285/286). Which is why nothing here computes a shortfall from
 *    the search row the agent was looking at: the figures shown are the ones the
 *    server pinned to the token being sent back.
 * 3. **The line's pill is FROZEN, not live.** `atpAtScan` is availability as it
 *    was when the item was added (§2.1); it is classified through the search
 *    row's own three states so the two never read alike — with `known:false`
 *    landing on *unknown* whatever quantity rides beside it.
 */
import type { AtpAtScan, PendingConfirmation } from '@/core/models/callcenter'
import { newRequestId } from './api'
import { committing, repreviewing, type ConfirmableAction } from './confirm-action'
import { availabilityOf, type Availability } from './item-search'

/**
 * One add, as the console sends it: the intent, and the id that survives the
 * confirm re-send.
 *
 * 🚩 It carries an item number and a quantity and **never a price** (law 1). The
 * estimate the agent was looking at when they pressed *Add* is a material-master
 * figure that has never been near the engine.
 */
export interface ItemAdd extends ConfirmableAction {
  itemNumber: string
  qty: number
  /** The row's own name, held only so the confirmation can say what the agent
   *  read out rather than an item number. Never sent. */
  description?: string
  /**
   * Which guidance card this add was launched from (172), where it was. Held so
   * the strip can say *Adding…* on the row that launched it — and so the outcome
   * is classified against the offer the agent was actually working on.
   *
   * 🚩 Never sent, like `description`: the wire carries an item number and a
   * quantity (law 1). The engine decides what fires; the console does not ask.
   */
  offerId?: string
}

/** What the agent asked for. The ONLY place an add's id is minted — a second
 *  call site is how a busy retry starts looking like a second add. */
export function beginAdd(
  intent: { itemNumber: string; qty: number; description?: string; offerId?: string },
  mint: () => string = newRequestId,
): ItemAdd {
  return { ...intent, requestId: mint() }
}

/** The acceptance: the same verb, the same id, plus the token (§5). */
export const committingAdd = (add: ItemAdd, confirmToken: string): ItemAdd => committing(add, confirmToken)

/** A spent or stale token: dropped, and the same action asks again. */
export const reaskingAdd = (add: ItemAdd): ItemAdd => repreviewing(add)

/**
 * What the agent is being asked to accept — the four figures §5.2 carries, and
 * the token that commits them.
 */
export interface BelowAtpAsk {
  confirmToken: string
  itemNumber: string
  requested: number
  /** Known by construction: an unknown availability is not an ask at all. */
  available: number
  /** Which store the shortfall is at. `null` where the block named none — the
   *  order's own store chip is then the only thing that answers it. */
  plant: string | null
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

/**
 * The `pendingConfirmation` block, projected — or `null` when this add is not
 * asking the agent anything.
 *
 * 🚩 It answers `null` for a `storeChange` confirmation too. That kind is
 * [167](.issues/167-store-move-shows-the-diff.md)'s and reuses this same modal
 * pattern; a below-availability sheet that drew someone else's detail would be
 * the second confirmation mechanism both slices exist to prevent.
 *
 * 🚩 It also answers `null` where the two figures are not both readable numbers.
 * That is not defensiveness for its own sake: `available: null` is precisely how
 * a degraded stock read arrives, and a sheet asking the agent to accept "5 of —"
 * is a number they cannot have been shown.
 */
export function belowAtpAsk(pending: PendingConfirmation | null | undefined): BelowAtpAsk | null {
  if (!pending || pending.kind !== 'belowAtp' || !pending.confirmToken) return null
  const detail = asRecord(pending.detail)
  const requested = num(detail.requested)
  const available = num(detail.available)
  if (requested === null || available === null) return null
  // Within availability there is nothing to accept. Asked for the same reason as
  // the two nulls above: the server decides when to raise this block, and the
  // console's job is to never draw an acceptance it cannot state truthfully.
  if (requested <= available) return null
  return {
    confirmToken: pending.confirmToken,
    itemNumber: str(detail.itemNumber) ?? '',
    requested,
    available,
    plant: str(detail.plant),
  }
}

/**
 * A basket line's availability **as frozen when the item was added** (§2.1),
 * classified through the search row's own three states — so *at add* and live
 * availability differ in wording while sharing a shape, and a re-freeze after a
 * store move ([167](.issues/167-store-move-shows-the-diff.md)) is visible rather
 * than silent.
 *
 * 🚩 `known:false` is *unknown* whatever `quantity` says beside it. A degraded
 * read is not a zero, and the quantity is dropped rather than shown as a figure
 * the agent could quote.
 */
export function frozenAvailability(atp: AtpAtScan | null | undefined): Availability {
  if (!atp || atp.known !== true) return { kind: 'unknown', quantity: null, labelKey: 'unknown', tone: 'caution' }
  return availabilityOf(atp.quantity)
}
