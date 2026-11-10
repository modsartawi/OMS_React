import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type {
  AnalyticsBoard,
  AnalyticsBoardPanel,
  AnalyticsDimension,
  AnalyticsFilter,
  AnalyticsFiling,
  AnalyticsFolder,
  AnalyticsItem,
  AnalyticsLabel,
  AnalyticsMeasure,
  AnalyticsMember,
  AnalyticsModel,
  AnalyticsQueryResult,
  AnalyticsReport,
  AnalyticsReportBlock,
  AnalyticsReportSection,
  AnalyticsReportWords,
  AnalyticsRow,
  AnalyticsSeries,
  AnalyticsUsedBy,
  AnalyticsViewDefinition,
  Bindings,
  Param,
} from '@/core/models/analytics'
import { readCalculations, readColumnCalculation, readUntilReached } from '@/core/models/analytics-calculations'
import { readAudience } from './audience'

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

/**
 * An area's unavailable reason: a label `{en, ar}` on the wire (841; passed through raw it reached JSX as an object,
 * React #31, production 2026-11-07). A bare string reads as both languages; blank or absent is none.
 */
export function readReason(v: unknown): AnalyticsLabel | null {
  const l = typeof v === 'string' ? { en: v, ar: v } : v && typeof v === 'object' ? said(v) : null
  return l && (l.en || l.ar) ? l : null
}

/** One model measure, tolerantly (shared by `Analytics/Model` and the catalog's `areas[].measures`, 841). */
export function readMeasure(raw: unknown): AnalyticsMeasure {
  const x = obj(raw)
  return {
    ...x,
    label: said(x.label),
    description: said(x.description),
    dimensions: arr<string>(x.dimensions),
    // 827 (⚠ proposed): a caveat in both languages, and a positive window of days; anything else is none.
    caveat: x.caveat && typeof x.caveat === 'object' ? said(x.caveat) : null,
    mayStillRiseDays: typeof x.mayStillRiseDays === 'number' && x.mayStillRiseDays > 0 ? x.mayStillRiseDays : null,
  } as AnalyticsMeasure
}

/** One model dimension, tolerantly (shared by `Analytics/Model` and the catalog's `areas[].dimensions`, 841). */
export function readDimension(raw: unknown): AnalyticsDimension {
  const x = obj(raw)
  return {
    ...x,
    label: said(x.label),
    ...('description' in x ? { description: said(x.description) } : {}),
    values: arr<Record<string, unknown>>(x.values).map((v) => ({ key: str(v.key), label: said(v.label) })),
  } as AnalyticsDimension
}

export function readModel(raw: Loose): AnalyticsModel {
  const m = obj(raw)
  return {
    areas: arr<unknown>(m.areas)
      .map(obj)
      .map((a) => ({ ...a, key: str(a.key), available: a.available === true, unavailableReason: readReason(a.unavailableReason) })),
    measures: arr<unknown>(m.measures).map(readMeasure),
    dimensions: arr<unknown>(m.dimensions).map(readDimension),
  }
}

/** The model's measure by key, or `undefined` when the model does not hold it (a retired or unknown member). */
export const measureOf = (model: Pick<AnalyticsModel, 'measures'> | null | undefined, key: string | null | undefined): AnalyticsMeasure | undefined =>
  model?.measures.find((m) => m.key === key)

/** The model's dimension by key, or `undefined` when the model does not hold it. */
export const dimensionOf = (model: Pick<AnalyticsModel, 'dimensions'> | null | undefined, key: string | null | undefined): AnalyticsDimension | undefined =>
  model?.dimensions.find((d) => d.key === key)

