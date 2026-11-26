/**
 * The Phase 2 bar tab (ticket 973, spec 4354 §18, BO 4283 decisions 31–33, BO 4396): each limit, a to i, in words
 * with its figure and "met", "not met" or "cannot be read yet" with why; the things read that are no limit, apart; the
 * 30 largest differences each way in each view to open and mark; the rulings to write; "accept this reading".
 *
 * Pure. Every figure and every state is the reply's as sent: the page says what is met, the owner judges, and the
 * model never decides a limit itself. It only orders, groups, and refuses to show an empty why.
 */
import {
  BAR_CAUSES,
  BAR_LIMITS,
  RESULTS_VIEWS,
  type BarCause,
  type BarDirection,
  type BarFigure,
  type BarLargestRow,
  type BarLimit,
  type BarReadingCode,
  type BarReply,
  type BarRuling,
  type BarState,
  type ResultsView,
} from '@/core/models/sourcing-results'

/** Why a limit stands where it does: a cause it cannot be read for, a figure that does not keep it, or neither said. */
export type BarWhy =
  | { kind: 'cause'; cause: BarCause }
  | { kind: 'figure'; part: string; value: number; unit: BarFigure['unit']; of: number | null }
  /** The server gave a state with no cause and no failing figure. */
  | { kind: 'unsaid' }
  /** The reply left the limit out. */
  | { kind: 'unsent' }

export interface BarLimitView {
  limit: BarLimit
  /** The tuning ticket's letter, a to i. */
  letter: string
  state: BarState
  figures: BarFigure[]
  /** Empty on a met limit. */
  why: BarWhy[]
}

export interface BarLargestGroup {
  view: ResultsView
  direction: BarDirection
  /** The largest estimated difference first. */
  rows: BarLargestRow[]
  marked: number
  wrongRule: number
}

export interface BarReadingView {
  limits: BarLimitView[]
  tally: Record<BarState, number>
  periodCauses: BarCause[]
  readings: BarReply['readings']
  largest: BarLargestGroup[]
  rulings: { due: BarRuling[]; written: BarRuling[] }
  /** Offered only on a reading whose every limit reads met or not met, not yet accepted. */
  canAccept: boolean
  accepted: BarReply['accepted']
  lastChangedAt: string | null
}

const READING_ORDER: readonly BarReadingCode[] = ['SAME_PLAN', 'ESTIMATES', 'FLEET_RATIO', 'LATER_SLOTS']
const DIRECTIONS: readonly BarDirection[] = ['EARLIER', 'LATER']

const causesInOrder = (causes: Iterable<BarCause>): BarCause[] => {
  const set = new Set(causes)
  return BAR_CAUSES.filter((c) => set.has(c))
}

export function barReading(reply: BarReply): BarReadingView {
  const periodCauses = causesInOrder(reply.causes)
  const sent = new Map(reply.limits.map((l) => [l.limit, l]))

  const limits: BarLimitView[] = BAR_LIMITS.map((limit, i) => {
    const letter = String.fromCharCode(97 + i)
    const l = sent.get(limit)
    if (!l) return { limit, letter, state: 'CANNOT_READ', figures: [], why: [{ kind: 'unsent' }] }
    let why: BarWhy[] = []
    if (l.state === 'CANNOT_READ') {
      why = causesInOrder([...l.causes, ...periodCauses]).map((cause) => ({ kind: 'cause', cause }))
    } else if (l.state === 'NOT_MET') {
      why = l.figures
        .filter((f) => f.meets === false)
        .map((f) => ({ kind: 'figure', part: f.part, value: f.value, unit: f.unit, of: f.of ?? null }))
    }
    if (l.state !== 'MET' && why.length === 0) why = [{ kind: 'unsaid' }]
    return { limit, letter, state: l.state, figures: l.figures, why }
  })

  const tally: Record<BarState, number> = { MET: 0, NOT_MET: 0, CANNOT_READ: 0 }
  for (const l of limits) tally[l.state] += 1

  const largest = RESULTS_VIEWS.flatMap((view) =>
    DIRECTIONS.map((direction) => {
      const rows = reply.largest
        .filter((r) => r.view === view && r.direction === direction)
        .sort((a, b) => Math.abs(b.estimateMinutes) - Math.abs(a.estimateMinutes))
      return {
        view,
        direction,
        rows,
        marked: rows.filter((r) => r.mark != null).length,
        wrongRule: rows.filter((r) => r.mark === 'WRONG_RULE').length,
      }
    }),
  )

  return {
    limits,
    tally,
    periodCauses,
    readings: [...reply.readings].sort((a, b) => READING_ORDER.indexOf(a.reading) - READING_ORDER.indexOf(b.reading)),
    largest,
    rulings: { due: reply.rulings.filter((r) => !r.ruling), written: reply.rulings.filter((r) => !!r.ruling) },
    canAccept: tally.CANNOT_READ === 0 && periodCauses.length === 0 && !reply.accepted,
    accepted: reply.accepted,
    lastChangedAt: reply.lastChangedAt,
  }
}

/** The last of the 28 whole local days that start on `from` (`yyyy-MM-dd`); '' without a first day. */
export function barPeriodEnd(from: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return ''
  const d = new Date(Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)) + 27))
  return d.toISOString().slice(0, 10)
}
