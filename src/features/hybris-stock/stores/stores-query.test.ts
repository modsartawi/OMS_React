import { describe, expect, it } from 'vitest'
import type { HybrisStockStoreRow } from '@/core/models/hybris-stock'
import { replaceRow, storesDoorParams, storesFromParams, storesToParams } from './stores-query'

const row = (storeCode: string, marked = false): HybrisStockStoreRow => ({
  storeCode,
  storeName: storeCode,
  closed: false,
  marked,
  markedAt: null,
  markedBy: null,
  health: null,
})

describe('the stores URL', () => {
  it('round-trips flag, health and q, defaults left off', () => {
    expect(storesToParams({ flag: 'any', health: 'any', q: null }).toString()).toBe('')
    const q = storesFromParams(new URLSearchParams('flag=marked&health=unhealthy&q=%20olaya%20'))
    expect(q).toEqual({ flag: 'marked', health: 'unhealthy', q: 'olaya' })
    expect(storesToParams(q).toString()).toBe('flag=marked&health=unhealthy&q=olaya')
  })

  it('a value the door does not know reads as any (never sent, so never HybrisStockFilterUnknown)', () => {
    expect(storesFromParams(new URLSearchParams('flag=yes&health=red'))).toEqual({ flag: 'any', health: 'any', q: null })
  })
})

describe('storesDoorParams', () => {
  it('sends flag / health / q, any left off', () => {
    expect(storesDoorParams({ flag: 'any', health: 'any', q: null })).toEqual({ flag: null, health: null, q: null })
    expect(storesDoorParams({ flag: 'unmarked', health: 'ok', q: 'x' })).toEqual({ flag: 'unmarked', health: 'ok', q: 'x' })
  })
})

describe('replaceRow', () => {
  it('swaps the row where it stands', () => {
    const rows = [row('1'), row('2'), row('3')]
    expect(replaceRow(rows, row('2', true)).map((r) => r.marked)).toEqual([false, true, false])
  })

  it('leaves a list without the row untouched', () => {
    const rows = [row('1')]
    expect(replaceRow(rows, row('9', true))).toBe(rows)
    expect(replaceRow(undefined, row('9'))).toBeUndefined()
  })
})
