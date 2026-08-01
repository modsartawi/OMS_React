/**
 * `oneCoverageIsSelectedWithoutAsking`,
 * `twoCoveragesRefuseToProceedWithoutAChoice` and
 * `theSeamCarriesTheEligibilityAndTheChosenMember` (ticket 213) — the three pure
 * Proof bullets, at the seam that owns them.
 *
 * Coverages in, a selection and a URL out. Nothing here knows what a radio looks
 * like or which hook fired (spec 209's tier-1 ruling): the assertions are about
 * what the agent is made to decide and what the next screen is handed, which is
 * the only place "raised under the policy I meant" is either true or not.
 */
import { describe, expect, it } from 'vitest'
import type { EligibilityCoverage } from '@/core/models/nphies'
import {
  RAISE_AUTHORIZATION_ROUTE,
  coveragePickerIsShown,
  raiseAuthorizationHref,
  raiseBlockers,
  resolveCoveragePick,
} from './coverage-choice'

/** One `EligibilityCoverageResponse`, with only the fields a test varies named. */
const coverage = (over: Partial<EligibilityCoverage> = {}): EligibilityCoverage => ({
  id: 'COV-1',
  sequence: 1,
  coverageId: 'COV-1',
  memberId: 'M-4417',
  subscriberId: 'S-1',
  network: 'Gold',
  coveragePlan: 'Comprehensive',
  coverageClass: 'Class A',
  coverageGroup: 'G-1',
  policyHolderName: 'Al Dawaa Medical Services',
  inForce: true,
  benefitStart: '2026-01-01',
  benefitEnd: '2026-12-31',
  periodStart: '2026-01-01',
  periodEnd: '2026-12-31',
  ...over,
})

describe('oneCoverageIsSelectedWithoutAsking', () => {
  it('auto-selects a lone coverage and shows no picker', () => {
    const one = [coverage()]
    const pick = resolveCoveragePick(one, null)

    expect(pick.index).toBe(0)
    expect(pick.memberId).toBe('M-4417')
    // The 99% case costs no click, so there is nothing to satisfy and nothing
    // holding the act.
    expect(coveragePickerIsShown(one)).toBe(false)
    expect(raiseBlockers(one, pick)).toEqual([])
  })

  it('🚩 auto-selects a LONE EXPIRED coverage too — the rule is keyed on the count', () => {
    // Spec 209 story 21. Hiding an out-of-force policy behind a picker would say
    // what the Verdict column already says, and say it worse: the agent would be
    // asked to choose between one option for no reason. `inForce` is a fact ON
    // the row, never a filter over the rule.
    const expired = [coverage({ inForce: false, memberId: 'M-EXPIRED' })]
    const pick = resolveCoveragePick(expired, null)

    expect(pick.index).toBe(0)
    expect(pick.memberId).toBe('M-EXPIRED')
    expect(coveragePickerIsShown(expired)).toBe(false)
    expect(raiseBlockers(expired, pick)).toEqual([])
  })

  it('a lone coverage stays selected however the agent clicks', () => {
    // There is no state in which one coverage is unselected — an out-of-range or
    // stale pick cannot unselect it, because "selected" was never the agent's to
    // give in the first place.
    const one = [coverage()]
    expect(resolveCoveragePick(one, 7).index).toBe(0)
    expect(resolveCoveragePick(one, -1).index).toBe(0)
  })

  it('🚩 a lone coverage with NO member id is still selected, and still cannot be raised', () => {
    // `MemberId` is nullable on `EligibilityCoverageResponse`, and §7.1's `Open`
    // takes `{ eligibilityId, memberId }`. Carrying a blank one through the seam
    // would fail on the form the agent has just been sent to, rather than here,
    // where the reason is legible.
    const blank = [coverage({ memberId: '' })]
    const pick = resolveCoveragePick(blank, null)

    expect(pick.index).toBe(0)
    expect(pick.memberId).toBe('')
    expect(raiseBlockers(blank, pick)).toEqual(['noMemberId'])
  })

  it('no coverages at all: nothing selected, no picker, and the act says why', () => {
    const none: EligibilityCoverage[] = []
    const pick = resolveCoveragePick(none, null)

    expect(pick.index).toBe(null)
    expect(coveragePickerIsShown(none)).toBe(false)
    expect(raiseBlockers(none, pick)).toEqual(['noCoverages'])
  })
})

