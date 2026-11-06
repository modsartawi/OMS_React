import { apiErrorCode, apiErrorData, apiErrorMessage } from '@/core/api'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { ROLLING_PERIODS } from './periods'
import type { SeriesProblem } from './series'
import { measureOf } from './wire'

/**
 * The three refusals the chart editor words in its own terms (spec 766 §C's table, ticket 775):
 * - `ANALYTICS-406` names the offending field. ⚠ §C does not say where the field rides: read here from
 *   the refusal's `data.field` (BackOffice 3378 to confirm); absent, the server's message stands alone.
 * - `ANALYTICS-407` says which percentile is capped, at how many days, and offers the longest rolling
 *   period under the cap.
 * - `ANALYTICS-410` shows the area's own unavailable reason from the model, else the server's words.
 * Anything else is `null`: the caller words it through `analyticsRefusal`. Pure.
 */
export type EditorRefusal =
  | { kind: 'invalid'; field: string | null; message: string }
  | { kind: 'window'; measure: string; days: number; shorter: string | null }
  | { kind: 'area'; reason: string }
  /** 825: `ANALYTICS-411`, an invalid declaration — the series problems it lists (others are not a view's). */
  | { kind: 'declaration'; series: SeriesProblem[]; message: string }

/**
 * ⚠ 411's `data.problems[]`: `{ what, why, … }` as the 798 prototype's `validate` shaped them; the series ones
 * are `{ what: 'series', why: 'tooMany' | 'duplicate' | 'foreignDimension', series?, dimension? }`. A problem of
 * a shape not known here is left out (the server's message still stands).
 */
function seriesProblemsOf(raw: unknown): SeriesProblem[] {
  const list = Array.isArray(raw) ? raw : []
  const out: SeriesProblem[] = []
  for (const x of list) {
    const p = x && typeof x === 'object' ? (x as Record<string, unknown>) : {}
    if (p.what !== 'series') continue
    const series = typeof p.series === 'string' ? p.series : ''
    if (p.why === 'tooMany') out.push({ why: 'tooMany' })
    else if (p.why === 'duplicate' && series) out.push({ why: 'duplicate', series })
    else if (p.why === 'foreignDimension' && series && typeof p.dimension === 'string') out.push({ why: 'foreignDimension', series, dimension: p.dimension })
  }
  return out
}

/** The percentile cap when neither the refusal nor the model states one (766 §B). */
const PERCENTILE_DAYS = 92

export function editorRefusal(err: unknown, definition: AnalyticsViewDefinition, model: AnalyticsModel): EditorRefusal | null {
  const code = apiErrorCode(err)
  const data = apiErrorData(err)
  const said = (k: string): unknown => (data && typeof data === 'object' ? (data as Record<string, unknown>)[k] : undefined)
  const chosen = definition.query.measures.map((k) => measureOf(model, k)).filter((m) => !!m)

  if (code === 'ANALYTICS-406') {
    const field = said('field')
    return { kind: 'invalid', field: typeof field === 'string' && field ? field : null, message: apiErrorMessage(err, '') }
  }
  if (code === 'ANALYTICS-411') return { kind: 'declaration', series: seriesProblemsOf(said('problems')), message: apiErrorMessage(err, '') }
  if (code === 'ANALYTICS-407') {
    const capped = chosen.find((m) => m.shape === 'percentile')
    const days = capped?.maxWindowDays ?? PERCENTILE_DAYS
    const shorter = ROLLING_PERIODS.find((p) => p.days <= days && p.token !== definition.query.period)?.token ?? null
    return { kind: 'window', measure: capped?.key ?? '', days, shorter }
  }
  if (code === 'ANALYTICS-410') {
    const area = chosen.map((m) => model.areas.find((a) => a.key === m.area)).find((a) => a && !a.available)
    return { kind: 'area', reason: area?.unavailableReason || apiErrorMessage(err, '') }
  }
  return null
}
