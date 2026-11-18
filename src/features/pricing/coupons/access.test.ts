/**
 * The coupons screens' grants (spec 505, ticket 521), over the one permissions answer since oms 909 (BackOffice spec
 * 4002). The brief's CouponsAdmin combination: `canAdmin = has('CouponsAdmin:03')`,
 * `canSupport = has('CouponsSupport:03') || has('CouponsAdmin:03')`.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf, type ScreenKey } from '@/core/permissions'
import { canAdminCoupons, canSupportCoupons } from './api'

const holding = (...screens: ScreenKey[]) => permissionsOf({ screens })

describe('the CouponsAdmin combination', () => {
  it('an admin is a support agent too (the superset)', () => {
    expect(canAdminCoupons(holding('CouponsAdmin:03'))).toBe(true)
    expect(canSupportCoupons(holding('CouponsAdmin:03'))).toBe(true)
  })

  it('🚩 half grant: CouponsSupport:03 alone opens support, never admin', () => {
    expect(canSupportCoupons(holding('CouponsSupport:03'))).toBe(true)
    expect(canAdminCoupons(holding('CouponsSupport:03'))).toBe(false)
  })

  it('🚩 neither key, or a failed answer, opens nothing', () => {
    for (const p of [holding(), holding('BbyMaintain:03'), permissionsOf(null)]) {
      expect(canAdminCoupons(p)).toBe(false)
      expect(canSupportCoupons(p)).toBe(false)
    }
  })
})
