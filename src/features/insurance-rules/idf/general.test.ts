/**
 * Ticket 647 — the General page's address. The page has tabs (`?tab`; Items is the default and leaves the address,
 * 650 adds `changes`); the Items tab keeps 643's items query (`?q&idf&page`). Only the tab on show writes its own keys,
 * so a later tab can reuse `idf` / `page` without the two colliding.
 */
import { describe, expect, it } from 'vitest'
import { readGeneralQuery, switchGeneralTab, writeGeneralQuery } from './general'

const read = (qs: string) => readGeneralQuery(new URLSearchParams(qs))
const write = (q: ReturnType<typeof read>) => writeGeneralQuery(q).toString()

describe('the general address keeps the items query on the default tab', () => {
  it('a bare address is the Items tab, page 1, no search or group', () => {
    expect(read('')).toEqual({ tab: 'items', items: { q: '', idf: '', page: 1 } })
    expect(write(read(''))).toBe('')
  })
  it('the items search, group and page round-trip, the default tab left out', () => {
    expect(read('q=adol&idf=IDF-IBU&page=2')).toEqual({ tab: 'items', items: { q: 'adol', idf: 'IDF-IBU', page: 2 } })
    expect(write(read('q=adol&idf=IDF-IBU&page=2'))).toBe('q=adol&idf=IDF-IBU&page=2')
  })
  it('an unknown tab reads as Items', () => {
    expect(read('tab=nope&q=x').tab).toBe('items')
    expect(write(read('tab=nope&q=x'))).toBe('q=x')
  })
  it('switching tab drops the items keys; coming back starts the items afresh', () => {
    const q = read('q=adol&page=3')
    expect(switchGeneralTab(q, 'items')).toBe(q)
    expect(write(switchGeneralTab(switchGeneralTab(q, 'items'), 'items'))).toBe('q=adol&page=3')
  })
})
