import {
  CALCULATION_KINDS,
  CHANGE_FROMS,
  MAX_CALCULATIONS,
  type AnalyticsCalculation,
  type AnalyticsCalculationKind,
  type AnalyticsChangeFrom,
} from '@/core/models/analytics-calculations'
import type { AnalyticsChart, AnalyticsLabel, AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { comparesToPrevious } from './editor'
import { choiceOf } from './shape-rules'
import { dimensionOf, measureOf } from './wire'

/**
 * The query builder's "Add calculation" (ticket 862, BackOffice spec 3519 decisions 7–10 and 23–26). Pure: no React.
 *
 * The web's copy of the server's rules exists ONLY to choose what to offer — `AnalyticsQueryCompiler` validates the
 * same rules and refuses the rest with `ANALYTICS-406` (shown through `EditorRefusalNote`), and it stays the authority.
 */

/** Why a kind is not offered: each is a `boards:editor.calc.why.<reason>` key. */
export type CalculationUnavailable =
  /** Decision 1: four per query. */
  | 'full'
  /** Decision 9: shares need an additive measure. */
  | 'noAdditive'
  /** Decision 9: a ratio needs two additive measures in the same unit. */
  | 'noPair'
  /** Spec 3543 decision 9: an average needs two additive measures (any units). */
  | 'noTwo'
  /** Decision 8: change needs a comparison — the previous period, or (876) the same weeks last year. */
  | 'needsCompare'
  /** Decision 7: a running share refuses a date breakdown… */
  | 'runningDate'
  /** …and named series. */
  | 'runningSeries'
  /** Decision 7: a running share orders the query by its measure, so a second one cannot hold. */
  | 'runningOnce'

export type CalculationKindOffer =
  | { kind: AnalyticsCalculationKind; offered: true }
  | { kind: AnalyticsCalculationKind; offered: false; reason: CalculationUnavailable }

/** What the builder holds when it asks which calculations fit. */
export interface CalculationSelection {
  measures: readonly string[]
  dimensions: readonly string[]
  /** How many named series the definition holds. */
  series: number
  /** Whether the query compares with the previous period (as it will be saved). */
  compare: boolean
  /** 876: whether the query compares with the same weeks last year (as it will be saved). Absent reads as off. */
  lastYear?: boolean
  calculations: readonly AnalyticsCalculation[]
}

const additive = (key: string, model: AnalyticsModel) => measureOf(model, key)?.shape === 'additive'

/** The kinds that take an `of` (a denominator): a ratio (3519) and an average (spec 3543 part C). */
export const takesOf = (kind: AnalyticsCalculationKind): kind is 'ratio' | 'average' => kind === 'ratio' || kind === 'average'

/** The measures a kind may take (decision 9): the selected additive ones, any selected one for `change`. */
export function measuresFor(kind: AnalyticsCalculationKind, measures: readonly string[], model: AnalyticsModel): string[] {
  if (kind === 'change') return [...measures]
  const sums = measures.filter((k) => additive(k, model))
  return takesOf(kind) ? sums.filter((k) => ofFor(k, measures, model, kind).length > 0) : sums
}

/**
 * The denominators for `measure` (decision 9): the other selected additive measures — in the same unit for a ratio;
 * in any unit (and from any area) for an average (spec 3543 decisions 9 and 16: "deliveries per till sale").
 */
export function ofFor(measure: string, measures: readonly string[], model: AnalyticsModel, kind: 'ratio' | 'average' = 'ratio'): string[] {
  const unit = measureOf(model, measure)?.unit
  if (!additive(measure, model)) return []
  return measures.filter((k) => k !== measure && additive(k, model) && (kind === 'average' || measureOf(model, k)?.unit === unit))
}

/** The four kinds, each offered or with the reason it is not (decisions 1, 7–9). */
export function calculationKinds(sel: CalculationSelection, model: AnalyticsModel): CalculationKindOffer[] {
  const hasDate = sel.dimensions.some((k) => dimensionOf(model, k)?.kind === 'time')
  return CALCULATION_KINDS.map((kind): CalculationKindOffer => {
    const no = (reason: CalculationUnavailable): CalculationKindOffer => ({ kind, offered: false, reason })
    if (sel.calculations.length >= MAX_CALCULATIONS) return no('full')
    if (kind === 'change') return sel.compare || sel.lastYear ? { kind, offered: true } : no('needsCompare')
    if (measuresFor(kind, sel.measures, model).length === 0) return no(kind === 'ratio' ? 'noPair' : kind === 'average' ? 'noTwo' : 'noAdditive')
    if (kind === 'cumulativeShare') {
      if (hasDate) return no('runningDate')
      if (sel.series > 0) return no('runningSeries')
      if (sel.calculations.some((c) => c.kind === 'cumulativeShare')) return no('runningOnce')
    }
    return { kind, offered: true }
  })
}

// ── What a change is taken from (ticket 876, BackOffice spec 3587 B10) ────────────────────────────────────

/** A comparison a change may be taken from, and whether the query has it on. */
export interface ChangeFromOffer {
  from: AnalyticsChangeFrom
  on: boolean
}

/**
 * The comparisons a change may be taken from, in the wire's order: the previous period, then the same weeks last year.
 * `on` says the query already compares with it; a pick that is not on turns its comparison on ({@link addCalculation}).
 */
export const changeFroms = (sel: Pick<CalculationSelection, 'compare' | 'lastYear'>): ChangeFromOffer[] =>
  CHANGE_FROMS.map((from) => ({ from, on: from === 'lastYear' ? sel.lastYear === true : sel.compare }))

/** The comparison a change is taken from: last year when it says so, else the previous period (the wire's default). */
export const changeFromOf = (c: Pick<AnalyticsCalculation, 'from'>): AnalyticsChangeFrom => (c.from === 'lastYear' ? 'lastYear' : 'previous')

/** The query option that loads a comparison's rows. */
const COMPARE_OPTION = { previous: 'compareToPrevious', lastYear: 'compareToLastYear' } as const

/**
 * A picked change turns on the comparison it is taken from (876), where the chart type shows a comparison — the server
 * refuses a change whose comparison is off (406 on `query.calculations[i].from`). Any other kind changes nothing.
 */
function withItsComparison(def: AnalyticsViewDefinition, draft: CalculationDraft): AnalyticsViewDefinition {
  if (draft.kind !== 'change' || !comparesToPrevious(choiceOf(def.chart))) return def
  const option = COMPARE_OPTION[changeFromOf(draft)]
  return def.query[option] === true ? def : { ...def, query: { ...def.query, [option]: true } }
}

// ── Adding, editing and settling (the definition is the draft) ────────────────────────────────────────────

/** What the author picks: the key is the builder's to give. */
export type CalculationDraft = Omit<AnalyticsCalculation, 'key'>

/**
 * Why a calculation was taken out when the query changed under it: each a `boards:editor.calc.dropped.<reason>` key.
 * `within` (863): a share within a parent whose parent breakdown left the query, or that would now name them all.
 * `lastYear` (876): a change taken from last year whose comparison went off (`compare` is the previous period's).
 */
export type DroppedReason = 'measure' | 'compare' | 'lastYear' | 'runningDate' | 'runningSeries' | 'within'

// ── Within a parent (ticket 863, spec 3543 part A) ─────────────────────────────────────────────────────────

/** The kinds that take `within` (decision 1). */
export const takesWithin = (kind: AnalyticsCalculationKind): boolean => kind === 'shareOfTotal' || kind === 'cumulativeShare'

const categoryBreakdowns = (dimensions: readonly string[], model: AnalyticsModel) => dimensions.filter((k) => dimensionOf(model, k)?.kind !== 'time')

/**
 * The breakdowns a share may be within (decision 1): the query's own category breakdowns, in query order, and only when
 * there are two or more — some must be left for the rows. The date is not offered: it already partitions every share
 * (3519), so naming it changes nothing, and with the date set aside a pick that names every other breakdown is 100 %
 * on every row. Stricter than the server's own check (which refuses only every dimension), never looser.
 */
export function withinChoices(dimensions: readonly string[], model: AnalyticsModel): string[] {
  const cats = categoryBreakdowns(dimensions, model)
  return cats.length >= 2 ? cats : []
}

/** Why a `within` pick cannot be saved: a key the query does not break down by, or every category breakdown. */
export function withinProblem(within: readonly string[], dimensions: readonly string[], model: AnalyticsModel): 'notInQuery' | 'all' | null {
  const choices = withinChoices(dimensions, model)
  if (within.some((k) => !dimensions.includes(k) || (dimensionOf(model, k)?.kind !== 'time' && !choices.includes(k)))) return 'notInQuery'
  const cats = categoryBreakdowns(dimensions, model)
  return cats.every((k) => within.includes(k)) ? 'all' : null
}

export interface DroppedCalculation {
  calculation: AnalyticsCalculation
  reason: DroppedReason
}

const KEY_STEM: Record<AnalyticsCalculationKind, string> = {
  shareOfTotal: 'share',
  ratio: 'ratio',
  cumulativeShare: 'running',
  change: 'change',
  average: 'avg',
}

/**
 * A fresh key (decision 1: `[a-z][A-Za-z0-9_]{0,39}`, unique, never a measure's or a dimension's key):
 * `share_<measure>`, `ratio_<measure>_<of>`, … cut to 40, then `_2`, `_3` while it is taken.
 */
export function calculationKey(draft: CalculationDraft, def: AnalyticsViewDefinition): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9_]/g, '_')
  // 876: a change from last year is keyed apart, so a query may hold one of each on the same measure.
  const stem = draft.kind === 'change' && changeFromOf(draft) === 'lastYear' ? 'change_ly' : KEY_STEM[draft.kind]
  const base = [stem, clean(draft.measure), ...(takesOf(draft.kind) && draft.of ? [clean(draft.of)] : [])].join('_').slice(0, 40)
  const taken = new Set([...def.query.measures, ...def.query.dimensions, ...(def.query.calculations ?? []).map((c) => c.key)])
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const tail = `_${n}`
    const key = base.slice(0, 40 - tail.length) + tail
    if (!taken.has(key)) return key
  }
}