export function readResult(raw: Loose): AnalyticsQueryResult {
  const r = obj(raw)
  const period = obj(r.period)
  return {
    // 861: a calculated column's `calculation` is read tolerantly; every other column passes through as it came.
    columns: arr<unknown>(r.columns).map((c) => {
      const col = obj(c) as unknown as AnalyticsQueryResult['columns'][number]
      if (!('calculation' in col)) return col
      const calculation = readColumnCalculation(col.calculation)
      return { ...col, calculation }
    }),
    rows: arr<AnalyticsRow>(r.rows),
    total: typeof r.total === 'number' ? r.total : 0,
    truncated: r.truncated === true,
    period: r.period ? { from: str(period.from), to: str(period.to) } : null,
    previous: arr<AnalyticsRow>(r.previous),
    fetchedAt: str(r.fetchedAt),
    dataAsOf: str(r.dataAsOf),
    // 823: each entry must name its parameter; anything else is left out.
    notReached: arr<unknown>(r.notReached).map(obj).filter((n) => !!str(n.param)).map((n) => ({ param: str(n.param), reason: str(n.reason) })),
    fellBack: arr<unknown>(r.fellBack).map(obj).filter((n) => !!str(n.param)).map((n) => ({ param: str(n.param) })),
    // 861 (spec 3519 D7): absent stays absent, so a result without a running-share cut is the shape it always was.
    ...(readUntilReached(r.untilReached) === undefined ? {} : { untilReached: readUntilReached(r.untilReached) }),
  }
}

/** 825: a named series read tolerantly — one without an id is left out; absent labels and filters read empty. */
function readSeries(raw: unknown): AnalyticsSeries[] {
  return arr<unknown>(raw)
    .map(obj)
    .filter((s) => !!str(s.id))
    .map((s) => ({ id: str(s.id), label: said(s.label), filters: arr<AnalyticsFilter>(s.filters) }))
}

export function readDefinition(raw: unknown): AnalyticsViewDefinition {
  const d = obj(raw)
  const { calculations: rawCalculations, ...q } = obj(d.query)
  const calculations = readCalculations(rawCalculations)
  const chart = obj(d.chart)
  return {
    ...(d as object),
    // Absent stays absent, so a definition without series is the same object shape it always was.
    ...('series' in d ? { series: readSeries(d.series) } : {}),
    chart: { ...chart, type: (str(chart.type) || 'bar') as AnalyticsViewDefinition['chart']['type'] },
    query: {
      ...q,
      measures: arr<string>(q.measures),
      dimensions: arr<string>(q.dimensions),
      filters: arr(q.filters),
      // 861: absent (or empty) stays absent, so a definition without calculations keeps its old shape.
      ...(calculations ? { calculations } : {}),
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
    audience: readAudience(i.audience),
    // 837 (BackOffice 3432): absent on a server before 3432 → unfiled, not deleted.
    folderId: str(i.folderId) || null,
    deletedAt: str(i.deletedAt) || null,
  } as AnalyticsItem
}

/** 837: `GET Analytics/Folders` → the caller's folders by `order`. A row without an id is dropped. */
export function readFolders(raw: unknown): AnalyticsFolder[] {
  const list = Array.isArray(raw) ? raw : arr<unknown>(obj(raw).folders)
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return list
    .map((x) => obj(x))
    .filter((f) => !!str(f.id))
    .map((f) => ({ id: str(f.id), name: str(f.name), order: num(f.order), itemCount: num(f.itemCount) }))
    .sort((a, b) => a.order - b.order)
}

export function readFolder(raw: unknown): AnalyticsFolder {
  return readFolders([raw])[0] ?? { id: '', name: '', order: 0, itemCount: 0 }
}

/** 837: `PUT Analytics/Item/{id}/Folder` → `{ itemId, folderId }`. */
export function readFiling(raw: unknown): AnalyticsFiling {
  const f = obj(raw)
  return { itemId: str(f.itemId), folderId: str(f.folderId) || null }
}

/**
 * 837: `GET Analytics/Item/{id}/UsedBy`, and an `ANALYTICS-416` refusal's `data` — `{ boards, hidden }`. A board with
 * no id is dropped; `hidden` that is not a whole number reads as 0.
 */
export function readUsedBy(raw: unknown): AnalyticsUsedBy {
  const u = obj(raw)
  const hidden = typeof u.hidden === 'number' && Number.isInteger(u.hidden) && u.hidden > 0 ? u.hidden : 0
  const boards = arr<unknown>(u.boards)
    .map((x) => obj(x))
    .filter((b) => !!str(b.id))
    .map((b) => ({
      id: str(b.id),
      title: said(b.title),
      owner: str(b.owner),
      tier: (b.tier === 'shared' || b.tier === 'certified' ? b.tier : 'personal') as AnalyticsUsedBy['boards'][number]['tier'],
      mine: b.mine === true,
    }))
  return { boards, hidden }
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
 * 819 (ticket 821): a board that carries `params[]` and `bindings` keeps them; one without them is a v1
 * board, which `boardParams` converts from its `filters` and `optOut`.
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
    audience: readAudience(i.audience),
    definition: {
      panels: arr<unknown>(d.panels)
        .map(readPanel)
        .filter((p): p is AnalyticsBoardPanel => p !== null),
      ...(d.filters && typeof d.filters === 'object' ? { filters: d.filters as AnalyticsBoard['definition']['filters'] } : {}),
      ...(typeof d.refresh === 'number' && d.refresh > 0 ? { refresh: d.refresh } : {}),
      ...readParams(d),
    },
  } as AnalyticsBoard
}

