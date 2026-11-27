/**
 * Starting a run by replaying an order (ticket 964, BackOffice 4281 decision 11, 4381): the order number, the
 * customer-point switch (`withCustomerPoint`, decision 17), and the point the user placed by hand, if any. Pure.
 */
import type { AdviseCartRequest, AdvisePoint, AdviseReplayRequest } from '@/core/models/sourcing-run'
import type { SimulatorRequest } from './replan-model'

/** How a run is started (SIMT decision 6: a two-way switch). */
export const START_KINDS = ['replay', 'build'] as const
export type StartKind = (typeof START_KINDS)[number]

export interface ReplayForm {
  orderNumber: string
  /** The customer-point switch. */
  withPoint: boolean
  /** The point placed by hand (a click or a drag on the map); null plans from the order's own point. */
  movedTo: AdvisePoint | null
}

export type ReplayProblem = 'noOrder' | 'badOrder'

export function replayProblem(form: ReplayForm): ReplayProblem | null {
  const n = form.orderNumber.trim()
  if (n === '') return 'noOrder'
  return /^\d+$/.test(n) ? null : 'badOrder'
}

/**
 * The order form of the request: `orderNumber` with the user route's own fields, and the hand-placed point beside it
 * when there is one (a replay "with the customer's point moved by hand", kind `REPLAY_MOVED_POINT`). Null while the
 * order number cannot be sent.
 */
export function replayRequest(form: ReplayForm): AdviseReplayRequest | null {
  if (replayProblem(form)) return null
  return {
    orderNumber: form.orderNumber.trim(),
    ...(form.movedTo ? { customer: { point: form.movedTo } } : {}),
    level: 'full',
    allPlans: true,
    withCustomerPoint: form.withPoint,
  }
}

/** The request as the cart form, or null for a replay (the tabs read the cart's lines from it). */
export const cartRequestOf = (r: SimulatorRequest | null | undefined): AdviseCartRequest | null => (r && 'lines' in r ? r : null)
