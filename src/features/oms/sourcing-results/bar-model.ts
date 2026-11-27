/**
 * The Phase 2 bar tab (ticket 973, spec 4354 §18, BO 4283 decisions 26–36, BO 4396): each limit, a to i, with its
 * figures and "met", "not met" or "cannot be read yet" with why; the period's causes; the things read that are no
 * limit, apart; the 30 largest differences each way in each view to open and mark; the reasons outside the rules and
 * the shelf chance figures that wait for a written ruling; the split check; the readings kept.
 *
 * Pure. Every figure, state and why is the reply's as sent: the server reads the bar, the owner judges, and the model
 * never decides a limit itself. It only orders, groups, and refuses to show an empty why.
 */
import {
  BAR_LIMITS,
  BAR_WAYS,
  RESULTS_VIEWS,
  type BarClose,
  type BarKeptReading,
  type BarLargestOrder,
  type BarLimit,
  type BarReadOnly,
  type BarReply,
  type BarState,
  type BarWay,
  type BarWhy,
  type ResultsView,
} from '@/core/models/sourcing-results'

export interface BarLimitView {
  limit: BarLimit
  /** The tuning ticket's letter, a to i. */
  letter: string
  state: BarState
  /** The limit's figures by name, in the order sent; a figure that cannot be read is null. */
  figures: { name: string; value: number | null }[]
  /** `Phase2BarWhys` codes; empty on a met limit. `UNSAID`: a state with no why; `UNSENT`: the reply left the limit out. */
  why: string[]
}

export interface BarLargestGroup {
  view: ResultsView
  way: BarWay
  /** The largest estimated difference first. */
  rows: BarLargestOrder[]
  marked: number
  wrongRule: number
}

/** A reason outside the rules (limit h) or a shelf chance figure (limit e) that waits for, or has, a written ruling. */
export interface BarRulingItem {
  kind: 'OUTSIDE_REASON' | 'SHELF_CHANCE'
  /** The key it is closed under: `CODE|STEP_CODE` or `MODE|STOCK_CLASS`. */
  key: string
  /** The reason's codes, or the figure's mode and stock class. */
  parts: [string, string]
  /** The reason's share of the orders compared; null for a shelf chance figure. */
  percent: number | null
  ruling: BarClose | null
}

export interface BarReadingView {
  state: BarState
  periodWhys: BarWhy[]
  limits: BarLimitView[]
  tally: Record<BarState, number>
  largest: BarLargestGroup[]
  rulings: { due: BarRulingItem[]; written: BarRulingItem[] }
  splitCheck: BarClose | null
  read: BarReadOnly
  kept: BarKeptReading[]
  figuresRuledOn: string
}

export function barReading(reply: BarReply): BarReadingView {
  const r = reply.reading
  const sent = new Map(r.limits.map((l) => [l.code, l]))

  const limits: BarLimitView[] = BAR_LIMITS.map((limit, i) => {
    const letter = String.fromCharCode(97 + i)
    const l = sent.get(limit)
    if (!l) return { limit, letter, state: 'CANNOT_READ_YET', figures: [], why: ['UNSENT'] }
    const why = l.state === 'MET' ? [] : l.why.length > 0 ? l.why : ['UNSAID']
    return { limit, letter, state: l.state, figures: Object.entries(l.figures).map(([name, value]) => ({ name, value })), why }
  })

  const tally: Record<BarState, number> = { MET: 0, NOT_MET: 0, CANNOT_READ_YET: 0 }
  for (const l of limits) tally[l.state] += 1

  const largest = RESULTS_VIEWS.flatMap((view) =>
    BAR_WAYS.map((way) => {
      const rows = r.largestDifferences
        .filter((o) => o.view === view && o.way === way)
        .sort((a, b) => Math.abs(b.estimate) - Math.abs(a.estimate))
      return { view, way, rows, marked: rows.filter((o) => o.mark != null).length, wrongRule: rows.filter((o) => o.mark === 'WRONG_RULE').length }
    }),
  )

  const items: (BarRulingItem & { needs: boolean })[] = [
    ...r.outsideReasons.map((o) => ({
      kind: 'OUTSIDE_REASON' as const,
      key: `${o.code}|${o.stepCode}`,
      parts: [o.code, o.stepCode] as [string, string],
      percent: o.percent,
      ruling: o.ruling ?? null,
      needs: o.needsRuling,
    })),
    ...r.shelfChance.map((s) => ({
      kind: 'SHELF_CHANCE' as const,
      key: `${s.mode}|${s.stockClass}`,
      parts: [s.mode, s.stockClass] as [string, string],
      percent: null,
      ruling: s.ruling ?? null,
      needs: s.needsRuling,
    })),
  ]
  const strip = ({ needs: _needs, ...item }: BarRulingItem & { needs: boolean }): BarRulingItem => item

  return {
    state: r.state,
    periodWhys: r.cannotReadYet,
    limits,
    tally,
    largest,
    rulings: {
      due: items.filter((x) => x.needs && !x.ruling).map(strip),
      written: items.filter((x) => x.ruling).map(strip),
    },
    splitCheck: r.splitCheck ?? null,
    read: r.read,
    kept: [...reply.kept].sort((a, b) => (a.readAt < b.readAt ? 1 : a.readAt > b.readAt ? -1 : 0)),
    figuresRuledOn: r.figuresRuledOn,
  }
}

/** The last of the 28 whole local days that start on `from` (`yyyy-MM-dd`); '' without a first day. */
export function barPeriodEnd(from: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return ''
  const d = new Date(Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)) + 27))
  return d.toISOString().slice(0, 10)
}
