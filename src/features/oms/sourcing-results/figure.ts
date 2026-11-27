/**
 * The figure an underlined number stands for, and how the orders door is asked for it (ticket 971, results ticket
 * decision 5: "every underlined figure opens one"). BO 4393's `Results/Orders` takes the filter bar, the figure's own
 * query names (`segment`; `view` + `class` + `ending`; `outside` + `outsideStep`; `by` + `key`; `hour`) and paging
 * (`page`, `pageSize`, `sort`, `desc`). A mark has no figure name of its own: it opens through the filter's `mark`.
 *
 * Pure.
 */
import type { ResultsFigure, ResultsFigureParams, ResultsOrderSort, ResultsQuery } from '@/core/models/sourcing-results'

export interface ResultsPaging {
  page: number
  pageSize: number
  sort: ResultsOrderSort
  desc: boolean
}

export type ResultsOrdersRequest = ResultsQuery & ResultsFigureParams & ResultsPaging

function figureParams(f: ResultsFigure): { query?: Partial<ResultsQuery>; params: ResultsFigureParams } {
  switch (f.kind) {
    case 'segment':
      return { params: { segment: f.segment } }
    case 'class':
      return { params: { view: f.view, class: f.cls, ...(f.ending ? { ending: f.ending } : {}) } }
    case 'outside':
      return { params: { outside: f.code, ...(f.step ? { outsideStep: f.step } : {}) } }
    case 'breakdown':
      return { params: { by: f.by, key: f.key } }
    case 'laterSlot':
      return { params: { hour: f.hour } }
    case 'mark':
      return { query: { mark: f.mark }, params: {} }
  }
}

/** The orders door's query for a figure, under the page's filters. */
export function ordersRequest(query: ResultsQuery, figure: ResultsFigure, paging: ResultsPaging): ResultsOrdersRequest {
  const { query: over, params } = figureParams(figure)
  return { ...query, ...over, ...params, ...paging }
}

/** A key naming the figure, for the drawer's `data-*` and the query cache. */
export function figureKey(f: ResultsFigure): string {
  switch (f.kind) {
    case 'segment':
      return `segment:${f.segment}`
    case 'class':
      return `class:${f.view}:${f.cls}${f.ending ? `:${f.ending}` : ''}`
    case 'outside':
      return `outside:${f.code}|${f.step}`
    case 'breakdown':
      return `breakdown:${f.by}:${f.key}`
    case 'laterSlot':
      return `laterSlot:${f.hour}`
    case 'mark':
      return `mark:${f.mark}`
  }
}
