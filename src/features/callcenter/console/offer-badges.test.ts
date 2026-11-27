/**
 * Ticket 996 (spec 995 D4) — the badges are server facts, never client rules. The only thing the
 * console works out is days left, against its own clock, and that is shown within 14 days.
 */
import { describe, expect, it } from 'vitest'
import i18n from '@/core/i18n'
import type { OfferAudience } from '@/core/models/callcenter'
import { formatOfferDay, offerBadges, tierPhrase, type OfferBadge } from './offer-badges'

const en = i18n.getFixedT('en')
/** The owner's walk: Friday 27 November 2026, mid-afternoon, local time. */
const WALK = new Date(2026, 10, 27, 15, 30)
const everyone: OfferAudience = { channelOnly: false, tiers: [], callerQualifies: true }
const named = (codes: string[]) => {
  const phrase = tierPhrase(codes, en, 'en')
  return en(phrase.key, phrase.params)
}
const kinds = (badges: OfferBadge[]) => badges.map((badge) => badge.kind)

describe('endsBadgeOnlyWithinFourteenDays', () => {
  it('ends Thu 3 Dec → 6 days left', () => {
    const [ends] = offerBadges(everyone, '2026-12-03', WALK)
    expect(ends).toMatchObject({ kind: 'ends', date: '2026-12-03', days: 6 })
  })

  it('a server datetime is read as its day', () => {
    expect(offerBadges(everyone, '2026-12-03T00:00:00', WALK)[0]).toMatchObject({ days: 6 })
  })

  it('14 days is shown; 15 is not', () => {
    expect(kinds(offerBadges(everyone, '2026-12-11', WALK))).toEqual(['ends'])
    expect(kinds(offerBadges(everyone, '2026-12-12', WALK))).toEqual([])
  })

  it('ends today is 0 days, and an end in the past or no end shows nothing', () => {
    expect(offerBadges(everyone, '2026-11-27', WALK)[0]).toMatchObject({ days: 0 })
    expect(offerBadges(everyone, '2026-11-26', WALK)).toEqual([])
    expect(offerBadges(everyone, null, WALK)).toEqual([])
    expect(offerBadges(everyone, 'not a date', WALK)).toEqual([])
  })
})

describe('tierBadgeSaysWhetherTheCallerQualifies', () => {
  it('tiers P,G,S with a qualifying caller → the tiers named as any-of, ✓', () => {
    const badges = offerBadges({ channelOnly: false, tiers: ['P', 'G', 'S'], callerQualifies: true }, null, WALK)
    const tier = badges.find((badge) => badge.kind === 'tier')
    expect(tier).toMatchObject({ kind: 'tier', qualifies: true })
    expect(tier?.kind === 'tier' && named(tier.codes)).toBe('Platinum, Gold, or Silver members')
  })

  it('a caller outside the tiers → ✗', () => {
    const [tier] = offerBadges({ channelOnly: false, tiers: ['S'], callerQualifies: false }, null, WALK)
    expect(tier).toMatchObject({ kind: 'tier', qualifies: false })
  })

  it('an unknown tier code is shown as the code, never dropped', () => {
    const [tier] = offerBadges({ channelOnly: false, tiers: ['X'], callerQualifies: true }, null, WALK)
    expect(tier?.kind === 'tier' && named(tier.codes)).toBe('X members')
  })

  it('no tiers → no tier badge; no audience → no audience badges', () => {
    expect(kinds(offerBadges(everyone, null, WALK))).toEqual([])
    expect(kinds(offerBadges(null, null, WALK))).toEqual([])
  })

  it('phone-only first, then the tier, then the end date', () => {
    const owner: OfferAudience = { channelOnly: true, tiers: ['P', 'G', 'S'], callerQualifies: true }
    expect(kinds(offerBadges(owner, '2026-12-03', WALK))).toEqual(['phoneOnly', 'tier', 'ends'])
  })
})

describe('theEndDayReadsAsTheWalkSaysIt', () => {
  it('English: Thu 3 Dec; the Say line: Thursday 3 December', () => {
    expect(formatOfferDay('2026-12-03', 'en')).toBe('Thu 3 Dec')
    expect(formatOfferDay('2026-12-03', 'en', 'long')).toBe('Thursday 3 December')
  })
})
