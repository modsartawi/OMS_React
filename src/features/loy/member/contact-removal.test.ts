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
  emailRemovalProblemKey,
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
    expect(emailRemovalProblemKey(emailRemovalVerdict(''))).toBeNull()
    expect(emailRemovalProblemKey(emailRemovalVerdict('CASE-1'))).toBeNull()
    expect(emailRemovalProblemKey(emailRemovalVerdict('C'.repeat(CASE_REFERENCE_MAX_LENGTH + 1)))).toBe(
      'profile.removeEmail.problem.tooLong',
    )
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

afterEach(() => vi.unstubAllGlobals())
