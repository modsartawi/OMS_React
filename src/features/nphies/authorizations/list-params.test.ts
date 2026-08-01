/**
 * `refusedRowsAreRequested` (ticket 214) — the pure Proof bullet, at the seam
 * that owns it.
 *
 * Criteria in, query out. Nothing here knows what a chip looks like or which hook
 * fired (spec 209's tier-1 ruling): the assertions are about what reaches the
 * server, which is the only place a refused authorization is either present or
 * invisible.
 */
import { describe, expect, it } from 'vitest'
import { lastSevenDays } from '@/core/nphies/list-window'
import { AUTH_PAGE_SIZE, buildAuthListParams, defaultAuthCriteria } from './list-params'

/** A fixed "today" — the module never reads the clock, which is what makes the
 *  default window assertable at all. */
const TODAY = new Date(2026, 7, 2) // 2026-08-02, local calendar

describe('refusedRowsAreRequested', () => {
  it('🚩 asks for refused rows EXPLICITLY, on the criteria the screen opens on', () => {
    // Upstream reads `if (!showAll) query.Where(c => !c.Error)`
    // (`AuthService.cs:1377`), so without this flag a refused authorization never
    // appears at all — and the rows most needing an agent's attention would be
    // exactly the ones hidden from them (story 70). The contract calls it the
    // single easiest thing in the effort to get silently wrong.
    expect(buildAuthListParams(defaultAuthCriteria(TODAY)).showAll).toBe(true)
  })

  it('asks for them on EVERY read, whatever else is filtered', () => {
    // There is no state in which this screen wants the refusals gone, so there is
    // nothing to toggle and nothing that can be left off by accident.
    const base = defaultAuthCriteria(TODAY)
    for (const criteria of [
      { ...base, window: null },
      { ...base, page: 7 },
      { ...base, request: 'complete' },
      { ...base, verdict: 'approved' },
      { ...base, patientId: '0000000003', payerCode: 'PAY-9', preAuthRef: 'PA-77' },
    ]) {
      expect(buildAuthListParams(criteria).showAll).toBe(true)
    }
  })

  it('never sends a claimType — SIS.Api pins it to 0 (§3.3)', () => {
    // A client that sent one would be re-introducing the mode dropdown the whole
    // spec exists to delete.
    expect(buildAuthListParams(defaultAuthCriteria(TODAY))).not.toHaveProperty('claimType')
  })

  it('sends no sort token: §3.3 names the parameter but no vocabulary for it', () => {
    expect(buildAuthListParams(defaultAuthCriteria(TODAY))).not.toHaveProperty('sort')
  })
})

describe('the window this list shares with the eligibility one', () => {
  it('opens on the same last seven days, and the built query carries them', () => {
    const criteria = defaultAuthCriteria(TODAY)
    // Not a second copy of the arithmetic: the assertion is that this list's
    // default IS `@/core/nphies/list-window`'s, so the two screens cannot drift
    // about what "Last 7 days" means.
    expect(criteria.window).toEqual(lastSevenDays(TODAY))
    expect(criteria.window).toEqual({ fromDate: '2026-07-27', toDate: '2026-08-02' })

    const params = buildAuthListParams(criteria)
    expect(params.fromDate).toBe('2026-07-27')
    expect(params.toDate).toBe('2026-08-02')
  })

  it('🚩 drops both bounds when the chip is removed — it does not substitute a wider window', () => {
    // The ABSENCE of both, not a wider pair: the agent asked for everything and
    // the query has to say so. (⚠️ Upstream defaults a null `fromDate` to three
    // days ago — `AuthService.cs:1384` — so SIS.Api's re-model must treat an
    // absent bound as NO lower bound, or removing a seven-day window silently
    // produces a four-day one.)
    const params = buildAuthListParams({ ...defaultAuthCriteria(TODAY), window: null })
    expect(params).not.toHaveProperty('fromDate')
    expect(params).not.toHaveProperty('toDate')
    expect(params.showAll).toBe(true)
  })

  it('pages with the shared size, and floors a nonsense page at 1', () => {
    expect(buildAuthListParams(defaultAuthCriteria(TODAY)).pageSize).toBe(AUTH_PAGE_SIZE)
    expect(buildAuthListParams({ ...defaultAuthCriteria(TODAY), page: 0 }).page).toBe(1)
    expect(buildAuthListParams({ ...defaultAuthCriteria(TODAY), page: -3 }).page).toBe(1)
    expect(buildAuthListParams({ ...defaultAuthCriteria(TODAY), page: 4 }).page).toBe(4)
  })
})

describe('emptyFiltersAreDroppedFromTheQuery', () => {
  it('contributes nothing for a blank or whitespace-only filter', () => {
    const params = buildAuthListParams({
      ...defaultAuthCriteria(TODAY),
      patientId: '   ',
      payerCode: '',
      providerCode: '',
      preAuthRef: '  ',
    })
    for (const key of ['patientId', 'payerCode', 'providerCode', 'preAuthRef']) {
      expect(params).not.toHaveProperty(key)
    }
  })

  it('trims what it does send', () => {
    const params = buildAuthListParams({
      ...defaultAuthCriteria(TODAY),
      patientId: ' 0000000003 ',
      preAuthRef: ' PA-77 ',
    })
    expect(params.patientId).toBe('0000000003')
    expect(params.preAuthRef).toBe('PA-77')
  })

  it('carries the preauth reference this list — unlike the eligibility one — really has', () => {
    // §3.3 puts `preAuthRef` on the authorization query and upstream matches it
    // exactly (`AuthService.cs:1374`). An eligibility check has no such reference,
    // because no authorization has been raised yet — which is why 212 does not
    // build this filter and 214 does.
    expect(buildAuthListParams({ ...defaultAuthCriteria(TODAY), preAuthRef: 'PA-77' }).preAuthRef).toBe(
      'PA-77',
    )
  })

  it('defaults the provider filter to ALL providers — the opposite of a till', () => {
    expect(defaultAuthCriteria(TODAY).providerCode).toBe('')
    expect(buildAuthListParams(defaultAuthCriteria(TODAY))).not.toHaveProperty('providerCode')
  })
})

describe('bothStatusAxesFilterIndependently', () => {
  it('narrows on Request alone', () => {
    const params = buildAuthListParams({ ...defaultAuthCriteria(TODAY), request: 'pending' })
    expect(params.request).toBe('pending')
    expect(params).not.toHaveProperty('verdict')
  })

  it('narrows on Verdict alone — "show me everything the payer rejected" is legal', () => {
    const params = buildAuthListParams({ ...defaultAuthCriteria(TODAY), verdict: 'rejected' })
    expect(params.verdict).toBe('rejected')
    expect(params).not.toHaveProperty('request')
  })

  it('narrows on both together', () => {
    const params = buildAuthListParams({
      ...defaultAuthCriteria(TODAY),
      request: 'complete',
      verdict: 'partlyApproved',
    })
    expect(params.request).toBe('complete')
    expect(params.verdict).toBe('partlyApproved')
  })
})
