import type { AnalyticsDimension, AnalyticsMeasure, AnalyticsModel, AnalyticsQueryResult, AnalyticsRow, AnalyticsViewDefinition } from '@/core/models/analytics'
import { IS_TOTAL_KEY } from '@/core/models/analytics-calculations'
import type { CopilotAnswerTable, CopilotTableRow } from '@/core/models/copilot'
import { newViewLink, type EditorSeed } from './editor'
import { panelTable, type PanelTable, type TableWords } from './panel-table'
import { toTableView, type TableView } from './view-model-forms'
import { readDefinition, readResult } from './wire'

/**
 * The copilot answer's tables (ticket 868, BackOffice spec 3558 D5-D7, D13; wire 3564) — pure. The copilot may not
 * import this feature, so the app shell registers `./CopilotTableEmbed` with `@/core/copilot-view-embed` and the answer
 * draws each table through it.
 *
 * A table is read into the analytics shapes the view panel already draws — a result (`./wire` `readResult`) and a
 * table definition (`./wire` `readDefinition`) — so the table form, its notes (until, notSplit, notFiltered), the
 * "All" rows last and the CSV / xlsx downloads are the view panel's own. What differs:
 *
 * - the rows are drawn AS SENT (`toTableView`'s `asSent`): no sort arrow, no top N — the server already ordered and cut;
 * - the headers are the WIRE's labels ({@link copilotTableModel}), in the screen's language.
 */

