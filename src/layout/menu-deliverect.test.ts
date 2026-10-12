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

describe('the Deliverect nav group', () => {
  it('is the LAST group, right after Materials', () => {
    expect(MENU.at(-1)).toBe(deliverect)
    expect(MENU.at(-2)?.labelKey).toBe('materials-search:menu.materials')
  })

  it('every leaf rides the ONE shared key; 477 ships only Stores', () => {
    const leaves = gatedLeaves([deliverect!])
    expect(leaves.map((l) => l.routerLink)).toEqual(['/deliverect/stores'])
    for (const leaf of leaves) expect(leaf.access!.key).toBe(DELIVERECT_ACCESS_KEY)
  })

  it('appears for a session holding canManageStores', () => {
    expect(labels(resolveMenu([deliverect!], [probed(ALL)]).items)).toEqual([
      'deliverect-stores:menu.deliverect',
      'deliverect-stores:menu.stores',
    ])
  })

  it('🚩 disappears — group and all — without canManageStores, on an error, a malformed answer or while pending', () => {
    for (const state of [probed({ ...ALL, canManageStores: false }), errored, probed({}), probed({ ...ALL, canManageStores: 'true' }), pending])
      expect(resolveMenu([deliverect!], [state]).items).toEqual([])
  })
})
