import type { AnalyticsDimension, AnalyticsLabel, AnalyticsMeasure, AnalyticsModel, AnalyticsQueryResult, AnalyticsRow, AnalyticsViewDefinition, MeasureUnit } from '@/core/models/analytics'
import { IS_TOTAL_KEY } from '@/core/models/analytics-calculations'
import type { CopilotAnswerTable, CopilotTableRow } from '@/core/models/copilot'
import { shownDecimals } from '@/core/charts/format'
import { saysIn } from '@/core/rules/sentence'
import type { CalculationWords } from './calculations'
import { newViewLink, type EditorSeed } from './editor'
import { panelFileBase, panelTable, type PanelTable, type TableWords } from './panel-table'
import { toTableView, type TableView } from './view-model-forms'
import { dimensionOf, readDefinition, readResult } from './wire'

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

/**
 * 878 (BackOffice 3621): the title of a table made from a part of an analysis result, in the screen's language (the
 * other language when that one is blank); `''` on a plain query's table, which has none.
 */
export const copilotTableTitle = (table: CopilotAnswerTable, lang: string): string => saysIn(table.title, lang).trim()

/**
 * 878 (BackOffice 3621): a table made from a part of an analysis result — the one that carries a title. Its cells are
 * the tool's own texts, already formatted ("3000", "-620", "62.0%"), and some of its columns are the tool's own
 * (`before`, `after`, `change`, `share`: not in `query`). So it is NOT read into an analytics result, whose measure
 * cells are numbers the table form formats: it is drawn column for column and cell for cell as sent ({@link sentTable}).
 * A plain query's table has no title and is read as before.
 */
export const isAnalysisTable = (table: CopilotAnswerTable): boolean => table.title != null && typeof table.title === 'object'

/**
 * An analysis table as the table form and the downloads take it: every column sent, in the order sent, under the wire's
 * label; every figure the server's text, untouched (null where it sent none); the rows in the order sent. A member is
 * named as on any table (the model's label for an inline value, else the member itself). No comparison column: the
 * tool's own columns already hold the figures it compared.
 */
function sentTable(table: CopilotAnswerTable, model: AnalyticsModel, lang: string, words: TableWords, byUnit = false): PanelTable {
  const columns = table.columns ?? []
  const members = new Map(
    columns
      .filter((c) => c.role === 'dimension')
      .map((c) => [c.key, new Map(dimensionOf(model, c.key)?.values.map((v) => [v.key, saysIn(v.label, lang)]) ?? [])] as const),
  )
  const rows = table.rows ?? []
  // 897: the measure columns the table form formats by their unit, on the screen only.
  const formatted = columns.map((c, i) => (byUnit && c.role !== 'dimension' ? unitOfSent(c.unit, rows.map((r) => r.values?.[i] ?? null)) : null))
  return {
    columns: columns.map((c, i) => {
      const label = saysIn(c.label, lang) || c.key
      if (c.role === 'dimension') return { key: c.key, role: 'dimension' as const, label }
      const unit = formatted[i]
      // No `max`: a cell bar's width would be a figure the panel worked out.
      return unit ? { key: c.key, role: 'measure' as const, label, unit } : { key: c.key, role: 'measure' as const, label, asSent: true }
    }),
    rows: rows.map((r) => {
      const out: Record<string, string | number | null> = {}
      columns.forEach((c, i) => {
        const v = r.values?.[i] ?? null
        if (c.role !== 'dimension') out[c.key] = formatted[i] && v != null ? Number(v) : v
        else out[c.key] = v == null ? (r.isTotal === true ? (words.all ?? '') : '') : members.get(c.key)?.get(v) || v
      })
      return out
    }),
  }
}

/**
 * 897 (BackOffice spec 3587): the units an analysis table's figures are formatted by, as the table form formats them
 * (`@/core/charts/format`) — money with its currency and separators, a count with separators. A percent and a share
 * stay as sent (the server writes them "62.0%"), and so does a column with no unit or any other unit (minutes, km: not
 * asked for by 897).
 */
