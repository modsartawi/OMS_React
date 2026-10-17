import type {
  RuleSimEffect,
  RuleSimLine,
  RuleSimOutcome,
  RuleSimRequest,
  RuleSimResult,
} from '@/core/models/rule-campaign'
import type { BasketLine } from './basket'

// The simulator's request and HQ's answer, shaped for the page (ticket 514). Pure. The client
// groups and counts what HQ answered; it never works an effect out (ADR 0089).

/** The outcomes, in the order the trace's summary reads them. */
export const SIM_OUTCOMES: readonly RuleSimOutcome[] = ['applied', 'notMet', 'skipped', 'budget', 'lost']

export interface ShapedLine extends RuleSimLine {
  effects: RuleSimEffect[]
}

export interface ShapedSim {
  /** The priced lines in basket order, each with the effects that landed on it. */
  lines: ShapedLine[]
  /** Effects on the whole sale, in HQ's order — and any on a line HQ did not answer, never dropped. */
  session: RuleSimEffect[]
  outcomes: Record<RuleSimOutcome, number>
}

export function shapeSimResult(r: RuleSimResult): ShapedSim {
  const lines: ShapedLine[] = [...(r.lines ?? [])].sort((a, b) => a.line - b.line).map((l) => ({ ...l, effects: [] }))
  const byLine = new Map(lines.map((l) => [l.line, l]))
  const session: RuleSimEffect[] = []
  for (const e of r.effects ?? []) {
    const at = e.line === null ? undefined : byLine.get(e.line)
    if (at) at.effects.push(e)
    else session.push(e)
  }
  const outcomes = Object.fromEntries(SIM_OUTCOMES.map((o) => [o, 0])) as Record<RuleSimOutcome, number>
  for (const t of r.trace ?? []) if (t.outcome in outcomes) outcomes[t.outcome]++
  return { lines, session, outcomes }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

/** The sale's local moment as sent: `yyyy-MM-ddTHH:mm:00`, never a `Z`; null while either is blank. */
export function simAt(date: string, time: string): string | null {
  return DAY.test(date) && TIME.test(time) ? `${date}T${time}:00` : null
}

export interface SimForm {
  basket: readonly BasketLine[]
  store: string
  memberId: string
  channel: string
  date: string
  time: string
  includeDrafts: boolean
  draftId: string | null
}

/** The dry run's body, or null while the form lacks a basket, a store, a channel or a moment. */
export function simRequest(f: SimForm): RuleSimRequest | null {
  const at = simAt(f.date, f.time)
  if (!f.basket.length || !f.store || !f.channel || !at) return null
  return {
    basket: f.basket.map(({ sku, qty }) => ({ sku, qty })),
    store: f.store,
    memberId: f.memberId.trim() || null,
    channel: f.channel,
    at,
    // Either every working copy, or one chosen one — never both.
    includeDrafts: f.draftId ? false : f.includeDrafts,
    draftId: f.draftId,
  }
}
