import { describe, expect, it } from 'vitest'
import {
  choose,
  clearSearch,
  emptyBoxes,
  frameView,
  goToPage,
  listUrl,
  sameSearch,
  searchFromParams,
  searchToParams,
  shouldRead,
  submitSearch,
  wireParams,
  type ListSpec,
} from './search'

const ITEMS: ListSpec = {
  filters: ['all', 'withStock', 'belowZero', 'held', 'differ'],
  sorts: ['item', 'held', 'till', 'gap'],
  keep: ['tab'],
}

const fromUrl = (qs: string, spec: ListSpec = ITEMS) => searchFromParams(new URLSearchParams(qs), spec)

describe('the search-first decision', () => {
  it('a list opened with no search in its address asks nothing', () => {
    expect(shouldRead(fromUrl('tab=items'))).toBe(false)
  })

  it('boxes and a filter in the address without "ran" still ask nothing', () => {
    expect(shouldRead(fromUrl('tab=items&item=123&filter=held'))).toBe(false)
  })

  it('Search with empty boxes asks, for the whole view at page 1', () => {
    const state = submitSearch(fromUrl('tab=items'), emptyBoxes())
    expect(shouldRead(state)).toBe(true)
    expect(wireParams(state)).toEqual({ item: '', batch: '', filter: 'all', sort: 'item', page: 1, size: 25 })
  })

  it('Search sends the boxes trimmed, and starts again at page 1', () => {
    const state = submitSearch(fromUrl('tab=items&ran=1&page=4'), { item: '  panadol ', batch: ' B12 ', gs1: '' })
    expect(wireParams(state)).toEqual({ item: 'panadol', batch: 'B12', filter: 'all', sort: 'item', page: 1, size: 25 })
  })

  it('a shared link that says a search ran asks at once, for its own page', () => {
    const state = fromUrl('tab=items&item=123&filter=held&sort=gap&page=3&ran=1')
    expect(shouldRead(state)).toBe(true)
    expect(wireParams(state)).toEqual({ item: '123', batch: '', filter: 'held', sort: 'gap', page: 3, size: 25 })
  })

  it('a list with no sort sends none', () => {
    const batches: ListSpec = { filters: ['all', 'expired'] }
    expect(wireParams(fromUrl('ran=1&sort=gap', batches))).toEqual({ item: '', batch: '', filter: 'all', page: 1, size: 25 })
  })
})

describe('the search in the address', () => {
  it('the boxes, filter, sort, page and "ran" go to the address and come back the same', () => {
    const searched = submitSearch(fromUrl('tab=items'), { item: 'panadol', batch: 'L77*', gs1: '' })
    const state = goToPage(choose(searched, { filter: 'differ', sort: 'gap' }, ITEMS), 3)
    const qs = searchToParams(state, ITEMS).toString()
    expect(qs).toBe('tab=items&item=panadol&batch=L77*&filter=differ&sort=gap&page=3&ran=1')
    expect(fromUrl(qs)).toEqual(state)
  })

  it('defaults stay out of the address: a fresh list writes only the page params it keeps', () => {
    expect(searchToParams(fromUrl('tab=items&filter=all&sort=item&page=1'), ITEMS).toString()).toBe('tab=items')
  })

  it('an unknown filter or sort falls back to the default, and a bad page to 1', () => {
    const state = fromUrl('filter=nope&sort=price&page=-2&ran=1')
    expect([state.filter, state.sort, state.page]).toEqual(['all', 'item', 1])
  })

  it("a page's other params are dropped; its kept ones and the list's extras ride with it", () => {
    const takes: ListSpec = { filters: ['all', 'granted'], extras: ['day'], keep: ['tab'] }
    const state = submitSearch(searchFromParams(new URLSearchParams('tab=takes&other=x'), takes), emptyBoxes(), {
      day: '2026-11-21',
    })
    expect(searchToParams(state, takes).toString()).toBe('tab=takes&day=2026-11-21&ran=1')
    expect(wireParams(state)).toEqual({ item: '', batch: '', filter: 'all', day: '2026-11-21', page: 1, size: 25 })
  })

  it('changing the filter or the sort after a search goes back to page 1, still searched', () => {
    const state = choose(goToPage(submitSearch(fromUrl(''), emptyBoxes()), 5), { filter: 'held' }, ITEMS)
    expect([state.filter, state.page, state.ran]).toEqual(['held', 1, true])
  })

  it('a value outside the spec is not chosen', () => {
    expect(choose(fromUrl(''), { filter: 'nope', sort: 'price' }, ITEMS)).toEqual(fromUrl(''))
  })

  it('listUrl gives one stable pair per spec, reading and writing it', () => {
    expect(listUrl(ITEMS)).toBe(listUrl(ITEMS))
    const { fromParams, toParams } = listUrl(ITEMS)
    expect(toParams(fromParams(new URLSearchParams('tab=items&ran=1&sort=held'))).toString()).toBe('tab=items&sort=held&ran=1')
  })
})

describe('Search again', () => {
  it('the same boxes again are the same search (the frame then re-reads it: "busy, try again" must try again)', () => {
    const shown = fromUrl('tab=items&item=123&ran=1')
    expect(sameSearch(shown, submitSearch(shown, { item: ' 123 ', batch: '', gs1: '' }), ITEMS)).toBe(true)
  })
  it('other boxes, or a first search, are a new one', () => {
    const shown = fromUrl('tab=items&item=123&ran=1')
    expect(sameSearch(shown, submitSearch(shown, { item: '124', batch: '', gs1: '' }), ITEMS)).toBe(false)
    const fresh = fromUrl('tab=items')
    expect(sameSearch(fresh, submitSearch(fresh, emptyBoxes()), ITEMS)).toBe(false)
  })
})

describe('Clear', () => {
  it('returns to "nothing is read yet": boxes, filter, sort, page, extras and "ran" gone, the tab kept', () => {
    const takes: ListSpec = { filters: ['all', 'granted'], sorts: ['time', 'item'], extras: ['day'], keep: ['tab'] }
    const searched = searchFromParams(
      new URLSearchParams('tab=takes&item=1&batch=B&gs1=01&filter=granted&sort=item&day=2026-11-21&page=2&ran=1'),
      takes,
    )
    const cleared = clearSearch(searched, takes)
    expect(shouldRead(cleared)).toBe(false)
    expect(searchToParams(cleared, takes).toString()).toBe('tab=takes')
    expect(frameView(cleared, { isPending: false, isError: false, data: { total: 9 } })).toBe('nothing')
  })
})

describe('what the frame draws', () => {
  const ran = submitSearch(fromUrl(''), emptyBoxes())
  it('before a search: "nothing is read yet", whatever the query holds', () => {
    expect(frameView(fromUrl(''), { isPending: true, isError: false, data: undefined })).toBe('nothing')
  })
  it('a search in flight with nothing to show yet: loading', () => {
    expect(frameView(ran, { isPending: true, isError: false, data: undefined })).toBe('loading')
  })
  it('a refused read draws its refusal, never kept rows', () => {
    expect(frameView(ran, { isPending: false, isError: true, data: { total: 4 } })).toBe('refused')
  })
  it('an answer with no row: the empty sentence; with rows: the rows', () => {
    expect(frameView(ran, { isPending: false, isError: false, data: { total: 0 } })).toBe('empty')
    expect(frameView(ran, { isPending: false, isError: false, data: { total: 3 } })).toBe('rows')
  })
})