const FORMATTED_UNITS: ReadonlySet<string> = new Set<MeasureUnit>(['SAR', 'count'])

/** A plain invariant number as the wire writes it: `-1883288.19`, `3000` — no exponent, no separator, no symbol. */
const PLAIN_NUMBER = /^-?(\d+)(?:\.(\d+))?$/

/**
 * The unit an analysis column's figures are formatted by (897), or null to show the column as sent. A column is
 * formatted only when every figure in it is a plain number its unit shows to its last decimal: the panel never shows a
 * figure rounded differently from the server's, so a column with one that would round, or one that is not a number,
 * reads as sent, whole.
 */
function unitOfSent(unit: string | null | undefined, cells: readonly (string | null)[]): MeasureUnit | null {
  if (!unit || !FORMATTED_UNITS.has(unit)) return null
  const decimals = shownDecimals(unit as MeasureUnit)
  const fits = cells.every((v) => {
    if (v == null) return true
    const m = PLAIN_NUMBER.exec(v)
    // Over 15 digits a JavaScript number no longer holds the figure exactly: it would read differently from the server's.
    return m != null && (m[2] ?? '').replace(/0+$/, '').length <= decimals && (m[1] + (m[2] ?? '')).replace(/^0+/, '').length <= 15
  })
  return fits ? (unit as MeasureUnit) : null
}

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
    // 878 (BackOffice 3607): the same weeks last year, when the query asked — rows, days and the areas that do not hold
    // them — read as a view's are (877), so the table form and the downloads gain the last-year column and its note.
    // Absent stays absent: a table that did not ask is read as before.
    ...(Array.isArray(table.lastYear) ? { lastYear: keyedRows(table, table.lastYear) } : {}),
    ...(table.lastYearFrom && table.lastYearTo ? { lastYearPeriod: { from: table.lastYearFrom, to: table.lastYearTo } } : {}),
    ...(Array.isArray(table.notes?.lastYearNotHeld) ? { lastYearNotHeld: table.notes.lastYearNotHeld } : {}),
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
 * How the panel names a column the server left unnamed (878): the screen's language and its calculation words
 * (`./use-calculations` `useCalculationWords`). Without it every column is headed by the wire's label, as before.
 */
export interface CopilotColumnNaming {
  lang: string
  words: Pick<CalculationWords, 'changeLastYear'>
}

/**
 * The model the table is drawn with: the analytics model (its member labels; may be empty while it loads) with every
 * column of the table named by the WIRE's label — a calculated or variant column too, which the model does not hold.
 */
export function copilotTableModel(table: CopilotAnswerTable, model: AnalyticsModel, naming?: CopilotColumnNaming): AnalyticsModel {
  const columns = table.columns ?? []
  const keys = new Set(columns.map((c) => c.key))
  // 878 (BackOffice 3607): a change from last year the server left unnamed (its header is its key) is named as the
  // query builder names it, "Change in {measure} from last year" (876) — it says which comparison it is from.
  const labelOf = (c: CopilotAnswerTable['columns'][number]): AnalyticsLabel => {
    const of = naming && c.calculation?.kind === 'change' && c.calculation.from === 'lastYear' ? c.calculation.measure : null
    if (!naming || !of || (saysIn(c.label, naming.lang) || c.key) !== c.key) return c.label
    const measure = columns.find((m) => m.key === of)?.label ?? model.measures.find((m) => m.key === of)?.label
    // The label as the viewer reads it, in either language: it is derived in `lang` already (as `./calculations` does).
    const named = naming.words.changeLastYear?.({ measure: saysIn(measure, naming.lang) || of, of: '', within: '' })
    return named ? { en: named, ar: named } : c.label
  }
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
        label: labelOf(c),
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
  /** 878: the table itself when it is an analysis result's ({@link isAnalysisTable}), drawn as sent; absent on a plain query's. */
  sent?: CopilotAnswerTable
}

