/**
 * Ticket 556 — the HungerStation orders monitor's search lives in the URL, its date window (date
 * only, both days included, at most 31 days, not before 2000-01-01, not after tomorrow) is refused
 * before any call, and `outcome` is a repeated key.
 */
import { describe, expect, it } from 'vitest'
import type { HungerStationOrdersQuery } from '@/core/models/hungerstation'
import { ORDERS_PAGE_SIZE, ORDER_OUTCOME_FILTERS, ordersFromParams, ordersToParams, ordersWindowProblem } from './orders-query'

const TODAY = '2026-10-24'

const query = (over: Partial<HungerStationOrdersQuery> = {}): HungerStationOrdersQuery => ({
  from: TODAY,
  to: TODAY,
  store: null,
  chain: null,
  outcome: [],
  q: null,
  skip: 0,
  take: ORDERS_PAGE_SIZE,
  ...over,
})

describe('the outcome filter', () => {
  it('offers the four outcomes then the two facts beside them, as the contract names them', () => {
    expect(ORDER_OUTCOME_FILTERS).toEqual(['created', 'cancelled', 'failed', 'pending', 'replacedLines', 'unmatched'])
  })
})

describe('ordersFromParams ⇄ ordersToParams', () => {
  it('an empty URL is today..today, the page size the contract’s default', () => {
    expect(ordersFromParams(new URLSearchParams(), TODAY)).toEqual(query())
    expect(ORDERS_PAGE_SIZE).toBe(100)
  })

  it('from and to are ALWAYS written; take never; skip only past the first page', () => {
    expect(ordersToParams(query()).toString()).toBe('from=2026-10-24&to=2026-10-24')
  })

  it('round-trips every filter: store, chain, repeated outcome keys, text, skip', () => {
    const full = query({ from: '2026-10-01', store: '1234', chain: 'OlaCare', outcome: ['failed', 'unmatched'], q: 'HS-77', skip: 100 })
    const params = ordersToParams(full)
    expect(params.toString()).toBe('from=2026-10-01&to=2026-10-24&store=1234&chain=OlaCare&outcome=failed&outcome=unmatched&q=HS-77&skip=100')
    expect(ordersFromParams(params, TODAY)).toEqual(full)
  })

  it('a pasted URL: blanks, repeats and outcomes the contract does not name are dropped', () => {
    const read = ordersFromParams(new URLSearchParams('outcome=failed&outcome=failed&outcome=refused&outcome=&chain=%20&q=%20x%20&skip=-3'), TODAY)
    expect(read).toEqual(query({ outcome: ['failed'], q: 'x' }))
  })

  it('a cleared date stays empty (refused as invalid) — only a MISSING key is today', () => {
    const read = ordersFromParams(new URLSearchParams('from=&to=2026-10-24'), TODAY)
    expect(read.from).toBe('')
    expect(ordersWindowProblem(read, TODAY)).toBe('invalid')
  })
})

describe('the window', () => {
  const win = (from: string, to: string) => ordersWindowProblem(query({ from, to }), TODAY)

  it('31 days (inclusive) pass, 32 are too long', () => {
    expect(win('2026-09-24', '2026-10-24')).toBeNull()
    expect(win('2026-09-23', '2026-10-24')).toBe('tooLong')
  })

  it('reversed', () => {
    expect(win('2026-10-24', '2026-10-23')).toBe('reversed')
  })

  it('🚩 tomorrow is the latest day allowed — the day after is out of bounds', () => {
    expect(win('2026-10-25', '2026-10-25')).toBeNull()
    expect(win('2026-10-25', '2026-10-26')).toBe('outOfBounds')
  })

  it('2000-01-01 is the earliest day allowed', () => {
    expect(win('2000-01-01', '2000-01-01')).toBeNull()
    expect(win('1999-12-31', '2000-01-01')).toBe('outOfBounds')
  })
})
