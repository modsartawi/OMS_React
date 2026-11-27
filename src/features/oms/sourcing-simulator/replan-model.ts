/**
 * Planning again on the same figures (ticket 963, BackOffice spec 4354 §11 and §19; 4281 decisions 11 and 13). Pure.
 *
 * Run sends the cart the first time. When only the weight set or the pins changed since the last run, it sends the
 * earlier-run form instead — `basedOnRun` with the weight set and the pins now set, and nothing of the cart — so a plan
 * that changes has changed because of the change and not because stock moved. A changed cart, or a moved customer, is
 * always a new run with its own read; Run pressed with nothing changed reads afresh too.
 *
 * A run is held 30 minutes (spec §12). When the door answers `ADVISE-404` to planning again, the held copy is gone and
 * the cart runs again. A change that needs a figure the earlier run never read is read afresh by the door as a new run
 * with the mark `READ_AFRESH`, and the screen says so.
 */
import { apiErrorCode } from '@/core/api'
import type { AdviseCartRequest, AdvisePin, AdvisePoint, AdviseReplayRequest, AdviseReply, AdviseRerunRequest, AdviseWeightSetRef } from '@/core/models/sourcing-run'

/** What the user asks to run: the cart (without pins or set), the pins and the weight set. */
export interface RunAsk {
  /** The cart, or (964) the order to replay. */
  cart: AdviseCartRequest | AdviseReplayRequest
  pins: AdvisePin[]
  /** Null while no set is read: the door then plans on the candidate set. */
  weightSet: AdviseWeightSetRef | null
}

/** The run the page last showed, and what was asked of it. */
export interface LastRun {
  ask: RunAsk
  runId: string
}

export type SimulatorRequest = AdviseCartRequest | AdviseReplayRequest | AdviseRerunRequest

export const isRerun = (r: SimulatorRequest): r is AdviseRerunRequest => 'basedOnRun' in r

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * The cart form (or, 964, the order form), carrying the pins and the set. A replay sends them beside `orderNumber` as a
 * cart does: pins apply to every run (spec 4354 §3). A choice to confirm with BackOffice 4381 (4281 decision 11 says
 * "`orderNumber` alone").
 */
export function cartRequest(ask: RunAsk): AdviseCartRequest | AdviseReplayRequest {
  return {
    ...ask.cart,
    ...(ask.pins.length ? { pins: ask.pins } : {}),
    ...(ask.weightSet ? { weightSet: ask.weightSet } : {}),
  }
}

/**
 * The run on screen with the customer moved (964; review 4354 #3): a click or a drag on the map tab plans that run
 * again from the new point — its cart or order, time, pins and set as they were sent — never from the form as it is
 * now, which may have changed since or be unable to run. A cart's point is replaced; a replay's point is placed, or with
 * `null` taken away again ("back to the order's point"). A moved customer is always a new run with its own read.
 */
export function movedAsk(ask: RunAsk, point: AdvisePoint | null): RunAsk {
  if ('lines' in ask.cart) return point ? { ...ask, cart: { ...ask.cart, customer: { point } } } : ask
  // The point beside the order number, where `replayRequest` puts it: asks are compared as sent, so the form moved the
  // same way makes the same ask and the plans do not read as stale.
  const { orderNumber, customer: _was, ...rest } = ask.cart
  return { ...ask, cart: { orderNumber, ...(point ? { customer: { point } } : {}), ...rest } }
}

/** Whether two asks differ (the "stale plans" note compares what was run with what is set now). */
export const sameAsk = (a: RunAsk, b: RunAsk) => same(a, b)

/**
 * Whether the plans on screen read as stale: what was asked of them is no longer what the form asks. A run of this page
 * is stale while the form cannot run too. A stored run opened by its link (ticket 969) is stale once a pin or the weight
 * set changes from what it ran (review 2 #2), but not while the form asks nothing yet: a stored cart run never kept the
 * customer's point, so its form opens unable to run.
 */
export function plansStale(shown: { ask: RunAsk; stored: boolean } | null, ask: RunAsk | null): boolean {
  if (!shown) return false
  if (!ask) return !shown.stored
  return !same(shown.ask, ask)
}

/** Whether Run, asking this, plans again on the last run's figures (`basedOnRun`) rather than sending its cart. */
export const plansAgain = (ask: RunAsk, last: LastRun | null): boolean => isRerun(runRequest(ask, last))

export function runRequest(ask: RunAsk, last: LastRun | null): SimulatorRequest {
  const replan = !!last && same(ask.cart, last.ask.cart) && (!same(ask.pins, last.ask.pins) || !same(ask.weightSet, last.ask.weightSet))
  if (!replan || !last) return cartRequest(ask)
  return {
    basedOnRun: last.runId,
    ...(ask.weightSet ? { weightSet: ask.weightSet } : {}),
    ...(ask.pins.length ? { pins: ask.pins } : {}),
    level: 'full',
    allPlans: true,
  }
}

/** On a refusal: the cart to run again when planning again found the held copy gone (`ADVISE-404`); else null. */
export function cartAgain(sent: SimulatorRequest, err: unknown, ask: RunAsk): AdviseCartRequest | AdviseReplayRequest | null {
  return isRerun(sent) && apiErrorCode(err) === 'ADVISE-404' ? cartRequest(ask) : null
}

export interface RunBasis {
  /** Planned again: the figures are as read at this time, from this run. */
  figuresFrom: { runId: string; readAt: string | null } | null
  /** The change needed a figure the earlier run never read: read afresh, with the server's why. */
  readAfresh: { why: string | null } | null
  /** The held copy was gone, so the cart ran again. */
  heldGone: boolean
}

export function runBasis(reply: Pick<AdviseReply, 'basedOnRun' | 'figuresReadAt' | 'solve'>, { heldGone }: { heldGone: boolean }): RunBasis {
  return {
    figuresFrom: reply.basedOnRun ? { runId: reply.basedOnRun, readAt: reply.figuresReadAt ?? null } : null,
    readAfresh: reply.solve.marks.includes('READ_AFRESH') ? { why: reply.solve.readAfreshWhy ?? null } : null,
    heldGone,
  }
}
