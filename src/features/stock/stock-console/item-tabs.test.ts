import { describe, expect, it } from 'vitest'
import { ITEM_TABS, itemTabParams, resolveItemTab } from './item-tabs'

describe('an item page’s tabs', () => {
  it('open on Batches, then Holds, Takes and Other stores, in the spec’s order', () => {
    expect(ITEM_TABS.slice(0, 4)).toEqual(['batches', 'holds', 'takes', 'stores'])
    expect(resolveItemTab(null)).toBe('batches')
  })

  it('an unknown tab in the address opens Batches; a known one opens itself', () => {
    expect(resolveItemTab('items')).toBe('batches')
    expect(resolveItemTab('stores')).toBe('stores')
  })

  it('switching writes the tab alone', () => {
    expect(itemTabParams('takes').toString()).toBe('tab=takes')
  })
})
