/**
 * The Transactions tab's pure logic (spec 444 amended by BackOffice spec 2586, ticket
 * 467). No React, no network — pinned by `transactions-helpers.test.ts`.
 *
 * 🚩 Nothing here judges a receipt or sums a day. The counter flag is the door's
 * `counter`, the signed total is the door's `total` (a return already negative), and
 * the summary is the door's `summary` — never recomputed from a page's rows.
 */
import type { Severity } from '@/core/ui/severity'
import type { CounterFlag, StoreTransaction, TxKindFilter, TxStatusFilter } from '@/core/models/sync-console'
import { fsi } from '@/core/util/bidi'
import { toIsoDate } from '@/core/util/date-format'
import { formatMoney3 } from '@/core/util/number-format'
import { failureLabelKey } from './control-helpers'
import { codeBadge, type CodeBadge } from './helpers'

// ── The day ─────────────────────────────────────────────────────────────────────

/**
 * How many finished days the picker offers before today. `Store/Transactions` refuses a
 * day outside D-0..D-`AgreementWindowDays` (BackOffice
 * `.issues/assets/2523-sync-console-door-contract.md`, "Today's transactions"), but no
 * door returns that setting, so this is the window the same contract documents for
 * `Store/Agreement` — D-1..D-7 ("Rail agreement"). Only these days are offered, so the
 * door's `BAD_DATE` cannot be reached from the tab while the setting stays 7.
 */
export const TRANSACTIONS_WINDOW_DAYS = 7

/** The browser's LOCAL calendar date as `yyyy-MM-dd` — never `toISOString()`, which is UTC. */
export const localToday = (now: Date): string => toIsoDate(now)

/** Today, then each day of the window before it, newest first — from the local calendar. */
export function transactionDays(now: Date): string[] {
  return Array.from({ length: TRANSACTIONS_WINDOW_DAYS + 1 }, (_, i) =>
    toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)),
  )
}

// ── Polling ─────────────────────────────────────────────────────────────────────

/** The tab re-reads a day still being sold on at this cadence (spec 2586, decision 3). */
export const TRANSACTIONS_POLL_MS = 60_000

/** Whether the picked day is today, the only day that polls. A past day never changes under the reader. */
export const pollsToday = (day: string, today: string): boolean => day === today

/**
 * The read's `refetchInterval`, judged at each tick against the local date then: a tab
 * left open on today past midnight stops polling, since its day is now a past one.
 */
export const transactionsPollInterval = (day: string, now: Date): number | false =>
  pollsToday(day, localToday(now)) ? TRANSACTIONS_POLL_MS : false

// ── The door query ──────────────────────────────────────────────────────────────

/** The list pages at 50, the door's maximum for this read. */
export const TRANSACTIONS_PAGE_SIZE = 50

/** The tab's filters — the door's `status`, `kind`, `counter` and `receipt`. */
export interface TransactionsFilter {
  status: TxStatusFilter
  kind: TxKindFilter
  /** `null` = every flag. */
  counter: CounterFlag | null
  /** The applied search (an exact receipt number), not the box being typed in. */
  receipt: string
}

export const DEFAULT_TRANSACTIONS_FILTER: TransactionsFilter = { status: 'COMPLETED', kind: 'all', counter: null, receipt: '' }

/**
 * The `GET ActionSync/Store/Transactions` parameters. `day` is ALWAYS sent (the picker's
 * value), so the list never changes day under the reader at midnight. The door's own
 * defaults are left out: status `COMPLETED`, kind `all`, no counter flag and a blank
 * receipt (trimmed first). `status=all` IS sent — the door's default is `COMPLETED`.
 * The page never goes below 1.
 */
export function transactionsQuery(code: string, day: string, filter: TransactionsFilter, page: number): Record<string, unknown> {
  const receipt = filter.receipt.trim()
  return {
    code,
    day,
    ...(filter.status !== DEFAULT_TRANSACTIONS_FILTER.status && { status: filter.status }),
    ...(filter.kind !== DEFAULT_TRANSACTIONS_FILTER.kind && { kind: filter.kind }),
    ...(filter.counter !== null && { counter: filter.counter }),
    ...(receipt !== '' && { receipt }),
    page: Math.max(1, Math.floor(page)),
    pageSize: TRANSACTIONS_PAGE_SIZE,
  }
}

