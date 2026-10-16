/** The Stuck now census's URL state, door params and `since` ordering (ticket 498, brief 2691). */
import { describe, expect, it } from 'vitest'
import type { PickSupportCensusRow } from '@/core/models/pick-support'
import { censusFromParams, censusQuery, compareSince, pageFromParams, pageToParams, sortSince } from './census-view'

const row = (deliveryNo: string, since: string | null, shape = 'DONOR_AT_OLD_ORDER_STORE'): PickSupportCensusRow => ({
  deliveryNo,
  orderNo: '1000451111',
  currentStore: '1139',
  shape,
  since,
})

const params = (qs: string) => new URLSearchParams(qs)

describe('censusQuery', () => {
  it('sends both filters, trimmed', () => {
    expect(censusQuery({ store: ' 1139 ', shape: ' ENDED_STILL_HOLDS ' })).toEqual({ store: '1139', shape: 'ENDED_STILL_HOLDS' })
  })

  it('drops a blank filter from the call', () => {
    expect(censusQuery({ store: '  ', shape: '' })).toEqual({})
    expect(censusQuery({ store: '1139', shape: '' })).toEqual({ store: '1139' })
    expect(censusQuery({ store: '', shape: 'STORE_CHANGE_NOT_FOLLOWED' })).toEqual({ shape: 'STORE_CHANGE_NOT_FOLLOWED' })
  })

  it('"All" drops the shape, whatever its case', () => {
    expect(censusQuery({ store: '1139', shape: 'ALL' })).toEqual({ store: '1139' })
    expect(censusQuery({ store: '', shape: 'all' })).toEqual({})
  })

  it('passes an unlisted shape through, for the server to refuse PICK-00003', () => {
    expect(censusQuery({ store: '', shape: 'NOT_A_SHAPE' })).toEqual({ shape: 'NOT_A_SHAPE' })
  })

  it('reads the filters from the URL', () => {
    expect(censusQuery(censusFromParams(params('store=%201139&shape=ENDED_STILL_HOLDS')))).toEqual({
      store: '1139',
      shape: 'ENDED_STILL_HOLDS',
    })
    expect(censusQuery(censusFromParams(params('')))).toEqual({})
  })
})

describe('the page URL state', () => {
  it('Search is the default tab and writes no tab param', () => {
    const q = pageFromParams(params('key=8006777365'))
    expect(q.tab).toBe('search')
    expect(pageToParams(q).toString()).toBe('key=8006777365')
  })

  it('Stuck now and its filters round-trip, beside the search key', () => {
    const q = pageFromParams(params('tab=stuck&store=1139&shape=ENDED_STILL_HOLDS&key=8006777365'))
    expect(q).toEqual({ tab: 'stuck', key: '8006777365', delivery: '', store: '1139', shape: 'ENDED_STILL_HOLDS' })
    expect(pageFromParams(pageToParams(q))).toEqual(q)
  })

  it('drops blank filters and "All" from the URL', () => {
    expect(pageToParams({ tab: 'stuck', key: '', delivery: '', store: ' ', shape: 'ALL' }).toString()).toBe('tab=stuck')
  })

  it('an unknown tab reads as Search', () => {
    expect(pageFromParams(params('tab=other')).tab).toBe('search')
  })

  it('keeps the search tab’s own reading (a delivery needs its key)', () => {
    expect(pageToParams({ tab: 'search', key: '', delivery: '8006777365', store: '', shape: '' }).toString()).toBe('')
  })
})

describe('sortSince', () => {
  it('keeps the server’s order', () => {
    const rows = [row('8006766074', '2026-10-02T14:03:11'), row('8006766074', '2026-10-02T14:03:11', 'ENDED_STILL_HOLDS'), row('8006700001', '2026-10-03T08:00:00')]
    expect(sortSince(rows)).toEqual(rows)
  })

  it('puts a null since last, keeping the order on both sides', () => {
    const a = row('A', null)
    const b = row('B', '2026-10-02T14:03:11')
    const c = row('C', null)
    const d = row('D', '2026-10-03T08:00:00')
    expect(sortSince([a, b, c, d]).map((r) => r.deliveryNo)).toEqual(['B', 'D', 'A', 'C'])
  })

  it('a since that reads as the dash (blank, the floor) also goes last', () => {
    const rows = [row('A', '0001-01-01T00:00:00'), row('B', ''), row('C', '2026-10-02T14:03:11')]
    expect(sortSince(rows).map((r) => r.deliveryNo)).toEqual(['C', 'A', 'B'])
  })

  it('does not change the list it was given', () => {
    const rows = [row('A', null), row('B', '2026-10-02T14:03:11')]
    sortSince(rows)
    expect(rows.map((r) => r.deliveryNo)).toEqual(['A', 'B'])
  })
})

describe('compareSince (a header sort)', () => {
  it('orders written stamps as sent, oldest first', () => {
    expect(compareSince('2026-10-02T14:03:11', '2026-10-03T08:00:00', false)).toBeLessThan(0)
    expect(compareSince('2026-10-03T08:00:00', '2026-10-02T14:03:11', false)).toBeGreaterThan(0)
    expect(compareSince('2026-10-02T14:03:11', '2026-10-02T14:03:11', false)).toBe(0)
  })

  it('keeps a null since last in either direction', () => {
    // AG Grid reverses the comparator's answer when descending, so "last" flips its sign there.
    expect(compareSince(null, '2026-10-02T14:03:11', false)).toBeGreaterThan(0)
    expect(compareSince(null, '2026-10-02T14:03:11', true)).toBeLessThan(0)
    expect(compareSince('2026-10-02T14:03:11', '0001-01-01T00:00:00', false)).toBeLessThan(0)
    expect(compareSince('2026-10-02T14:03:11', '0001-01-01T00:00:00', true)).toBeGreaterThan(0)
    expect(compareSince(null, null, true)).toBe(0)
  })
})
