/**
 * The parked-returns list's filters and page (BackOffice ticket 4224, spec 4212 stories 2, 3, 12; door BackOffice 4218
 * `GET RefundLedgerWeb/ParkedReturns`): read from the URL, written back to it, and turned into the query the door is
 * asked. Pure; the page keeps them in the address (`useUrlQuery`).
 *
 * The **view** folds the door's two booleans into one choice: `needsHq` (the default, story 2), `open` (every parked
 * return not yet finished) and `all` (finished ones too: searchable, never the default, story 12). The server orders the
 * rows (needs HQ first, then the oldest park), so no order is ever sent.
 */
import type { LedgerStatus, ParkedReturnsQuery } from '@/core/models/parked-returns'

/** Rows a page (the door's default). */
export const PAGE_SIZE = 50

export const VIEWS = ['needsHq', 'open', 'all'] as const
export type ListView = (typeof VIEWS)[number]

export const LEDGER_STATUSES: readonly LedgerStatus[] = ['PENDING', 'SUBMITTED', 'REFUNDED', 'FAILED']

export interface ParkedFilters {
  store: string
  /** A partner code; a return any of whose grains is this partner. */
  partner: string
  /** A ledger status; a return any of whose grains has it. Blank = any. */
  ledgerStatus: LedgerStatus | ''
  /** Parked at least this many days ago; null = any age. */
  minAgeDays: number | null
  view: ListView
  transactionId: string
  /** 1-based. */
  page: number
}

export const NO_FILTERS: ParkedFilters = Object.freeze({
  store: '',
  partner: '',
  ledgerStatus: '',
  minAgeDays: null,
  view: 'needsHq',
  transactionId: '',
  page: 1,
})

const text = (v: string | null) => (v ?? '').trim()
const wholeAtLeast = (v: string | null, min: number): number | null => {
  if (v === null || v.trim() === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= min ? n : null
}

export function filtersFromParams(params: URLSearchParams): ParkedFilters {
  const status = text(params.get('status')).toUpperCase()
  const view = params.get('view') ?? ''
  return {
    store: text(params.get('store')),
    partner: text(params.get('partner')),
    ledgerStatus: (LEDGER_STATUSES as readonly string[]).includes(status) ? (status as LedgerStatus) : '',
    minAgeDays: wholeAtLeast(params.get('age'), 0),
    view: (VIEWS as readonly string[]).includes(view) ? (view as ListView) : 'needsHq',
    transactionId: text(params.get('transaction')),
    page: wholeAtLeast(params.get('page'), 1) ?? 1,
  }
}

export function filtersToParams(f: ParkedFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.store) p.set('store', f.store)
  if (f.partner) p.set('partner', f.partner)
  if (f.ledgerStatus) p.set('status', f.ledgerStatus)
  if (f.minAgeDays !== null) p.set('age', String(f.minAgeDays))
  if (f.view !== 'needsHq') p.set('view', f.view)
  if (f.transactionId) p.set('transaction', f.transactionId)
  if (f.page > 1) p.set('page', String(f.page))
  return p
}

/** The door's query. A blank filter is passed through: `@/core/api`'s `buildQuery` drops it (api-envelope rule). */
export function listQuery(f: ParkedFilters): ParkedReturnsQuery {
  return {
    store: f.store,
    partner: f.partner,
    ledgerStatus: f.ledgerStatus,
    minAgeDays: f.minAgeDays,
    needsHq: f.view === 'needsHq',
    includeFinished: f.view === 'all',
    transactionId: f.transactionId,
    page: f.page,
    pageSize: PAGE_SIZE,
  }
}

/** A filter changed: the list starts again at page 1. */
export function changeFilter(f: ParkedFilters, change: Partial<Omit<ParkedFilters, 'page'>>): ParkedFilters {
  return { ...f, ...change, page: 1 }
}
