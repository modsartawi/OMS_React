/**
 * 3185 review — the IDF screens' shared paging: one reader for a `?page=` value, one filler for a null page body, and
 * where an emptied last page falls back to (findings 1 and 10).
 */
import { describe, expect, it } from 'vitest'
import { emptiedPageTarget, pageOrEmpty, readPage } from './paging'

describe('a ?page= value reads as a whole page of 1 or more, else page 1', () => {
  it('reads a whole page and falls back to 1 on anything else', () => {
    expect(readPage('3')).toBe(3)
    expect(readPage(null)).toBe(1)
    expect(readPage('0')).toBe(1)
    expect(readPage('-2')).toBe(1)
    expect(readPage('2.5')).toBe(1)
    expect(readPage('x')).toBe(1)
  })
})

describe('a null page body is an empty page at the page asked for', () => {
  it('fills every field a body leaves out', () => {
    expect(pageOrEmpty(null, 4)).toEqual({ page: 4, pageSize: 0, total: 0, rows: [] })
    expect(pageOrEmpty({ page: 2, pageSize: 25, total: 30, rows: [1, 2] }, 9)).toEqual({ page: 2, pageSize: 25, total: 30, rows: [1, 2] })
    expect(pageOrEmpty({ rows: ['a'] } as never, 1)).toEqual({ page: 1, pageSize: 0, total: 0, rows: ['a'] })
  })
})

describe('an emptied page above 1 falls back to the new last page', () => {
  it('the last row of page 3 removed (50 left at 25 a page) goes to page 2; 26 left from page 5 → page 2', () => {
    expect(emptiedPageTarget({ page: 3, pageSize: 25, total: 50, rows: [] }, 3)).toBe(2)
    expect(emptiedPageTarget({ page: 5, pageSize: 25, total: 26, rows: [] }, 5)).toBe(2)
  })
  it('a page with rows, page 1, an empty result or an unknown page size stays put (null)', () => {
    expect(emptiedPageTarget({ page: 2, pageSize: 25, total: 26, rows: [{}] }, 2)).toBeNull()
    expect(emptiedPageTarget({ page: 1, pageSize: 25, total: 0, rows: [] }, 1)).toBeNull()
    expect(emptiedPageTarget({ page: 3, pageSize: 0, total: 0, rows: [] }, 3)).toBeNull()
  })
  it('a page read for another page than the address asks (a placeholder) is not acted on', () => {
    expect(emptiedPageTarget({ page: 2, pageSize: 25, total: 25, rows: [] }, 3)).toBeNull()
  })
  it('every row gone from page 4 clamps to page 1', () => {
    expect(emptiedPageTarget({ page: 4, pageSize: 25, total: 0, rows: [] }, 4)).toBe(1)
  })
})
