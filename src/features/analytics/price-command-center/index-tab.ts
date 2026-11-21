/**
 * The Index tab's pure rules (oms 938, BackOffice spec 4127 decisions 5 and 8): the price index with us at 100, its
 * tone, the lowest-price score, and the Cube queries the tab sends through `Analytics/Query`. No React, no `t`.
 *
 * ⚠ GUESSED (BO 4132, not built): the index members keep their names (`shelf_price_index`, `paid_price_index`) with the
 * SQL flipped to theirs ÷ ours and unit `share` (1.10 → index 110); the lowest-price score is a new view
 * `lowest_price_score` with `shelf_lowest_price_flagged`, `paid_lowest_price_flagged` and `lowest_price_counted`. Dims
 * `competitor`, `category` (A-level) and `date` (grain `day` | `week`). Reconcile against `GET Analytics/Model` once the
 * 4132 image is released.
 */
import { CHART_SLOT_COUNT } from '@/core/charts/slots'
import type { AnalyticsQueryResult, AnalyticsSemanticQuery, MeasureUnit, PeriodToken } from '@/core/models/analytics'
import type { Severity } from '@/core/ui/severity'

/**
 * Cube's figure as an index with us at 100, read by the column's unit: a `share` (theirs ÷ ours, today's unit) is ×100;
 * anything else is taken as already ×100 (BO 4132's text writes the measure "× 100"). `null` when there is no figure.
 */
export function asIndex(value: unknown, unit: MeasureUnit | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return unit === 'share' ? value * 100 : value
}

/** What an index says about the competitor: dearer than us (above 100), level, or cheaper than us (below 100). */
export type IndexTone = 'dearer' | 'level' | 'cheaper'
export const INDEX_TONES: readonly IndexTone[] = ['dearer', 'level', 'cheaper']

/** The index as drawn, one decimal: "110.0". */
export function formatIndex(index: number | null): string {
  return index === null ? '' : index.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })
}

/** The tone of an index as it is SHOWN (one decimal), so "100.0" is never called dearer or cheaper. */
export function indexTone(index: number | null): IndexTone | null {
  if (index === null) return null
  const shown = Math.round(index * 10) / 10
  return shown > 100 ? 'dearer' : shown < 100 ? 'cheaper' : 'level'
}

/** 🔑 A competitor cheaper than us is the warning; dearer is fine (the CMO's Mindsite sense, spec 4127 decision 5). */
export const INDEX_TONE_SEVERITY: Record<IndexTone, Severity> = { dearer: 'ok', level: 'mute', cheaper: 'warn' }

/**
 * The lowest-price score as a share: flagged (no competitor cheaper than us, a tie counts as lowest) ÷ counted. Each
 * material counts once — unweighted, unlike the index. `null` when nothing was counted.
 */
export function lowestPriceScore(flagged: unknown, counted: unknown): number | null {
  const f = num(flagged)
  const c = num(counted)
  return f === null || c === null || c <= 0 ? null : f / c
}

// ── Reading the answers ─────────────────────────────────────────────────────────────────────────────────────────────

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value))
const day = (value: unknown): string => text(value).slice(0, 10)
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const unitOf = (result: AnalyticsQueryResult, key: string): MeasureUnit | null => result.columns.find((c) => c.key === key)?.unit ?? null

/** One competitor's index and how many materials it compares, competitors in code order. */
export interface CompetitorIndex {
  competitor: string
  index: number | null
  materials: number | null
}

export function competitorIndexes(result: AnalyticsQueryResult, basis: PriceBasis): CompetitorIndex[] {
  const key = indexMeasure(basis)
  const unit = unitOf(result, key)
  return result.rows
    .map((row) => ({ competitor: text(row.competitor), index: asIndex(row[key], unit), materials: num(row[MATERIALS_MEASURE]) }))
    .sort((a, b) => byText(a.competitor, b.competitor))
}

/** The A-level table: one row per A-level, one cell per competitor (`null` = no figure), both in code order. */
export interface CategoryTable {
  competitors: string[]
  rows: { category: string; cells: Record<string, number | null> }[]
}

export function categoryTable(result: AnalyticsQueryResult, basis: PriceBasis): CategoryTable {
  const key = indexMeasure(basis)
  const unit = unitOf(result, key)
  const competitors = new Set<string>()
  const rows = new Map<string, Record<string, number | null>>()
  for (const row of result.rows) {
    const competitor = text(row.competitor)
    const category = text(row.category)
    competitors.add(competitor)
    const cells = rows.get(category) ?? {}
    cells[competitor] = asIndex(row[key], unit)
    rows.set(category, cells)
  }
  const order = [...competitors].sort(byText)
  return {
    competitors: order,
    rows: [...rows.keys()].sort(byText).map((category) => {
      const cells = rows.get(category) ?? {}
      return { category, cells: Object.fromEntries(order.map((c) => [c, cells[c] ?? null])) }
    }),
  }
}

/** The trend: the competitors (code order) and one point per day/week start, oldest first. */
export interface IndexTrend {
  competitors: string[]
  points: { day: string; values: Record<string, number | null> }[]
}

