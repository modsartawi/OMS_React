/**
 * Ticket 650 — the General page's Change log filter (BackOffice spec 3185, door 3194). Item, group, user and a window
 * of local days (both ends counted, both optional) live in the address under `?tab=changes`, beside the page; a window
 * whose `to` is before its `from` is refused before any read.
 */
import { describe, expect, it } from 'vitest'
import { changesDoorParams, changesExportParams, changesWindowProblem, readChangesQuery, typedChangesFilter, withChangesFilter, writeChangesQuery } from './changes-filter'
import { readGeneralQuery, switchGeneralTab, writeGeneralQuery } from './general'

const read = (qs: string) => readChangesQuery(new URLSearchParams(qs))
const write = (q: ReturnType<typeof read>) => writeChangesQuery(q).toString()

describe('change filters round-trip through the URL and refuse to before from', () => {
  it('a bare address asks the whole log, page 1, and writes nothing', () => {
    expect(read('')).toEqual({ item: '', idf: '', user: '', from: '', to: '', page: 1 })
    expect(write(read(''))).toBe('')
  })
  it('item, group, user, window and page round-trip', () => {
    const qs = 'item=300110&idf=IDF-IBU&user=msartawi&from=2026-10-01&to=2026-10-27&page=2'
    expect(read(qs)).toEqual({ item: '300110', idf: 'IDF-IBU', user: 'msartawi', from: '2026-10-01', to: '2026-10-27', page: 2 })
    expect(write(read(qs))).toBe(qs)
  })
  it('a bad page reads as page 1; values are trimmed', () => {
    expect(read('page=0&item=%20300110%20')).toEqual({ item: '300110', idf: '', user: '', from: '', to: '', page: 1 })
  })
  it('one end of the window alone is a window', () => {
    expect(changesWindowProblem(read('from=2026-10-01'))).toBeNull()
    expect(changesWindowProblem(read('to=2026-10-01'))).toBeNull()
    expect(changesWindowProblem(read(''))).toBeNull()
  })
  it('the same day both ends is one day, not a refusal', () => {
    expect(changesWindowProblem(read('from=2026-10-27&to=2026-10-27'))).toBeNull()
  })
  it('to before from is refused', () => {
    expect(changesWindowProblem(read('from=2026-10-27&to=2026-10-26'))).toBe('reversed')
  })
  it('a day that does not exist is refused', () => {
    expect(changesWindowProblem(read('from=2026-02-30'))).toBe('invalid')
    expect(changesWindowProblem(read('to=nope'))).toBe('invalid')
  })
  it('a filter change goes back to page 1; an untouched typed box changes nothing', () => {
    const q = read('item=300110&page=3')
    expect(withChangesFilter(q, { user: 'aali' })).toEqual({ ...q, user: 'aali', page: 1 })
    expect(typedChangesFilter(q, 'item', ' 300110 ')).toBeNull()
    expect(typedChangesFilter(q, 'item', '300120')).toEqual({ item: '300120' })
  })
  it('the door gets every field by its own name, page included; the export the same without the page', () => {
    const q = read('item=300110&idf=IDF-IBU&from=2026-10-01&page=2')
    expect(changesDoorParams(q)).toEqual({ item: '300110', idf: 'IDF-IBU', user: '', from: '2026-10-01', to: '', page: '2' })
    expect(changesExportParams(q)).toEqual({ item: '300110', idf: 'IDF-IBU', user: '', from: '2026-10-01', to: '' })
  })
})

describe('the change log lives in the General address under ?tab=changes', () => {
  it('the changes tab reads its own keys, and the items keys are not read', () => {
    const g = readGeneralQuery(new URLSearchParams('tab=changes&idf=IDF-IBU&user=aali&page=2&q=adol'))
    expect(g.tab).toBe('changes')
    expect(g.changes).toEqual({ item: '', idf: 'IDF-IBU', user: 'aali', from: '', to: '', page: 2 })
    expect(g.items).toEqual({ q: '', idf: '', page: 1 })
    expect(writeGeneralQuery(g).toString()).toBe('tab=changes&idf=IDF-IBU&user=aali&page=2')
  })
  it('switching from Items to Change log drops the items keys, and back again drops the log keys', () => {
    const items = readGeneralQuery(new URLSearchParams('q=adol&idf=IDF-IBU&page=3'))
    const log = switchGeneralTab(items, 'changes')
    expect(writeGeneralQuery(log).toString()).toBe('tab=changes')
    const filtered = { ...log, changes: { ...log.changes, user: 'aali' } }
    expect(writeGeneralQuery(switchGeneralTab(filtered, 'items')).toString()).toBe('')
  })
})
