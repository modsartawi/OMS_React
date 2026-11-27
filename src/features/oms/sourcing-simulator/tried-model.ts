/**
 * What was tried and the trade-off (ticket 966, BackOffice spec 4354 §9; the run record 4242 "search"; SIMT "how it is
 * drawn"). Pure.
 *
 * - **What was tried**: the best whole plans the search kept for a goal (50 per goal, a system setting), ten at first
 *   and the rest behind "show more" (4242), each with what it lost by against the goal's winner and the part that cost
 *   it most, as sent; and the search counts.
 * - **The trade-off**: every kept plan once, at the minutes until its last shipment arrives and at its fee with the
 *   company's cost, shaped by its deliveries (pick-up apart), the shown plans marked with every goal each answers.
 *   The point's height (`money`) is drawing geometry: the screen never prints it as a figure — its tooltip shows the
 *   fee and the company's cost as sent (4281 decision 28, no reader adds up).
 */
import { PLAN_GOALS, type AdviseKeptPlan, type AdviseKeptShipment, type AdviseReply, type AdviseSearchCounts, type PlanGoal } from '@/core/models/sourcing-run'

/** `yyyy-MM-dd HH:mm:ss` → `HH:mm`, read off the string: local wall clock, no zone (4379). */
export const clock = (at: string | null | undefined): string => (at && at.length >= 16 ? at.slice(11, 16) : '')

/** How many kept plans a goal shows before "show more" (the run record 4242). */
export const TRIED_FIRST = 10

export interface TriedRow {
  rank: number
  /** The goal's winner (rank 1, nothing lost). */
  winner: boolean
  shipments: AdviseKeptShipment[]
  deliveries: number
  pickUp: boolean
  linesServed: number
  promiseBy: string
  fee: number
  companyCost: number
  waiting: number
  sum: number
  lostBy: number
  lostMostOn: string | null
}

export interface Tried {
  rows: TriedRow[]
  /** Kept plans behind "show more". */
  more: number
  counts: AdviseSearchCounts | null
}

const isPickUp = (shipments: readonly { mode: string }[]) => shipments.length > 0 && shipments.every((s) => s.mode === 'PICK_UP')

/** The goals the search kept plans for, in the screen's goal order. */
export function keptGoals(reply: Pick<AdviseReply, 'search'>): PlanGoal[] {
  const kept = new Set((reply.search?.kept ?? []).map((k) => k.goal))
  return PLAN_GOALS.filter((g) => kept.has(g))
}

/** A goal's kept plans by rank: the first ten, or all of them once "show more" is pressed. */
export function triedFor(reply: Pick<AdviseReply, 'search'>, goal: PlanGoal, showAll: boolean): Tried {
  const search = reply.search
  if (!search) return { rows: [], more: 0, counts: null }
  const all = (search.kept ?? []).filter((k) => k.goal === goal).sort((a, b) => a.rank - b.rank)
  const rows = (showAll ? all : all.slice(0, TRIED_FIRST)).map(
    (k): TriedRow => ({
      rank: k.rank,
      winner: k.rank === 1,
      shipments: k.shipments,
      deliveries: k.shipments.length,
      pickUp: isPickUp(k.shipments),
      linesServed: k.linesServed,
      promiseBy: k.by,
      fee: k.fee,
      companyCost: k.companyCost,
      waiting: k.waiting,
      sum: k.sum,
      lostBy: k.lostBy,
      lostMostOn: k.lostMostOn ?? null,
    }),
  )
  return { rows, more: all.length - rows.length, counts: search.counts ?? null }
}

// ── The trade-off ────────────────────────────────────────────────────────────────────────────────

export type TradeOffShape = 'circle' | 'square' | 'triangle' | 'diamond'

export interface TradeOffPoint {
  /** Unique on the chart: the plan's pairs and lines, and its promise time. */
  id: string
  /** The plan's pairs and lines (`store:mode:lines|…`). Two plans through the same pairs at other times share it. */
  key: string
  minutes: number
  fee: number
  companyCost: number
  /** Drawing geometry only: the point's height. Never printed. */
  money: number
  promiseBy: string
  deliveries: number
  shape: TradeOffShape
  /** The goals of the shown plan this point is, in the screen's goal order; empty for a plan tried and not shown. */
  shown: PlanGoal[]
  shipments: AdviseKeptShipment[]
}

/** `yyyy-MM-dd HH:mm:ss` (local wall clock, no zone) as minutes on one scale; `null` when it does not read. */
function wallMinutes(at: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(at ?? '')
  if (!m) return null
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)) / 60000
}

const keyOf = (shipments: readonly AdviseKeptShipment[]) => shipments.map((s) => `${s.store}:${s.mode}:${s.lines.join(',')}`).join('|')

const shapeOf = (shipments: readonly AdviseKeptShipment[]): TradeOffShape =>
  isPickUp(shipments) ? 'diamond' : shipments.length <= 1 ? 'circle' : shipments.length === 2 ? 'square' : 'triangle'

/** Every kept plan with a time and money, once; the shown plans marked. */
export function tradeOffPoints(reply: Pick<AdviseReply, 'search' | 'plans' | 'plannedFor'>): TradeOffPoint[] {
  const start = wallMinutes(reply.plannedFor)
  if (start === null) return []
  const shownGoals = new Map<string, Set<PlanGoal>>()
  for (const p of reply.plans) {
    const id = `${keyOf(p.shipments)}@${p.promise.by}`
    const goals = shownGoals.get(id) ?? new Set<PlanGoal>()
    goals.add(p.goal)
    p.alsoGoals.forEach((g) => goals.add(g))
    shownGoals.set(id, goals)
  }
  const points = new Map<string, TradeOffPoint>()
  for (const k of reply.search?.kept ?? ([] as AdviseKeptPlan[])) {
    const end = wallMinutes(k.by)
    if (end === null) continue
    const key = keyOf(k.shipments)
    const id = `${key}@${k.by}`
    if (points.has(id)) continue
    const goals = shownGoals.get(id)
    points.set(id, {
      id,
      key,
      minutes: Math.round(end - start),
      fee: k.fee,
      companyCost: k.companyCost,
      money: k.fee + k.companyCost,
      promiseBy: k.by,
      deliveries: k.shipments.length,
      shape: shapeOf(k.shipments),
      shown: goals ? PLAN_GOALS.filter((g) => goals.has(g)) : [],
      shipments: k.shipments,
    })
  }
  return [...points.values()]
}
