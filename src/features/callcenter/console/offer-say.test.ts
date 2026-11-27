/**
 * Ticket 996 (spec 995 D7) — the Say lines: i18n keys filled from server facts, in English and
 * Arabic. The phone clause only when `channelOnly`; the deadline only within 14 days.
 */
import { describe, expect, it } from 'vitest'
import i18n from '@/core/i18n'
import { appliedSay, pitchSay } from './offer-say'
import type { GuidancePhrase } from './guidance-view'

const say = (phrases: GuidancePhrase[], lang = 'en') =>
  phrases.map((p) => i18n.getFixedT(lang)(p.key, p.params).replace(/<\/?offer>/g, '')).join(' ')

const OWNER = {
  description: '3+1',
  add: { qty: 3, free: 1 },
  badges: [
    { kind: 'phoneOnly' as const },
    { kind: 'tier' as const, codes: ['P', 'G', 'S'], qualifies: true },
    { kind: 'ends' as const, date: 'Thursday 3 December', days: 6 },
  ],
}

describe('sayDropsThePhoneClauseWhenNotChannelOnly', () => {
  it('the owner’s case: the add, phone only, and the deadline', () => {
    expect(say(pitchSay(OWNER))).toBe(
      'Take 3 more and you get 1 of them free. It’s only for phone orders. It ends on Thursday 3 December.',
    )
  })

  it('not channel-only → no phone clause', () => {
    const open = { ...OWNER, badges: OWNER.badges.filter((badge) => badge.kind !== 'phoneOnly') }
    expect(say(pitchSay(open))).toBe('Take 3 more and you get 1 of them free. It ends on Thursday 3 December.')
  })

  it('no end within 14 days → no deadline clause (the badge is not there)', () => {
    expect(say(pitchSay({ ...OWNER, badges: [OWNER.badges[0]] }))).toBe(
      'Take 3 more and you get 1 of them free. It’s only for phone orders.',
    )
  })

  it('no free unit in the add → the offer is named; no add at all → the pitch', () => {
    expect(say(pitchSay({ ...OWNER, add: { qty: 2, free: 0 }, badges: [] }))).toBe('Take 2 more and «3+1» applies.')
    expect(say(pitchSay({ ...OWNER, add: null, badges: [] }))).toBe('There’s an offer on this: «3+1».')
  })

  it('the same facts say themselves in Arabic, with the phone clause', () => {
    const arabic = say(pitchSay(OWNER), 'ar')
    expect(arabic).toMatch(/مجانًا/)
    expect(arabic).toMatch(/الهاتف/)
    expect(arabic).not.toMatch(/Take/)
  })
})

describe('appliedSayNamesTheEngineAmount', () => {
  it('one line: the saving and what the caller pays, all server figures', () => {
    const phrases = appliedSay({ amount: '98.00', currency: 'SAR', landed: { qty: 4, after: '294.00' }, keepAll: true })
    expect(say(phrases)).toBe('You save 98.00 SAR: you pay 294.00 SAR for 4. Keep all 4 to keep the free one.')
  })

  it('no single line → no pays clause; no free unit → no keep-all warning', () => {
    expect(appliedSay({ amount: '5.00', currency: 'SAR', landed: null, keepAll: false })).toEqual([])
  })
})