const runningOf = (calcs: readonly AnalyticsCalculation[]) => calcs.find((c) => c.kind === 'cumulativeShare') ?? null

/** The keys the sort picker offers (decision 10): the measures and the calculated keys — only the running share's measure beside one. */
export function sortKeys(def: AnalyticsViewDefinition): string[] {
  const calcs = def.query.calculations ?? []
  const running = runningOf(calcs)
  return running ? [running.measure] : [...def.query.measures, ...calcs.map((c) => c.key)]
}

/**
 * The calculations re-checked against the query as it now is: one whose measure (or `of`) is no longer selected, a
 * change without the comparison it is taken from (876: the previous period's, or last year's), a running share beside
 * a date breakdown or named series is taken out and reported, rather than saved for the server to refuse. A running
 * share then orders the query by its measure descending (decision 7), and a sort the picker would no longer offer (a
 * calculated key that went, or beside a running share) is dropped.
 * No calculations leaves no `calculations` at all.
 */
export function settleCalculations(def: AnalyticsViewDefinition, model: AnalyticsModel): { definition: AnalyticsViewDefinition; dropped: DroppedCalculation[] } {
  const all = def.query.calculations ?? []
  if (all.length === 0 && !('calculations' in def.query)) return { definition: def, dropped: [] }
  const measures = def.query.measures
  const hasDate = def.query.dimensions.some((k) => dimensionOf(model, k)?.kind === 'time')
  const series = def.series?.length ?? 0
  const dropped: DroppedCalculation[] = []
  const kept: AnalyticsCalculation[] = []
  for (const c of all) {
    const reason: DroppedReason | null = !measuresFor(c.kind, measures, model).includes(c.measure) ||
      (takesOf(c.kind) && !ofFor(c.measure, measures, model, c.kind).includes(c.of ?? ''))
      ? 'measure'
      : c.kind === 'change' && def.query[COMPARE_OPTION[changeFromOf(c)]] !== true
        ? changeFromOf(c) === 'lastYear'
          ? 'lastYear'
          : 'compare'
        : c.kind === 'cumulativeShare' && hasDate
          ? 'runningDate'
          : c.kind === 'cumulativeShare' && series > 0
            ? 'runningSeries'
            : c.within?.length && withinProblem(c.within, def.query.dimensions, model)
              ? 'within'
              : null
    if (reason) dropped.push({ calculation: c, reason })
    else if (c.kind !== 'cumulativeShare' || !runningOf(kept)) kept.push(c)
  }
  const { calculations: _old, ...query } = def.query
  void _old
  const next: AnalyticsViewDefinition = { ...def, query: kept.length ? { ...query, calculations: kept } : query }
  const running = runningOf(kept)
  let chart: AnalyticsChart = def.chart
  if (running) chart = { ...chart, sort: { key: running.measure, direction: 'desc' } }
  else if (chart.sort && !sortKeys(next).includes(chart.sort.key)) chart = { ...chart, sort: null }
  return { definition: chart === def.chart ? next : { ...next, chart }, dropped }
}