/** A measure's value: the invariant number text the wire carries, or null. */
const numberOf = (v: string | null | undefined): number | null => {
  if (v == null || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function keyedRows(table: CopilotAnswerTable, rows: readonly CopilotTableRow[]): AnalyticsRow[] {
  return rows.map((r) => {
    const out: AnalyticsRow = {}
    table.columns.forEach((c, i) => {
      const v = r.values?.[i] ?? null
      out[c.key] = c.role === 'measure' ? numberOf(v) : v
    })
    if (r.isTotal === true) out[IS_TOTAL_KEY] = true
    return out
  })
}

/** The running share's `within` dimensions (read through `readDefinition`): the keys a parent's values come in. */
const withinOf = (definition: AnalyticsViewDefinition): string[] =>
  definition.query.calculations?.find((c) => c.kind === 'cumulativeShare')?.within ?? []

function untilReachedOf(table: CopilotAnswerTable, definition: AnalyticsViewDefinition): unknown {
  const notes = table.notes ?? null
  const byParent = notes?.untilReachedByParent
  if (Array.isArray(byParent) && byParent.length) {
    const within = withinOf(definition)
    return byParent.map((p) => ({
      parent: Object.fromEntries(within.map((k, i) => [k, p.parent?.[i] ?? ''])),
      reached: p.reached,
    }))
  }
  return notes?.untilReached ?? undefined
}

/** The table read as the analytics query result a view panel draws; `definition` is {@link copilotTableDefinition}'s. */
export function copilotTableResult(table: CopilotAnswerTable, definition: AnalyticsViewDefinition = copilotTableDefinition(table)): AnalyticsQueryResult {
  const columns = table.columns ?? []
  return readResult({
    columns: columns.map((c) => ({
      key: c.key,
      role: c.role,
      unit: c.unit,
      shape: c.shape,
      ...(c.calculation ? { calculation: c.calculation } : {}),
      ...(c.variant ? { variant: c.variant } : {}),
      ...(c.dateBasis ? { dateBasis: c.dateBasis } : {}),
    })),
    rows: keyedRows(table, table.rows ?? []),
    total: table.total,
    truncated: table.truncated,
    period: table.periodFrom || table.periodTo ? { from: table.periodFrom, to: table.periodTo } : null,
    previous: keyedRows(table, table.previous ?? []),
    dataAsOf: table.dataAsOf,
    untilReached: untilReachedOf(table, definition),
    notSplit: table.notes?.notSplit ?? undefined,
    notFiltered: table.notes?.notFiltered ?? undefined,
  })
}

/**
 * The table's query as a table view's definition: the `semantic_query` input it ran, its first `order` as the table's
 * sort (a view query has no `order`). What the table is drawn with, and what "Open as view" seeds the editor with.
 *
 * A table view sorts by ONE key (`chart.sort`), so a second `order` key does not survive "Open as view": the view
 * sorts by the first, its ties in the server's order. The answer's own table is drawn as sent, so it keeps them all.
 */
export function copilotTableDefinition(table: CopilotAnswerTable): AnalyticsViewDefinition {
  const { order, show: _show, ...query } = table.query ?? {}
  const first = Array.isArray(order) ? order[0] : undefined
  const sort = first && typeof first.key === 'string' ? { key: first.key, direction: first.direction === 'asc' ? 'asc' : 'desc' } : null
  return readDefinition({ chart: { type: 'table', ...(sort ? { sort } : {}) }, query })
}

/**
 * The model the table is drawn with: the analytics model (its member labels; may be empty while it loads) with every
 * column of the table named by the WIRE's label — a calculated or variant column too, which the model does not hold.
 */
export function copilotTableModel(table: CopilotAnswerTable, model: AnalyticsModel): AnalyticsModel {
  const columns = table.columns ?? []
  const keys = new Set(columns.map((c) => c.key))
  const measures: AnalyticsMeasure[] = columns
    .filter((c) => c.role === 'measure')
    .map((c) => {
      const base = model.measures.find((m) => m.key === c.key)
      return {
        ...(base ?? {
          key: c.key,
          area: '',
          shape: (c.shape ?? 'additive') as AnalyticsMeasure['shape'],
          unit: (c.unit ?? 'count') as AnalyticsMeasure['unit'],
          description: { en: '', ar: '' },
          dimensions: [],
        }),
        label: c.label,
      }
    })
  const dimensions: AnalyticsDimension[] = columns
    .filter((c) => c.role === 'dimension')
    .map((c) => {
      const base = model.dimensions.find((d) => d.key === c.key)
      return { ...(base ?? { key: c.key, kind: c.key === 'date' ? ('time' as const) : ('category' as const), values: [] }), label: c.label }
    })
  return {
    areas: model.areas,
    measures: [...measures, ...model.measures.filter((m) => !keys.has(m.key))],
    dimensions: [...dimensions, ...model.dimensions.filter((d) => !keys.has(d.key))],
  }
}

/**
 * A table read once into what it is drawn with: its result, its definition and the model headed by the wire's labels.
 * The embed memoises each; the view, the downloads and "Open as view" take them as read.
 */
export interface CopilotTableParts {
  result: AnalyticsQueryResult
  definition: AnalyticsViewDefinition
  model: AnalyticsModel
}

/** {@link CopilotTableParts} for a table, over the analytics model (may be empty while it loads). */
export function copilotTableParts(table: CopilotAnswerTable, model: AnalyticsModel): CopilotTableParts {
  const definition = copilotTableDefinition(table)
  return { result: copilotTableResult(table, definition), definition, model: copilotTableModel(table, model) }
}

/** The table form's view model: every row, as sent, the "All" rows last, headed by the wire's labels. */
export function copilotTableView(parts: CopilotTableParts, lang: string, words: TableWords): TableView {
  return toTableView(parts.result, parts.definition, parts.model, lang, { ...words, asSent: true })
}

/** What the CSV and xlsx downloads write (`./panel-table`): every row as sent, the "All" rows last, the wire's headers. */
export function copilotTableDownload(parts: CopilotTableParts, lang: string, words: TableWords): PanelTable {
  return panelTable(parts.result, parts.definition, parts.model, lang, words)
}

/** "Open as view": the view editor, seeded with the table's definition (`./editor` `newViewLink`, route state). */
export function copilotTableOpenAsView(definition: AnalyticsViewDefinition): { to: string; state: { editorSeed: EditorSeed } | null } {
  return newViewLink({ definition })
}
