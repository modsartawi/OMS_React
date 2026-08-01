/**
 * `theDefaultWindowIsTheLastSevenDaysAndItIsRemovable`,
 * `emptyFiltersAreDroppedFromTheQuery` and `bothStatusAxesFilterIndependently`
 * (ticket 212) — the three pure Proof bullets, at the seam that owns them.
 *
 * Criteria in, query out. Nothing here knows what a chip looks like or which hook
 * fired (spec 209's tier-1 ruling): the assertions are about what reaches the
 * server, which is the only place the window is either honest or a lie.
 */
import { describe, expect, it } from 'vitest'
import {
  ELIGIBILITY_PAGE_SIZE,
  buildEligibilityListParams,
  defaultEligibilityCriteria,
} from './list-params'
// The window and the pager moved to `core/` when 214's list became their second
// consumer — same module, same assertions, one copy.
import {
  DEFAULT_WINDOW_DAYS,
  isDefaultWindow,
  isoDate,
  lastSevenDays,
  pageCountFor,
  pagerEnablement,
  setWindowBound,
} from '@/core/nphies/list-window'

/** A fixed "today" — the module never reads the clock, which is what makes the
 *  default window assertable at all. */
const TODAY = new Date(2026, 7, 2) // 2026-08-02, local calendar

describe('theDefaultWindowIsTheLastSevenDaysAndItIsRemovable', () => {
  it('opens on the last seven days, and the built query carries them', () => {
    const criteria = defaultEligibilityCriteria(TODAY)
    // SEVEN calendar days, inclusive at both ends — 07-27 … 08-02, not 07-26.
    // The chip says the number out loud, so an eight-day span under the words
    // "Last 7 days" is a small version of the lie this ticket exists to remove.
    expect(criteria.window).toEqual({ fromDate: '2026-07-27', toDate: '2026-08-02' })

    const params = buildEligibilityListParams(criteria)
    expect(params.fromDate).toBe('2026-07-27')
    expect(params.toDate).toBe('2026-08-02')
  })

  it('🚩 the chip only claims "last 7 days" while that is still true', () => {
    // Widening the window must not leave the phrase behind — a seven-month
    // result set labelled as a week is the chip telling the very lie it exists
    // to prevent.
    expect(isDefaultWindow(lastSevenDays(TODAY), TODAY)).toBe(true)
    expect(isDefaultWindow({ fromDate: '2026-01-01', toDate: '2026-08-02' }, TODAY)).toBe(false)
    expect(isDefaultWindow({ fromDate: '2026-07-27', toDate: '' }, TODAY)).toBe(false)
    expect(isDefaultWindow(null, TODAY)).toBe(false)
  })

  it('🚩 removing the chip DROPS the window rather than substituting a wider one', () => {
    // The distinction the whole ticket rests on. A removed chip must not become
    // "the last 90 days" or any other quiet ceiling — the agent asked for
    // everything and the query has to say so, or the screen is back to reading
    // "that's everything" when it is not.
    const params = buildEligibilityListParams({
      ...defaultEligibilityCriteria(TODAY),
      window: null,
    })
    expect('fromDate' in params).toBe(false)
    expect('toDate' in params).toBe(false)
  })

  it('spans exactly DEFAULT_WINDOW_DAYS calendar dates, both ends included', () => {
    const { fromDate, toDate } = lastSevenDays(TODAY)
    expect(toDate).toBe(isoDate(TODAY))
    const days = (Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000 + 1
    expect(days).toBe(DEFAULT_WINDOW_DAYS)
  })

  it('crosses a month and a year boundary without arithmetic of its own', () => {
    expect(lastSevenDays(new Date(2026, 0, 3)).fromDate).toBe('2025-12-28')
  })

  it('widening one bound keeps the window; clearing both removes it', () => {
    const week = lastSevenDays(TODAY)
    expect(setWindowBound(week, 'fromDate', '2026-01-01')).toEqual({
      fromDate: '2026-01-01',
      toDate: '2026-08-02',
    })
    // One bound left open is still a window — a half-open range is a legitimate
    // "everything since March", not a removal.
    expect(setWindowBound(week, 'fromDate', '')).toEqual({ fromDate: '', toDate: '2026-08-02' })
    expect(setWindowBound({ fromDate: '', toDate: '2026-08-02' }, 'toDate', '')).toBeNull()
  })

  it('sends only the bound that is set on a half-open window', () => {
    const params = buildEligibilityListParams({
      ...defaultEligibilityCriteria(TODAY),
      window: { fromDate: '2026-03-01', toDate: '' },
    })
    expect(params.fromDate).toBe('2026-03-01')
    expect('toDate' in params).toBe(false)
  })
})

describe('emptyFiltersAreDroppedFromTheQuery', () => {
  it('contributes nothing for a blank patient id or an unset status axis', () => {
    const params = buildEligibilityListParams(defaultEligibilityCriteria(TODAY))
    for (const key of ['patientId', 'payerCode', 'providerCode', 'request', 'verdict']) {
      expect(key in params).toBe(false)
    }
  })

  it('treats whitespace as blank — a space is not a patient id', () => {
    const params = buildEligibilityListParams({
      ...defaultEligibilityCriteria(TODAY),
      patientId: '   ',
      payerCode: ' PAY-9 ',
    })
    expect('patientId' in params).toBe(false)
    expect(params.payerCode).toBe('PAY-9')
  })

  it('🚩 always asks for every row, whatever the payer said', () => {
    // Upstream: `if (!showAll) query.Where(c => c.IsEligible)`
    // (`EligibilityService.cs:976`). Without this the list of what payers
    // answered would show only the yeses — and the verdict filter below would be
    // filtering a set the refusals had already been removed from.
    expect(buildEligibilityListParams(defaultEligibilityCriteria(TODAY)).showAll).toBe(true)
    expect(
      buildEligibilityListParams({ ...defaultEligibilityCriteria(TODAY), window: null }).showAll,
    ).toBe(true)
  })

  it('always carries the page and the page size, and never a page below 1', () => {
    const params = buildEligibilityListParams({ ...defaultEligibilityCriteria(TODAY), page: 0 })
    expect(params.page).toBe(1)
    expect(params.pageSize).toBe(ELIGIBILITY_PAGE_SIZE)
    expect(buildEligibilityListParams({ ...defaultEligibilityCriteria(TODAY), page: 4 }).page).toBe(4)
  })

  it('sends no sort token it has no vocabulary for', () => {
    // §3.3 names the parameter but no values, and this slice ships no sort
    // control — "newest first" is the re-modelled endpoint's own default.
    expect('sort' in buildEligibilityListParams(defaultEligibilityCriteria(TODAY))).toBe(false)
  })
})

describe('bothStatusAxesFilterIndependently', () => {
  const base = defaultEligibilityCriteria(TODAY)

  it('narrows on Request alone', () => {
    const params = buildEligibilityListParams({ ...base, request: 'failed' })
    expect(params.request).toBe('failed')
    expect('verdict' in params).toBe(false)
  })

  it('🚩 narrows on Verdict alone — a Verdict filter with no Request filter is legal', () => {
    // "Show me everyone the payer refused" is a question an agent asks without
    // caring how the request got there.
    const params = buildEligibilityListParams({ ...base, verdict: 'notEligible' })
    expect(params.verdict).toBe('notEligible')
    expect('request' in params).toBe(false)
  })

  it('narrows on both at once, each in its own parameter', () => {
    const params = buildEligibilityListParams({
      ...base,
      request: 'complete',
      verdict: 'notInForce',
    })
    expect(params.request).toBe('complete')
    expect(params.verdict).toBe('notInForce')
  })
})

describe('the pager arithmetic', () => {
  it('reports one empty page rather than zero', () => {
    expect(pageCountFor(0)).toBe(1)
  })

  it('counts pages from the TRUE total, not from a page of rows', () => {
    expect(pageCountFor(50)).toBe(1)
    expect(pageCountFor(51)).toBe(2)
    expect(pageCountFor(6000)).toBe(120)
  })

  it('counts with the page size the SERVER served, not the one we asked for', () => {
    // A server that capped 50 to 25 has three pages of 64 rows, not two — and
    // counting with the client's constant would hide the last 14 behind a
    // disabled Next.
    expect(pageCountFor(64)).toBe(2)
    expect(pageCountFor(64, 25)).toBe(3)
  })

  it('lights Previous and Next from where the page sits in the count', () => {
    expect(pagerEnablement({ page: 1, pages: 3 })).toEqual({ previous: false, next: true })
    expect(pagerEnablement({ page: 2, pages: 3 })).toEqual({ previous: true, next: true })
    expect(pagerEnablement({ page: 3, pages: 3 })).toEqual({ previous: true, next: false })
    expect(pagerEnablement({ page: 1, pages: 1 })).toEqual({ previous: false, next: false })
  })

  it('still offers Previous when the result shrank under the agent', () => {
    // Stranded on page 3 of a result that now fits one page: Next is correctly
    // dead, but Previous is the only way back and must stay live.
    expect(pagerEnablement({ page: 3, pages: 1 })).toEqual({ previous: true, next: false })
  })
})
