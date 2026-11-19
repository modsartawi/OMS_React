/**
 * Oms 924 (BackOffice 4055 `GET Insurance/Patterns/Reveals?from&to&user&caseId&skip&take`, GUESSED) — the reveal log's
 * filters (period, user, case) and page: read from the address, written back to it, and turned into the door's query.
 */
import { describe, expect, it } from 'vitest'
import {
  changeRevealFilter,
  NO_REVEAL_FILTERS,
  REVEALS_PAGE_SIZE,
  revealFiltersFromParams,
  revealFiltersToParams,
  revealPeriodBackwards,
  revealsQuery,
} from './reveal-log'

const params = (s: string) => new URLSearchParams(s)

describe('the address', () => {
  it('an empty address is no filter, page 1', () => {
    expect(revealFiltersFromParams(params(''))).toEqual({ from: '', to: '', user: '', caseId: '', page: 1 })
    expect(NO_REVEAL_FILTERS).toEqual({ from: '', to: '', user: '', caseId: '', page: 1 })
  })

  it('reads the period, the user, the case and the page', () => {
    expect(revealFiltersFromParams(params('from=2026-11-01&to=2026-11-19&user=%20investigator1%20&case=01JD3K7Q2WPC0123&page=2'))).toEqual({
      from: '2026-11-01',
      to: '2026-11-19',
      user: 'investigator1',
      caseId: '01JD3K7Q2WPC0123',
      page: 2,
    })
  })

  it('drops a day that is not one and a page that is not a whole number from 1', () => {
    expect(revealFiltersFromParams(params('from=2026-13-01&to=yesterday&page=0'))).toEqual(NO_REVEAL_FILTERS)
    expect(revealFiltersFromParams(params('page=2.5')).page).toBe(1)
  })

  it('drops a day the calendar does not have: shaped like a day is not enough', () => {
    expect(revealFiltersFromParams(params('from=2026-02-30&to=2026-11-31'))).toEqual(NO_REVEAL_FILTERS)
    expect(revealFiltersFromParams(params('from=2028-02-29&to=2026-11-30'))).toMatchObject({ from: '2028-02-29', to: '2026-11-30' })
  })

  it('writes back only what is set, the page only past the first, and reads back the same', () => {
    expect(revealFiltersToParams(NO_REVEAL_FILTERS).toString()).toBe('')
    const filters = { from: '2026-11-01', to: '', user: 'investigator1', caseId: '01JD3K7Q2WPC0123', page: 3 }
    expect(revealFiltersToParams(filters).toString()).toBe('from=2026-11-01&user=investigator1&case=01JD3K7Q2WPC0123&page=3')
    expect(revealFiltersFromParams(revealFiltersToParams(filters))).toEqual(filters)
  })
})

describe('the door’s query', () => {
  it('page 1 with no filter asks the first page only', () => {
    expect(revealsQuery(NO_REVEAL_FILTERS)).toEqual({ skip: 0, take: 25 })
    expect(REVEALS_PAGE_SIZE).toBe(25)
  })

  it('each set filter goes under the door’s own name; the case as caseId', () => {
    expect(revealsQuery({ from: '2026-11-01', to: '2026-11-19', user: 'investigator1', caseId: '01JD3K7Q2WPC0123', page: 3 })).toEqual({
      from: '2026-11-01',
      to: '2026-11-19',
      user: 'investigator1',
      caseId: '01JD3K7Q2WPC0123',
      skip: 50,
      take: 25,
    })
  })

  it('a changed filter starts again at page 1', () => {
    expect(changeRevealFilter({ ...NO_REVEAL_FILTERS, page: 4 }, { user: 'investigator2' })).toEqual({ ...NO_REVEAL_FILTERS, user: 'investigator2', page: 1 })
  })

  it('a period that ends before it starts is backwards; an open end is not', () => {
    expect(revealPeriodBackwards({ ...NO_REVEAL_FILTERS, from: '2026-11-19', to: '2026-11-01' })).toBe(true)
    expect(revealPeriodBackwards({ ...NO_REVEAL_FILTERS, from: '2026-11-01', to: '2026-11-01' })).toBe(false)
    expect(revealPeriodBackwards({ ...NO_REVEAL_FILTERS, from: '2026-11-19' })).toBe(false)
  })
})
