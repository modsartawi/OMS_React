/**
 * The Deliverect nav group, gated (ticket 477, BackOffice spec 2615).
 *
 * Read out of the **real** `MENU`, never re-declared, so a leaf that lost its probe or drifted off
 * the ONE shared key fails here — 478, 479 and 482 each append a leaf to this group, and each must
 * ride `DELIVERECT_ACCESS_KEY` with its own flag's predicate.
 */
import { describe, expect, it } from 'vitest'
import { DELIVERECT_ACCESS_KEY } from '@/core/deliverect/api'
import { MENU, type ShellMenuItem } from './menu-model'
import { resolveMenu, type ProbeState } from './useVisibleMenu'

const deliverect = MENU.find((g) => g.labelKey === 'deliverect-stores:menu.deliverect')

const gatedLeaves = (items: ShellMenuItem[]): ShellMenuItem[] =>
  items.flatMap((i) => [...(i.access ? [i] : []), ...gatedLeaves(i.items ?? [])])
const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])

const probed = (data: unknown): ProbeState => ({ isPending: false, isSuccess: true, data })
const errored: ProbeState = { isPending: false, isSuccess: false, data: undefined }
const pending: ProbeState = { isPending: true, isSuccess: false, data: undefined }

const ALL = { canManageStores: true, canManageCatalog: true, canViewOrders: true, canManageTerms: true }

/** One state per gated leaf — at runtime they share the ONE key, so every leaf reads the same answer. */
const each = (state: ProbeState): ProbeState[] => gatedLeaves([deliverect!]).map(() => state)

describe('the Deliverect nav group', () => {
  it('comes right after Materials (551 put the HungerStation group after it; 607 Insurance rules after that, last)', () => {
    expect(MENU.at(-3)).toBe(deliverect)
    expect(MENU.at(-4)?.labelKey).toBe('materials-search:menu.materials')
  })

  it('every leaf rides the ONE shared key; 477 shipped Stores, 478 appends Orders, 479 Catalog, 482 Terms', () => {
    const leaves = gatedLeaves([deliverect!])
    expect(leaves.map((l) => l.routerLink)).toEqual(['/deliverect/stores', '/deliverect/orders', '/deliverect/catalog', '/deliverect/terms'])
    for (const leaf of leaves) expect(leaf.access!.key).toBe(DELIVERECT_ACCESS_KEY)
  })

  it('appears for a session holding canManageStores', () => {
    expect(labels(resolveMenu([deliverect!], each(probed({ ...ALL, canViewOrders: false, canManageCatalog: false, canManageTerms: false }))).items)).toEqual([
      'deliverect-stores:menu.deliverect',
      'deliverect-stores:menu.stores',
    ])
  })

  it('478: the Orders leaf follows canViewOrders alone — a session granted only the monitor gets a one-leaf group', () => {
    expect(labels(resolveMenu([deliverect!], each(probed({ ...ALL, canManageCatalog: false, canManageTerms: false }))).items)).toEqual([
      'deliverect-stores:menu.deliverect',
      'deliverect-stores:menu.stores',
      'deliverect-stores:menu.orders',
    ])
    expect(labels(resolveMenu([deliverect!], each(probed({ ...ALL, canManageStores: false, canManageCatalog: false, canManageTerms: false }))).items)).toEqual([
      'deliverect-stores:menu.deliverect',
      'deliverect-stores:menu.orders',
    ])
  })

  it('479: the Catalog leaf follows canManageCatalog alone, after Orders', () => {
    expect(labels(resolveMenu([deliverect!], each(probed({ ...ALL, canManageTerms: false }))).items)).toEqual([
      'deliverect-stores:menu.deliverect',
      'deliverect-stores:menu.stores',
      'deliverect-stores:menu.orders',
      'deliverect-stores:menu.catalog',
    ])
    expect(labels(resolveMenu([deliverect!], each(probed({ ...ALL, canManageStores: false, canViewOrders: false, canManageTerms: false }))).items)).toEqual([
      'deliverect-stores:menu.deliverect',
      'deliverect-stores:menu.catalog',
    ])
  })

  it('482: the Terms leaf follows canManageTerms alone, LAST', () => {
    expect(labels(resolveMenu([deliverect!], each(probed(ALL))).items)).toEqual([
      'deliverect-stores:menu.deliverect',
      'deliverect-stores:menu.stores',
      'deliverect-stores:menu.orders',
      'deliverect-stores:menu.catalog',
      'deliverect-stores:menu.terms',
    ])
    expect(labels(resolveMenu([deliverect!], each(probed({ canManageStores: false, canViewOrders: false, canManageCatalog: false, canManageTerms: true }))).items)).toEqual([
      'deliverect-stores:menu.deliverect',
      'deliverect-stores:menu.terms',
    ])
  })

  it('🚩 disappears — group and all — without its leaves’ flags, on an error, a malformed answer or while pending', () => {
    const none = { canManageStores: false, canViewOrders: false, canManageCatalog: false, canManageTerms: false }
    for (const state of [probed(none), errored, probed({}), probed({ ...none, canManageStores: 'true', canViewOrders: 'true', canManageCatalog: 'true', canManageTerms: 'true' }), pending])
      expect(resolveMenu([deliverect!], each(state)).items).toEqual([])
  })
})
