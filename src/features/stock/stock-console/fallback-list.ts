/**
 * Inventory control's list of a store's expiry fallback takes (BackOffice 4277, spec 4275 "What head office sees",
 * ADR 0146) — pure, so what it asks and when is pinned by tests. `/stock/console/fallback`, a page of the stock console
 * behind its one grant (`StockConsole:03`).
 *
 * The list is by material, the pack's vendor batch and the batch the door chose, with takes and units, so the counted
 * stock can be moved to its own batch. It reads nothing until Read; a store, a first day, the last not before it, at most
 * 32 days (Stock Visibility's limit, both ends in) and no day after today are checked here, before anything is asked.
 * The address carries the store, the days and the Read, so a shared link reads the same list.
 */
import { addDays, windowDays, windowProblem, type LocalDate } from '@/core/util/date-window'
import { FALLBACK_PATH, type ConsolePage } from './console-pages'

/** SIS.Stock 086's most days in one read, both ends in. */
export const FALLBACK_MOST_DAYS = 32

/** The page's top link. */
export const FALLBACK_LIST_PAGE: ConsolePage = { to: FALLBACK_PATH, key: 'fallback' }

/** The grid's column ids, each with its header in both locales. */
export const FALLBACK_LIST_COLUMNS = [
  'item', 'name', 'vendorBatch', 'batch', 'expiryDate', 'takes', 'quantity', 'firstTakenAt', 'lastTakenAt',
] as const

/** The columns exported as text (codes Excel must not turn into numbers). */
export const FALLBACK_TEXT_COLUMNS = new Set(['item', 'vendorBatch', 'batch'])

/** Why the list was not read: no store, no first day, or a range Stock Visibility would refuse. */
export const FALLBACK_LIST_PROBLEMS = ['store', 'from', 'invalid', 'reversed', 'tooLong', 'outOfBounds'] as const
export type FallbackListProblem = (typeof FALLBACK_LIST_PROBLEMS)[number]

export interface FallbackListState {
  store: string
  /** `yyyy-MM-dd`, local; '' = not given. */
  from: string
  /** '' = the first day. */
  to: string
  /** Read was pressed: the list reads. */
  ran: boolean
}

export type FallbackListRead =
  | { kind: 'nothing' }
  | { kind: 'stopped'; problem: FallbackListProblem }
  | { kind: 'read'; store: string; from: LocalDate; to: LocalDate }

export function fallbackListFromParams(params: URLSearchParams): FallbackListState {
  return {
    store: (params.get('store') ?? '').trim().toUpperCase(),
    from: (params.get('from') ?? '').trim(),
    to: (params.get('to') ?? '').trim(),
    ran: params.get('ran') === '1',
  }
}

export function fallbackListToParams(state: FallbackListState): URLSearchParams {
  const qs = new URLSearchParams()
  if (state.store) qs.set('store', state.store)
  if (state.from) qs.set('from', state.from)
  if (state.to) qs.set('to', state.to)
  if (state.ran) qs.set('ran', '1')
  return qs
}

/** Whether the list reads, and what: never before Read; never a range the server would refuse. */
export function fallbackListRead(state: FallbackListState, today: LocalDate): FallbackListRead {
  if (!state.ran) return { kind: 'nothing' }
  const store = state.store.trim().toUpperCase()
  if (!store) return { kind: 'stopped', problem: 'store' }
  if (!state.from) return { kind: 'stopped', problem: 'from' }
  const to = state.to || state.from
  const problem = windowProblem(state.from, to, { maxDays: FALLBACK_MOST_DAYS, latest: today })
  return problem ? { kind: 'stopped', problem } : { kind: 'read', store, from: state.from, to }
}

/** The days the boxes start on: the last 7, today included. */
export const defaultFallbackDays = (today: LocalDate): { from: LocalDate; to: LocalDate } => ({
  from: addDays(today, -6),
  to: today,
})

/** The days read, for the file name and the heading: one day, or the range. */
export const fallbackDaysCount = (from: LocalDate, to: LocalDate): number => windowDays(from, to) ?? 0

/** The list opened on a store and its days, read. */
export const fallbackTakesHref = (store: string, from: LocalDate, to: LocalDate): string =>
  `${FALLBACK_PATH}?${fallbackListToParams({ store, from, to, ran: true }).toString()}`
