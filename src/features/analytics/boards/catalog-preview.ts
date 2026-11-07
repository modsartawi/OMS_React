import { apiErrorCode, apiErrorData, apiErrorMessage } from '@/core/api'
import type { TableChartColumn } from '@/core/charts/TableChart'
import { formatDay } from '@/core/charts/format'
import type { AnalyticsCatalogArea, AnalyticsCatalogPreview, AnalyticsCatalogPreviewRequest, AnalyticsLabel } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import { analyticsRefusal, readReason, readResult, type AnalyticsRefusal } from './wire'

/**
 * The catalog preview (ticket 843, BackOffice spec 3437 §D, stories 35–38): what `POST Analytics/Catalog/Preview` is
 * asked, how its answer is read (keeping `dropped`) and drawn as a grid. Pure: no React. `./CatalogPreview` renders it.
 *
 * The server fixes the rest — 200 rows, the date by day, newest first — so the request carries only the choices.
 */

/** The preview's own default period (not the builder's `DEFAULT_PERIOD`). */
export const PREVIEW_PERIOD = 'last-7-days'

/** What the period picker and the column chooser hold. Empty lists = the server's defaults (all). */
export interface PreviewChoice {
  period: string
  dimensions: string[]
  measures: string[]
}

/** The first choice: the defaults, narrowed to one measure on a measure node. */
export const previewChoice = (measure?: string): PreviewChoice => ({ period: PREVIEW_PERIOD, dimensions: [], measures: measure ? [measure] : [] })

export const withPreviewPeriod = (choice: PreviewChoice, period: string): PreviewChoice => ({ ...choice, period })

/** The body: the area, the period, and only the lists that narrow — category dimensions only (`date` is the server's). */
export function previewRequest(area: AnalyticsCatalogArea, choice: PreviewChoice): AnalyticsCatalogPreviewRequest {
  const category = new Set(area.dimensions.filter((d) => d.kind !== 'time' || d.key !== 'date').map((d) => d.key))
  const dimensions = choice.dimensions.filter((k) => k !== 'date' && category.has(k))
  return {
    area: area.key,
    period: choice.period || PREVIEW_PERIOD,
    ...(dimensions.length > 0 ? { dimensions } : {}),
    ...(choice.measures.length > 0 ? { measures: [...choice.measures] } : {}),
  }
}

/** The preview's query key: the whole body, so a new choice asks again and the same choice is cached. */
export const analyticsPreviewKey = (body: AnalyticsCatalogPreviewRequest) => ['analytics', 'catalogPreview', body] as const

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** The answer: the query door's (`readResult`) plus `dropped`, each entry naming its measure (else left out). */
export function readPreview(raw: unknown): AnalyticsCatalogPreview {
  const r = obj(raw)
  const dropped = (Array.isArray(r.dropped) ? r.dropped : [])
    .map(obj)
    .filter((d) => str(d.measure) !== '')
    .map((d) => ({ measure: str(d.measure), because: str(d.because) }))
  return { ...readResult(r), dropped }
}

/** One "left out" note: the measure's name and the name of the dimension that refused it (keys when unknown). */
export interface DroppedNote {
  measure: string
  label: string
  because: string
}

export function droppedNotes(preview: AnalyticsCatalogPreview, area: AnalyticsCatalogArea, lang: string): DroppedNote[] {
  return preview.dropped.map((d) => {
    const m = area.measures.find((x) => x.key === d.measure)
    const by = area.dimensions.find((x) => x.key === d.because)
    return { measure: d.measure, label: (m && saysIn(m.label, lang)) || d.measure, because: (by && saysIn(by.label, lang)) || d.because }
  })
}

type Cell = string | number | null

/**
 * The answer as a grid (`@/core/charts/TableChart`): columns named in the screen's language like the charts name
 * them, the day written by `formatDay`, an inline member by its label. Measures keep their numbers — the grid's
 * `formatValue` writes them by unit. The server's order (newest first) is kept.
 */
export function previewTable(preview: AnalyticsCatalogPreview, area: AnalyticsCatalogArea, lang: string): { columns: TableChartColumn[]; rows: Record<string, Cell>[] } {
  const columns: TableChartColumn[] = preview.columns
    .filter((c) => c.role === 'dimension' || c.role === 'measure')
    .map((c) => {
      if (c.role === 'dimension') {
        const d = area.dimensions.find((x) => x.key === c.key)
        return { key: c.key, role: 'dimension', label: (d && saysIn(d.label, lang)) || c.key }
      }
      const m = area.measures.find((x) => x.key === c.key)
      const max = Math.max(0, ...preview.rows.map((r) => (typeof r[c.key] === 'number' ? Math.abs(r[c.key] as number) : 0)))
      return { key: c.key, role: 'measure', label: (m && saysIn(m.label, lang)) || c.key, unit: c.unit ?? m?.unit ?? 'count', max }
    })
  const rows = preview.rows.map((r) => {
    const out: Record<string, Cell> = {}
    for (const c of columns) {
      const v = r[c.key] ?? null
      if (c.role === 'measure' || v === null) out[c.key] = v
      else {
        const d = area.dimensions.find((x) => x.key === c.key)
        if (d?.kind === 'time') out[c.key] = formatDay(String(v), lang) || String(v)
        else {
          const member = d?.values.find((x) => x.key === String(v))
          out[c.key] = (member && saysIn(member.label, lang)) || v
        }
      }
    }
    return out
  })
  return { columns, rows }
}

/**
 * A preview refusal in the preview's own terms (agent ruling 13; `catalog.preview.refusal.*`, falling back to the
 * analytics words):
 * - `ANALYTICS-410` unavailable area → the area's reason from the refusal's data, else the catalog's;
 * - `ANALYTICS-406` on `measures` → every chosen measure was dropped ("choose fewer dimensions"); on another field →
 *   a member the area does not hold;
 * - `ANALYTICS-408` → the preview's 30 s.
 */
export type PreviewRefusal = { kind: 'area'; reason: AnalyticsLabel | null; message: string } | ({ kind: 'words' } & AnalyticsRefusal)

const PREVIEW_REFUSAL_KEYS: Record<string, string> = {
  'ANALYTICS-408': 'catalog.preview.refusal.timedOut',
}

export function previewRefusal(err: unknown, area: AnalyticsCatalogArea): PreviewRefusal {
  const code = apiErrorCode(err)
  const data = obj(apiErrorData(err))
  if (code === 'ANALYTICS-410') return { kind: 'area', reason: readReason(data.unavailableReason) ?? area.unavailableReason, message: apiErrorMessage(err, '') }
  if (code === 'ANALYTICS-406')
    return { kind: 'words', code, key: str(data.field) === 'measures' ? 'catalog.preview.refusal.allDropped' : 'catalog.preview.refusal.invalid' }
  const key = code ? PREVIEW_REFUSAL_KEYS[code] : undefined
  if (key) return { kind: 'words', code, key }
  return { kind: 'words', ...analyticsRefusal(err, '') }
}
