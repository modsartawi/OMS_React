import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsRow, AnalyticsViewDefinition } from '@/core/models/analytics'
import { dimensionOf } from './wire'

/**
 * The previous period beside a table or a bar (BackOffice spec 3519, review item 11) — pure. With
 * `compareToPrevious` the server answers `result.previous`: the same query over the previous period. A table shows
 * a "previous" column after each of the query's measures, and a bar a previous-period series; both read a current
 * row's previous row through {@link previousMatcher}.
 */

/** The key a measure's previous-period value is kept under in a table row. */
export const previousKey = (measure: string): string => `${measure}:previous`

/** The measures that get a previous column: the query's own (a calculated column has none), when the answer has previous rows. */
export const previousMeasures = (definition: AnalyticsViewDefinition, result: AnalyticsQueryResult): string[] =>
  result.previous.length > 0 ? definition.query.measures.filter((m) => m.trim() !== '') : []

/**
 * Each current row's previous-period row: the same member on every category dimension (and on each of `extraKeys`,
 * e.g. the series column), and a time bucket by its place among its own period's buckets — the k-th day, week or
 * month beside the k-th of the previous period, as the server pairs a change. `undefined` when there is none.
 */
export function previousMatcher(
  result: AnalyticsQueryResult,
  dimKeys: readonly string[],
  model: AnalyticsModel,
  extraKeys: readonly string[] = [],
): (row: AnalyticsRow) => AnalyticsRow | undefined {
  const timeKeys = dimKeys.filter((k) => dimensionOf(model, k)?.kind === 'time')
  const ranks = (rows: readonly AnalyticsRow[]) =>
    new Map(timeKeys.map((k) => [k, new Map([...new Set(rows.map((r) => String(r[k] ?? '')))].sort().map((b, i) => [b, i]))]))
  const current = ranks(result.rows)
  const earlier = ranks(result.previous)
  const keyOf = (r: AnalyticsRow, rank: Map<string, Map<string, number>>) =>
    [...extraKeys, ...dimKeys].map((k) => (rank.has(k) ? String(rank.get(k)!.get(String(r[k] ?? ''))) : String(r[k] ?? ''))).join('\u0001')
  const before = new Map<string, AnalyticsRow>()
  for (const r of result.previous) {
    const key = keyOf(r, earlier)
    if (!before.has(key)) before.set(key, r)
  }
  return (r) => before.get(keyOf(r, current))
}
