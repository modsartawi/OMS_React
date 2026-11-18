/**
 * The Loyalty member predicates (ticket 234, spec 231 §11, spec 301 tiers), over the one permissions answer since oms
 * 909 (BackOffice spec 4002). Keys from the brief's mapping table (row 23): `LoyMember:03` look, `:02` edit, `:04`
 * remove the mobile.
 *
 * 🚩 The failure being designed against is a customer-PII lookup left open: only the exact key admits, and a pending
 * or failed answer is a denial. What the nav does is pinned in `src/layout/menu-loy.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf, type ScreenKey } from '@/core/permissions'
import { canEditLoyMember, canOpenLoyMember, canRemoveLoyMemberMobile, memberAuthority } from './api'

const holding = (...screens: ScreenKey[]) => permissionsOf({ screens })

describe('canOpenLoyMember', () => {
  it('admits LoyMember:03 and nothing else', () => {
    expect(canOpenLoyMember(holding('LoyMember:03'))).toBe(true)
    expect(canOpenLoyMember(holding())).toBe(false)
    // The write tiers are not the screen grant.
    expect(canOpenLoyMember(holding('LoyMember:02', 'LoyMember:04'))).toBe(false)
    // Neither is the loyalty-groups screen.
    expect(canOpenLoyMember(holding('LoyaltyGroup:03'))).toBe(false)
  })

  it('🚩 a failed answer is a denial', () => {
    expect(canOpenLoyMember(permissionsOf(null))).toBe(false)
  })
})

describe('the edit and remove predicates read only their own key', () => {
  const predicates = [
    ['LoyMember:02', canEditLoyMember],
    ['LoyMember:04', canRemoveLoyMemberMobile],
  ] as const

  it('admits its own key, and the other tier never leaks into it', () => {
    for (const [key, predicate] of predicates) {
      expect(predicate(holding('LoyMember:03', key))).toBe(true)
      const other = predicates.find(([k]) => k !== key)![0]
      expect(predicate(holding('LoyMember:03', other))).toBe(false)
      expect(predicate(holding('LoyMember:03'))).toBe(false)
      expect(predicate(permissionsOf(null))).toBe(false)
    }
  })
})

describe('memberAuthority', () => {
  it('reads the three tiers off ONE answer', () => {
    expect(memberAuthority(holding('LoyMember:03', 'LoyMember:02', 'LoyMember:04'))).toEqual({
      mayLook: true,
      mayEdit: true,
      mayRemoveMobile: true,
    })
  })

  it('draws the look-only session with no write authority at all', () => {
    expect(memberAuthority(holding('LoyMember:03'))).toEqual({ mayLook: true, mayEdit: false, mayRemoveMobile: false })
  })

  it('🚩 anchors every tier on may-look — an editor who cannot open the screen edits nothing', () => {
    expect(memberAuthority(holding('LoyMember:02', 'LoyMember:04'))).toEqual({
      mayLook: false,
      mayEdit: false,
      mayRemoveMobile: false,
    })
  })

  it('denies everything on a pending or errored answer', () => {
    const pending = permissionsOf(null, { settled: false, failed: false })
    for (const p of [pending, permissionsOf(null)]) {
      expect(memberAuthority(p)).toEqual({ mayLook: false, mayEdit: false, mayRemoveMobile: false })
    }
  })
})