// ── A row's words ───────────────────────────────────────────────────────────────

const COUNTER_SEVERITY: Record<CounterFlag, Severity> = {
  // As ruled for the wave: the shadow is on the counter rail and its total agrees.
  arrived: 'go',
  // Not yet: it may still arrive today — a human looks if it stays.
  notYet: 'warn',
  // Both rails carry it, with different money.
  mismatch: 'bad',
}

/** A receipt's counter-rail flag as a badge; a flag this bundle does not know is neutral with its raw code. */
export function counterBadge(flag: string): CodeBadge {
  return codeBadge(COUNTER_SEVERITY, 'transactionsTab.counter.flags', flag)
}

/**
 * The counter badge's tooltip — a string-only sink, so its key and the counter total
 * formatted to 3 decimals and isolated ONCE. A receipt with no shadow (`counterTotal:
 * null`) has its own words, never a `0.000` that reads as a zero sale.
 */
export function counterTip(row: Pick<StoreTransaction, 'counter' | 'counterTotal'>): { key: string; total?: string } {
  // `== null`: a door that drops a null member must not draw an empty total.
  if (row.counterTotal == null) return { key: 'transactionsTab.counter.tipNotYet' }
  return { key: 'transactionsTab.counter.tip', total: fsi(formatMoney3(row.counterTotal)) }
}

const STATUS_SEVERITY: Record<'COMPLETED' | 'VOIDED', Severity> = { COMPLETED: 'mute', VOIDED: 'mute' }

/** A receipt's stored status as a word; one this bundle does not know shows raw. */
export function txStatusLabel(status: string): CodeBadge {
  return codeBadge(STATUS_SEVERITY, 'transactionsTab.statuses', status)
}

/** Sale or return, from the door's `isReturn`. */
export const txKindLabel = (isReturn: boolean): string => `transactionsTab.kinds.${isReturn ? 'return' : 'sale'}`

// ── A receipt's JSON (ticket 468) ───────────────────────────────────────────────

/**
 * A snapshot pretty-printed as Copy JSON copies it: the whole value at a 2-space indent.
 * A door that dropped the member reads as `null`, never an empty block.
 */
export const prettyJson = (value: unknown): string => JSON.stringify(value ?? null, null, 2)

/** One collapsible block of the JSON drawer: a top-level key (`null` for the whole value) and its pretty value. */
export interface SnapshotSection {
  key: string | null
  json: string
}

/**
 * The snapshot's top-level keys (header, lines, tenders, …) in the order the parsed object
 * holds them, each pretty-printed on its own. Anything that is not a non-empty plain object
 * — an array, `null`, a primitive, `{}` — comes back as one unnamed section, so the drawer
 * always draws the whole value.
 */
export function snapshotSections(json: unknown): SnapshotSection[] {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) return [{ key: null, json: prettyJson(json) }]
  const entries = Object.entries(json)
  if (entries.length === 0) return [{ key: null, json: prettyJson(json) }]
  return entries.map(([key, value]) => ({ key, json: prettyJson(value) }))
}

/**
 * The words for a refused snapshot read, from the door's code (`apiErrorCode`).
 * `NOT_FOUND` (no header, another store's, a training sale) has its own sentence and the
 * code is not repeated. Any other code takes the store doors' shared words
 * (`failureLabelKey` — `NO_STORE` has some) and is shown beside them; a code without
 * words (`BAD_REQUEST`, one this bundle does not know) shows raw with the server's
 * message, and no code at all (the 500 of a failed audit write) shows core's server sentence alone.
 */
export function snapshotRefusal(code: string | null): { labelKey: string | null; showCode: boolean } {
  if (code === 'NOT_FOUND') return { labelKey: 'transactionsTab.snapshot.notFound', showCode: false }
  if (code === null) return { labelKey: null, showCode: false }
  return { labelKey: failureLabelKey(code), showCode: true }
}
