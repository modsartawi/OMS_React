/**
 * Ticket 620 — a store list's stores are edited as one set and saved whole (`PUT …/{id}/stores { storeCodes }`):
 * typed codes are split on commas and spaces, upper-cased and de-duplicated; removing a code drops it; the set sent
 * is exactly the set on screen.
 */
import { describe, expect, it } from 'vitest'
import { addStores, removeStore, sameStoreSet, storeSetBody } from './store-lists'

describe('store set edit', () => {
  it('adds, removes and de-duplicates store codes — the set sent equals the visible set', () => {
    const start = ['P001', 'P002']
    const added = addStores(start, ' p003, P001  p004,,P003 ')
    expect(added).toEqual(['P001', 'P002', 'P003', 'P004'])
    const removed = removeStore(added, 'P002')
    expect(removed).toEqual(['P001', 'P003', 'P004'])
    expect(storeSetBody(removed)).toEqual({ storeCodes: ['P001', 'P003', 'P004'] })
    expect(start).toEqual(['P001', 'P002'])
  })
  it('adding nothing but separators leaves the set as it was', () => {
    expect(addStores(['P001'], ' , ;\n')).toEqual(['P001'])
  })
  it('the set is unchanged whatever its order: removing and re-adding a code is not an edit', () => {
    const saved = ['P001', 'P002', 'P003']
    const reAdded = addStores(removeStore(saved, 'P001'), 'p001')
    expect(reAdded).toEqual(['P002', 'P003', 'P001'])
    expect(sameStoreSet(reAdded, saved)).toBe(true)
    expect(sameStoreSet(removeStore(saved, 'P002'), saved)).toBe(false)
    expect(sameStoreSet(['P001', 'P004', 'P003'], saved)).toBe(false)
    expect(sameStoreSet([], [])).toBe(true)
  })
})
