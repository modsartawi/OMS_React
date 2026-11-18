/**
 * The Bonus Buy Maintenance nav leaf (ticket 416, BackOffice spec 2374 story 85): hidden from the navigation of a
 * session without the `BbyMaintain` grant — `BbyMaintain:03` off the ONE permissions answer (oms 909). The leaf is
 * read out of the **real** `MENU`, never re-declared.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { MENU, type ShellMenuItem } from './menu-model'
import { isGated, resolveMenu } from './useVisibleMenu'

const pricing = MENU.find((g) => g.labelKey === 'simulation:menu.pricing')!
const leaf = (pricing.items ?? []).find((i) => i.labelKey === 'bonus-buy-maintenance:menu.bonusBuyMaintenance')!
/** The leaf alone, under its group, so the other Pricing leaves do not take part. */
const group: ShellMenuItem = { ...pricing, items: [leaf] }
const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])
const holding = (...screens: string[]) => permissionsOf({ screens })

describe('nav entry hidden without BbyMaintain:03', () => {
  it('sits under Pricing, gated', () => {
    expect(leaf.routerLink).toBe('/pricing/bonus-buy-maintenance')
    expect(isGated(leaf)).toBe(true)
  })

  it('BbyMaintain:03 → shown', () => {
    expect(labels(resolveMenu([group], holding('BbyMaintain:03')).items)).toContain(
      'bonus-buy-maintenance:menu.bonusBuyMaintenance',
    )
  })

  it('🚩 half-grant: BbyMaintain:04 alone → hidden (the delete/test key needs the screen key)', () => {
    expect(resolveMenu([group], holding('BbyMaintain:04')).items).toEqual([])
  })

  it('🚩 fails closed: no grant, another Bby key, errored or pending → hidden', () => {
    for (const p of [
      holding(),
      holding('BbyInquiry:03'),
      permissionsFromQuery({ isPending: false, isError: true, data: undefined }),
      permissionsFromQuery({ isPending: true, isError: false, data: undefined }),
    ]) {
      expect(resolveMenu([group], p).items).toEqual([])
    }
  })
})