/** A new calculation, keyed, then settled. */
export function addCalculation(def: AnalyticsViewDefinition, draft: CalculationDraft, model: AnalyticsModel): AnalyticsViewDefinition {
  const calc: AnalyticsCalculation = { key: calculationKey(draft, def), ...tidy(draft) }
  const on = withItsComparison(def, draft)
  return settleCalculations({ ...on, query: { ...on.query, calculations: [...(def.query.calculations ?? []), calc] } }, model).definition
}

/** One calculation changed in place (its key kept), then settled. */
export function updateCalculation(def: AnalyticsViewDefinition, key: string, draft: CalculationDraft, model: AnalyticsModel): AnalyticsViewDefinition {
  const calcs = (def.query.calculations ?? []).map((c) => (c.key === key ? { key, ...tidy(draft) } : c))
  const on = withItsComparison(def, draft)
  return settleCalculations({ ...on, query: { ...on.query, calculations: calcs } }, model).definition
}

/** One calculation taken out. */
export function removeCalculation(def: AnalyticsViewDefinition, key: string, model: AnalyticsModel): AnalyticsViewDefinition {
  const calcs = (def.query.calculations ?? []).filter((c) => c.key !== key)
  return settleCalculations({ ...def, query: { ...def.query, calculations: calcs } }, model).definition
}

