import { apiErrorCode, apiErrorData, apiErrorMessage } from '@/core/api'
import type { AnalyticsModel, AnalyticsViewDefinition, BindReason } from '@/core/models/analytics'
import type { ParamProblem } from './bindings'
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
 * ⚠ 411's `data.problems[]`: `{ what, why, … }` as the 798 prototype's `validate` shaped them — a series
 * problem `{ what: 'series', why: 'tooMany' | 'duplicate' | 'foreignDimension', series?, dimension? }` (825),
 * a name `{ what: 'name', param, why: 'slug' | 'reserved' | 'duplicate' }`, a binding `{ what: 'binding',
 * param, panel, reason }` or a default `{ what: 'default', param }` (824). A problem of a shape not known
 * here is left out (the server's message still stands).
 */
export type DeclarationProblem =
  | ParamProblem
  /** `panel`: the report panel whose series it is (829; a view's own 411 names none). */
  | ({ what: 'series'; panel?: string } & SeriesProblem)
  /**
   * 829: a text block's live figure naming a panel the report no longer holds (`missingPanel`), or a value of it
   * that is not a single one (`notSingle`). ⚠ `{ what: 'figure', block, panel, figure, why }`.
   */
  | FigureProblem
  /** 829: a report holds one summary block at most. ⚠ `{ what: 'summary', why: 'tooMany' }`. */
  | { what: 'summary'; why: 'tooMany' }

export type FigureProblem = { what: 'figure'; block: string; panel: string; figure: string; why: 'missingPanel' | 'notSingle' }

const NAME_WHY = ['slug', 'reserved', 'duplicate'] as const
const BIND_REASONS: readonly BindReason[] = ['noTimeAxis', 'seriesFilters', 'thresholdShape', 'topNShape', 'measureShape', 'breakdownShape', 'notInArea']

export function declarationProblemsOf(raw: unknown): DeclarationProblem[] {
  const list = Array.isArray(raw) ? raw : []
  const out: DeclarationProblem[] = []
  const text = (v: unknown) => (typeof v === 'string' && v ? v : '')
  for (const x of list) {
    const p = x && typeof x === 'object' ? (x as Record<string, unknown>) : {}
    const series = text(p.series)
    const param = text(p.param)
    const panel = text(p.panel)
    const onPanel = panel ? { panel } : {}
    if (p.what === 'series') {
      if (p.why === 'tooMany') out.push({ what: 'series', why: 'tooMany', ...onPanel })
      else if (p.why === 'duplicate' && series) out.push({ what: 'series', why: 'duplicate', series, ...onPanel })
      else if (p.why === 'foreignDimension' && series && text(p.dimension)) out.push({ what: 'series', why: 'foreignDimension', series, dimension: text(p.dimension), ...onPanel })
    } else if (p.what === 'figure' && text(p.block) && panel && text(p.figure) && (p.why === 'missingPanel' || p.why === 'notSingle')) {
      out.push({ what: 'figure', block: text(p.block), panel, figure: text(p.figure), why: p.why })
    } else if (p.what === 'summary' && p.why === 'tooMany') {
      out.push({ what: 'summary', why: 'tooMany' })
    } else if (p.what === 'name' && param && (NAME_WHY as readonly unknown[]).includes(p.why)) {
      out.push({ what: 'name', why: p.why as (typeof NAME_WHY)[number], param })
    } else if (p.what === 'binding' && param && text(p.panel) && BIND_REASONS.includes(p.reason as BindReason)) {
      out.push({ what: 'binding', param, panel: text(p.panel), reason: p.reason as BindReason })
    } else if (p.what === 'default' && param) {
      out.push({ what: 'default', param })
    }
  }
  return out
}

/** A view's series problems of a 411 (the rest are not a view's). */
const seriesProblemsOf = (raw: unknown): SeriesProblem[] =>
  declarationProblemsOf(raw).flatMap((p): SeriesProblem[] => {
    if (p.what !== 'series') return []
    const { what: _what, panel: _panel, ...problem } = p
    void _what
    void _panel
    return [problem]
  })

/** `ANALYTICS-411` on a board or report save: every problem it lists, and the server's words; else `null`. */
export function declarationRefusal(err: unknown): { problems: DeclarationProblem[]; message: string } | null {
  if (apiErrorCode(err) !== 'ANALYTICS-411') return null
  const data = apiErrorData(err)
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>).problems : undefined
  return { problems: declarationProblemsOf(raw), message: apiErrorMessage(err, '') }
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
