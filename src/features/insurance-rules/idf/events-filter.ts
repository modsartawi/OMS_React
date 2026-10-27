import { addDays, localToday, windowProblem, type LocalDate, type WindowProblem } from '@/core/util/date-window'
import { IDF_EVENT_FILTER_OUTCOMES, type IdfEventFilterOutcome } from './events'

// The IDF events address (ticket 626): `?from&to&store&payer&master&outcome&page`. Pure; the page reads it through
// `useUrlQuery(idfEventsFromParams, idfEventsToParams)`.
//
// 627: the swap report (`?tab=report`, `events` by default) shares the FILTER (`IdfEventsFilter`, `filterDoorParams`)
// — the window, store, payer and master — but not the outcome or the page.

export interface IdfEventsFilter {
  /** Local days, both ends counted. */
  from: LocalDate
  to: LocalDate
  /** A store code; '' = every store. */
  store: string
  /** A payer code; '' = every payer. */
  payer: string
  /** A master id from 619's list (`?master=`); '' = every master. */
  masterId: string
}

export interface IdfEventsQuery extends IdfEventsFilter {
  /** '' = every outcome. */
  outcome: IdfEventFilterOutcome | ''
  /** 1-based. */
  page: number
  /** 627 · which tab: the log (default) or the swap report (`?tab=report`). The filter is shared by both. */
  tab: IdfEventsTab
}

/** 627 · the page's tabs. */
export const IDF_EVENTS_TABS = ['events', 'report'] as const
export type IdfEventsTab = (typeof IDF_EVENTS_TABS)[number]

/** The default window: the last 7 local days to today. */
export const DEFAULT_WINDOW_DAYS = 7
/** The longest window a read may ask for. ⚠️ GUESSED cap (the brief names none; 3167 may set one). */
export const MAX_WINDOW_DAYS = 366

function defaults(today: LocalDate): IdfEventsQuery {
  return { from: addDays(today, -(DEFAULT_WINDOW_DAYS - 1)), to: today, store: '', payer: '', masterId: '', outcome: '', page: 1, tab: 'events' }
}

function readPage(value: string | null): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

export function readIdfEventsQuery(params: URLSearchParams, today: LocalDate): IdfEventsQuery {
  const d = defaults(today)
  const outcome = params.get('outcome') ?? ''
  return {
    from: params.get('from') || d.from,
    to: params.get('to') || d.to,
    store: params.get('store')?.trim() ?? '',
    payer: params.get('payer')?.trim() ?? '',
    masterId: params.get('master')?.trim() ?? '',
    outcome: (IDF_EVENT_FILTER_OUTCOMES as readonly string[]).includes(outcome) ? (outcome as IdfEventFilterOutcome) : '',
    page: readPage(params.get('page')),
    tab: (IDF_EVENTS_TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as IdfEventsTab) : d.tab,
  }
}

export function writeIdfEventsQuery(q: IdfEventsQuery, today: LocalDate): URLSearchParams {
  const d = defaults(today)
  const out = new URLSearchParams()
  const put = (key: string, value: string, fallback: string) => value && value !== fallback && out.set(key, value)
  put('from', q.from, d.from)
  put('to', q.to, d.to)
  put('store', q.store, d.store)
  put('payer', q.payer, d.payer)
  put('master', q.masterId, d.masterId)
  put('outcome', q.outcome, d.outcome)
  put('page', String(q.page), String(d.page))
  put('tab', q.tab, d.tab)
  return out
}

/** Stable, module-level readers for `useUrlQuery`. */
export const idfEventsFromParams = (p: URLSearchParams) => readIdfEventsQuery(p, localToday())
export const idfEventsToParams = (q: IdfEventsQuery) => writeIdfEventsQuery(q, localToday())

/** A filter change: any change of what is asked starts again at page 1. */
export function withFilter(q: IdfEventsQuery, patch: Partial<Omit<IdfEventsQuery, 'page'>>): IdfEventsQuery {
  return { ...q, ...patch, page: 1 }
}

/** Why the window may not be read, or null when it may. */
export function windowOf(q: Pick<IdfEventsFilter, 'from' | 'to'>): WindowProblem | null {
  return windowProblem(q.from, q.to, { maxDays: MAX_WINDOW_DAYS })
}

/** The shared filter's door params (626's log and 627's report): the window always, the rest only when filled. */
export function filterDoorParams(f: IdfEventsFilter): Record<string, string> {
  const out: Record<string, string> = { from: f.from, to: f.to }
  if (f.store) out.store = f.store
  if (f.payer) out.payer = f.payer
  if (f.masterId) out.masterId = f.masterId
  return out
}

/** `GET IdfPriority/events`'s params: the filter, the outcome when chosen, and the page. */
export function eventsDoorParams(q: IdfEventsQuery): Record<string, string> {
  const out = filterDoorParams(q)
  if (q.outcome) out.outcome = q.outcome
  out.page = String(q.page)
  return out
}
