/**
 * The IDF swap report, pure (BackOffice spec 3157, door 3169; oms ticket 627). One row per master × store × payer
 * over the event log's shared filter (`IdfEventsFilter`): how many events ended in each outcome, the summed price
 * difference on the picks taken (money), and the average time spent.
 *
 * ⚠️ Row spelling ASSUMED from the brief ("counts per outcome, summed price difference on picks taken, average time
 * spent"); 3169 finalises it and 628 reconciles.
 */
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
