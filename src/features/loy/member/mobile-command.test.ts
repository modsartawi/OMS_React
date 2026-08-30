/**
 * The mobile **member command**'s two rulings (ticket 305, spec 301).
 *
 * The number is the programme's login credential and one of only **two** ways a
 * member can be found at all, so both rulings here are about refusing to write
 * it: which refusals are named as themselves, and what the confirmation will not
 * let an analyst send in the first place.
 *
 * Neither is reachable from JSX while React Testing Library is unbootstrapped —
 * which is exactly why they live in a pure module and are pinned here.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { commandRefusalKey, commandRefusalText } from './member-commands'
import { mobileChangeVerdict, mobileProblemKey } from './mobile-command'

const refusal = (code: string) =>
  new ApiError('business', 'the server sentence', 400, [
    { errorCode: code, errorMessage: '', internalErrorCode: '' },
  ])

describe('eachRefusalIsNamedAsItselfRatherThanAsAFailure', () => {
  it('🚩 names the three the mobile command can meet, each as ITSELF', () => {
    // A collision is not a format problem and a no-op is not a collision. The
    // analyst has to know which of the three problems they have, so the three
    // codes map to three distinct keys and never to one shared "it failed".
    const keys = [
      commandRefusalKey(refusal('LOY-00109')),
      commandRefusalKey(refusal('LOY-00110')),
      commandRefusalKey(refusal('LOY-00111')),
    ]
    expect(keys).toEqual([
      'command.refusal.mobileAlreadyUsed',
      'command.refusal.sameMobile',
      'command.refusal.invalidMobile',
    ])
    expect(new Set(keys).size).toBe(3)
  })

  it('keeps the wave’s other refusals distinct from these three', () => {
    // One map serves every command on the screen, so a mobile code colliding
    // with a profile or status code would silently rename someone else's
    // refusal. Every key it can return is distinct.
    const all = [
      'LOY-00100',
      'LOY-00105',
      'LOY-00106',
      'LOY-00107',
      'LOY-00108',
      'LOY-00109',
      'LOY-00110',
      'LOY-00111',
    ].map((code) => commandRefusalKey(refusal(code)))
    expect(all.every((key) => key !== null)).toBe(true)
    expect(new Set(all).size).toBe(all.length)
  })

  it('🚩 falls back to the SERVER’s own sentence for a code it does not know', () => {
    // The backend half of spec 301 is unwritten, so these three codes are design
    // intent. The wrong-guess cost is the screen's extra wording and nothing
    // else: an unrecognised refusal is still explained in the server's words
    // rather than as a generic failure (`.claude/rules/api-envelope.md`).
    const t = (key: string, params?: Record<string, unknown>) =>
      key === 'command.refusal.pair' ? `${params!.named} ${params!.said}` : key
    expect(commandRefusalKey(refusal('LOY-99999'))).toBeNull()
    expect(commandRefusalText(refusal('LOY-99999'), 'a generic fallback', t)).toBe(
      'the server sentence',
    )
    // And a recognised one says BOTH — the screen's wording and the server's.
    expect(commandRefusalText(refusal('LOY-00109'), 'a generic fallback', t)).toBe(
      'command.refusal.mobileAlreadyUsed the server sentence',
    )
  })
})

describe('theConfirmationWillNotSendANumberItCanSeeIsWrong', () => {
  const verdict = (typed: string, current: string | null = '966555000111') =>
    mobileChangeVerdict(typed, current)

  it('takes a typed number as the compacted key the reads already use', () => {
    // Compaction is NOT normalisation — the rule that builds the loyalty base's
    // key is the door's (`LoyMobileNumbers.NormaliseTyped`), and a second
    // spelling of it here is how the two start to disagree.
    expect(verdict('+966 55 500-0222')).toEqual({ state: 'writable', mobile: '966555000222' })
    expect(verdict('  966555000222  ')).toEqual({ state: 'writable', mobile: '966555000222' })
  })

  it('says nothing at all about an empty field', () => {
    // Nothing typed yet is not a complaint. The confirm is simply unarmed.
    for (const blank of ['', '   ', ' - ', '+', '()']) {
      expect(verdict(blank).state).toBe('empty')
      expect(mobileProblemKey(verdict(blank))).toBeNull()
    }
  })

  it('🚩 refuses a number the member already has, so no snapshot records a no-op', () => {
    expect(verdict('966555000111').state).toBe('unchanged')
    // Including one typed with the punctuation the field tolerates — the same
    // number said differently is still the same number.
    expect(verdict('+966 555 000 111').state).toBe('unchanged')
    expect(mobileProblemKey(verdict('966555000111'))).toBe('profile.mobile.problem.unchanged')
  })

  it('🚩 is a COURTESY and never the authority — a member with no number on file', () => {
    // The stored number is normalised server-side and the typed one is not, so
    // `0555000111` and `966555000111` can be the same number and this cannot
    // tell. That is why "same mobile as now" also exists as a NAMED server
    // refusal: this check arrives earlier, the door decides.
    expect(verdict('0555000111').state).toBe('writable')
    for (const absent of [null, '', '   ']) {
      expect(verdict('966555000222', absent).state).toBe('writable')
    }
  })

  it('refuses what no normalisation could turn into a number', () => {
    // A typo must not become a member's credential, and a letter is never a
    // phone number under any dialling rule.
    for (const typed of ['not a number', '96655500011X', '966555000111a', '966555000111 ext 2']) {
      expect(verdict(typed).state).toBe('notANumber')
      expect(mobileProblemKey(verdict(typed))).toBe('profile.mobile.problem.notANumber')
    }
  })

  it('🚩 checks SHAPE and never a value — no length rule, no country rule', () => {
    // Column widths and the mobile-number ranges live in the database, not in
    // this repo. A cap invented here would refuse a change the door would have
    // accepted; an invalid number comes back as a named refusal instead.
    expect(verdict('7').state).toBe('writable')
    expect(verdict('9665550001110000000000').state).toBe('writable')
    expect(verdict('4915112345678').state).toBe('writable')
  })

  it('names a problem for exactly the two states that have one', () => {
    expect(mobileProblemKey({ state: 'writable', mobile: '966555000222' })).toBeNull()
    expect(mobileProblemKey({ state: 'empty' })).toBeNull()
    expect(mobileProblemKey({ state: 'unchanged' })).toBe('profile.mobile.problem.unchanged')
    expect(mobileProblemKey({ state: 'notANumber' })).toBe('profile.mobile.problem.notANumber')
  })
})
