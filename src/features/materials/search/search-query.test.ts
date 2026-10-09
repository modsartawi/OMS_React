/**
 * Ticket 451 — `searchQuery`: the Material search lives in the URL, and the URL's parameters are
 * the door's (contract § `GET MaterialWeb/Search`). The box, the levels, the side filters and
 * take build the exact query string, lists as REPEATED keys, and a URL parses back to the same
 * string — a round trip.
 */
import { describe, expect, it } from 'vitest'
import {
  emptySearch,
  hasSearch,
  parseItemType,
  searchApiParams,
  searchFromParams,
  searchQueryString,
  searchToParams,
  type MaterialSearchState,
} from './search-query'

const state = (over: Partial<MaterialSearchState> = {}): MaterialSearchState => ({ ...emptySearch(), ...over })
const roundTrip = (qs: string) => searchQueryString(searchFromParams(new URLSearchParams(qs)))

describe('searchQuery — building the query string', () => {
  it('an empty search is an empty string', () => {
    expect(searchQueryString(emptySearch())).toBe('')
  })

  it('builds every part in the contract order, lists as repeated keys', () => {
    const s = state({
      q: 'panadol 500',
      levels: { A: ['A006', 'A008'], B: ['B010'], C: [], D: [], E: ['E1'] },
      vendor: ['0200345'],
      brand: ['PANADOL'],
      manufacturer: ['GSK'],
      status: ['ACTIVE', 'DISC'],
      blocked: 'no',
      serialised: 'yes',
      itemType: [0, 3],
      take: 500,
    })
    expect(searchQueryString(s)).toBe(
      'q=panadol+500&aLevel=A006&aLevel=A008&bLevel=B010&eLevel=E1&vendor=0200345&brand=PANADOL' +
        '&manufacturer=GSK&status=ACTIVE&status=DISC&blocked=false&serialised=true&itemType=0&itemType=3&take=500',
    )
  })

  it('blocked / serialised "any" and the default take are absent', () => {
    const qs = searchToParams(state({ q: 'pan', blocked: 'any', serialised: 'any', take: null }))
    expect([...qs.keys()]).toEqual(['q'])
  })

  it('a blank box is absent; the box goes as typed otherwise', () => {
    expect(searchQueryString(state({ q: '   ' }))).toBe('')
    expect(searchToParams(state({ q: '0101234' })).get('q')).toBe('0101234')
  })

  it('a raw GS1 scan keeps its group separator and its # byte for byte', () => {
    const scan = '0106281234567890172703311' + 'OA12' + '\u001d' + '21X9#'
    const qs = searchQueryString(state({ q: scan }))
    expect(searchFromParams(new URLSearchParams(qs)).q).toBe(scan)
  })

  it('a duplicated value goes once', () => {
    expect(searchQueryString(state({ brand: ['X', 'X'] }))).toBe('brand=X')
  })
})

describe('searchQuery — parsing the URL', () => {
  it('parses every part back', () => {
    const s = searchFromParams(
      new URLSearchParams('q=pan&aLevel=A006&aLevel=A008&vendor=0200345&blocked=true&serialised=false&itemType=0&take=500'),
    )
    expect(s).toEqual(
      state({
        q: 'pan',
        levels: { A: ['A006', 'A008'], B: [], C: [], D: [], E: [] },
        vendor: ['0200345'],
        blocked: 'yes',
        serialised: 'no',
        itemType: [0],
        take: 500,
      }),
    )
  })

  it('codes and vendor numbers stay strings with their leading zeros', () => {
    const s = searchFromParams(new URLSearchParams('vendor=000123&aLevel=0006'))
    expect(s.vendor).toEqual(['000123'])
    expect(s.levels.A).toEqual(['0006'])
  })

  it('a malformed blocked / serialised / take / itemType reads as any / default / dropped', () => {
    const s = searchFromParams(new URLSearchParams('blocked=maybe&serialised=1&take=9999&itemType=x&itemType=2'))
    expect(s.blocked).toBe('any')
    expect(s.serialised).toBe('any')
    expect(s.take).toBeNull()
    expect(s.itemType).toEqual([2])
  })

  it('take 0 is not a take', () => {
    expect(searchFromParams(new URLSearchParams('take=0')).take).toBeNull()
  })
})

describe('searchQuery — the round trip', () => {
  it.each([
    '',
    'q=panadol+500',
    'aLevel=A006&aLevel=A008',
    'q=pan&aLevel=A006&bLevel=B010&cLevel=C0101&dLevel=D1&eLevel=E1',
    'vendor=0200345&vendor=200346&brand=PANADOL&manufacturer=GSK&status=ACTIVE',
    'blocked=false&serialised=true',
    'itemType=0&itemType=3&take=500',
    'q=%D8%A8%D9%86%D8%A7%D8%AF%D9%88%D9%84&take=200',
    'q=010628123456789017270331%1D21X9%23',
  ])('URL → state → URL is unchanged: %s', (qs) => {
    expect(roundTrip(qs)).toBe(qs)
  })

  it('state → URL → state is unchanged', () => {
    const s = state({
      q: 'بنادول 500',
      levels: { A: ['A006'], B: ['B010', 'B011'], C: [], D: [], E: [] },
      status: ['ACTIVE'],
      blocked: 'yes',
      itemType: [0],
      take: 500,
    })
    expect(searchFromParams(searchToParams(s))).toEqual(s)
  })
})

describe('searchQuery — the door parameters', () => {
  it('lists are arrays (even of one), singles are strings — what buildQuery repeats', () => {
    expect(
      searchApiParams(
        state({ q: 'pan', levels: { A: ['A006', 'A008'], B: [], C: [], D: [], E: [] }, vendor: ['1'], blocked: 'no', itemType: [0], take: 500 }),
      ),
    ).toEqual({ q: 'pan', aLevel: ['A006', 'A008'], vendor: ['1'], blocked: 'false', itemType: ['0'], take: '500' })
  })
})

describe('searchQuery — hasSearch', () => {
  it('is false for nothing, and for take alone', () => {
    expect(hasSearch(emptySearch())).toBe(false)
    expect(hasSearch(state({ take: 500 }))).toBe(false)
    expect(hasSearch(state({ q: '  ' }))).toBe(false)
  })

  it.each<Partial<MaterialSearchState>>([
    { q: 'p' },
    { levels: { A: [], B: [], C: ['C1'], D: [], E: [] } },
    { manufacturer: ['GSK'] },
    { itemType: [0] },
    { blocked: 'no' },
    { serialised: 'yes' },
  ])('is true for any one criterion: %o', (over) => {
    expect(hasSearch(state(over))).toBe(true)
  })
})

describe('parseItemType', () => {
  it('takes a whole number and nothing else', () => {
    expect(parseItemType(' 3 ')).toBe(3)
    expect(parseItemType('0')).toBe(0)
    expect(parseItemType('3.5')).toBeNull()
    expect(parseItemType('a')).toBeNull()
    expect(parseItemType('')).toBeNull()
  })
})