/** A board's `params` (each with a name, a kind and a default) and `bindings`, both or neither. */
function readParams(d: Record<string, unknown>): { params?: Param[]; bindings?: Bindings } {
  if (!Array.isArray(d.params) || !d.bindings || typeof d.bindings !== 'object') return {}
  return { params: wellFormedParams(d.params), bindings: d.bindings as Bindings }
}

const wellFormedParams = (raw: unknown): Param[] =>
  arr<unknown>(raw)
    .filter((p): p is Param => {
      const x = obj(p)
      return !!str(x.name) && !!str(x.kind) && !!x.default && typeof x.default === 'object'
    })
    .map((p) => ({ ...p, label: said(p.label) }))

/** One report block, or `null` for a kind the web does not draw or one without an id (left out, never guessed at). */
function readReportBlock(raw: unknown): AnalyticsReportBlock | null {
  const b = obj(raw)
  const id = str(b.id)
  if (!id) return null
  if (b.kind === 'panel') {
    const from = obj(b.from)
    return {
      id,
      kind: 'panel',
      title: said(b.title),
      definition: readDefinition(b.definition),
      ...(str(from.viewId) ? { from: { viewId: str(from.viewId), revision: typeof from.revision === 'number' ? from.revision : 0 } } : {}),
      sourceChangedSinceCopy: b.sourceChangedSinceCopy === true,
    }
  }
  if (b.kind === 'text') return { id, kind: 'text', text: said(b.text) }
  if (b.kind === 'summary') return { id, kind: 'summary' }
  return null
}

/**
 * `GET Analytics/Item/{id}` read as a report (827, spec 819 §C ⚠ proposed): the item, and its definition's
 * `params[]`, `bindings` and ordered `sections[]` of panel, text and summary blocks. Absent arrays read empty.
 */
export function readReport(raw: Loose): AnalyticsReport {
  const i = obj(raw)
  const d = obj(i.definition)
  const sections: AnalyticsReportSection[] = arr<unknown>(d.sections)
    .map(obj)
    .map((s) => ({
      id: str(s.id),
      heading: said(s.heading),
      blocks: arr<unknown>(s.blocks)
        .map(readReportBlock)
        .filter((b): b is AnalyticsReportBlock => b !== null),
    }))
  return {
    ...(i as object),
    kind: 'report',
    title: said(i.title),
    subtitle: said(i.subtitle),
    sourceChangedSinceCopy: i.sourceChangedSinceCopy === true,
    audience: readAudience(i.audience),
    definition: {
      params: wellFormedParams(d.params),
      bindings: d.bindings && typeof d.bindings === 'object' && !Array.isArray(d.bindings) ? (d.bindings as Bindings) : {},
      sections,
    },
  } as AnalyticsReport
}

