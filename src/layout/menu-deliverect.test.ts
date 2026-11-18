/**
 * The Deliverect nav group, gated (ticket 477, BackOffice spec 2615).
 *
 * Read out of the **real** `MENU`, never re-declared, so a leaf that lost its gate or drifted onto another key fails
 * here. Each leaf reads its own key off the ONE permissions answer (oms 914, brief 3995 row 39): Stores =
 * `DeliverectStores:03`, Orders = `DeliverectOrders:03`, Catalog = `DeliverectCatalog:03`, Terms = `DeliverectTerms:03`.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf, type Permissions } from '@/core/permissions'
import { MENU, type ShellMenuItem } from './menu-model'
import { isGated, resolveMenu } from './useVisibleMenu'

const deliverect = MENU.find((g) => g.labelKey === 'deliverect-stores:menu.deliverect')

const leavesOf = (items: ShellMenuItem[]): ShellMenuItem[] => items.flatMap((i) => (i.items ? leavesOf(i.items) : [i]))
const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])
const holding = (...screens: string[]) => permissionsOf({ screens })
const visible = (p: Permissions) => labels(resolveMenu([deliverect!], p).items)

const STORES = 'DeliverectStores:03'
const ORDERS = 'DeliverectOrders:03'
const CATALOG = 'DeliverectCatalog:03'
const TERMS = 'DeliverectTerms:03'

describe('the Deliverect nav group', () => {
  it('comes right after Materials (551 put the HungerStation group after it, 847 Hybris stock after that; 607 Insurance rules last)', () => {
    expect(MENU.at(-4)).toBe(deliverect)
    expect(MENU.at(-5)?.labelKey).toBe('materials-search:menu.materials')
  })

  it('every leaf is gated; 477 shipped Stores, 478 appends Orders, 479 Catalog, 482 Terms', () => {
    const leaves = leavesOf([deliverect!])
    expect(leaves.map((l) => l.routerLink)).toEqual(['/deliverect/stores', '/deliverect/orders', '/deliverect/catalog', '/deliverect/terms'])
    for (const leaf of leaves) expect(isGated(leaf)).toBe(true)
  })

  it('appears for a session holding the stores key', () => {
    expect(visible(holding(STORES))).toEqual(['deliverect-stores:menu.deliverect', 'deliverect-stores:menu.stores'])
  })

  it('478: the Orders leaf follows its own key alone — a session granted only the monitor gets a one-leaf group', () => {
    expect(visible(holding(STORES, ORDERS))).toEqual([
      'deliverect-stores:menu.deliverect',
      'deliverect-stores:menu.stores',
      'deliverect-stores:menu.orders',
    ])
    expect(visible(holding(ORDERS))).toEqual(['deliverect-stores:menu.deliverect', 'deliverect-stores:menu.orders'])
  })

  it('479: the Catalog leaf follows its own key alone, after Orders', () => {
    expect(visible(holding(STORES, ORDERS, CATALOG))).toEqual([
      'deliverect-stores:menu.deliverect',
      'deliverect-stores:menu.stores',
      'deliverect-stores:menu.orders',
      'deliverect-stores:menu.catalog',
    ])
    expect(visible(holding(CATALOG))).toEqual(['deliverect-stores:menu.deliverect', 'deliverect-stores:menu.catalog'])
  })

  it('482: the Terms leaf follows its own key alone, LAST', () => {
    expect(visible(holding(STORES, ORDERS, CATALOG, TERMS))).toEqual([
      'deliverect-stores:menu.deliverect',
      'deliverect-stores:menu.stores',
      'deliverect-stores:menu.orders',
      'deliverect-stores:menu.catalog',
      'deliverect-stores:menu.terms',
    ])
    expect(visible(holding(TERMS))).toEqual(['deliverect-stores:menu.deliverect', 'deliverect-stores:menu.terms'])
  })

  it('🚩 disappears — group and all — without its keys, on near-miss keys, an error or while pending', () => {
    for (const p of [
      holding(),
      holding('DeliverectStores:02', 'DeliverectOrders:06', 'DeliverectPlatformAdd:03', 'HungerStationStores:03'),
      permissionsFromQuery({ isPending: false, isError: true, data: undefined }),
      permissionsFromQuery({ isPending: true, isError: false, data: undefined }),
    ])
      expect(resolveMenu([deliverect!], p).items).toEqual([])
  })
})
