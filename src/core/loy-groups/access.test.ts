/**
 * The loyalty-groups predicates (oms ticket 629, BackOffice spec 3173), over the one permissions answer since oms 909
 * (BackOffice spec 4002): `LoyaltyGroup:03` view, `LoyaltyGroup:02` maintain (brief row 22).
 *
 * 🚩 Maintain sits BESIDE view, never instead of it: a session that may maintain but not view gets nothing.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf, type ScreenKey } from '@/core/permissions'
import { canMaintainLoyGroups, canViewLoyGroups } from './api'

const holding = (...screens: ScreenKey[]) => permissionsOf({ screens })

describe('loy-groups predicates', () => {
  it('admits the view key, and maintain only on top of it', () => {
    expect(canViewLoyGroups(holding('LoyaltyGroup:03'))).toBe(true)
    expect(canMaintainLoyGroups(holding('LoyaltyGroup:03'))).toBe(false)
    expect(canMaintainLoyGroups(holding('LoyaltyGroup:03', 'LoyaltyGroup:02'))).toBe(true)
  })

  it('🚩 maintain without view still hides', () => {
    expect(canViewLoyGroups(holding('LoyaltyGroup:02'))).toBe(false)
    expect(canMaintainLoyGroups(holding('LoyaltyGroup:02'))).toBe(false)
  })

  it('🚩 hides on no key, a neighbour key or a failed answer', () => {
    for (const p of [holding(), holding('LoyMember:03'), permissionsOf(null)]) {
      expect(canViewLoyGroups(p)).toBe(false)
      expect(canMaintainLoyGroups(p)).toBe(false)
    }
  })
})
