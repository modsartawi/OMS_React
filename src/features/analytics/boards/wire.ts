import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type {
  AnalyticsBoard,
  AnalyticsBoardPanel,
  AnalyticsDimension,
  AnalyticsItem,
  AnalyticsLabel,
  AnalyticsMeasure,
  AnalyticsMember,
  AnalyticsModel,
  AnalyticsQueryResult,
  AnalyticsRow,
  AnalyticsViewDefinition,
} from '@/core/models/analytics'

/**
 * Reading the analytics wire (spec 766 §C, ticket 767) — defensively, because the doors are proposed
 * and not yet built (BackOffice 3378): every absent array reads as empty, and every refusal code as
 * its own words.
 *
 * Pure: no React. `./api` passes each answer through here, so the screens never meet `undefined`.
 */

type Loose = Record<string, unknown> | null | undefined

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const said = (v: unknown): AnalyticsLabel => ({ en: str(obj(v).en), ar: str(obj(v).ar) })

export function readModel(raw: Loose): AnalyticsModel {
  const m = obj(raw)
  return {
    areas: arr(m.areas),
    measures: arr<Record<string, unknown>>(m.measures).map(
      (x) => ({ ...x, label: said(x.label), description: said(x.description), dimensions: arr<string>(x.dimensions) }) as AnalyticsMeasure,
    ),
    dimensions: arr<Record<string, unknown>>(m.dimensions).map(
      (x) =>
        ({
          ...x,
          label: said(x.label),
          values: arr<Record<string, unknown>>(x.values).map((v) => ({ key: str(v.key), label: said(v.label) })),
        }) as AnalyticsDimension,
    ),
  }
}

export function readResult(raw: Loose): AnalyticsQueryResult {
  const r = obj(raw)
  const period = obj(r.period)
  return {
    columns: arr(r.columns),
    rows: arr<AnalyticsRow>(r.rows),
    total: typeof r.total === 'number' ? r.total : 0,
    truncated: r.truncated === true,
    period: r.period ? { from: str(period.from), to: str(period.to) } : null,
    previous: arr<AnalyticsRow>(r.previous),
    fetchedAt: str(r.fetchedAt),
    dataAsOf: str(r.dataAsOf),
  }
}

export function readDefinition(raw: unknown): AnalyticsViewDefinition {
  const d = obj(raw)
  const q = obj(d.query)
  const chart = obj(d.chart)
  return {
    ...(d as object),
    chart: { ...chart, type: (str(chart.type) || 'bar') as AnalyticsViewDefinition['chart']['type'] },
    query: {
      ...q,
      measures: arr<string>(q.measures),
      dimensions: arr<string>(q.dimensions),
      filters: arr(q.filters),
    },
  } as AnalyticsViewDefinition
}

export function readItem(raw: Loose): AnalyticsItem {
  const i = obj(raw)
  return {
    ...(i as object),
    title: said(i.title),
    subtitle: said(i.subtitle),
    sourceChangedSinceCopy: i.sourceChangedSinceCopy === true,
    definition: readDefinition(i.definition),
  } as AnalyticsItem
}

/**
 * `GET Analytics/Items` (ticket 770). ⚠ §C names the door, not its envelope's `data` shape: a bare array
 * of items is read, and so is an `{ items }` page, in case the door pages. Anything else is empty.
 */
export function readItems(raw: unknown): AnalyticsItem[] {
  const list = Array.isArray(raw) ? raw : arr<unknown>(obj(raw).items)
  return list.map((x) => readItem(obj(x)))
}

const layout = (v: unknown) => {
  const l = obj(v)
  const n = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d)
  return { x: n(l.x, 0), y: n(l.y, 0), w: n(l.w, 6), h: n(l.h, 2) }
}

/** One board panel, or `null` for a kind the web does not draw (it is left out, never guessed at). */
function readPanel(raw: unknown): AnalyticsBoardPanel | null {
  const p = obj(raw)
  const base = { id: str(p.id), layout: layout(p.layout) }
  if (p.kind === 'view' && str(p.viewId)) return { ...base, kind: 'view', viewId: str(p.viewId), optOut: arr(p.optOut) }
  if (p.kind === 'text') return { ...base, kind: 'text', text: said(p.text) }
  if (p.kind === 'section') return { ...base, kind: 'section', title: said(p.title) }
  return null
}

/**
 * `GET Analytics/Item/{id}` read as a board (ticket 771). ⚠ §C fixes no board definition: `panels[]`
 * (a view by reference, text, or a section header, each with its grid `layout`) and optional saved `filters`.
 */
export function readBoard(raw: Loose): AnalyticsBoard {
  const i = obj(raw)
  const d = obj(i.definition)
  return {
    ...(i as object),
    kind: 'board',
    title: said(i.title),
    subtitle: said(i.subtitle),
    sourceChangedSinceCopy: i.sourceChangedSinceCopy === true,
    definition: {
      panels: arr<unknown>(d.panels)
        .map(readPanel)
        .filter((p): p is AnalyticsBoardPanel => p !== null),
      ...(d.filters && typeof d.filters === 'object' ? { filters: d.filters as AnalyticsBoard['definition']['filters'] } : {}),
    },
  } as AnalyticsBoard
}

/** `GET Analytics/DimensionValues` — up to 50 `{ key, label }`; a plain-string label reads as both languages. */
export function readMembers(raw: unknown): AnalyticsMember[] {
  const list = Array.isArray(raw) ? raw : arr<unknown>(obj(raw).values)
  return list.map((x) => {
    const m = obj(x)
    return { key: str(m.key), label: typeof m.label === 'string' ? { en: m.label, ar: m.label } : said(m.label) }
  })
}

/**
 * Each refusal code the web words itself → its key in the `boards` namespace (766 §C's table). A later
 * slice adds its own codes HERE, with their words in both `boards` bundles, as it builds the state the
 * code asks for (402/403/405 with saving, 406/407/410 with the editor, 408/409 with the panel states).
 */
const REFUSAL_KEYS: Record<string, string> = {
  'ANALYTICS-401': 'refusal.noAccess',
  'ANALYTICS-404': 'refusal.notFound',
}

/** A refusal the screen words itself (`key`), or the server's message as it came; `code` either way. */
export type AnalyticsRefusal = { code: string | null; key: string } | { code: string | null; message: string }

export function analyticsRefusal(err: unknown, fallback: string): AnalyticsRefusal {
  const code = apiErrorCode(err)
  const key = code ? REFUSAL_KEYS[code] : undefined
  return key ? { code, key } : { code, message: apiErrorMessage(err, fallback) }
}
