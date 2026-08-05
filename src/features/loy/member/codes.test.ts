/**
 * `codes` — ticket 235's first pure Proof bullet, and the test that makes 229's
 * rule enforceable rather than a convention.
 *
 * Every assertion states an external behaviour: an agent reading "Gold", or
 * reading a bare `X` for a tier the server invented after this shipped. 🚩 The
 * degrade case is the reason the module exists — a raw `loy:tier.X` on screen is
 * the failure, and it is one keystroke away at any call site that reaches for
 * `t(key, { defaultValue })` instead.
 */
import { describe, expect, it } from 'vitest'
import * as codes from './codes'
import { activityStatusKey, blockedReasonKey, memberTypeKey, tierKey } from './codes'

describe('tierKey', () => {
  it('maps the three tiers closed by GetTiers', () => {
    expect(tierKey('S')).toBe('tier.silver')
    expect(tierKey('G')).toBe('tier.gold')
    expect(tierKey('P')).toBe('tier.platinum')
  })

  it('🚩 returns null for a tier outside the set, so the caller renders the bare code', () => {
    expect(tierKey('X')).toBeNull()
    // The set is closed in source, not case-insensitive: a lowercase value is a
    // value the server never wrote, and guessing at it would be a shape rule.
    expect(tierKey('g')).toBeNull()
  })

  it('treats every spelling of absent as absent — the model is all-nullable', () => {
    expect(tierKey(null)).toBeNull()
    expect(tierKey(undefined)).toBeNull()
    expect(tierKey('')).toBeNull()
  })
})

describe('memberTypeKey', () => {
  it('maps the four types closed by LoyMemberTypeConstants', () => {
    expect(memberTypeKey('M')).toBe('memberType.member')
    expect(memberTypeKey('N')).toBe('memberType.nonLoyalty')
    expect(memberTypeKey('A')).toBe('memberType.archived')
    expect(memberTypeKey('F')).toBe('memberType.family')
  })

  it('degrades an unknown type to the bare code', () => {
    expect(memberTypeKey('Z')).toBeNull()
    expect(memberTypeKey(null)).toBeNull()
  })
})

describe('activityStatusKey', () => {
  it('maps the four statuses closed by LoyActivityStatusConstants', () => {
    expect(activityStatusKey('A')).toBe('activityStatus.added')
    expect(activityStatusKey('P')).toBe('activityStatus.posted')
    expect(activityStatusKey('N')).toBe('activityStatus.pending')
    expect(activityStatusKey('E')).toBe('activityStatus.error')
  })

  it('degrades an unknown status to the bare code', () => {
    expect(activityStatusKey('Q')).toBeNull()
    expect(activityStatusKey('')).toBeNull()
  })
})

describe('blockedReasonKey', () => {
  it('maps the two code-bearing reasons', () => {
    expect(blockedReasonKey('CM')).toBe('blockedReason.mobileMoved')
    expect(blockedReasonKey('IA')).toBe('blockedReason.inactive')
  })

  it('🚩 degrades an unseeded master-table reason to the bare code', () => {
    // The set is OPEN — a mapped master table — so this is the ordinary case and
    // not an edge one. `XZ` renders as `XZ`, never as `loy:blockedReason.XZ`.
    expect(blockedReasonKey('XZ')).toBeNull()
  })

  it('reads an unblocked member as no reason at all', () => {
    expect(blockedReasonKey(null)).toBeNull()
    expect(blockedReasonKey('')).toBeNull()
  })
})

describe('the codes that are NOT translated', () => {
  it('🚩 offers no gender map — it looks closed and is not', () => {
    // Guarded as an absence, because the pressure to add `{ M: …, F: … }` here is
    // exactly what 229 clause 3 refused: `LoyMember.Gender` is whatever sign-up
    // wrote, unvalidated, and `GenderConst` holds the words rather than the codes.
    expect(Object.keys(codes).filter((name) => /gender|nationality|city|store/i.test(name))).toEqual(
      [],
    )
  })
})
