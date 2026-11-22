/**
 * The stock console's reads (oms 940–945): what each answer normalises to, which failures are retried, and which page is
 * kept on screen while the next one reads. The wire is stubbed at `api.get`, the one door every read goes through.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlaceholderDataFunction } from '@tanstack/react-query'
import { ApiError, api } from '@/core/api'
import type { StockConsolePage, StockConsoleSapLine } from '@/core/models/stock-console'
import type { MovementsState, WindowRead } from './movements'
import { retryUnlessAnswered, sapLinesQuery, stockConsoleApi, toPage } from './api'

afterEach(() => vi.restoreAllMocks())

const READ: WindowRead = { kind: 'read', from: '2026-11-21', to: '2026-11-22' }
const lines = (over: Partial<MovementsState> = {}): MovementsState => ({
  from: '2026-11-21',
  to: '2026-11-22',
  ran: true,
  page: 1,
  sapDay: '2026-11-22',
  sapType: '101',
  ...over,
})

type LinesPage = StockConsolePage<StockConsoleSapLine>
const kept: LinesPage = { total: 30, page: 1, size: 25, rows: [] }

/** Ask a query's `placeholderData` what it keeps, given the query that answered last. */
function keeps(options: { placeholderData?: unknown }, previousKey: readonly unknown[]): LinesPage | undefined {
  const keep = options.placeholderData as PlaceholderDataFunction<LinesPage, Error, LinesPage, readonly unknown[]>
  return keep(kept, { queryKey: previousKey } as never)
}

describe('an opened SAP row’s lines, a page at a time', () => {
  it('keep the last page on screen while the next page of the same row reads', () => {
    const page1 = sapLinesQuery('P077', READ, lines())
    const page2 = sapLinesQuery('P077', READ, lines({ page: 2 }))
    expect(keeps(page2, page1.queryKey)).toBe(kept)
  })

  it('show their loading line for another row — never the other row’s lines', () => {
    const other = sapLinesQuery('P077', READ, lines({ sapType: '601' }))
    const otherDay = sapLinesQuery('P077', READ, lines({ sapDay: '2026-11-21' }))
    const asked = sapLinesQuery('P077', READ, lines({ page: 2 }))
    expect(keeps(asked, other.queryKey)).toBeUndefined()
    expect(keeps(asked, otherDay.queryKey)).toBeUndefined()
  })
})

describe('a page as drawn', () => {
  it('without a total counts its rows — never "nothing found" over rows', () => {
    expect(toPage({ rows: ['a', 'b'] }, { page: 1, size: 25 })).toEqual({ total: 2, page: 1, size: 25, rows: ['a', 'b'] })
  })

  it('reads its rows as `lines` (SV 079 as built), or a bare array as one page of it, each row read by the caller', () => {
    expect(toPage({ total: 9, lines: [1, 2] }, { page: 2, size: 2 }, (n: number) => n * 10)).toEqual({
      total: 9,
      page: 2,
      size: 2,
      rows: [10, 20],
    })
    expect(toPage(['a', 'b', 'c'], { page: 1, size: 200 })).toEqual({ total: 3, page: 1, size: 3, rows: ['a', 'b', 'c'] })
  })

  it('with nothing in it is empty, on the page asked', () => {
    expect(toPage(null, { page: 3, size: 25 })).toEqual({ total: 0, page: 3, size: 25, rows: [] })
  })
})

describe('a failed read is retried', () => {
  const failure = (kind: 'auth' | 'business' | 'server' | 'network' | 'unknown', status = 500) =>
    new ApiError(kind, 'x', status)

  it('once, for an outage: the network or the server', () => {
    expect(retryUnlessAnswered(0, failure('network', 0))).toBe(true)
    expect(retryUnlessAnswered(0, failure('server'))).toBe(true)
    expect(retryUnlessAnswered(1, failure('server'))).toBe(false)
  })

  it('never for an answer: a coded refusal, a bare 403, a signed-out session, or what we cannot read', () => {
    expect(retryUnlessAnswered(0, failure('business', 409))).toBe(false)
    expect(retryUnlessAnswered(0, failure('unknown', 403))).toBe(false)
    expect(retryUnlessAnswered(0, failure('auth', 401))).toBe(false)
    expect(retryUnlessAnswered(0, new Error('boom'))).toBe(false)
  })
})

describe('Feeds and switches as read', () => {
  it('a feed’s age or the reader’s lag left out reads as no answer (null), never as "just now"', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      readAt: '2026-11-22T10:00:00',
      feeds: [{ feed: 'Sap', lastCompletePassAt: '2026-11-22T09:58:00' }],
      ledgerReader: { lastPassAt: '2026-11-22T09:59:30', readThroughAt: null },
    })
    const fleet = await stockConsoleApi.fleet()
    expect(fleet.feeds).toEqual([{ feed: 'Sap', lastCompletePassAt: '2026-11-22T09:58:00', ageSeconds: null }])
    expect(fleet.ledgerReader).toEqual({ lastPassAt: '2026-11-22T09:59:30', lagSeconds: null, readThroughAt: null })
  })
})
