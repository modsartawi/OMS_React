/**
 * `member-header` — ticket 235's second pure Proof bullet: what the header
 * *says* about a member, proved without rendering one.
 *
 * The four rows of 230's table are four tests here, and the point of them is
 * the property they share: the chips are **additive and independent**, so
 * archived-and-blocked shows both facts and no rule decides between them.
 */
import { describe, expect, it } from 'vitest'
import type { LoyMember } from '@/core/models/loy'
import { memberBirthDate, memberChips } from './member-header'

const MEMBER: LoyMember = {
  loyId: '100001293',
  mobileCountry: 'SA',
  mobile: '966555000111',
  fullName: 'Nouf Al-Harbi',
  birthDate: '1990-11-08T00:00:00',
  gender: 'F',
  email: 'nouf.h@example.com',
  nationality: 'SA',
  nationalId: '1098443217',
  insuranceCompany: null,
  cityCode: 'RUH',
  preferredLanguage: 'AR',
  joinDate: '2021-03-14T00:00:00',
  lastUpdate: '2026-07-31T09:12:00',
  tier: 'G',
  tierPointsBalance: 8940,
  pendingPoints: 320,
  pointsBalance: 12480,
  pointsBalanceAmount: 561,
  pointsBalanceAmountCurrency: 'SAR',
  pointsExpireSoon: 1200,
  memberType: 'M',
  blockedReasonCode: null,
}

const member = (over: Partial<LoyMember> = {}): LoyMember => ({ ...MEMBER, ...over })
const kinds = (m: LoyMember) => memberChips(m).map((c) => c.kind)

describe('memberChips — 230, drawn', () => {
  it('🚩 M, not blocked → the tier alone: an ordinary member carries NO status chip', () => {
    expect(kinds(member())).toEqual(['tier'])
    expect(memberChips(member())[0]).toMatchObject({ code: 'G', labelKey: 'tier.gold' })
  })

  it('M, CM → tier + blocked', () => {
    expect(kinds(member({ blockedReasonCode: 'CM' }))).toEqual(['tier', 'blocked'])
  })

  it('A, not blocked → tier + type', () => {
    expect(kinds(member({ memberType: 'A' }))).toEqual(['tier', 'type'])
  })

  it('🚩 A, IA → all three: neither fact hides behind the other', () => {
    const chips = memberChips(member({ memberType: 'A', blockedReasonCode: 'IA' }))
    expect(chips.map((c) => c.kind)).toEqual(['tier', 'type', 'blocked'])
    expect(chips.map((c) => c.labelKey)).toEqual([
      'tier.gold',
      'memberType.archived',
      'blockedReason.inactive',
    ])
  })

  it('carries every non-M type, not just archived', () => {
    expect(memberChips(member({ memberType: 'N' }))[1]).toMatchObject({
      labelKey: 'memberType.nonLoyalty',
    })
    expect(memberChips(member({ memberType: 'F' }))[1]).toMatchObject({
      labelKey: 'memberType.family',
    })
  })

  it('🚩 hands an untranslatable code through with a null key, so the chip renders it bare', () => {
    const chips = memberChips(member({ tier: 'X', memberType: 'Z', blockedReasonCode: 'XZ' }))
    expect(chips.map((c) => c.code)).toEqual(['X', 'Z', 'XZ'])
    expect(chips.map((c) => c.labelKey)).toEqual([null, null, null])
  })

  it('draws no empty chip for a field the payload left absent', () => {
    // `tier` is nullable like every string on the model, and `memberType` arrives
    // only because the LoyWeb projection maps it through (230's amendment) — a
    // door shipping without that line must not produce a chip saying nothing.
    expect(kinds(member({ tier: null, memberType: null }))).toEqual([])
    expect(kinds(member({ tier: '', memberType: '', blockedReasonCode: '' }))).toEqual([])
  })

  it('🚩 reads a PADDED blocked reason as not blocked — the chip and the Status control agree', () => {
    // The code arrives from a `char`-backed column, so `'  '` is a member with no
    // block. `statusCommand` (303) reads it the same way, and the two must not
    // differ: a red "Blocked" chip above a Profile tab saying "this member is not
    // blocked" and offering Block is one screen telling an analyst two things.
    expect(kinds(member({ blockedReasonCode: '  ' }))).toEqual(['tier'])
    expect(kinds(member({ blockedReasonCode: '	' }))).toEqual(['tier'])
  })

  it('gives each chip a severity, so no call site invents a colour', () => {
    const chips = memberChips(member({ memberType: 'A', blockedReasonCode: 'CM' }))
    expect(chips.map((c) => c.sev)).toEqual(['warn', 'mute', 'bad'])
  })
})

describe('memberBirthDate', () => {
  it('renders a real birth date', () => {
    expect(memberBirthDate('1990-11-08T00:00:00')).toBe('08 Nov 1990')
  })

  it('🚩 suppresses the 0001-01-01 sentinel rather than presenting it as a fact', () => {
    expect(memberBirthDate('0001-01-01T00:00:00')).toBeNull()
  })

  it('treats an absent or unparseable value as absent', () => {
    expect(memberBirthDate(null)).toBeNull()
    expect(memberBirthDate('')).toBeNull()
    expect(memberBirthDate('not a date')).toBeNull()
  })
})