/**
 * 827: the Words answer. Each figure is the server's `{ value, formatted { en, ar } }` (3408 §F; the 835 live walk) —
 * its words are kept, a bare string reads as both languages, and one with no words (a selection with no data) or of
 * another shape is dropped, so it reads "figure unavailable". The summary: written (`text`), `unavailable` with its
 * reason, or none.
 */
export function readWords(raw: unknown): AnalyticsReportWords {
  const w = obj(raw)
  const figures: Record<string, AnalyticsLabel> = {}
  for (const [token, v] of Object.entries(obj(w.figures))) {
    const words = typeof v === 'string' ? { en: v, ar: v } : v && typeof v === 'object' && 'formatted' in v ? said(obj(v).formatted) : null
    if (words && (words.en || words.ar)) figures[token] = words
  }
  const s = w.summary && typeof w.summary === 'object' ? obj(w.summary) : null
  const summary = !s ? null : s.text && typeof s.text === 'object' ? { text: said(s.text) } : { unavailable: str(s.unavailable) }
  return { figures, summary }
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
  // 773: the panel's retry state (`./PanelBody`); 410's panel state shows the area's own reason first.
  'ANALYTICS-408': 'refusal.timedOut',
  'ANALYTICS-409': 'refusal.engineDown',
  // 775: the editor words these in its own terms (`./editor-refusal`); elsewhere these are the words.
  'ANALYTICS-406': 'refusal.invalid',
  'ANALYTICS-407': 'refusal.window',
  'ANALYTICS-410': 'refusal.areaUnavailable',
  // 822 (spec 819 §C): needs the author grant; the screen also drops the grant from the cached probe (`./access`).
  'ANALYTICS-415': 'refusal.needsAuthor',
  // 826: not shared with you — the item pages show the "not shared with you" state naming the owner (`./Refused`).
  'ANALYTICS-413': 'refusal.notShared',
  // 825 (spec 819 §C): an invalid declaration at save — the view editor lists its series problems (`./editor-refusal`).
  'ANALYTICS-411': 'refusal.declaration',
  // 823: an invalid parameter value at run; the strip also names the parameter (`refusedParam`).
  'ANALYTICS-412': 'refusal.invalidValue',
  // 833: an invalid recipient; the schedule editor also names each one (`./schedule` `refusedRecipients`).
  'ANALYTICS-414': 'refusal.invalidRecipient',
  // ── 844 (spec 3437 §G, BO 3442): the Catalog's raw preview. 402 = not a curator; 417 = the table is not
  // previewable (internal, `stg_*`, or no allow-listed column). Its 10 s timeout is worded in `./catalog-raw`.
  'ANALYTICS-402': 'refusal.needsCurator',
  'ANALYTICS-417': 'refusal.notPreviewable',
}

/** A refusal the screen words itself (`key`), or the server's message as it came; `code` either way. */
export type AnalyticsRefusal = { code: string | null; key: string } | { code: string | null; message: string }

/** A refusal's words: its own key's in the `boards` namespace, or the server's message as it came. */
export const refusalWords = (refusal: AnalyticsRefusal, t: (key: string) => string): string =>
  'key' in refusal ? t(refusal.key) : refusal.message

/**
 * A failure's words for a toast or a note (api-envelope.md): a known `ANALYTICS-*` code's own key, else the
 * server's message (`apiErrorMessage`), else `fallback`. Never one fixed string for every failure.
 */
export const analyticsErrorWords = (err: unknown, fallback: string, t: (key: string) => string): string => refusalWords(analyticsRefusal(err, fallback), t)

export function analyticsRefusal(err: unknown, fallback: string): AnalyticsRefusal {
  const code = apiErrorCode(err)
  const key = code ? REFUSAL_KEYS[code] : undefined
  return key ? { code, key } : { code, message: apiErrorMessage(err, fallback) }
}
