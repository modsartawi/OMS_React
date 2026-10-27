/**
 * The IDF swap report, pure (BackOffice spec 3157, door 3169; oms ticket 627). One row per master × store × payer
 * over the event log's shared filter (`IdfEventsFilter`): how many events ended in each outcome, the summed price
 * difference on the picks taken (money), and the average time spent.
 *
 * ⚠️ Row spelling ASSUMED from the brief ("counts per outcome, summed price difference on picks taken, average time
 * spent"); 3169 finalises it and 628 reconciles.
 */
import { IDF_EVENT_FILTER_OUTCOMES, IDF_EVENT_OUTCOMES, type IdfEventOutcome } from './events'
import type { IdfEventsFilter } from './events-filter'

/** A row of `GET IdfPriority/swap-report` (3169 finalises the spelling). */
export interface IdfSwapReportRow {
  /** Null when no master decided (an event the till could not attribute). */
  masterId?: string | null
  storeCode: string
  payerCode?: string | null
  /** Events per outcome code (the log's outcomes); an outcome with none may be absent. */
  counts: Partial<Record<string, number>>
  /** Summed price difference on the picks taken, SAR. Null when no pick was taken. */
  priceDifference?: number | null
  averageTimeSeconds?: number | null
}

/** The row's identity (the grouping): master × store × payer. */
export function swapRowKey(r: IdfSwapReportRow): string {
  return [r.masterId ?? '', r.storeCode, r.payerCode ?? ''].join('|')
}

/** The export's name when the server's `Content-Disposition` gives none. */
export function swapReportFileName(f: Pick<IdfEventsFilter, 'from' | 'to'>): string {
  return `idf-swap-report-${f.from}-${f.to}.xlsx`
}

/** A count column of the report: an outcome, or `other` for the codes this screen has no word for. */
export type SwapReportColumn = IdfEventOutcome | 'other'

const KNOWN = new Set<string>(IDF_EVENT_OUTCOMES)
const OFFERED = new Set<string>(IDF_EVENT_FILTER_OUTCOMES)

/**
 * The count columns for these rows, so every count the server sends is on screen and the totals match it: the six
 * offered outcomes always; a reserved outcome (`requestRaised`, `autoApproved`) only when some row counts one; and
 * `other` when some row counts a code this screen does not know.
 */
export function swapReportColumns(rows: IdfSwapReportRow[]): SwapReportColumn[] {
  const carried = new Set<string>()
  for (const r of rows) for (const [code, n] of Object.entries(r.counts ?? {})) if (n) carried.add(code)
  const reserved = IDF_EVENT_OUTCOMES.filter((o) => !OFFERED.has(o) && carried.has(o))
  const unknown = [...carried].some((c) => !KNOWN.has(c))
  return [...IDF_EVENT_FILTER_OUTCOMES, ...reserved, ...(unknown ? (['other'] as const) : [])]
}

/** A row's count under a column; `other` sums every code this screen does not know. */
export function swapReportCount(r: IdfSwapReportRow, column: SwapReportColumn): number {
  const counts = r.counts ?? {}
  if (column !== 'other') return counts[column] ?? 0
  return Object.entries(counts).reduce((sum, [code, n]) => (KNOWN.has(code) ? sum : sum + (n ?? 0)), 0)
}
