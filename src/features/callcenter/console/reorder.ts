/**
 * *Reorder all* and the history read's gate (ticket 990, spec 983 D11, contract v1.13 C2).
 *
 * 🚩 **A reorder is N ordinary adds, one at a time** — never a batch verb and never
 * in parallel. Each line goes through the page's own `addItem` path (its `runGuarded`
 * busy schedule, its guardrails), so every line is priced by the engine today and
 * refused by it where it would refuse a typed add. Two rules decide the loop:
 *
 * - **It stops at the first `SESSION_BUSY`** that reaches it. That refusal arrives
 *   only after the contract's bounded schedule is spent (§6.1), and sending the next
 *   line into a claim that is still held would only stack refusals behind it. A dead
 *   order (`SESSION_CLOSED`, `NOT_YOUR_SESSION`) stops it too: every later line would
 *   fail the same way.
 * - **Any other refusal is that line's.** It is reported with the server's own
 *   message and the loop carries on — a blocked item must not cost the caller the
 *   rest of their usual order.
 *
 * A below-availability ask (§5.2) is also *not added*: the ask carries the unchanged
 * state, and accepting a shortfall is the agent's deliberate act from the search row,
 * never something a reorder does for them.
 *
 * Nothing here is a phrase or money: the report carries counts, lines and the
 * server's messages, and the render tier words them.
 */
import { apiErrorCode } from '@/core/api'
import { readSessionFault } from '@/core/engine-session/session-fault'
import type { CustomerHistoryOrder, SessionState } from '@/core/models/callcenter'

/** One line to add again — the past order's item, quantity and unit. */
export interface ReorderLine {
  itemNumber: string
  description: string
  qty: number
  uom: string
}

/** A line that did not land, and why. `message` is the server's, on `refused`. */
export interface ReorderRefusal {
  line: ReorderLine
  reason: 'refused' | 'belowAtp'
  message: string | null
}

export interface ReorderReport {
  /** How many lines landed. */
  added: number
  /** How many lines the order had — the `of` in *4 of 5 added*. */
  total: number
  refused: ReorderRefusal[]
  /** Why the loop stopped early, or `null` when it reached the end. */
  stopped: 'busy' | 'closed' | null
  /** The lines never sent, from the one that met the stop onward. */
  notTried: ReorderLine[]
}

export interface ReorderDeps {
  /** One add — the page's `runGuarded(addItem)` with a fresh `requestId` per line. */
  add: (line: ReorderLine) => Promise<SessionState>
  /** The display text of a refusal — the page's `apiErrorMessage` with its fallback. */
  messageOf: (err: unknown) => string
  /** Each landed (or asked) state, so the basket redraws line by line. */
  onLanded?: (state: SessionState) => void
}

/** A past order's items as lines to add again, in the order's own order. */
export const reorderLines = (order: CustomerHistoryOrder): ReorderLine[] =>
  order.items.map(({ itemNumber, description, qty, uom }) => ({ itemNumber, description, qty, uom }))

export async function reorderAll(lines: readonly ReorderLine[], deps: ReorderDeps): Promise<ReorderReport> {
  const report: ReorderReport = { added: 0, total: lines.length, refused: [], stopped: null, notTried: [] }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    try {
      const state = await deps.add(line)
      deps.onLanded?.(state)
      if (state.pendingConfirmation?.kind === 'belowAtp') {
        report.refused.push({ line, reason: 'belowAtp', message: null })
      } else {
        report.added += 1
      }
    } catch (err) {
      const stop = apiErrorCode(err) === 'SESSION_BUSY' ? 'busy' : readSessionFault(err) ? 'closed' : null
      if (stop) {
        report.stopped = stop
        report.notTried = lines.slice(index)
        return report
      }
      report.refused.push({ line, reason: 'refused', message: deps.messageOf(err) })
    }
  }
  return report
}

/**
 * Whether — and for whom — the history is read (D11): only with a caller attached
 * on an order that is still open, and keyed by that caller, so it is read once per
 * attached customer and a swap reads the new one. `null` means *do not read*: before
 * an attach the door would refuse `NO_CUSTOMER_ATTACHED`.
 */
export function historyRead(
  state: SessionState | undefined,
): { transactionId: string; customerId: string } | null {
  const customerId = state?.header.customer?.customerId
  if (!state || !customerId || state.status !== 'open') return null
  return { transactionId: state.transactionId, customerId }
}
