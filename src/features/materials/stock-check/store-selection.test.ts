/**
 * Ticket 453 — the store choice: a set merges into the chips without duplicates, "All stores"
 * sends `null`, a chip can be removed.
 */
import { describe, expect, it } from 'vitest'
import {
  addStores,
  chosenFromLookup,
  clearStores,
  emptyStoreSelection,
  hasStoreChoice,
  matchesStore,
  removeStore,
  selectedStoreCodes,
  setAllStores,
  type ChosenStore,
} from './store-selection'

const store = (storeCode: string, storeName: string | null = null): ChosenStore => ({ storeCode, storeName })

describe('storeSelection', () => {
  it('starts empty, with no store choice to ask about', () => {
    const s = emptyStoreSelection()
    expect(selectedStoreCodes(s)).toEqual([])
    expect(hasStoreChoice(s)).toBe(false)
  })

  it('adding a set merges into the existing chips without duplicates, in order', () => {
    let s = addStores(emptyStoreSelection(), [store('1002', 'Riyadh - Malaz')])
    s = addStores(s, [store('1001', 'Riyadh - Olaya'), store('1002', 'Riyadh - Malaz'), store('1003', 'Riyadh - Nakheel')])
    expect(selectedStoreCodes(s)).toEqual(['1002', '1001', '1003'])
    expect(s.stores).toHaveLength(3)
  })

  it('a code already chosen keeps its first name, but gains one it lacked', () => {
    let s = addStores(emptyStoreSelection(), [store('1001', 'Olaya'), store('1002')])
    s = addStores(s, [store('1001', 'Other'), store('1002', 'Riyadh - Malaz')])
    expect(s.stores).toEqual([store('1001', 'Olaya'), store('1002', 'Riyadh - Malaz')])
  })

  it('keeps leading zeros and trims, never adding a blank code', () => {
    const s = addStores(emptyStoreSelection(), [store(' 0101 '), store(''), store('0101')])
    expect(selectedStoreCodes(s)).toEqual(['0101'])
  })

  it('"All stores" sends null — and the chips come back when it is turned off', () => {
    let s = addStores(emptyStoreSelection(), [store('1001')])
    s = setAllStores(s, true)
    expect(selectedStoreCodes(s)).toBeNull()
    expect(hasStoreChoice(s)).toBe(true)
    s = setAllStores(s, false)
    expect(selectedStoreCodes(s)).toEqual(['1001'])
  })

  it('"All stores" with no chip is still a store choice', () => {
    expect(hasStoreChoice(setAllStores(emptyStoreSelection(), true))).toBe(true)
  })

  it('choosing a store turns "All stores" off', () => {
    const s = addStores(setAllStores(emptyStoreSelection(), true), [store('1001')])
    expect(s.all).toBe(false)
    expect(selectedStoreCodes(s)).toEqual(['1001'])
  })

  it('removing a chip works, and only that chip goes', () => {
    let s = addStores(emptyStoreSelection(), [store('1001'), store('1002'), store('1003')])
    s = removeStore(s, '1002')
    expect(selectedStoreCodes(s)).toEqual(['1001', '1003'])
    expect(selectedStoreCodes(removeStore(s, '9999'))).toEqual(['1001', '1003'])
  })

  it('clearing drops every chip', () => {
    const s = clearStores(addStores(emptyStoreSelection(), [store('1001'), store('1002')]))
    expect(selectedStoreCodes(s)).toEqual([])
    expect(hasStoreChoice(s)).toBe(false)
  })
})

describe('picking a store from the lookup', () => {
  const olaya = { storeCode: '1001', city: 'RIYADH', region: 'CENTRAL', storeAddress: 'Riyadh - Olaya' }

  it('finds a store by code or by any word of its name, city or region, ignoring case', () => {
    expect(matchesStore(olaya, '1001')).toBe(true)
    expect(matchesStore(olaya, '100')).toBe(true)
    expect(matchesStore(olaya, 'olaya')).toBe(true)
    expect(matchesStore(olaya, 'riyadh olaya')).toBe(true)
    expect(matchesStore(olaya, 'central')).toBe(true)
    expect(matchesStore(olaya, 'jeddah')).toBe(false)
    expect(matchesStore(olaya, '  ')).toBe(false)
  })

  it('names the chip with the address, else the city, else nothing', () => {
    expect(chosenFromLookup(olaya)).toEqual({ storeCode: '1001', storeName: 'Riyadh - Olaya' })
    expect(chosenFromLookup({ ...olaya, storeAddress: ' ' })).toEqual({ storeCode: '1001', storeName: 'RIYADH' })
    expect(chosenFromLookup({ ...olaya, storeAddress: null, city: null })).toEqual({ storeCode: '1001', storeName: null })
  })
})
