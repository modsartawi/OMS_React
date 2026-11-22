/**
 * The Index tab's pure rules (oms 938, BackOffice spec 4127 decisions 5 and 8): the price index with us at 100, its
 * tone, the lowest-price score, and the Cube queries the tab sends through `Analytics/Query`. No React, no `t`.
 *
 * Cube members as shipped by BO 4132 (pricing2 d099aac36; the image build + release is still the owner's):
 *  - view `price_index`: `shelf_price_index` / `paid_price_index` (same names, SQL flipped to Σ theirs ÷ Σ ours weighted
 *    by our units, unit `share`: 1.10 → index 110), `price_indexed_materials` (count).
 *  - view `price_lowest_score`: `shelf_lowest_price_score` / `paid_lowest_price_score` — a MEASURE, unit `share`
 *    (1 − beaten ÷ scored day|item; a tie counts as lowest; unweighted), and `lowest_price_scored_items` (count of
 *    day|item). The flagged / beaten counts are private: no "n of m" is published.
 *  - dims (both views): `competitor` (leave it out for "all competitors"), `category` (A-level), `class_b`, `brand`,
 *    `date` (day + `sunday_week`).
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
 * The lowest-price score as a share (0.75 = 75 %), read by its column's unit: Cube publishes it as a `share`; a
 * `percent` column is ÷100. `null` when there is no figure (nothing scored).
 */
export function asShare(value: unknown, unit: MeasureUnit | null | undefined): number | null {
  const v = num(value)
  return v === null ? null : unit === 'percent' ? v / 100 : v
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
  /** A share, 0..1; null = nothing scored. */
  score: number | null
  /** The day|item pairs the score was taken over. */
  scored: number | null
}

export function scoreFigures(result: AnalyticsQueryResult, basis: PriceBasis): ScoreFigure[] {
  const key = scoreMeasure(basis)
  const unit = unitOf(result, key)
  return result.rows
    .map((row) => ({ competitor: text(row.competitor), score: asShare(row[key], unit), scored: num(row[SCORED_MEASURE]) }))
    .sort((a, b) => byText(a.competitor, b.competitor))
}

/** The score over time (all competitors), oldest first. */
export function scoreTrend(result: AnalyticsQueryResult, basis: PriceBasis): { day: string; score: number | null }[] {
  const key = scoreMeasure(basis)
  const unit = unitOf(result, key)
  return result.rows.map((row) => ({ day: day(row.date), score: asShare(row[key], unit) })).sort((a, b) => byText(a.day, b.day))
}

// ── The Cube queries (BO 4132 members) ──────────────────────────────────────────────────────────────────

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
/** The lowest-price score on a basis (view `price_lowest_score`, a share); `lowest_price_scored_items` is basis-free. */
export const scoreMeasure = (basis: PriceBasis): string => `${basis}_lowest_price_score`
export const SCORED_MEASURE = 'lowest_price_scored_items'
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
  const measures = [scoreMeasure(basis), SCORED_MEASURE]
  if (cut === 'overall') return { ...base(period), measures, dimensions: [] }
  if (cut === 'competitor') return { ...base(period), measures, dimensions: ['competitor'] }
  return { ...base(period), measures, dimensions: ['date'], grain: cut }
}
