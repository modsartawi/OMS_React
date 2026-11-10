import type { TableChartColumn } from '@/core/charts/TableChart'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { stripIsolates } from '@/core/util/bidi'
import type { XlsxSheet } from '@/core/util/grid-xlsx'
import { saysIn } from '@/core/rules/sentence'
import { measureKeysOf } from './calculations'
import { seriesColumnOf, seriesName, seriesOf } from './series'
import { viewMeasureOf } from './view-model'
import { dimensionOf } from './wire'

/**
 * A panel's rows as one table (spec 766 §F, ticket 773): what "view as table" shows and what the CSV and
 * xlsx downloads write. Pure. It keeps the answer's row order — the order the chart draws — and names a
 * member the way the chart does (the model's label for an inline value, else the member itself), so the
 * table view matches the chart. Unlike the table FORM (769's `toTableView`) it never sorts or cuts.
 *
 * Exports go through the core xlsx writer and strip isolates (the bidi rule): no FSI…PDI ever reaches a
 * file, whatever a label or member carried.
 */

type Cell = string | number | null
export interface PanelTable {
  columns: TableChartColumn[]
  rows: Record<string, Cell>[]
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * 825: a view with named series gets a `series` column FIRST, each row named by its series' label (the
 * comparison survives the download); rows of a series the view does not hold are dropped, as the chart
 * drops them. `words.series` is that column's header, in the screen's language.
 */
export function panelTable(
  result: AnalyticsQueryResult,
  definition: AnalyticsViewDefinition,
  model: AnalyticsModel,
  lang: string,
  words: { series: string } = { series: 'series' },
): PanelTable {
  const named = seriesOf(definition)
  const seriesKey = seriesColumnOf(result.columns)
  const seriesNames = new Map(named.map((s) => [s.id, seriesName(s, lang)]))
  const kept = named.length ? result.rows.filter((r) => seriesNames.has(String(r[seriesKey] ?? ''))) : result.rows
  const fromColumns = (role: 'dimension' | 'measure') => result.columns.filter((c) => c.role === role).map((c) => c.key)
  const dimKeys = definition.query.dimensions.length ? definition.query.dimensions : fromColumns('dimension')
  // 861: the query's measures, then the calculated columns the server returned (`./calculations`).
  const measureKeys = measureKeysOf(definition, result)

  const namers = new Map(
    dimKeys.map((k) => {
      const dim = dimensionOf(model, k)
      const labels = new Map(dim?.values.map((v) => [v.key, saysIn(v.label, lang)]) ?? [])
      return [k, { label: saysIn(dim?.label, lang) || k, member: (m: string) => labels.get(m) || m }]
    }),
  )
  const rows = kept.map((r) => {
    const out: Record<string, Cell> = {}
    if (named.length) out[seriesKey] = seriesNames.get(String(r[seriesKey] ?? '')) ?? ''
    for (const k of dimKeys) out[k] = r[k] == null ? '' : namers.get(k)!.member(String(r[k]))
    for (const k of measureKeys) out[k] = num(r[k])
    return out
  })
  const columns: TableChartColumn[] = [
    ...(named.length ? [{ key: seriesKey, role: 'dimension' as const, label: words.series }] : []),
    ...dimKeys.map((k) => ({ key: k, role: 'dimension' as const, label: namers.get(k)!.label })),
    ...measureKeys.map((k) => {
      const m = viewMeasureOf(k, model, result, lang)
      return { key: k, role: 'measure' as const, label: m.label, unit: m.unit, max: Math.max(0, ...rows.map((r) => Math.abs(num(r[k]) ?? 0))) }
    }),
  ]
  return { columns, rows }
}

const bare = (v: Cell): string => (v == null ? '' : stripIsolates(String(v)))

const csvCell = (v: Cell): string => {
  const s = bare(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** The CSV: a BOM (so Excel reads the Arabic as UTF-8), the header, then the rows; numbers raw, CRLF. */
export function panelCsv(table: PanelTable): string {
  const lines = [table.columns.map((c) => csvCell(c.label)), ...table.rows.map((r) => table.columns.map((c) => csvCell(r[c.key])))]
  return '﻿' + lines.map((l) => l.join(',')).join('\r\n') + '\r\n'
}

/** Excel refuses `\ / ? * : [ ]` in a sheet name and caps it at 31 characters. */
const sheetName = (name: string): string => stripIsolates(name).replace(/[\\/?*:[\]]/g, '').slice(0, 31) || 'Sheet1'

/** The xlsx worksheet for the core writer: numbers stay numeric so Excel can total them; members are text. */
export function panelSheet(table: PanelTable, name: string): XlsxSheet {
  return {
    name: sheetName(name),
    data: [
      table.columns.map((c) => ({ value: bare(c.label), fontWeight: 'bold' as const })),
      ...table.rows.map((r) =>
        table.columns.map((c) => {
          const v = r[c.key]
          return c.role === 'measure' && typeof v === 'number' ? { type: Number, value: v } : { type: String, value: bare(v) }
        }),
      ),
    ],
    columns: table.columns.map((c) => ({ width: Math.min(60, Math.max(10, bare(c.label).length + 2)) })),
  }
}

/** A download's base name: the view id, made safe for a file system (titles may be Arabic or empty). */
export const panelFileBase = (viewId: string): string => `analytics-${viewId.replace(/[^A-Za-z0-9_-]+/g, '-')}`
