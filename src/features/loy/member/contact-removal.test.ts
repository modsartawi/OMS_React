/**
 * The **contact removal** module's two rules (ticket 306, spec 301) — the
 * precondition that makes an unaccountable removal unconstructable, and the
 * shape of what leaves the browser.
 *
 * 🚩 Prior art is `actions-request.ts`, whose whole job is making a dangerous
 * call unrepresentable rather than merely unlikely. The danger here is the
 * mirror image of that one: not data leaving that should not, but a removal
 * happening with nothing on the trail to say **a person asked for it**
 * (ADR 0002 — the case reference is the whole "why").
 *
 * The second describe asserts the **body that leaves the browser**, not the
 * shape of an object, for the same reason 238's tests assert the URL: the thing
 * ADR 0002 forbids is the removed address being *published*, and publication is
 * a property of the request, not of a value in memory.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { loyCommandApi } from './api'
import {
  CASE_REFERENCE_MAX_LENGTH,
  emailRemovalVerdict,
  mobileRemovalVerdict,
  removalProblem,
} from './contact-removal'

describe('a removal cannot be constructed without a case reference', () => {
  it('🚩 refuses nothing at all — there is no removal to make', () => {
    expect(emailRemovalVerdict('')).toEqual({ state: 'noReference' })
  })

  it('🚩 refuses whitespace — a space bar is not an accountable removal', () => {
    expect(emailRemovalVerdict('   ')).toEqual({ state: 'noReference' })
    expect(emailRemovalVerdict('\t\n ')).toEqual({ state: 'noReference' })
  })

  it('refuses a reference longer than the cap, measured AFTER trimming', () => {
    const atCap = 'C'.repeat(CASE_REFERENCE_MAX_LENGTH)
    expect(emailRemovalVerdict(atCap).state).toBe('removable')
    // Trailing spaces are not length — a paste that picked up a newline is not
    // an over-long reference, it is the same reference.
    expect(emailRemovalVerdict(`  ${atCap}  `).state).toBe('removable')
    expect(emailRemovalVerdict(`${atCap}X`)).toEqual({ state: 'referenceTooLong' })
  })

  it('accepts an ordinary reference and carries it TRIMMED', () => {
    expect(emailRemovalVerdict('  CASE-4471 ')).toEqual({
      state: 'removable',
      removal: { clears: ['email'], blocks: false, caseReference: 'CASE-4471' },
    })
  })

  it('🚩 gives it no format rule — a phone call with no ticket is still a reference', () => {
    for (const typed of ['phone call 30 Aug', '4471', 'ticket #12/9', 'العميل اتصل']) {
      expect(emailRemovalVerdict(typed).state).toBe('removable')
    }
  })

  it('says nothing about an empty field and names the over-long one', () => {
    // An analyst who has typed nothing is not being told off — the control is
    // simply unarmed (the mobile command's rule, same reason).
    expect(removalProblem(emailRemovalVerdict(''))).toBeNull()
    expect(removalProblem(emailRemovalVerdict('CASE-1'))).toBeNull()
    // 🚩 And it says WHICH field it is about — the mobile removal asks for two,
    // and a cap complaint under the retyped id is an analyst hunting the wrong
    // input.
    expect(removalProblem(emailRemovalVerdict('C'.repeat(CASE_REFERENCE_MAX_LENGTH + 1)))).toEqual({
      field: 'caseReference',
      key: 'profile.caseReference.problem.tooLong',
    })
  })
})

describe('an email removal names the email and nothing else', () => {
  const verdict = emailRemovalVerdict('CASE-4471')
  const removal = verdict.state === 'removable' ? verdict.removal : null

  it('names the email field, and only it', () => {
    expect(removal?.clears).toEqual(['email'])
  })

  it('🚩 does NOT block the member — they keep their login, points and history', () => {
    expect(removal?.blocks).toBe(false)
  })

  it('🚩 carries the removed address NOWHERE — the wire body is the reference alone', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ statusCode: 200, success: true, message: '', errors: [], data: null }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    await loyCommandApi.removeEmail('100001293', removal!)

    const [url, init] = fetchMock.mock.calls.at(-1)!
    expect(String(url)).toContain('LoyWeb/Member/100001293/RemoveEmail')
    const body = JSON.parse(String((init as RequestInit).body))
    // Exactly one key. Not "no email key" — anything beyond the reference is a
    // value this command has no business republishing (ADR 0002).
    expect(Object.keys(body)).toEqual(['caseReference'])
    expect(body.caseReference).toBe('CASE-4471')
  })
})

/**
 * Ticket 307's first pure bullet. The failure being designed against is **not a
 * mis-click but the wrong member** — two members open in two tabs — and a
 * confirmation dialog does not prevent that, because people click through
 * dialogs. A retyped id does, because the wrong id is on screen and will not
 * match.
 *
 * 🚩 **Exact, and deliberately not trimmed or case-folded.** Every looser rule
 * has to answer "how much unlike the id on screen may this be", and the honest
 * answer for a command that destroys a login and leaves the loyalty id as the
 * only remaining handle is *not at all*.
 */
