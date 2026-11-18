/**
 * The HungerStation nav group, gated (ticket 551, BackOffice spec 3028).
 *
 * Read out of the **real** `MENU`, never re-declared. 551 shipped three leaves — Stores, Materials (555) and Orders
 * (556) — each on its own grant; 665 added Promotions. Since oms 909 each reads its own key off the ONE permissions
 * answer (brief 3995 row 40): `HungerStationStores:03`, `HungerStationCatalog:03`, `HungerStationOrders:03`,
 * `HungerStationPromotions:03`.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf, type Permissions } from '@/core/permissions'
import { MENU, type ShellMenuItem } from './menu-model'
import { isGated, resolveMenu } from './useVisibleMenu'

const hungerstation = MENU.find((g) => g.labelKey === 'hungerstation-stores:menu.hungerstation')

const leavesOf = (items: ShellMenuItem[]): ShellMenuItem[] => items.flatMap((i) => (i.items ? leavesOf(i.items) : [i]))
const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])
const holding = (...screens: string[]) => permissionsOf({ screens })
const visible = (p: Permissions) => labels(resolveMenu([hungerstation!], p).items)

const ALL = ['HungerStationStores:03', 'HungerStationCatalog:03', 'HungerStationOrders:03', 'HungerStationPromotions:03']

describe('the HungerStation nav group', () => {
  it('is ONE group of its own, right after Deliverect (847 put Hybris stock after it; 607 Insurance rules last)', () => {
    expect(MENU.filter((g) => g.labelKey === 'hungerstation-stores:menu.hungerstation')).toHaveLength(1)
    expect(MENU.at(-3)).toBe(hungerstation)
    expect(MENU.at(-2)?.labelKey).toBe('hybris-stock-stores:menu.hybrisStock')
    expect(MENU.at(-4)?.labelKey).toBe('deliverect-stores:menu.deliverect')
  })

  it('every leaf is gated, in order', () => {
    const leaves = leavesOf([hungerstation!])
    expect(leaves.map((l) => l.routerLink)).toEqual(['/hungerstation/stores', '/hungerstation/materials', '/hungerstation/orders', '/hungerstation/promotions'])
    for (const leaf of leaves) expect(isGated(leaf)).toBe(true)
  })

  it('every key shows its own leaf, in order', () => {
    expect(visible(holding(...ALL))).toEqual([
      'hungerstation-stores:menu.hungerstation',
      'hungerstation-stores:menu.stores',
      'hungerstation-stores:menu.materials',
      'hungerstation-stores:menu.orders',
      'hungerstation-stores:menu.promotions',
    ])
  })

  it.each([
    ['HungerStationStores:03', 'hungerstation-stores:menu.stores'],
    ['HungerStationCatalog:03', 'hungerstation-stores:menu.materials'],
    ['HungerStationOrders:03', 'hungerstation-stores:menu.orders'],
    ['HungerStationPromotions:03', 'hungerstation-stores:menu.promotions'],
  ])('%s alone gives a one-leaf group', (key, leaf) => {
    expect(visible(holding(key))).toEqual(['hungerstation-stores:menu.hungerstation', leaf])
  })

  it('without the stores key the Stores leaf is hidden, the others stay', () => {
    expect(visible(holding(...ALL.slice(1)))).not.toContain('hungerstation-stores:menu.stores')
  })

  it('ticket 665: Promotions is hidden without its key, shown with it', () => {
    expect(visible(holding(...ALL.slice(0, 3)))).not.toContain('hungerstation-stores:menu.promotions')
    expect(visible(holding(...ALL))).toContain('hungerstation-stores:menu.promotions')
  })

  it('🚩 fails closed — group and all — on no keys, near-miss keys, an errored answer, or while pending', () => {
    for (const p of [
      holding(),
      holding('HungerStationStores:06', 'HungerStationPromotions:02', 'DeliverectStores:03'),
      permissionsFromQuery({ isPending: false, isError: true, data: undefined }),
      permissionsFromQuery({ isPending: true, isError: false, data: undefined }),
    ])
      expect(resolveMenu([hungerstation!], p).items).toEqual([])
  })
})