export function indexTrend(result: AnalyticsQueryResult, basis: PriceBasis): IndexTrend {
  const key = indexMeasure(basis)
  const unit = unitOf(result, key)
  const competitors = new Set<string>()
  const points = new Map<string, Record<string, number | null>>()
  for (const row of result.rows) {
    const competitor = text(row.competitor)
    competitors.add(competitor)
    const values = points.get(day(row.date)) ?? {}
    values[competitor] = asIndex(row[key], unit)
    points.set(day(row.date), values)
  }
  const order = [...competitors].sort(byText)
  return {
    competitors: order,
    points: [...points.keys()].sort(byText).map((d) => {
      const values = points.get(d) ?? {}
      return { day: d, values: Object.fromEntries(order.map((c) => [c, values[c] ?? null])) }
    }),
  }
}

/** One lowest-price score figure: across all competitors (`competitor` ''), or one competitor's. */
export interface ScoreFigure {
  competitor: string
  flagged: number | null
  counted: number | null
  score: number | null
}

export function scoreFigures(result: AnalyticsQueryResult, basis: PriceBasis): ScoreFigure[] {
  const flaggedKey = flaggedMeasure(basis)
  return result.rows
    .map((row) => {
      const flagged = num(row[flaggedKey])
      const counted = num(row[COUNTED_MEASURE])
      return { competitor: text(row.competitor), flagged, counted, score: lowestPriceScore(flagged, counted) }
    })
    .sort((a, b) => byText(a.competitor, b.competitor))
}

/** The score over time (all competitors), oldest first. */
export function scoreTrend(result: AnalyticsQueryResult, basis: PriceBasis): { day: string; score: number | null }[] {
  const flaggedKey = flaggedMeasure(basis)
  return result.rows
    .map((row) => ({ day: day(row.date), score: lowestPriceScore(row[flaggedKey], row[COUNTED_MEASURE]) }))
    .sort((a, b) => byText(a.day, b.day))
}

// ── The Cube queries (GUESSED members, BO 4132) ──────────────────────────────────────────────────────────────────

/** Shelf (their regular against our basic) or paid (what a customer pays, offers included, against our effective). */
export type PriceBasis = 'shelf' | 'paid'
export const PRICE_BASES: readonly PriceBasis[] = ['shelf', 'paid']

/** The periods the tab offers (server-resolved relative tokens, Riyadh time, Sunday weeks). */
export const INDEX_PERIODS = ['last-7-days', 'last-28-days', 'last-month', 'year-to-date'] as const satisfies readonly PeriodToken[]
export type IndexPeriod = (typeof INDEX_PERIODS)[number]

/** The trend's grain: daily or weekly (Sunday weeks). */
export type IndexGrain = 'day' | 'week'
export const INDEX_GRAINS: readonly IndexGrain[] = ['day', 'week']

/**
 * The basis an answer was ASKED on, read off its measure columns (`shelf_…` / `paid_…`); `null` when it carries neither.
 * The switch keeps the previous answer on screen while the next one runs, so the readers take the answer's own basis,
 * never the switch's — else the kept answer is read with the other basis' key and every figure is blank.
 */
export function answerBasis(result: AnalyticsQueryResult | undefined): PriceBasis | null {
  for (const column of result?.columns ?? []) {
    const basis = PRICE_BASES.find((b) => column.key.startsWith(`${b}_`))
    if (basis) return basis
  }
  return null
}

/** A trend line's colour slot: one per palette slot, past the palette ink grey (`null`), as the drill-down does. */
export const trendSlot = (i: number): number | null => (i < CHART_SLOT_COUNT ? i : null)

/** The index measure the switch picks — the one thing shelf/paid changes on an index query. */
export const indexMeasure = (basis: PriceBasis): string => `${basis}_price_index`
/** The lowest-price score's flagged count on a basis ("no competitor cheaper than us"); `lowest_price_counted` is basis-free. */
export const flaggedMeasure = (basis: PriceBasis): string => `${basis}_lowest_price_flagged`
export const COUNTED_MEASURE = 'lowest_price_counted'
export const MATERIALS_MEASURE = 'price_indexed_materials'

const base = (period: IndexPeriod): Pick<AnalyticsSemanticQuery, 'filters' | 'period'> => ({ filters: [], period })

/** The headline: one index per competitor, with how many materials it compares. */
export function indexByCompetitorQuery(basis: PriceBasis, period: IndexPeriod): AnalyticsSemanticQuery {
  return { ...base(period), measures: [indexMeasure(basis), MATERIALS_MEASURE], dimensions: ['competitor'] }
}

/** The A-level table (Mindsite's category competition): one index per A-level × competitor. */
export function indexByCategoryQuery(basis: PriceBasis, period: IndexPeriod): AnalyticsSemanticQuery {
  return { ...base(period), measures: [indexMeasure(basis)], dimensions: ['category', 'competitor'] }
}

/** The trend: one line per competitor, by day or by week. */
export function indexTrendQuery(basis: PriceBasis, grain: IndexGrain, period: IndexPeriod): AnalyticsSemanticQuery {
  return { ...base(period), measures: [indexMeasure(basis)], dimensions: ['competitor', 'date'], grain }
}

/** The lowest-price score: across all competitors (no dimension), per competitor, or over time (all competitors). */
export type ScoreCut = 'overall' | 'competitor' | IndexGrain
export function scoreQuery(basis: PriceBasis, cut: ScoreCut, period: IndexPeriod): AnalyticsSemanticQuery {
  const measures = [flaggedMeasure(basis), COUNTED_MEASURE]
  if (cut === 'overall') return { ...base(period), measures, dimensions: [] }
  if (cut === 'competitor') return { ...base(period), measures, dimensions: ['competitor'] }
  return { ...base(period), measures, dimensions: ['date'], grain: cut }
}
