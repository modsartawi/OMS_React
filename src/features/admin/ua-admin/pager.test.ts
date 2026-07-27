// Pager arithmetic (ticket 148, spec 147 "Tier 1 — pure"). The two suites the
// ticket's Proof names: how many pages a match count spans (and whether the
// footer shows at all), and which of Previous / Next is live.
import { describe, expect, it } from 'vitest'
import {
  PAGE_SIZE,
  clampToLastPageWhenCurrentPageEmpties,
  pageCountFromTotalMatches,
  pagerButtonEnablement,
  showsPager,
  skipForPage,
} from './pager'

describe('pageCountFromTotalMatches', () => {
  it('spans one page for an empty or single-page result', () => {
    // Zero matches is still "Page 1 of 1" — there is a page, it is empty. A
    // count of 0 pages would render "Page 1 of 0".
    expect(pageCountFromTotalMatches(0)).toBe(1)
    expect(pageCountFromTotalMatches(1)).toBe(1)
    expect(pageCountFromTotalMatches(50)).toBe(1)
  })

  it('spans a second page for the 51st match', () => {
    expect(pageCountFromTotalMatches(51)).toBe(2)
    expect(pageCountFromTotalMatches(100)).toBe(2)
    expect(pageCountFromTotalMatches(101)).toBe(3)
  })

  it('spans 120 pages for the ~6,000-identity estate', () => {
    expect(pageCountFromTotalMatches(6000)).toBe(120)
  })

  it('never returns a fraction or a negative for a nonsense total', () => {
    expect(pageCountFromTotalMatches(-1)).toBe(1)
  })

  it('shows the footer only past the first page', () => {
    // A four-row result grows no controls (spec 147, story 11).
    expect(showsPager(0)).toBe(false)
    expect(showsPager(4)).toBe(false)
    expect(showsPager(50)).toBe(false)
    expect(showsPager(51)).toBe(true)
    expect(showsPager(6000)).toBe(true)
  })

  it('walks in fixed 50-row steps from zero', () => {
    expect(PAGE_SIZE).toBe(50)
    expect(skipForPage(1)).toBe(0)
    expect(skipForPage(2)).toBe(50)
    expect(skipForPage(120)).toBe(5950)
    // A page number below 1 can only come from a bug; it must not ask the
    // server for a negative offset.
    expect(skipForPage(0)).toBe(0)
  })
})

describe('clampToLastPageWhenCurrentPageEmpties', () => {
  it('holds the page whenever the refetch still has rows', () => {
    // The rule this slice exists for: working down a worklist must not restart
    // it. A page that still holds rows is untouched, whatever the total did.
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 7, rowCount: 50, totalMatches: 6000 })).toBe(7)
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 2, rowCount: 1, totalMatches: 51 })).toBe(2)
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 1, rowCount: 4, totalMatches: 4 })).toBe(1)
  })

  it('falls back to the new last page when the current one empties', () => {
    // Fixing the final person on a worklist emptied page 3; 100 matches remain,
    // so the new last page is 2 — not an empty grid at the moment the work
    // succeeded.
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 3, rowCount: 0, totalMatches: 100 })).toBe(2)
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 120, rowCount: 0, totalMatches: 51 })).toBe(2)
  })

  it('stays on page 1 when the whole worklist empties', () => {
    // There is nowhere to clamp to, and "no results" is the honest state.
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 1, rowCount: 0, totalMatches: 0 })).toBe(1)
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 2, rowCount: 0, totalMatches: 0 })).toBe(1)
  })
})

describe('pagerButtonEnablement', () => {
  it('disables Previous on page 1', () => {
    expect(pagerButtonEnablement({ page: 1, isCapped: true })).toEqual({ previous: false, next: true })
  })

  it('disables Next when isCapped is false — there is no page beyond this one', () => {
    // `isCapped` stops being a cap NOTE and becomes the "another page exists"
    // flag (ticket 143).
    expect(pagerButtonEnablement({ page: 3, isCapped: false })).toEqual({ previous: true, next: false })
    expect(pagerButtonEnablement({ page: 1, isCapped: false })).toEqual({ previous: false, next: false })
  })

  it('lives on both in the middle of a walk', () => {
    expect(pagerButtonEnablement({ page: 2, isCapped: true })).toEqual({ previous: true, next: true })
    expect(pagerButtonEnablement({ page: 119, isCapped: true })).toEqual({ previous: true, next: true })
  })
})
