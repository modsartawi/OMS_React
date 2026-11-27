import { describe, expect, it } from 'vitest'
import type { ResultsQuery } from '@/core/models/sourcing-results'
import { figureKey, ordersRequest } from './figure'

// `GET SourcingAdvisor/Results/Orders` takes the filter bar, the figure's own query names (BO 4393 `ResultsFigure`),
// and `page`, `pageSize`, `sort`, `desc`.
const query: ResultsQuery = { period: 'DAYS_14', channelGroup: 'ALL' }
const paging = { page: 2, pageSize: 25, sort: 'ESTIMATE' as const, desc: true }

describe('the orders door for a figure', () => {
  it('asks a bar segment by `segment`', () => {
    expect(ordersRequest(query, { kind: 'segment', segment: 'ANOTHER_STORE' }, paging)).toEqual({
      period: 'DAYS_14',
      channelGroup: 'ALL',
      segment: 'ANOTHER_STORE',
      page: 2,
      pageSize: 25,
      sort: 'ESTIMATE',
      desc: true,
    })
  })

  it('asks a row of "where the plans differ" by `view` and `class`, and an ending by `ending`', () => {
    expect(ordersRequest(query, { kind: 'class', view: 'STORES_ONLY', cls: 'CALLOUT_FALLBACK', ending: 'LATE' }, paging)).toMatchObject({
      view: 'STORES_ONLY',
      class: 'CALLOUT_FALLBACK',
      ending: 'LATE',
    })
  })

  it('asks an outside reason by `outside` and its step by `outsideStep`, an empty step left out', () => {
    expect(ordersRequest(query, { kind: 'outside', code: 'PIN_PAIR_REMOVED', step: 'OUT_OF_REACH' }, paging)).toMatchObject({
      outside: 'PIN_PAIR_REMOVED',
      outsideStep: 'OUT_OF_REACH',
    })
    expect(ordersRequest(query, { kind: 'outside', code: 'PIN_NO_STOCK', step: '' }, paging)).not.toHaveProperty('outsideStep')
  })

  it('asks a breakdown row by `by` and `key`, and a later-slot hour by `hour`', () => {
    expect(ordersRequest(query, { kind: 'breakdown', by: 'CITY', key: 'Riyadh' }, paging)).toMatchObject({ by: 'CITY', key: 'Riyadh' })
    expect(ordersRequest(query, { kind: 'laterSlot', hour: 0 }, paging)).toMatchObject({ hour: 0 })
  })

  it('asks a mark through the filter\'s own `mark`, over the one the page holds', () => {
    const r = ordersRequest({ ...query, mark: 'AS_IT_STANDS' }, { kind: 'mark', mark: 'SHORT_FIGURE' }, paging)
    expect(r.mark).toBe('SHORT_FIGURE')
  })

  it('gives each figure a key of its own for the drawer and the cache', () => {
    expect(figureKey({ kind: 'class', view: 'WHOLE_PLAN', cls: 'ANOTHER_MODE' })).toBe('class:WHOLE_PLAN:ANOTHER_MODE')
    expect(figureKey({ kind: 'outside', code: 'PIN_NO_STOCK', step: '' })).toBe('outside:PIN_NO_STOCK|')
    expect(figureKey({ kind: 'breakdown', by: 'DAY', key: '2026-11-20' })).toBe('breakdown:DAY:2026-11-20')
  })
})