describe('a mobile removal needs both a reference and the exact loyalty id', () => {
  const MEMBER = '100001293'

  it('passes on the exact pair, and carries the reference trimmed', () => {
    expect(mobileRemovalVerdict('  CASE-77 ', MEMBER, MEMBER)).toEqual({
      state: 'removable',
      removal: {
        clears: ['mobile', 'mobileCountry'],
        blocks: true,
        caseReference: 'CASE-77',
      },
    })
  })

  it('🚩 refuses a WRONG id — the member in the other tab', () => {
    expect(mobileRemovalVerdict('CASE-77', '100004411', MEMBER)).toEqual({ state: 'idMismatch' })
  })

  it('🚩 refuses a whitespace-padded id — exact means exact', () => {
    expect(mobileRemovalVerdict('CASE-77', ` ${MEMBER}`, MEMBER)).toEqual({ state: 'idMismatch' })
    expect(mobileRemovalVerdict('CASE-77', `${MEMBER} `, MEMBER)).toEqual({ state: 'idMismatch' })
  })

  it('🚩 refuses an id differing only in case', () => {
    expect(mobileRemovalVerdict('CASE-77', 'm100a', 'M100A')).toEqual({ state: 'idMismatch' })
  })

  it('refuses a blank or whitespace reference even with the id right', () => {
    expect(mobileRemovalVerdict('', MEMBER, MEMBER)).toEqual({ state: 'noReference' })
    expect(mobileRemovalVerdict('   ', MEMBER, MEMBER)).toEqual({ state: 'noReference' })
  })

  it('refuses an over-long reference, measured after trimming', () => {
    const atCap = 'C'.repeat(CASE_REFERENCE_MAX_LENGTH)
    expect(mobileRemovalVerdict(atCap, MEMBER, MEMBER).state).toBe('removable')
    expect(mobileRemovalVerdict(`${atCap}X`, MEMBER, MEMBER)).toEqual({
      state: 'referenceTooLong',
    })
  })

  it('🚩 nothing typed at all is silent, and each named problem speaks as itself', () => {
    // The reference is asked for first, so an analyst is not told about an id
    // they have not reached yet.
    expect(removalProblem(mobileRemovalVerdict('', '', MEMBER))).toBeNull()
    expect(removalProblem(mobileRemovalVerdict('CASE-77', '', MEMBER))).toBeNull()
    expect(removalProblem(mobileRemovalVerdict('CASE-77', 'nope', MEMBER))).toEqual({
      field: 'loyId',
      key: 'profile.removeMobile.problem.idMismatch',
    })
    // 🚩 An over-long reference is the REFERENCE's problem even on the command
    // that asks for two things.
    expect(
      removalProblem(mobileRemovalVerdict('C'.repeat(CASE_REFERENCE_MAX_LENGTH + 1), MEMBER, MEMBER)),
    ).toEqual({ field: 'caseReference', key: 'profile.caseReference.problem.tooLong' })
  })
})

/**
 * Ticket 307's second pure bullet — **one module, two paths, two different
 * requests**, so the difference between the removals is a thing a test can read
 * rather than a thing two components happen to do.
 */
describe('the two removal paths differ, and neither carries an old value', () => {
  const email = emailRemovalVerdict('CASE-1')
  const mobile = mobileRemovalVerdict('CASE-1', 'M1', 'M1')
  const removals = [
    email.state === 'removable' ? email.removal : null,
    mobile.state === 'removable' ? mobile.removal : null,
  ]

  it('🚩 the mobile path clears the number AND its country code; the email path clears one field', () => {
    expect(removals[0]?.clears).toEqual(['email'])
    expect(removals[1]?.clears).toEqual(['mobile', 'mobileCountry'])
  })

  it('🚩 the mobile path BLOCKS and the email path does not — the whole difference in one flag', () => {
    expect(removals[0]?.blocks).toBe(false)
    expect(removals[1]?.blocks).toBe(true)
  })

  it('🚩 neither carries a removed value — the reference is the only thing either records', () => {
    for (const removal of removals) {
      expect(Object.keys(removal!).sort()).toEqual(['blocks', 'caseReference', 'clears'])
      expect(removal!.caseReference).toBe('CASE-1')
    }
  })

  it('🚩 the mobile body on the wire is the reference alone — the number goes nowhere new', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ statusCode: 200, success: true, message: '', errors: [], data: null }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    await loyCommandApi.removeMobile('100001293', removals[1]!)

    const [url, init] = fetchMock.mock.calls.at(-1)!
    expect(String(url)).toContain('LoyWeb/Member/100001293/RemoveMobile')
    const body = JSON.parse(String((init as RequestInit).body))
    expect(Object.keys(body)).toEqual(['caseReference'])
  })
})

afterEach(() => vi.unstubAllGlobals())