describe('twoCoveragesRefuseToProceedWithoutAChoice', () => {
  const two = [
    coverage({ id: 'COV-1', sequence: 1, memberId: 'M-1' }),
    coverage({ id: 'COV-2', sequence: 2, memberId: 'M-2', coveragePlan: 'Basic' }),
  ]

  it('🚩 supplies NO default — two coverages open unselected', () => {
    const pick = resolveCoveragePick(two, null)

    // Not the first, not the in-force one, not the one with the richer plan.
    // Any default here is the screen choosing the policy an authorization is
    // raised under, which is the one decision this ticket exists to make the
    // agent take.
    expect(pick.index).toBe(null)
    expect(pick.memberId).toBe('')
    expect(coveragePickerIsShown(two)).toBe(true)
  })

  it('blocks the raise until the agent picks, then releases it', () => {
    expect(raiseBlockers(two, resolveCoveragePick(two, null))).toEqual(['pickCoverage'])

    const picked = resolveCoveragePick(two, 1)
    expect(picked.index).toBe(1)
    expect(picked.memberId).toBe('M-2')
    expect(raiseBlockers(two, picked)).toEqual([])
  })

  it('🚩 an out-of-range pick is no pick — it never falls back to the first row', () => {
    // The failure mode a clamp would produce: a stale index from a previous
    // response, silently resolving to somebody's other policy.
    expect(resolveCoveragePick(two, 5).index).toBe(null)
    expect(resolveCoveragePick(two, -1).index).toBe(null)
    expect(resolveCoveragePick(two, 1.5).index).toBe(null)
  })

  it('three coverages behave as two do — the rule is "two or more"', () => {
    const three = [...two, coverage({ id: 'COV-3', sequence: 3, memberId: 'M-3' })]
    expect(coveragePickerIsShown(three)).toBe(true)
    expect(resolveCoveragePick(three, null).index).toBe(null)
    expect(raiseBlockers(three, resolveCoveragePick(three, 2))).toEqual([])
  })

  it('a picked coverage with no member id is still not raisable', () => {
    const withBlank = [two[0], coverage({ id: 'COV-9', memberId: '   ' })]
    const pick = resolveCoveragePick(withBlank, 1)
    expect(pick.index).toBe(1)
    expect(raiseBlockers(withBlank, pick)).toEqual(['noMemberId'])
  })
})

describe('theSeamCarriesTheEligibilityAndTheChosenMember', () => {
  it('carries BOTH ids, so the form can be reached cold days later', () => {
    // The decision that makes the two features independently buildable: WPF
    // carried the response object in a controller field, the web fetches it by
    // id. An authorization is often raised days after the check, from a row on
    // the list rather than in the same sitting.
    const href = raiseAuthorizationHref('ELG-78', 'M-4417')

    expect(href).toBe(`${RAISE_AUTHORIZATION_ROUTE}?from=ELG-78&coverage=M-4417`)
  })

  it('escapes both ids rather than pasting them into a query string', () => {
    const href = raiseAuthorizationHref('ELG/78 A', 'M&4417')
    expect(href).toBe(`${RAISE_AUTHORIZATION_ROUTE}?from=ELG%2F78%20A&coverage=M%264417`)
  })

  it('🚩 refuses to build a half-addressed URL', () => {
    // A seam missing either id lands on a form that cannot open. `null` is what
    // the screen renders as a withheld act with its reason, rather than an href
    // that looks live and is not.
    expect(raiseAuthorizationHref('ELG-78', '')).toBe(null)
    expect(raiseAuthorizationHref('', 'M-4417')).toBe(null)
    expect(raiseAuthorizationHref('  ', '  ')).toBe(null)
  })

  it('points at the authorization form route spec 209 §1 names', () => {
    // Stated as a literal here on purpose: 217 builds the other end, and if the
    // route moves this test is the thing that fails rather than a dead link an
    // agent finds.
    expect(RAISE_AUTHORIZATION_ROUTE).toBe('/nphies/authorizations/new')
  })
})
