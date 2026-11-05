import { apiErrorCode, apiErrorData, apiErrorMessage } from '@/core/api'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { ROLLING_PERIODS } from './periods'
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
