/**
 * The Breakdowns tab (ticket 972, results ticket decision 10 and its amendments): one table with a switch for its rows
 * — mode, city, channel, day, who made the run, the channel's own split, or the orders with a line the stock figure could
 * not cover — the same columns in every grouping and a total row. BO 4393 answers one grouping per read
 * (`Results/Breakdown?by=`), every figure a count of the row's orders.
 *
 * Pure. Every figure is the reply's as sent ("no reader recomputes"): the rows keep the order sent, the total row is
 * never re-summed, and `addsUp` only says whether the rows' orders reach it.
 */
import type { ResultsBreakdownBy, ResultsBreakdownReply, ResultsBreakdownRow, ResultsFigure } from '@/core/models/sourcing-results'

export const BREAKDOWN_COLUMNS = [
  'orders',
  'samePlanWhole',
  'samePlanStores',
  'middleEstimate',
  'promiseKept',
  'late',
  'returned',
  'cancelled',
  'customerCancelled',
  'noStock',
  'pairsCut',
] as const satisfies readonly (keyof ResultsBreakdownRow)[]
export type BreakdownColumn = (typeof BREAKDOWN_COLUMNS)[number]

/** How the row's name is written: a code in the page's (or the code list's) words, a city as free text, a day as a date. */
export type BreakdownLabel =
  | { kind: 'modeMix'; code: string }
  | { kind: 'text'; text: string }
  | { kind: 'channel'; code: string }
  | { kind: 'date'; day: string }
  | { kind: 'madeBy'; code: string }
  | { kind: 'ownSplit'; code: string }

export interface BreakdownTableRow {
  key: string
  label: BreakdownLabel
  cells: Record<BreakdownColumn, number | null>
  /** The figure the row's orders open; null for the total row. */
  figure: ResultsFigure | null
}

export interface BreakdownsTable {
  by: ResultsBreakdownBy
  rows: BreakdownTableRow[]
  total: BreakdownTableRow
  addsUp: boolean
}

const cellsOf = (r: ResultsBreakdownRow) =>
  Object.fromEntries(BREAKDOWN_COLUMNS.map((c) => [c, r[c] ?? null])) as Record<BreakdownColumn, number | null>

function labelOf(by: ResultsBreakdownBy, key: string): BreakdownLabel {
  switch (by) {
    case 'MODE':
    case 'SHORT_FIGURE':
      return { kind: 'modeMix', code: key }
    case 'CITY':
      return { kind: 'text', text: key }
    case 'CHANNEL':
      return { kind: 'channel', code: key }
    case 'DAY':
      return { kind: 'date', day: key }
    case 'MADE_BY':
      return { kind: 'madeBy', code: key }
    case 'OWN_SPLIT':
      return { kind: 'ownSplit', code: key }
  }
}

export function breakdownsTable(reply: ResultsBreakdownReply): BreakdownsTable {
  const { by } = reply
  const sum = reply.rows.reduce((n, r) => n + r.orders, 0)
  return {
    by,
    rows: reply.rows.map((r) => ({ key: r.key, label: labelOf(by, r.key), cells: cellsOf(r), figure: { kind: 'breakdown', by, key: r.key } })),
    total: { key: reply.total.key, label: { kind: 'text', text: '' }, cells: cellsOf(reply.total), figure: null },
    addsUp: sum === reply.total.orders,
  }
}
