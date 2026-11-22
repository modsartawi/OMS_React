import { describe, expect, it } from 'vitest'
import {
  FIND_LIST,
  answerShown,
  findAnswer,
  findDecision,
  findRowHref,
  findWire,
  itemStoresOpen,
  itemStoresParams,
  itemStoresPage,
} from './find'
import { searchFromParams } from './search'

const at = (query: string) => searchFromParams(new URLSearchParams(query), FIND_LIST)

describe('Find asks only when there is something to find', () => {
  it('reads nothing before Search', () => {
    expect(findDecision(at('item=1001'))).toBe('nothing')
  })

  it('both boxes empty: Search says what to fill, and asks nothing', () => {
    expect(findDecision(at('ran=1'))).toBe('fill')
    expect(findDecision(at('item=%20%20&batch=&ran=1'))).toBe('fill')
  })

  it('a batch filled asks the fleet for the batch — with or without an item', () => {
    expect(findDecision(at('batch=L2291&ran=1'))).toBe('batch')
    expect(findDecision(at('item=1001&batch=L2291&ran=1'))).toBe('batch')
  })

  it('only the item filled asks for items, by number or name', () => {
    expect(findDecision(at('item=1001&ran=1'))).toBe('item')
    expect(findDecision(at('item=panadol&ran=1'))).toBe('item')
  })

  it('sends the two boxes and the page — no filter, no sort, never the GS1 code', () => {
    expect(findWire(at('item=1001&batch=L2291&gs1=0109&page=3&ran=1'))).toEqual({
      item: '1001',
      batch: 'L2291',
      page: 3,
      size: 25,
    })
  })
})

describe('Find’s answer is picked by what was sent', () => {
  it('a batch sent reads the batch answer, with its count of rows and of stores', () => {
    const answer = findAnswer('batch', { kind: 'Batch', total: 3, stores: 2, page: 1, size: 25, rows: [] }, { page: 1, size: 25 })
    expect(answer).toEqual({ kind: 'Batch', total: 3, stores: 2, page: 1, size: 25, rows: [] })
  })

  it('an item sent reads the items answer, whatever kind the server names', () => {
    const answer = findAnswer('item', { kind: 'Batch', total: 1, rows: [{ item: '1001', nameEn: 'A', nameAr: 'أ' }] }, { page: 1, size: 25 })
    expect(answer).toEqual({ kind: 'Item', total: 1, page: 1, size: 25, rows: [{ item: '1001', nameEn: 'A', nameAr: 'أ' }] })
  })

  it('a batch answer without its store count says no count — the page’s stores would undercount a longer match', () => {
    const rows = [{ plant: 'P077' }, { plant: 'P078' }, { plant: 'P077' }]
    expect(findAnswer('batch', { total: 60, rows } as never, { page: 1, size: 25 })).toMatchObject({ kind: 'Batch', stores: null })
    expect(findAnswer('batch', null, { page: 2, size: 25 })).toEqual({ kind: 'Batch', total: 0, stores: null, page: 2, size: 25, rows: [] })
  })
})

describe('the answer shown is the one asked for', () => {
  const batch = { kind: 'Batch' as const, total: 1, stores: 1, page: 1, size: 25, rows: [] }
  const items = { kind: 'Item' as const, total: 1, page: 1, size: 25, rows: [] }

  it('an answer of the other kind kept from the last search is not drawn under this one’s columns', () => {
    expect(answerShown('item', batch)).toBeUndefined()
    expect(answerShown('batch', items)).toBeUndefined()
  })

  it('an answer of the kind asked is drawn; nothing asked draws nothing', () => {
    expect(answerShown('batch', batch)).toBe(batch)
    expect(answerShown('item', items)).toBe(items)
    expect(answerShown('fill', batch)).toBeUndefined()
    expect(answerShown('nothing', undefined)).toBeUndefined()
  })
})

describe('a Find row opens the item at that store', () => {
  it('a batch row links to its item at its store', () => {
    expect(findRowHref({ plant: 'P077', item: '1001' })).toBe('/stock/console/store/P077/item/1001')
  })

  it('a store or item code is escaped as one path segment', () => {
    expect(findRowHref({ plant: 'P 7', item: 'A/1' })).toBe('/stock/console/store/P%207/item/A%2F1')
  })
})

describe('an item found opens its Other stores view on Find', () => {
  it('the address keeps the search and names the item, from the first page', () => {
    const shown = at('item=panadol&ran=1&storesPage=4&stores=999')
    const params = itemStoresParams(shown, '1001')
    expect(params.toString()).toBe('stores=1001&item=panadol&ran=1')
    const opened = searchFromParams(params, FIND_LIST)
    expect(itemStoresOpen(opened)).toBe('1001')
    expect(itemStoresPage(opened)).toBe(1)
  })

  it('a page of the opened item’s stores is kept in the address', () => {
    const opened = at('item=panadol&ran=1&stores=1001')
    const params = itemStoresParams(opened, '1001', 3)
    expect(params.get('storesPage')).toBe('3')
    expect(itemStoresPage(searchFromParams(params, FIND_LIST))).toBe(3)
  })

  it('closing it leaves the search as it was', () => {
    expect(itemStoresParams(at('item=panadol&ran=1&stores=1001'), null).toString()).toBe('item=panadol&ran=1')
  })

  it('a bad page reads as the first; no item named reads as none open', () => {
    expect(itemStoresPage(at('stores=1001&storesPage=x'))).toBe(1)
    expect(itemStoresOpen(at('item=1001&ran=1'))).toBeNull()
  })
})
