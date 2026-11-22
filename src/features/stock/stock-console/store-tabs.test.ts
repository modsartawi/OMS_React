import { describe, expect, it } from 'vitest'
import { STORE_TABS, resolveStoreTab, tabParams } from './store-tabs'

describe("a store's tabs", () => {
  it('are the seven of the spec, in its order', () => {
    expect(STORE_TABS).toEqual(['items', 'holds', 'batches', 'takes', 'sap', 'feeds', 'stage'])
  })

  it('the open tab is the address’s; none or an unknown one is Items', () => {
    expect(resolveStoreTab('batches')).toBe('batches')
    expect(resolveStoreTab(null)).toBe('items')
    expect(resolveStoreTab('prices')).toBe('items')
  })

  it('switching tab writes the tab alone, so the new tab opens on "nothing is read yet"', () => {
    expect(tabParams('batches').toString()).toBe('tab=batches')
  })
})
