/**
 * BackOffice ticket 4224 (spec 4212, stories 2, 3, 12) — the parked-returns list's filters, kept in the URL, and the query
 * they ask `GET RefundLedgerWeb/ParkedReturns` for (BackOffice 4218: `store, partner, ledgerStatus, minAgeDays, needsHq,
 * includeFinished, transactionId, page, pageSize`). The list opens on "needs HQ".
 */
import { describe, expect, it } from 'vitest'
import { changeFilter, filtersFromParams, filtersToParams, listQuery, NO_FILTERS, PAGE_SIZE } from './filter'

const from = (qs: string) => filtersFromParams(new URLSearchParams(qs))

describe('the default view is "needs HQ"', () => {
  it('an empty address reads as needs HQ, no filter, page 1', () => {
    expect(from('')).toEqual(NO_FILTERS)
    expect(NO_FILTERS).toEqual({ store: '', partner: '', ledgerStatus: '', minAgeDays: null, view: 'needsHq', transactionId: '', page: 1 })
  })

  it('asks the door for needs HQ only, finished left out', () => {
    expect(listQuery(NO_FILTERS)).toMatchObject({ needsHq: true, includeFinished: false })
  })

  it('the default is not written to the address', () => {
    expect(filtersToParams(NO_FILTERS).toString()).toBe('')
  })
})

describe('the three views', () => {
  it('open: every parked return still open — needs HQ off, finished still left out', () => {
    expect(listQuery({ ...NO_FILTERS, view: 'open' })).toMatchObject({ needsHq: false, includeFinished: false })
  })

  it('all: finished ones too (searchable, never the default)', () => {
    expect(listQuery({ ...NO_FILTERS, view: 'all' })).toMatchObject({ needsHq: false, includeFinished: true })
  })

  it('a view nobody agreed to falls back to needs HQ', () => {
    expect(from('view=everything').view).toBe('needsHq')
  })
})

describe('the URL read as filters', () => {
  it('every filter and the page, as written', () => {
    expect(from('store=P077&partner=TABBY&status=FAILED&age=3&view=open&transaction=T-1&page=2')).toEqual({
      store: 'P077',
      partner: 'TABBY',
      ledgerStatus: 'FAILED',
      minAgeDays: 3,
      view: 'open',
      transactionId: 'T-1',
      page: 2,
    })
  })

  it('a value nobody agreed to is dropped, not sent', () => {
    expect(from('status=LOST&age=-1&page=0')).toEqual(NO_FILTERS)
    expect(from('age=1.5').minAgeDays).toBeNull()
    expect(from('age=abc').minAgeDays).toBeNull()
  })

  it('a ledger status is read in any case; text is trimmed', () => {
    expect(from('status=refunded').ledgerStatus).toBe('REFUNDED')
    expect(from('store=%20P077%20&partner=%20TABBY%20&transaction=%20T-1%20')).toMatchObject({ store: 'P077', partner: 'TABBY', transactionId: 'T-1' })
  })

  it('written back and read again, they are the same filters', () => {
    const f = { store: 'P001', partner: 'TAMARA', ledgerStatus: 'PENDING', minAgeDays: 0, view: 'all', transactionId: 'X', page: 3 } as const
    expect(filtersFromParams(filtersToParams(f))).toEqual(f)
  })
})

describe('the query sent', () => {
  it(`every filter under the door's own names, the 1-based page and ${PAGE_SIZE} a page`, () => {
    expect(PAGE_SIZE).toBe(50)
    expect(listQuery({ store: 'P077', partner: 'TABBY', ledgerStatus: 'FAILED', minAgeDays: 3, view: 'needsHq', transactionId: 'T-1', page: 2 })).toStrictEqual({
      store: 'P077',
      partner: 'TABBY',
      ledgerStatus: 'FAILED',
      minAgeDays: 3,
      needsHq: true,
      includeFinished: false,
      transactionId: 'T-1',
      page: 2,
      pageSize: 50,
    })
  })

  it('a blank filter passes through blank (core buildQuery drops it)', () => {
    expect(listQuery(NO_FILTERS)).toStrictEqual({
      store: '',
      partner: '',
      ledgerStatus: '',
      minAgeDays: null,
      needsHq: true,
      includeFinished: false,
      transactionId: '',
      page: 1,
      pageSize: 50,
    })
  })
})

describe('changing a filter', () => {
  it('goes back to page 1 and keeps the others', () => {
    expect(changeFilter({ ...NO_FILTERS, partner: 'TABBY', page: 4 }, { view: 'all' })).toEqual({ ...NO_FILTERS, partner: 'TABBY', view: 'all', page: 1 })
  })
})
