/**
 * The two Coupons nav leaves (spec 505, tickets 521/523) through the menu, over the ONE permissions answer (oms 909,
 * BackOffice spec 4002): the admin leaf on `canAdminCoupons` (`CouponsAdmin:03`), the support leaf on
 * `canSupportCoupons` (`CouponsSupport:03` OR `CouponsAdmin:03`). The predicates' own cases are in
 * `features/pricing/coupons/access.test.ts`; here the leaves are read out of the **real** `MENU`, never re-declared.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf, type ScreenKey } from '@/core/permissions'
import { MENU, type ShellMenuItem } from './menu-model'
import { isGated, resolveMenu } from './useVisibleMenu'

const ADMIN = 'coupons:menu.coupons'
const SUPPORT = 'coupons:menu.couponSupport'
const pricing = MENU.find((g) => g.labelKey === 'simulation:menu.pricing')!
/** The two Coupons leaves alone, under their group, so the other Pricing leaves do not take part. */
const group: ShellMenuItem = { ...pricing, items: (pricing.items ?? []).filter((i) => i.labelKey === ADMIN || i.labelKey === SUPPORT) }
const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])
const visible = (...screens: ScreenKey[]) => labels(resolveMenu([group], permissionsOf({ screens })).items)

describe('the Coupons leaves through the menu', () => {
  it('sit under Pricing, both gated', () => {
    expect(group.items?.map((i) => i.labelKey)).toEqual([ADMIN, SUPPORT])
    expect(group.items?.every(isGated)).toBe(true)
  })

  it('CouponsAdmin:03 shows both leaves (an admin is a support agent too)', () => {
    expect(visible('CouponsAdmin:03')).toEqual([pricing.labelKey, ADMIN, SUPPORT])
  })

  it('🚩 half grant: CouponsSupport:03 alone shows the support leaf and never the admin one', () => {
    expect(visible('CouponsSupport:03')).toEqual([pricing.labelKey, SUPPORT])
  })

  it('🚩 fails closed: no Coupons key, an errored or a pending answer drops the group', () => {
    for (const p of [
      permissionsOf({ screens: ['BbyMaintain:03'] }),
      permissionsFromQuery({ isPending: false, isError: true, data: undefined }),
      permissionsFromQuery({ isPending: true, isError: false, data: undefined }),
    ]) {
      expect(resolveMenu([group], p).items).toEqual([])
    }
  })
})
