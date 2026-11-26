/**
 * The Breakdowns tab (ticket 972, results ticket decision 10 and its amendments): one table with a switch for its
 * rows — mode, city, channel or day — the same columns in every grouping and a total row; under the rows "a line the
 * stock figure could not cover" by stock class and mode, and "the channel's own split" in its three parts.
 *
 * Pure. Every figure is the reply's as sent ("no reader recomputes"): the total row is never re-summed, and `addsUp`
 * only says whether the rows' orders reach it.
 */
import {
  RESULTS_CHANNEL_SPLIT_PARTS,
  RESULTS_MODE_ROWS,
  type ResultsBreakdownBy,
  type ResultsBreakdownFigures,
  type ResultsBreakdownsReply,
  type ResultsChannelSplitPart,
  type ResultsFigure,
  type ResultsModeRow,
  type ResultsShipMode,
  type ResultsShortStockClass,
} from '@/core/models/sourcing-results'

export const BREAKDOWN_COLUMNS = [
  'orders',
  'samePlanWhole',
  'samePlanStores',
  'estimateMiddle',
  'promiseKept',
  'late',
  'returned',
  'cancelled',
  'endedNoStock',
] as const satisfies readonly (keyof ResultsBreakdownFigures)[]

/**
 * "Set beside it" adds one more column (ticket 973, BO 4283 decision 14): each row's same-plan share under the set
 * beside it, after the two same-plan columns. Drawn only when the reply's rows carry it.
 */
export const BESIDE_COLUMN = 'besideSamePlan'
export type BreakdownColumn = (typeof BREAKDOWN_COLUMNS)[number] | typeof BESIDE_COLUMN
const WITH_BESIDE: readonly BreakdownColumn[] = [
  ...BREAKDOWN_COLUMNS.slice(0, BREAKDOWN_COLUMNS.indexOf('samePlanStores') + 1),
  BESIDE_COLUMN,
  ...BREAKDOWN_COLUMNS.slice(BREAKDOWN_COLUMNS.indexOf('samePlanStores') + 1),
]

/** How the row's name is written: a mode row or a channel in the page's words, a city as free text, a day as a date. */
// PROVISIONAL (spec 4354: not specified) — `OTHER` as the city key of "the other cities".
export type BreakdownLabel =
  | { kind: 'mode'; mode: ResultsModeRow }
  | { kind: 'text'; text: string }
  | { kind: 'otherCities' }
  | { kind: 'channel'; code: string }
  | { kind: 'date'; day: string }
  | { kind: 'stockShort'; stockClass: ResultsShortStockClass; mode: ResultsShipMode }
  | { kind: 'channelSplit'; part: ResultsChannelSplitPart }

export interface BreakdownTableRow {
  key: string
  label: BreakdownLabel
  cells: Record<BreakdownColumn, number | null>
  /** The figure the row's orders open; null for the total row. */
  figure: ResultsFigure | null
}

export interface BreakdownsTable {
  header: ResultsBreakdownBy
  columns: readonly BreakdownColumn[]
  rows: BreakdownTableRow[]
  total: BreakdownTableRow
  addsUp: boolean
  stockShort: BreakdownTableRow[]
  channelSplit: BreakdownTableRow[]
}

const cellsOf = (f: ResultsBreakdownFigures): Record<BreakdownColumn, number | null> =>
  ({
    ...Object.fromEntries(BREAKDOWN_COLUMNS.map((c) => [c, f[c] ?? null])),
    [BESIDE_COLUMN]: f.beside?.samePlan.percent ?? null,
  }) as Record<BreakdownColumn, number | null>

function labelOf(by: ResultsBreakdownBy, key: string): BreakdownLabel {
  switch (by) {
    case 'MODE':
      return { kind: 'mode', mode: key as ResultsModeRow }
    case 'CITY':
      return key === 'OTHER' ? { kind: 'otherCities' } : { kind: 'text', text: key }
    case 'CHANNEL':
      return { kind: 'channel', code: key }
    case 'DAY':
      return { kind: 'date', day: key }
  }
}

const inOrder = <T>(list: readonly T[], value: T) => {
  const i = list.indexOf(value)
  return i < 0 ? list.length : i
}

export function breakdownsTable(reply: ResultsBreakdownsReply): BreakdownsTable {
  const { by } = reply
  let rows = [...reply.rows]
  if (by === 'MODE') rows.sort((a, b) => inOrder(RESULTS_MODE_ROWS, a.key as ResultsModeRow) - inOrder(RESULTS_MODE_ROWS, b.key as ResultsModeRow))
  if (by === 'DAY') rows = rows.sort((a, b) => a.key.localeCompare(b.key))

  const sum = rows.reduce((n, r) => n + r.orders, 0)
  const hasBeside = reply.total.beside != null || rows.some((r) => r.beside != null)
  return {
    header: by,
    columns: hasBeside ? WITH_BESIDE : BREAKDOWN_COLUMNS,
    rows: rows.map((r) => ({ key: r.key, label: labelOf(by, r.key), cells: cellsOf(r), figure: { kind: 'breakdown', by, key: r.key } })),
    total: { key: 'ALL', label: { kind: 'text', text: '' }, cells: cellsOf(reply.total), figure: null },
    addsUp: sum === reply.total.orders,
    stockShort: reply.stockShort.map((r) => ({
      key: `${r.stockClass}:${r.mode}`,
      label: { kind: 'stockShort', stockClass: r.stockClass, mode: r.mode },
      cells: cellsOf(r),
      figure: { kind: 'stockShort', stockClass: r.stockClass, mode: r.mode },
    })),
    channelSplit: [...reply.channelSplit]
      .sort((a, b) => inOrder(RESULTS_CHANNEL_SPLIT_PARTS, a.part) - inOrder(RESULTS_CHANNEL_SPLIT_PARTS, b.part))
      .map((r) => ({
        key: r.part,
        label: { kind: 'channelSplit', part: r.part },
        cells: cellsOf(r),
        figure: { kind: 'channelSplit', part: r.part },
      })),
  }
}
