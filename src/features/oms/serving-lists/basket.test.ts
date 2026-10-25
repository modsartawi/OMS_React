/**
 * Ticket 569 — the add-stores basket: picks across searches, pasted codes, de-duplicated case-insensitively the
 * way the door de-dups them (BackOffice 3045 keeps the first spelling). Pure.
 */
import { describe, expect, it } from 'vitest'
import type { ServingListStoreRow } from '@/core/models/serving-list'
import {
  EMPTY_BASKET,
  addHits,
  addPasted,
  basketBody,
  basketCodes,
  inBasket,
  parsePastedCodes,
  pickable,
  removeCodes,
  toggleHit,
} from './basket'

describe('parsePastedCodes', () => {
  it('splits a pasted column on newlines, trims, drops blanks', () => {
    expect(parsePastedCodes(' 1001\r\n1002\n\n  1003  \n')).toEqual(['1001', '1002', '1003'])
  })
  it('splits on commas and spaces too', () => {
    expect(parsePastedCodes('1001, 1002,1003 1004\t1005')).toEqual(['1001', '1002', '1003', '1004', '1005'])
  })
  it('de-dups case-insensitively, keeping the first spelling', () => {
    expect(parsePastedCodes('p019\nP019\n1001\np019')).toEqual(['p019', '1001'])
  })
  it('nothing pasted is no code', () => {
    expect(parsePastedCodes('  \n , ')).toEqual([])
  })
})

const row = (storeCode: string, over: Partial<ServingListStoreRow> = {}): ServingListStoreRow => ({
  storeCode,
  name: `Store ${storeCode}`,
  city: 'Riyadh',
  closed: false,
  onList: false,
  ...over,
})

describe('picking search hits', () => {
  it('a store already on the list cannot be picked', () => {
    expect(pickable(row('1001', { onList: true }))).toBe(false)
    expect(toggleHit(EMPTY_BASKET, row('1001', { onList: true }))).toEqual(EMPTY_BASKET)
  })
  it('a closed store can be picked, and keeps its closed mark', () => {
    const b = toggleHit(EMPTY_BASKET, row('1009', { closed: true }))
    expect(b).toEqual([{ storeCode: '1009', name: 'Store 1009', city: 'Riyadh', closed: true }])
  })
  it('picks across searches keep their order; picking again takes it out', () => {
    let b = toggleHit(EMPTY_BASKET, row('1002'))
    b = toggleHit(b, row('1001'))
    expect(basketCodes(b)).toEqual(['1002', '1001'])
    b = toggleHit(b, row('1002'))
    expect(basketCodes(b)).toEqual(['1001'])
  })
  it('a hit is in the basket whatever its case', () => {
    const b = addPasted(EMPTY_BASKET, 'p019').basket
    expect(inBasket(b, 'P019')).toBe(true)
    expect(basketCodes(toggleHit(b, row('P019')))).toEqual([])
  })
  it('picking every shown hit skips those on the list and those already picked', () => {
    const b = toggleHit(EMPTY_BASKET, row('1002'))
    const next = addHits(b, [row('1001', { onList: true }), row('1002'), row('1003'), row('1004', { closed: true })])
    expect(basketCodes(next)).toEqual(['1002', '1003', '1004'])
  })
})

describe('pasting into the basket', () => {
  it('adds the new codes and counts the ones already there', () => {
    const b = toggleHit(EMPTY_BASKET, row('1001'))
    const { basket, added, skipped } = addPasted(b, '1001\n1002\n1003\n1002')
    expect(basketCodes(basket)).toEqual(['1001', '1002', '1003'])
    expect([added, skipped]).toEqual([2, 1])
  })
  it('a pasted code knows only its code', () => {
    expect(addPasted(EMPTY_BASKET, '1005').basket).toEqual([{ storeCode: '1005' }])
  })
})

describe('removing and sending', () => {
  it('removes codes case-insensitively ("remove these and retry")', () => {
    const b = addPasted(EMPTY_BASKET, 'x1, 1001, X2, 1002').basket
    expect(basketCodes(removeCodes(b, ['X1', 'x2']))).toEqual(['1001', '1002'])
  })
  it('the body sends the codes and a trimmed note, no note when blank', () => {
    const b = addPasted(EMPTY_BASKET, '1001 1002').basket
    expect(basketBody(b, '  contract 7  ')).toEqual({ storeCodes: ['1001', '1002'], note: 'contract 7' })
    expect(basketBody(b, '   ')).toEqual({ storeCodes: ['1001', '1002'] })
  })
})