/** {@link CopilotTableParts} for a table, over the analytics model (may be empty while it loads). */
export function copilotTableParts(table: CopilotAnswerTable, model: AnalyticsModel, naming?: CopilotColumnNaming): CopilotTableParts {
  const definition = copilotTableDefinition(table)
  return { result: copilotTableResult(table, definition), definition, model: copilotTableModel(table, model, naming), ...(isAnalysisTable(table) ? { sent: table } : {}) }
}

/** The table form's view model: every row, as sent, the "All" rows last, headed by the wire's labels. */
export function copilotTableView(parts: CopilotTableParts, lang: string, words: TableWords): TableView {
  if (parts.sent) {
    // 897: on screen, a money or count column is formatted by its unit, as a query table's is.
    const { columns, rows } = sentTable(parts.sent, parts.model, lang, words, true)
    const first = columns.findIndex((c) => c.role === 'dimension')
    const members = parts.sent.rows.map((r) => String((first < 0 ? null : r.values?.[first]) ?? ''))
    return { kind: 'table', columns, rows, members, sort: null, cut: false, empty: rows.length === 0 }
  }
  return toTableView(parts.result, parts.definition, parts.model, lang, { ...words, asSent: true })
}

/** What the CSV and xlsx downloads write (`./panel-table`): every row as sent, the "All" rows last, the wire's headers. */
export function copilotTableDownload(parts: CopilotTableParts, lang: string, words: TableWords): PanelTable {
  // 878: an analysis table downloads every column and every text as sent. 897: the screen formats a money or count
  // column by its unit; the file keeps the server's figures — it is for reading back, not for display.
  if (parts.sent) return sentTable(parts.sent, parts.model, lang, words)
  return panelTable(parts.result, parts.definition, parts.model, lang, words)
}

/**
 * A download's base name. A plain query's table keeps the name it had (`analytics-copilot-<step>`: one table per
 * step). 878: an analysis result's tables all sit on one step, so each is named by its place among the answer's tables
 * as well (`index`, 0-based; written from 1).
 */
export function copilotTableFileBase(table: CopilotAnswerTable, index: number): string {
  return panelFileBase(isAnalysisTable(table) ? `copilot-${table.step}-${index + 1}` : `copilot-${table.step}`)
}

/**
 * Whether the table has a query to open as a view. A plain query's table always does (the input it ran). 878
 * (BackOffice 3621): a part of an analysis result that came from no single query carries `{}`, and is offered no
 * "Open as view" — there is nothing to open.
 */
export function copilotTableOpensAsView(table: CopilotAnswerTable): boolean {
  const { order: _order, show: _show, ...query } = table.query ?? {}
  return Object.keys(query).length > 0
}

/**
 * 878 (BackOffice 3621): the columns of an analysis table that its query does not hold — the ones the analysis computed
 * itself (before, after, change, share) — by the wire's label in `lang`. "Open as view" opens the query, so the view
 * lacks them, and `./ComputedColumnsNote` says so. Empty on a plain query's table (every column of it is its query's),
 * and when there is no query to open.
 */
export function copilotTableComputedColumns(table: CopilotAnswerTable, definition: AnalyticsViewDefinition, lang: string): string[] {
  if (!isAnalysisTable(table) || !copilotTableOpensAsView(table)) return []
  const { measures, dimensions, calculations, variants } = definition.query
  const asked = new Set([...measures, ...dimensions, ...(calculations ?? []).map((c) => c.key), ...(variants ?? []).map((v) => v.key)])
  return (table.columns ?? []).filter((c) => !asked.has(c.key)).map((c) => saysIn(c.label, lang) || c.key)
}

/** "Open as view": the view editor, seeded with the table's definition (`./editor` `newViewLink`, route state). */
export function copilotTableOpenAsView(definition: AnalyticsViewDefinition): { to: string; state: { editorSeed: EditorSeed } | null } {
  return newViewLink({ definition })
}
