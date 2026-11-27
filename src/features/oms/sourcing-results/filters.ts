/**
 * The results page's filters, kept in the URL (ticket 971, spec 4354 §17, results ticket decision 7 and its amendments):
 * the period, the channel group, the candidate set by name and version, "Set beside it", a line the stock figure could
 * not cover, one of the run's marks. The view of "Where the plans differ" and the open tab ride along, so a link reopens
 * the page as it was read.
 *
 * "Set beside it" is two finished trials over the same period (BO 4394 `Trials/Beside`): the candidate set's trial
 * (`against`) and the tried set's (`beside`), by their ids.
 *
 * Pure: `filtersFromParams` / `filtersToParams` are the page's reading of its URL, `resultsQuery` the doors' query.
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
} from '@/core/models/sourcing-results'
import { RESULTS_TABS, type ResultsTab } from './tabs'

/** A weight set picked by name and version; null = every set the period's orders ran on. */
export type SetPick = { name: string; version: number } | null

/** The two trials read side by side: the candidate set's and the set beside it. */
export type BesidePick = { against: string; beside: string } | null

export interface ResultsFilters {
  period: ResultsPeriod
  channelGroup: ResultsChannelGroup
  set: SetPick
  beside: BesidePick
  shortFigure: boolean
  runMark: ResultsRunMark | null
  view: ResultsView
  tab: ResultsTab
}

export const DEFAULT_FILTERS: ResultsFilters = {
  period: 'DAYS_14',
  channelGroup: 'ALL',
  set: null,
  beside: null,
  shortFigure: false,
  runMark: null,
  view: 'WHOLE_PLAN',
  tab: RESULTS_TABS[0],
}

/** `name@version`, the last `@` splitting, so a name holding one still reads. */
export const setKey = (s: SetPick): string => (s ? `${s.name}@${s.version}` : '')
export function setFromKey(key: string | null): SetPick {
  if (!key) return null
  const at = key.lastIndexOf('@')
  const version = Number(key.slice(at + 1))
  if (at <= 0 || !Number.isInteger(version) || version < 1) return null
  return { name: key.slice(0, at), version }
}

const oneOf = <T>(list: readonly T[], value: unknown, fallback: T): T => (list.includes(value as T) ? (value as T) : fallback)

export function filtersFromParams(p: URLSearchParams): ResultsFilters {
  const against = p.get('against')
  const beside = p.get('beside')
  return {
    period: oneOf(RESULTS_PERIODS, p.get('period'), DEFAULT_FILTERS.period),
    channelGroup: oneOf(RESULTS_CHANNEL_GROUPS, p.get('channel'), DEFAULT_FILTERS.channelGroup),
    set: setFromKey(p.get('set')),
    beside: against && beside ? { against, beside } : null,
    shortFigure: p.get('short') === '1',
    runMark: oneOf<ResultsRunMark | null>(RESULTS_RUN_MARKS, p.get('runMark'), null),
    view: oneOf(RESULTS_VIEWS, p.get('view'), DEFAULT_FILTERS.view),
    tab: oneOf(RESULTS_TABS, p.get('tab'), DEFAULT_FILTERS.tab),
  }
}

export function filtersToParams(f: ResultsFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.period !== DEFAULT_FILTERS.period) p.set('period', f.period)
  if (f.channelGroup !== DEFAULT_FILTERS.channelGroup) p.set('channel', f.channelGroup)
  if (f.set) p.set('set', setKey(f.set))
  if (f.beside) {
    p.set('against', f.beside.against)
    p.set('beside', f.beside.beside)
  }
  if (f.shortFigure) p.set('short', '1')
  if (f.runMark) p.set('runMark', f.runMark)
  if (f.view !== DEFAULT_FILTERS.view) p.set('view', f.view)
  if (f.tab !== DEFAULT_FILTERS.tab) p.set('tab', f.tab)
  return p
}

/** The query every results door takes (BO 4393 `ResultsQuery`); a blank value is dropped by `@/core/api`. */
export function resultsQuery(f: ResultsFilters): ResultsQuery {
  return {
    period: f.period,
    channelGroup: f.channelGroup,
    set: f.set?.name,
    version: f.set?.version,
    shortFigure: f.shortFigure || undefined,
    runMark: f.runMark ?? undefined,
  }
}
