/**
 * Oms 922 — the case list's filters (store, period, signal, status, severity) and its page, kept in the URL, and the
 * query they ask `GET Insurance/Patterns/Cases` for. The server orders the rows (score, then the last dispense): the
 * query never names an order.
 */
import { describe, expect, it } from 'vitest'
import { casesQuery, changeFilter, filtersFromParams, filtersToParams, NO_FILTERS, PAGE_SIZE, periodBackwards } from './filter'

const from = (qs: string) => filtersFromParams(new URLSearchParams(qs))

describe('the URL read as filters', () => {
  it('an empty address is no filter, on page 1', () => {
    expect(from('')).toEqual(NO_FILTERS)
    expect(NO_FILTERS).toEqual({ store: '', from: '', to: '', signal: '', status: '', severity: '', page: 1 })
  })

  it('every filter and the page, as written', () => {
    expect(from('store=1001&from=2026-11-01&to=2026-11-19&signal=travel&status=confirmed&severity=action&page=3')).toEqual({
      store: '1001',
      from: '2026-11-01',
      to: '2026-11-19',
      signal: 'travel',
      status: 'confirmed',
      severity: 'action',
      page: 3,
    })
  })

  it('a value nobody agreed to is dropped, not sent', () => {
    expect(from('signal=teleport&status=reopened&severity=urgent&from=19-11-2026&to=2026-13-45x&page=abc')).toEqual(NO_FILTERS)
    expect(from('page=0').page).toBe(1)
    expect(from('page=-2').page).toBe(1)
    expect(from('page=2.5').page).toBe(1)
  })

  it('a store is trimmed', () => {
    expect(from('store=%201001%20').store).toBe('1001')
  })
})

describe('the filters written back to the URL', () => {
  it('only what is set; page 1 is not written', () => {
    expect(filtersToParams(NO_FILTERS).toString()).toBe('')
    expect(filtersToParams({ ...NO_FILTERS, signal: 'overlap', page: 1 }).toString()).toBe('signal=overlap')
    expect(filtersToParams({ ...NO_FILTERS, status: 'open', page: 4 }).toString()).toBe('status=open&page=4')
  })

  it('read again, they are the same filters', () => {
    const f = { store: '2040', from: '2026-11-01', to: '2026-11-19', signal: 'hopping', status: 'watching', severity: 'info', page: 2 } as const
    expect(filtersFromParams(filtersToParams(f))).toEqual(f)
  })
})

describe('the query sent', () => {
  it(`no filter: page 1 of ${PAGE_SIZE}, nothing else`, () => {
    expect(PAGE_SIZE).toBe(25)
    expect(casesQuery(NO_FILTERS)).toEqual({ skip: 0, take: 25 })
  })

  it('every filter under the door’s own names, and the page as skip/take', () => {
    expect(casesQuery({ store: '1001', from: '2026-11-01', to: '2026-11-19', signal: 'travel', status: 'open', severity: 'action', page: 3 })).toEqual({
      storeCode: '1001',
      from: '2026-11-01',
      to: '2026-11-19',
      signal: 'travel',
      status: 'open',
      severity: 'action',
      skip: 50,
      take: 25,
    })
  })

  it('one end of the period alone is sent alone', () => {
    expect(casesQuery({ ...NO_FILTERS, from: '2026-11-01' })).toEqual({ from: '2026-11-01', skip: 0, take: 25 })
    expect(casesQuery({ ...NO_FILTERS, to: '2026-11-19' })).toEqual({ to: '2026-11-19', skip: 0, take: 25 })
  })
})

describe('changing a filter', () => {
  it('goes back to page 1', () => {
    expect(changeFilter({ ...NO_FILTERS, page: 5 }, { status: 'open' })).toEqual({ ...NO_FILTERS, status: 'open', page: 1 })
  })

  it('keeps the other filters', () => {
    expect(changeFilter({ ...NO_FILTERS, signal: 'travel', page: 2 }, { store: '1001' })).toEqual({ ...NO_FILTERS, signal: 'travel', store: '1001', page: 1 })
  })
})

describe('a period that ends before it starts', () => {
  it('is backwards, and is not asked for', () => {
    expect(periodBackwards({ ...NO_FILTERS, from: '2026-11-19', to: '2026-11-01' })).toBe(true)
  })

  it('one day, either end alone, or none is not', () => {
    for (const f of [
      { ...NO_FILTERS, from: '2026-11-19', to: '2026-11-19' },
      { ...NO_FILTERS, from: '2026-11-19' },
      { ...NO_FILTERS, to: '2026-11-01' },
      NO_FILTERS,
    ])
      expect(periodBackwards(f)).toBe(false)
  })
})