/**
 * Only the fields its kind carries: `of` on a ratio or an average, `until` (1–100, whole) on a running share, `within` (non-empty) on
 * a share or a running share, `from` on a change taken from last year (never written for the previous period), a label
 * if given.
 */
function tidy(d: CalculationDraft): CalculationDraft {
  const out: CalculationDraft = { kind: d.kind, measure: d.measure }
  if (takesOf(d.kind) && d.of) out.of = d.of
  if (d.kind === 'cumulativeShare' && typeof d.until === 'number' && Number.isFinite(d.until)) out.until = Math.min(100, Math.max(1, Math.round(d.until)))
  if (takesWithin(d.kind) && d.within?.length) out.within = [...new Set(d.within)]
  if (d.kind === 'change' && d.from === 'lastYear') out.from = 'lastYear'
  if (d.label) out.label = d.label
  return out
}

/**
 * A typed label override (decision 1, the titles' rule): both languages, or neither — neither keeps the derived
 * default. One language alone is refused, so it is never saved for the server to refuse.
 */
export function labelOverride(typed: AnalyticsLabel): { ok: true; label: AnalyticsLabel | undefined } | { ok: false; reason: 'oneLanguage' } {
  const en = typed.en.trim()
  const ar = typed.ar.trim()
  if (!en && !ar) return { ok: true, label: undefined }
  if (!en || !ar) return { ok: false, reason: 'oneLanguage' }
  return { ok: true, label: { en, ar } }
}

/**
 * The calculations an edit took out (`before` → `after`), with why — for the editor's note. Read by re-settling `after`
 * with `before`'s calculations, so the reason is the rule that removed each one.
 */
export function droppedBy(before: AnalyticsViewDefinition, after: AnalyticsViewDefinition, model: AnalyticsModel): DroppedCalculation[] {
  const had = before.query.calculations ?? []
  if (had.length === 0) return []
  const kept = new Set((after.query.calculations ?? []).map((c) => c.key))
  const why = new Map(settleCalculations({ ...after, query: { ...after.query, calculations: had } }, model).dropped.map((d) => [d.calculation.key, d.reason]))
  return had.filter((c) => !kept.has(c.key) && why.has(c.key)).map((c) => ({ calculation: c, reason: why.get(c.key)! }))
}

