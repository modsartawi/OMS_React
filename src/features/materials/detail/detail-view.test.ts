/**
 * Ticket 452 — the detail's tabs, its Stock tab and its simulator link (spec 2544 stories 19–22).
 *
 * 🚩 The Stock tab needs BOTH the search and the stock grant; without `canCheckStock` it shows a
 * "not permitted" note and NO request is made. That is proven here against a real TanStack Query
 * observer with the stock door spied, not only by reading a flag.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { materialStockApi, materialStockQuery } from '@/core/materials/stock'
import type { MaterialAccessResult, MaterialStockCell } from '@/core/models/materials'
import { detailStockRequest, detailStockRows, detailTabs, resolveDetailTab, simulatorHref, stockTabVisible } from './detail-view'

const grants = (search: boolean, stock: boolean): MaterialAccessResult => ({ canSearchMaterials: search, canCheckStock: stock, canCheckGs1: false })

describe('stockTabVisible', () => {
  it('needs both the search and the stock grant', () => {
    expect(stockTabVisible(grants(true, true))).toBe(true)
    expect(stockTabVisible(grants(true, false))).toBe(false)
    expect(stockTabVisible(grants(false, true))).toBe(false)
    expect(stockTabVisible(undefined)).toBe(false)
  })
})

describe('detailStockRequest', () => {
  it('asks for this ONE material at every store (stores: null), closed stores left out', () => {
    expect(JSON.stringify(detailStockRequest('0101234', grants(true, true), false))).toBe(
      '{"materials":["0101234"],"stores":null,"includeZero":false,"includeClosed":false}',
    )
  })

  it('the "show zero stores" toggle sets includeZero', () => {
    expect(detailStockRequest('101234', grants(true, true), true)?.includeZero).toBe(true)
  })

  it('is null without the stock grant — there is nothing to ask', () => {
    expect(detailStockRequest('101234', grants(true, false), false)).toBeNull()
    expect(detailStockRequest('101234', undefined, false)).toBeNull()
  })
})

describe('🚩 the Stock tab makes no request without canCheckStock', () => {
  afterEach(() => vi.restoreAllMocks())

  /** Mount the Stock tab's very query against a real observer and let it settle. */
  async function observe(access: MaterialAccessResult | undefined) {
    const stock = vi.spyOn(materialStockApi, 'stock').mockResolvedValue({ cells: [], storesAsked: 0, materialsAsked: 1 })
    const client = new QueryClient()
    const observer = new QueryObserver(client, materialStockQuery(detailStockRequest('101234', access, false)))
    const unsubscribe = observer.subscribe(() => {})
    await new Promise((r) => setTimeout(r, 20))
    unsubscribe()
    client.clear()
    return stock
  }

  it('without the stock grant: no call', async () => {
    expect((await observe(grants(true, false))).mock.calls).toEqual([])
  })

  it('with no probe answer at all: no call', async () => {
    expect((await observe(undefined)).mock.calls).toEqual([])
  })

  it('with both grants: exactly one call, with the contract body', async () => {
    const stock = await observe(grants(true, true))
    expect(stock.mock.calls).toEqual([[{ materials: ['101234'], stores: null, includeZero: false, includeClosed: false }]])
  })
})

describe('detailStockRows', () => {
  const cell = (storeCode: string, atp: number, sap = atp): MaterialStockCell => ({
    materialNumber: '101234', storeCode, storeName: null, atp, sapUnrestricted: sap, pos: 0, oms: 0, updatedAt: null,
  })

  it('every store whose ATP is not zero, highest ATP first; a negative ATP is not zero', () => {
    const rows = detailStockRows([cell('1002', 4), cell('1003', 0, 15), cell('1001', 12), cell('1004', -2)], false)
    expect(rows.map((r) => r.storeCode)).toEqual(['1001', '1002', '1004'])
  })

  it('with zero stores shown, the zero-ATP stores join at their place in the order', () => {
    const rows = detailStockRows([cell('1002', 4), cell('1003', 0, 15), cell('1001', 12), cell('1004', -2)], true)
    expect(rows.map((r) => r.storeCode)).toEqual(['1001', '1002', '1003', '1004'])
  })

  it('equal ATP keeps the store order stable, by store code', () => {
    expect(detailStockRows([cell('1009', 3), cell('0101', 3)], false).map((r) => r.storeCode)).toEqual(['0101', '1009'])
  })
})

describe('the tabs', () => {
  it('Batches only for a serialised material', () => {
    expect(detailTabs(true)).toEqual(['master', 'barcodes', 'batches', 'stock'])
    expect(detailTabs(false)).toEqual(['master', 'barcodes', 'stock'])
  })

  it('?tab= opens its tab; an unknown or unavailable one falls back to Master', () => {
    expect(resolveDetailTab('stock', false)).toBe('stock')
    expect(resolveDetailTab('batches', true)).toBe('batches')
    expect(resolveDetailTab('batches', false)).toBe('master')
    expect(resolveDetailTab('nope', true)).toBe('master')
    expect(resolveDetailTab(null, true)).toBe('master')
  })
})

describe('simulatorHref', () => {
  it('a plain path to the simulator with this material, leading zeros kept', () => {
    expect(simulatorHref('101234')).toBe('/pricing/simulation?material=101234')
    expect(simulatorHref('0100777')).toBe('/pricing/simulation?material=0100777')
  })
})
