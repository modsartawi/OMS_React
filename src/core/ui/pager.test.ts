// Pager arithmetic (ticket 232, inherited from ticket 148 / spec 147 "Tier 1 —
// pure"). Two things this suite now has to say that the ua-admin original could
// not: the page size is a parameter, so the same match count answers differently
// at 25 and at 50; and Next has two derivations, one per kind of thing a caller
// can know about the far end of the result.
import { describe, expect, it } from 'vitest'
import {
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
    expect(pageCountFromTotalMatches(0, 50)).toBe(1)
    expect(pageCountFromTotalMatches(1, 50)).toBe(1)
    expect(pageCountFromTotalMatches(50, 50)).toBe(1)
    expect(pageCountFromTotalMatches(0, 25)).toBe(1)
    expect(pageCountFromTotalMatches(25, 25)).toBe(1)
  })

  it('spans a second page for the first match past the size', () => {
    expect(pageCountFromTotalMatches(51, 50)).toBe(2)
    expect(pageCountFromTotalMatches(100, 50)).toBe(2)
    expect(pageCountFromTotalMatches(101, 50)).toBe(3)
    expect(pageCountFromTotalMatches(26, 25)).toBe(2)
  })

  it('spans 120 pages for the ~6,000-identity estate', () => {
    expect(pageCountFromTotalMatches(6000, 50)).toBe(120)
  })

  it('never returns a fraction or a negative for a nonsense total', () => {
    expect(pageCountFromTotalMatches(-1, 50)).toBe(1)
    expect(pageCountFromTotalMatches(-1, 25)).toBe(1)
  })

  it('shows the footer only past the first page', () => {
    // A four-row result grows no controls (spec 147, story 11).
    expect(showsPager(0, 50)).toBe(false)
    expect(showsPager(4, 50)).toBe(false)
    expect(showsPager(50, 50)).toBe(false)
    expect(showsPager(51, 50)).toBe(true)
    expect(showsPager(6000, 50)).toBe(true)
  })

  it('walks in fixed steps from zero', () => {
    expect(skipForPage(1, 50)).toBe(0)
    expect(skipForPage(2, 50)).toBe(50)
    expect(skipForPage(120, 50)).toBe(5950)
    // A page number below 1 can only come from a bug; it must not ask the
    // server for a negative offset.
    expect(skipForPage(0, 50)).toBe(0)
  })
})

describe('page size is a parameter', () => {
  // The Loy member's Actions tab pages 25 (the server's own default) while Ua
  // Users pages 50. The same 60 matches must answer differently everywhere.
  it('gives 25 and 50 different skips for the same page', () => {
    expect(skipForPage(3, 25)).toBe(50)
    expect(skipForPage(3, 50)).toBe(100)
  })

  it('gives 25 and 50 different page counts for the same total', () => {
    expect(pageCountFromTotalMatches(60, 25)).toBe(3)
    expect(pageCountFromTotalMatches(60, 50)).toBe(2)
  })

  it('gives 25 and 50 different "renders at all" answers for the same total', () => {
    // 30 actions is two pages of 25 and one page of 50: the footer belongs on
    // the first screen and not on the second.
    expect(showsPager(30, 25)).toBe(true)
    expect(showsPager(30, 50)).toBe(false)
  })

  it('clamps an emptied page to the last page of its own size', () => {
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 4, rowCount: 0, totalMatches: 60, pageSize: 25 })).toBe(3)
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 4, rowCount: 0, totalMatches: 60, pageSize: 50 })).toBe(2)
  })
})

describe('clampToLastPageWhenCurrentPageEmpties', () => {
  it('holds the page whenever the refetch still has rows', () => {
    // The rule this slice exists for: working down a worklist must not restart
    // it. A page that still holds rows is untouched, whatever the total did.
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 7, rowCount: 50, totalMatches: 6000, pageSize: 50 })).toBe(7)
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 2, rowCount: 1, totalMatches: 51, pageSize: 50 })).toBe(2)
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 1, rowCount: 4, totalMatches: 4, pageSize: 50 })).toBe(1)
  })

  it('falls back to the new last page when the current one empties', () => {
    // Fixing the final person on a worklist emptied page 3; 100 matches remain,
    // so the new last page is 2 — not an empty grid at the moment the work
    // succeeded.
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 3, rowCount: 0, totalMatches: 100, pageSize: 50 })).toBe(2)
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 120, rowCount: 0, totalMatches: 51, pageSize: 50 })).toBe(2)
  })

  it('stays on page 1 when the whole worklist empties', () => {
    // There is nowhere to clamp to, and "no results" is the honest state.
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 1, rowCount: 0, totalMatches: 0, pageSize: 50 })).toBe(1)
    expect(clampToLastPageWhenCurrentPageEmpties({ page: 2, rowCount: 0, totalMatches: 0, pageSize: 50 })).toBe(1)
  })
})

describe('pagerButtonEnablement — next from a cap flag', () => {
  it('disables Previous on page 1', () => {
    expect(pagerButtonEnablement({ page: 1, pageSize: 50, isCapped: true })).toEqual({
      previous: false,
      next: true,
    })
  })

  it('disables Next when isCapped is false — there is no page beyond this one', () => {
    // `isCapped` stops being a cap NOTE and becomes the "another page exists"
    // flag (ticket 143).
    expect(pagerButtonEnablement({ page: 3, pageSize: 50, isCapped: false })).toEqual({
      previous: true,
      next: false,
    })
    expect(pagerButtonEnablement({ page: 1, pageSize: 50, isCapped: false })).toEqual({
      previous: false,
      next: false,
    })
  })

  it('lives on both in the middle of a walk', () => {
    expect(pagerButtonEnablement({ page: 2, pageSize: 50, isCapped: true })).toEqual({
      previous: true,
      next: true,
    })
    expect(pagerButtonEnablement({ page: 119, pageSize: 50, isCapped: true })).toEqual({
      previous: true,
      next: true,
    })
  })
})

describe('pagerButtonEnablement — next from a real total', () => {
  // The Loy actions read returns a real `recordsCount`, so the last page is
  // arithmetic. Reusing the capped path here would leave Next dead or wrongly
  // live (ticket 232).
  it('keeps Next live while pages remain', () => {
    expect(pagerButtonEnablement({ page: 1, pageSize: 25, totalMatches: 312 })).toEqual({
      previous: false,
      next: true,
    })
    expect(pagerButtonEnablement({ page: 12, pageSize: 25, totalMatches: 312 })).toEqual({
      previous: true,
      next: true,
    })
  })

  it('kills Next on the last page', () => {
    // 312 actions at 25 a page is 13 pages; page 13 has nowhere to go.
    expect(pagerButtonEnablement({ page: 13, pageSize: 25, totalMatches: 312 })).toEqual({
      previous: true,
      next: false,
    })
    // An exact multiple must not grow a phantom 14th page.
    expect(pagerButtonEnablement({ page: 12, pageSize: 25, totalMatches: 300 })).toEqual({
      previous: true,
      next: false,
    })
  })

  it('treats an empty result as one page, never zero', () => {
    expect(pagerButtonEnablement({ page: 1, pageSize: 25, totalMatches: 0 })).toEqual({
      previous: false,
      next: false,
    })
  })

  it('answers the same total differently at a different page size', () => {
    // 60 matches: page 2 is the last of two at 50, and the middle of three at 25.
    expect(pagerButtonEnablement({ page: 2, pageSize: 50, totalMatches: 60 }).next).toBe(false)
    expect(pagerButtonEnablement({ page: 2, pageSize: 25, totalMatches: 60 }).next).toBe(true)
  })
})
