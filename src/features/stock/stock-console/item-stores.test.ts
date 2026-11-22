import { describe, expect, it } from 'vitest'
import { itemStoreHref } from './item-stores'

describe('an Other stores row', () => {
  it('links to the same item at that store', () => {
    expect(itemStoreHref('1001', { plant: 'P078' })).toBe('/stock/console/store/P078/item/1001')
  })
})
