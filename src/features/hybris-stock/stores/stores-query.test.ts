import { describe, expect, it } from 'vitest'
import type { HybrisStockStoreRow } from '@/core/models/hybris-stock'
import { replaceRow, storesFromParams, storesToParams } from './stores-query'

const row = (storeCode: string, marked = false): HybrisStockStoreRow => ({
  storeCode,
  storeName: storeCode,
  marked,
  changedAt: null,
  changedBy: null,
  health: null,
})

describe('the stores URL', () => {
  it('round-trips, defaults left off', () => {
    expect(storesToParams({ marked: 'any', q: null }).toString()).toBe('')
    const q = storesFromParams(new URLSearchParams('marked=marked&q=%20olaya%20'))
    expect(q).toEqual({ marked: 'marked', q: 'olaya' })
    expect(storesToParams(q).toString()).toBe('marked=marked&q=olaya')
  })

  it('an unknown marked filter reads as any', () => {
    expect(storesFromParams(new URLSearchParams('marked=yes')).marked).toBe('any')
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
