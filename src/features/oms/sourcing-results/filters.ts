/**
 * The results page's filters, kept in the URL (ticket 971, spec 4354 §17, results ticket decision 7 and its amendments):
 * the period, the channel group, the candidate set by name and version, "Set beside it", a line the stock figure could
 * not cover, the run's marks. The view of "Where the plans differ" and the open tab ride along, so a link reopens the
 * page as it was read.
 *
 * Pure: `filtersFromParams` / `filtersToParams` are the page's reading of its URL, `resultsQuery` the door's query.
 */
import {
  RESULTS_CHANNEL_GROUPS,
  RESULTS_PERIODS,
  RESULTS_RUN_MARKS,
  RESULTS_VIEWS,
  type ResultsChannelGroup,
  type ResultsPeriod,
  type ResultsQuery,
  type ResultsRunMark,
  type ResultsView,
  type ResultsWeightSet,
} from '@/core/models/sourcing-results'
import { RESULTS_TABS, type ResultsTab } from './tabs'

/** A weight set picked by name and version; null = the period's candidate set (or no set beside it). */
export type SetPick = { name: string; version: number } | null

export interface ResultsFilters {
  period: ResultsPeriod
  channelGroup: ResultsChannelGroup
  set: SetPick
  beside: SetPick
  stockShortLine: boolean
  marks: ResultsRunMark[]
  view: ResultsView
  tab: ResultsTab
}

export const DEFAULT_FILTERS: ResultsFilters = {
  period: 14,
  channelGroup: 'ALL',
  set: null,
  beside: null,
  stockShortLine: false,
  marks: [],
  view: 'WHOLE_PLAN',
  tab: RESULTS_TABS[0],
}

/** `name@version`, the last `@` splitting, so a name holding one still reads. */
export const setKey = (s: SetPick | ResultsWeightSet): string => (s ? `${s.name}@${s.version}` : '')
export function setFromKey(key: string | null): SetPick {
  if (!key) return null
  const at = key.lastIndexOf('@')
  const version = Number(key.slice(at + 1))
  if (at <= 0 || !Number.isInteger(version) || version < 1) return null
  return { name: key.slice(0, at), version }
}

const oneOf = <T>(list: readonly T[], value: unknown, fallback: T): T => (list.includes(value as T) ? (value as T) : fallback)

export function filtersFromParams(p: URLSearchParams): ResultsFilters {
  const marks = (p.get('marks') ?? '').split(',').filter((m): m is ResultsRunMark => RESULTS_RUN_MARKS.includes(m as ResultsRunMark))
  return {
    period: oneOf(RESULTS_PERIODS, Number(p.get('period')), DEFAULT_FILTERS.period),
    channelGroup: oneOf(RESULTS_CHANNEL_GROUPS, p.get('channel'), DEFAULT_FILTERS.channelGroup),
    set: setFromKey(p.get('set')),
    beside: setFromKey(p.get('beside')),
    stockShortLine: p.get('short') === '1',
    marks: RESULTS_RUN_MARKS.filter((m) => marks.includes(m)),
    view: oneOf(RESULTS_VIEWS, p.get('view'), DEFAULT_FILTERS.view),
    tab: oneOf(RESULTS_TABS, p.get('tab'), DEFAULT_FILTERS.tab),
  }
}

export function filtersToParams(f: ResultsFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.period !== DEFAULT_FILTERS.period) p.set('period', String(f.period))
  if (f.channelGroup !== DEFAULT_FILTERS.channelGroup) p.set('channel', f.channelGroup)
  if (f.set) p.set('set', setKey(f.set))
  if (f.beside) p.set('beside', setKey(f.beside))
  if (f.stockShortLine) p.set('short', '1')
  if (f.marks.length > 0) p.set('marks', f.marks.join(','))
  if (f.view !== DEFAULT_FILTERS.view) p.set('view', f.view)
  if (f.tab !== DEFAULT_FILTERS.tab) p.set('tab', f.tab)
  return p
}

/** The query every results door takes. PROVISIONAL (spec 4354: not specified) — the query names (`ResultsQuery`). */
export function resultsQuery(f: ResultsFilters): ResultsQuery {
  return {
    period: f.period,
    channelGroup: f.channelGroup,
    weightSet: f.set?.name,
    weightSetVersion: f.set?.version,
    besideSet: f.beside?.name,
    besideSetVersion: f.beside?.version,
    stockShortLine: f.stockShortLine || undefined,
    marks: f.marks.length > 0 ? f.marks.join(',') : undefined,
  }
}
