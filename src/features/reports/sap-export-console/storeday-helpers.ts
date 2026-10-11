/**
 * The store-day page's pure logic (BackOffice spec 2579, ticket 461), pinned by
 * `storeday-helpers.test.ts`.
 *
 * 🚩 The door classifies and orders; nothing here re-sorts a row or derives a label.
 */
import { STATE_CODES, type Label, type StateCode } from '@/core/models/sap-export'
import { WORST_FIRST } from './label-helpers'

/** The door pages; the console asks for 50 a page (the contract's default). */
export const STORE_DAY_PAGE_SIZE = 50

/** What the store-day grid is asked for, beside the store and the day in the URL. */
export interface StoreDayFilter {
  /** Sent as a REPEATED `label` (the door ORs them). Empty = every row not exported or by design. */
  labels: Label[]
  /** Sent as a REPEATED `state` (OR within, AND with `label`). */
  states: StateCode[]
  page: number
}

export const DEFAULT_STORE_DAY_FILTER: StoreDayFilter = { labels: [], states: [], page: 1 }

/**
 * The `GET SapExport/StoreDay` parameters. `label` and `state` are arrays, which
 * `@/core/api`'s query builder sends as repeated keys (an empty one sends nothing).
 */
export function storeDayParams(code: string, day: string, filter: StoreDayFilter): Record<string, unknown> {
  return {
    code,
    day,
    label: filter.labels,
    state: filter.states,
    page: Math.max(1, filter.page),
    pageSize: STORE_DAY_PAGE_SIZE,
  }
}

/**
 * A label chip clicked: the label in or out, kept worst first so the query string is the same
 * however the chips were clicked, back on page 1. An unknown value changes nothing, so the
 * console never provokes the door's `BAD_FILTER`.
 */
export function toggleLabel(filter: StoreDayFilter, label: string): StoreDayFilter {
  if (!(WORST_FIRST as readonly string[]).includes(label)) return filter
  const on = (filter.labels as string[]).includes(label)
  const labels = WORST_FIRST.filter((l) => (l === label ? !on : filter.labels.includes(l)))
  return { ...filter, labels, page: 1 }
}

/** A legend entry clicked: the state in or out, in the contract's order, back on page 1. */
export function toggleState(filter: StoreDayFilter, state: string): StoreDayFilter {
  if (!(STATE_CODES as readonly string[]).includes(state)) return filter
  const on = (filter.states as string[]).includes(state)
  const states = STATE_CODES.filter((s) => (s === state ? !on : filter.states.includes(s)))
  return { ...filter, states, page: 1 }
}

/** The store page (464). */
export const storeHref = (code: string): string => `/reports/sap-export/store/${encodeURIComponent(code)}`

/** One store-day's page (the strip's cells, 464). */
export const storeDayHref = (code: string, day: string): string => `${storeHref(code)}/day/${encodeURIComponent(day)}`

/**
 * A transaction's way into the IDoc inspector. A URL only — a feature never imports another
 * feature. 462 makes the inspector open straight on it; before that it simply opens the inspector.
 */
export function inspectorHref(code: string, trxNumber: string): string {
  return `/reports/idoc-inspector?${new URLSearchParams({ store: code, trx: trxNumber }).toString()}`
}

const HOURS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

/** Hours past the day's end as drawn: grouped, one decimal at most; `null` is blank. */
export const formatHours = (hours: number | null): string => (hours == null ? '' : HOURS.format(hours))

/** A whole count as drawn, `12,345`. */
export const figure = (n: number): string => n.toLocaleString('en-US')

const REFUSALS = ['NO_STORE', 'BAD_DAY', 'DAY_OUT_OF_WINDOW', 'BAD_FILTER', 'BAD_PAGING'] as const

/** A store-day refusal's own sentence key, or `null` to show the envelope's message. */
export function storeDayErrorKey(code: string | null | undefined): string | null {
  return code && (REFUSALS as readonly string[]).includes(code) ? `storeDay.errors.${code}` : null
}
