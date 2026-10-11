/**
 * The double-send list's pure logic (BackOffice spec 2579, ticket 465): its rows and its query as
 * it lives in the URL. Pinned by `double-send-helpers.test.ts`.
 *
 * A double send is a transaction sent on BOTH rails. `X1` already reached SAP twice (SAP is asked
 * for a reversal); `X1p` has a legacy send and new-rail documents not exported yet, so it **can still
 * be stopped** — it is listed first and in red (spec 2579 story 26).
 *
 * 🚩 Read-only: the list shows them; stopping or reversing one is out of scope (resets, spec 2579).
 *
 * 🔑 The URL is the query's single source of truth, as on the fleet: its names ARE the door's
 * (`GET SapExport/DoubleSends?code=&flag=&page=`). No `flag` is the door's default, both.
 */
import type { DoubleSendRow } from '@/core/models/sap-export'
import { formatCount } from '@/core/util/bidi'
import { DOUBLE_SEND_FLAGS, type DoubleSendFlag } from './fleet-helpers'
import { figure } from './storeday-helpers'
import { refusalKey } from './toggle-and-refusal'

/** The door pages; the console asks for 50 a page (the contract's default). */
export const DOUBLE_SEND_PAGE_SIZE = 50

/** The flag filter's options, X1p first, as the list reads. */
export const DOUBLE_SEND_FLAG_OPTIONS: readonly DoubleSendFlag[] = ['X1p', 'X1']

export interface DoubleSendQuery {
  /** One flag, or `null` for both (the door's default). */
  flag: DoubleSendFlag | null
  /** A store code; trimmed, `''` = the whole fleet. */
  code: string
  page: number
}

export const DEFAULT_DOUBLE_SEND_QUERY: DoubleSendQuery = { flag: null, code: '', page: 1 }

const PAGE = /^\d+$/

/**
 * The query a URL describes. One known `flag` narrows the list; none, both, or an unknown one reads
 * as both, so a hand-edited link never provokes the door's `BAD_FILTER`.
 */
export function doubleSendQueryFromParams(params: URLSearchParams): DoubleSendQuery {
  const flags = DOUBLE_SEND_FLAGS.filter((f) => params.getAll('flag').includes(f))
  const page = params.get('page') ?? ''
  return {
    flag: flags.length === 1 ? flags[0] : null,
    code: (params.get('code') ?? '').trim(),
    page: PAGE.test(page) && Number(page) >= 1 ? Number(page) : 1,
  }
}

/** The query as its URL, in the door's order: `code`, `flag`, `page`; defaults absent. */
export function doubleSendQueryToParams(query: DoubleSendQuery): URLSearchParams {
  const qs = new URLSearchParams()
  const code = query.code.trim()
  if (code) qs.set('code', code)
  if (query.flag) qs.set('flag', query.flag)
  if (query.page > 1) qs.set('page', String(query.page))
  return qs
}

/** The `GET SapExport/DoubleSends` parameters. A blank code and a `null` flag are dropped by the query builder. */
export function doubleSendDoorParams(query: DoubleSendQuery): Record<string, unknown> {
  return {
    code: query.code.trim(),
    flag: query.flag,
    page: Math.max(1, query.page),
    pageSize: DOUBLE_SEND_PAGE_SIZE,
  }
}

/** A flag or store change, back on page 1. No change returns the SAME query. */
export function withDoubleSendFilter(query: DoubleSendQuery, change: Partial<Pick<DoubleSendQuery, 'flag' | 'code'>>): DoubleSendQuery {
  const next = { ...query, ...change }
  if (next.flag === query.flag && next.code.trim() === query.code.trim()) return query
  return { ...next, code: next.code.trim(), page: 1 }
}

/** Whether a filter narrows the list. */
export const isFilteredDoubleSends = (query: DoubleSendQuery): boolean => query.flag !== null || query.code.trim() !== ''

export interface DoubleSendView extends DoubleSendRow {
  /** `X1p`: the new-rail documents are not exported yet, so the second send can still be stopped. */
  stoppable: boolean
  /** The documents exported of the documents made, `n / m`, one plain string (isolated once). */
  exportedOf: string
}

/**
 * The rows as drawn: `X1p` first, then the door's own order (store, day, transaction) kept — the
 * door already sends them so, and this keeps a page that does not in the same order.
 */
export function doubleSendRows(items: readonly DoubleSendRow[]): DoubleSendView[] {
  const pending = items.filter((r) => r.flag === 'X1p')
  const rest = items.filter((r) => r.flag !== 'X1p')
  return [...pending, ...rest].map((r) => ({
    ...r,
    stoppable: r.flag === 'X1p',
    exportedOf: formatCount(figure(r.documentsExported), figure(r.documents)),
  }))
}

const REFUSALS = ['NO_STORE', 'BAD_FILTER', 'BAD_PAGING'] as const

/** A double-send refusal's own sentence key, or `null` to show the envelope's message. */
export function doubleSendErrorKey(code: string | null | undefined): string | null {
  return refusalKey('doubleSends', REFUSALS, code)
}
