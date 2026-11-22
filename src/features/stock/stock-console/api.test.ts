/**
 * The stock console's reads (oms 940–945): what each answer normalises to, which failures are retried, and which page is
 * kept on screen while the next one reads. The wire is stubbed at `api.get`, the one door every read goes through.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlaceholderDataFunction } from '@tanstack/react-query'
import { ApiError, api } from '@/core/api'
import type { StockConsoleSapLines } from '@/core/models/stock-console'
import type { MovementsState, WindowRead } from './movements'
import { retryUnlessAnswered, sapLinesQuery, stockConsoleApi } from './api'

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

type LinesPage = StockConsoleSapLines
const kept: LinesPage = { readAt: '2026-11-22T10:00:00', day: '2026-11-22T00:00:00', movementType: '101', total: 30, page: 1, size: 25, lines: [] }

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

describe('each read asks SIS.Api’s route as it is built (BO 4158–4163) and answers what it sends', () => {
  const page = { total: 0, page: 1, size: 25, rows: [] }
  const search = { item: '1001', batch: '', filter: 'standing', page: 1, size: 25 }

  it('a store is read fresh: the answer carries the row under `store`', async () => {
    const answer = { readAt: '2026-11-22T10:00:00', reservedRun: { lastSuccessAt: null, lastNetting: null }, store: null }
    const get = vi.spyOn(api, 'get').mockResolvedValue(answer)
    expect(await stockConsoleApi.store('P 77')).toBe(answer)
    expect(get).toHaveBeenCalledWith('StockConsole/Stores/P%2077')
  })

  it('the Holds filter goes out as `state`, the Takes filter as `outcome` with its day', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(page)
    await stockConsoleApi.holds('P077', search)
    expect(get).toHaveBeenLastCalledWith('StockConsole/Stores/P077/Holds', { item: '1001', batch: '', state: 'standing', page: 1, size: 25 })
    await stockConsoleApi.takes('P077', { ...search, filter: 'refused', day: '2026-11-20' })
    expect(get).toHaveBeenLastCalledWith('StockConsole/Stores/P077/Takes', {
      item: '1001',
      batch: '',
      outcome: 'refused',
      day: '2026-11-20',
      page: 1,
      size: 25,
    })
  })

  it('an item’s holds are one list, not paged; its batches and takes ask the first 200', async () => {
    const holds = { open: 2, released: 1, total: 3, allShown: true, rows: [] }
    const get = vi.spyOn(api, 'get').mockResolvedValue(holds)
    expect(await stockConsoleApi.itemHolds('P077', '1001')).toBe(holds)
    expect(get).toHaveBeenLastCalledWith('StockConsole/Stores/P077/Items/1001/Holds')
    await stockConsoleApi.itemBatches('P077', '1001')
    expect(get).toHaveBeenLastCalledWith('StockConsole/Stores/P077/Items/1001/Batches', { page: 1, size: 200 })
    await stockConsoleApi.itemTakes('P077', '1001')
    expect(get).toHaveBeenLastCalledWith('StockConsole/Stores/P077/Items/1001/Takes', { page: 1, size: 200 })
  })

  it('a ledger window and a SAP row’s lines ask with their own names; the answers carry `lines`', async () => {
    const ledger = { store: 'P077', item: '1001', from: '2026-11-16T00:00:00', to: '2026-11-22T00:00:00', page: 1, size: 25, total: 0, lines: [] }
    const get = vi.spyOn(api, 'get').mockResolvedValue(ledger)
    expect(await stockConsoleApi.itemMovements('P077', '1001', { from: '2026-11-16', to: '2026-11-22', page: 1, size: 25 })).toBe(ledger)
    expect(get).toHaveBeenLastCalledWith('StockConsole/Stores/P077/Items/1001/Movements', {
      from: '2026-11-16',
      to: '2026-11-22',
      page: 1,
      size: 25,
    })
    await stockConsoleApi.sapLines('P077', { day: '2026-11-22', type: '101', page: 2, size: 25 })
    expect(get).toHaveBeenLastCalledWith('StockConsole/Stores/P077/SapMovements/Lines', { day: '2026-11-22', type: '101', page: 2, size: 25 })
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
