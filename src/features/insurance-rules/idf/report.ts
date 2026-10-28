/**
 * The IDF swap report, pure (BackOffice spec 3157, door 3169; oms ticket 627). One row per master × store × payer
 * over the event log's shared filter (`IdfEventsFilter`), ordered by master, store, payer, with a `totals` row.
 *
 * Door as built (3169 + the 3157 review): each row (and `totals`, whose `masterId` / `store` / `insurerCustomerId` are
 * empty) carries fixed counts — `events` (every outcome, the reserved two included), `reminders` and of those
 * `remindersAllCandidatesDearer`, `forcedPicksTaken`, `alternativesTaken`, `picksCancelled`, `linesAbandoned`,
 * `skippedByException`, `refusedPreAuth` — the `priceDifference` (summed `scannedUnitPrice - dispensedUnitPrice` per
 * BASE unit over the picks TAKEN; negative when the dispensed item was dearer; money, 3 decimals in the export), and
 * the time spent (`totalDurationMs`, `averageDurationMs`). An empty `masterId` is the general master.
 */
import type { IdfEventsFilter } from './events-filter'

/** A row of `GET IdfPriority/swap-report` (3169), and its `totals`. */
export interface IdfSwapReportRow {
  /** Empty = the general master (names empty too). */
  masterId: string
  masterNameEn?: string | null
  masterNameAr?: string | null
  store: string
  insurerCustomerId: string
  events: number
  reminders: number
  remindersAllCandidatesDearer: number
  forcedPicksTaken: number
  alternativesTaken: number
  picksCancelled: number
  linesAbandoned: number
  skippedByException: number
  refusedPreAuth: number
  /** Per base unit, over the picks taken. */
  priceDifference: number
  totalDurationMs: number
  averageDurationMs: number
}

/** `GET IdfPriority/swap-report` → `{ from, to, rows, totals }`. */
export interface IdfSwapReport {
  from?: string | null
  to?: string | null
  rows: IdfSwapReportRow[]
  totals: IdfSwapReportRow | null
}

/** The count columns, in the door's order. */
export const SWAP_REPORT_COUNTS = [
  'events',
  'reminders',
  'remindersAllCandidatesDearer',
  'forcedPicksTaken',
  'alternativesTaken',
  'picksCancelled',
  'linesAbandoned',
  'skippedByException',
  'refusedPreAuth',
] as const
export type SwapReportCount = (typeof SWAP_REPORT_COUNTS)[number]

/** The row's identity (the grouping): master × store × payer. */
export function swapRowKey(r: Pick<IdfSwapReportRow, 'masterId' | 'store' | 'insurerCustomerId'>): string {
  return [r.masterId ?? '', r.store ?? '', r.insurerCustomerId ?? ''].join('|')
}

/** The master's name in the reader's language off the row itself; null for the general master (empty id). */
export function swapRowMasterName(r: Pick<IdfSwapReportRow, 'masterId' | 'masterNameEn' | 'masterNameAr'>, lang: string): string | null {
  if (!r.masterId) return null
  const name = lang.startsWith('ar') && r.masterNameAr ? r.masterNameAr : r.masterNameEn || r.masterNameAr
  return name || null
}

/** A null body is an empty report. */
export function reportOrEmpty(r: IdfSwapReport | null | undefined): IdfSwapReport {
  return { from: r?.from ?? null, to: r?.to ?? null, rows: r?.rows ?? [], totals: r?.totals ?? null }
}

const compact = (d: string) => d.replace(/-/g, '')

/** The export's name when the server's `Content-Disposition` gives none — the door's own spelling. */
export function swapReportFileName(f: Pick<IdfEventsFilter, 'from' | 'to'>): string {
  return `idf-swap-report${f.from ? `-${compact(f.from)}` : ''}${f.to ? `-to-${compact(f.to)}` : ''}.xlsx`
}
