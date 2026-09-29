/**
 * What the central-invoice list asks the server for (ticket 333, BackOffice 2100). Pure.
 *
 * The toolbar edits a **draft** of these; only Search promotes it to the query, so a
 * half-typed store code never fires a request.
 */
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'

/** Which day the range reads. `billed` selects BILLED rows only (the server's rule). */
export type CentralInvoiceDateBasis = 'requested' | 'billed'

/** The server's three statuses — the wire spellings `GET Sd/CentralInvoice` filters on. */
export const CENTRAL_INVOICE_STATUSES = ['QUEUED', 'BILLED', 'STRANDED'] as const
export type CentralInvoiceStatus = (typeof CENTRAL_INVOICE_STATUSES)[number]

export interface CentralInvoiceListCriteria {
  /** `yyyy-MM-dd`, inclusive; `''` leaves that end open. */
  from: string
  /** `yyyy-MM-dd`, inclusive; `''` leaves that end open. */
  to: string
  dateBasis: CentralInvoiceDateBasis
  store: string
  /** `''` is every status. */
  status: CentralInvoiceStatus | ''
}

/** How many days the landing range spans, today included. */
export const LANDING_DAYS = 30

/**
 * The landing query: raised in the last 30 days, every store, every status.
 *
 * A range rather than everything: the server has no page and no cap, and the audit only
 * grows. Either end can be cleared to ask the open question.
 */
export function defaultListCriteria(today: Date = new Date()): CentralInvoiceListCriteria {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (LANDING_DAYS - 1))
  return { from: toIsoDate(from), to: toIsoDate(today), dateBasis: 'requested', store: '', status: '' }
}

/**
 * Why the draft cannot be searched, or `null`: a range that ends before it starts (the
 * server's `CINV-LIST-FILTER` 400, caught here first), an end that is not a date, or a
 * billing-day range asked of a status that is never billed.
 */
export function criteriaProblem(c: CentralInvoiceListCriteria): 'badDate' | 'reversed' | 'billedStatus' | null {
  if ((c.from && !fromIsoDate(c.from)) || (c.to && !fromIsoDate(c.to))) return 'badDate'
  // `yyyy-MM-dd` sorts as it reads.
  if (c.from && c.to && c.to < c.from) return 'reversed'
  // Only a billed request has a billing day: the server reads the billed basis as BILLED rows
  // only, so this pairing would come back empty and look like "nothing was raised".
  if (c.dateBasis === 'billed' && c.status !== '' && c.status !== 'BILLED') return 'billedStatus'
  return null
}

/**
 * The query parameters, named as the endpoint binds them. Blank values are left for
 * `buildQuery` to drop (`api-envelope`); the store is trimmed because the server compares
 * it exactly.
 */
export function listParams(c: CentralInvoiceListCriteria): Record<string, string> {
  return { from: c.from, to: c.to, dateBasis: c.dateBasis, store: c.store.trim(), status: c.status }
}
