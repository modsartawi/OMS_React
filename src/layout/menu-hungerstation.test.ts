/**
 * The HungerStation nav group, gated (ticket 551, BackOffice spec 3028).
 *
 * Read out of the **real** `MENU`, never re-declared, so a leaf that lost its probe or drifted off
 * the ONE shared key fails here. 551 shipped all three leaves — Stores, Materials (555) and Orders
 * (556) — each on its own flag.
 */
import { describe, expect, it } from 'vitest'
import { HUNGERSTATION_ACCESS_KEY } from '@/core/hungerstation/api'
import { MENU, type ShellMenuItem } from './menu-model'
import { resolveMenu, type ProbeState } from './useVisibleMenu'

const hungerstation = MENU.find((g) => g.labelKey === 'hungerstation-stores:menu.hungerstation')

const gatedLeaves = (items: ShellMenuItem[]): ShellMenuItem[] =>
  items.flatMap((i) => [...(i.access ? [i] : []), ...gatedLeaves(i.items ?? [])])
const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])

const probed = (data: unknown): ProbeState => ({ isPending: false, isSuccess: true, data })
const errored: ProbeState = { isPending: false, isSuccess: false, data: undefined }
const pending: ProbeState = { isPending: true, isSuccess: false, data: undefined }

const NONE = { canManageStores: false, canManageCatalog: false, canViewOrders: false }

/** One state per gated leaf — at runtime they share the ONE key, so every leaf reads the same answer. */
const each = (state: ProbeState): ProbeState[] => gatedLeaves([hungerstation!]).map(() => state)
const visible = (state: ProbeState) => labels(resolveMenu([hungerstation!], each(state)).items)

describe('the HungerStation nav group', () => {
  it('is ONE group of its own, the LAST, right after Deliverect', () => {
    expect(MENU.filter((g) => g.labelKey === 'hungerstation-stores:menu.hungerstation')).toHaveLength(1)
    expect(MENU.at(-1)).toBe(hungerstation)
    expect(MENU.at(-2)?.labelKey).toBe('deliverect-stores:menu.deliverect')
  })

  it('one probe call: every leaf rides the ONE shared key, on HungerStationWeb/Access', () => {
    const leaves = gatedLeaves([hungerstation!])
    expect(leaves.map((l) => l.routerLink)).toEqual(['/hungerstation/stores', '/hungerstation/materials', '/hungerstation/orders'])
    for (const leaf of leaves) expect(leaf.access!.key).toBe(HUNGERSTATION_ACCESS_KEY)
    expect(new Set(leaves.map((l) => l.access!.key)).size).toBe(1)
  })

  it('every flag shows its own leaf, in order', () => {
    expect(visible(probed({ canManageStores: true, canManageCatalog: true, canViewOrders: true }))).toEqual([
      'hungerstation-stores:menu.hungerstation',
      'hungerstation-stores:menu.stores',
      'hungerstation-stores:menu.materials',
      'hungerstation-stores:menu.orders',
    ])
  })

  it.each([
    ['canManageStores', 'hungerstation-stores:menu.stores'],
    ['canManageCatalog', 'hungerstation-stores:menu.materials'],
    ['canViewOrders', 'hungerstation-stores:menu.orders'],
  ])('%s alone gives a one-leaf group', (flag, leaf) => {
    expect(visible(probed({ ...NONE, [flag]: true }))).toEqual(['hungerstation-stores:menu.hungerstation', leaf])
  })

  it('without canManageStores the Stores leaf is hidden, the others stay', () => {
    expect(visible(probed({ canManageStores: false, canManageCatalog: true, canViewOrders: true }))).not.toContain('hungerstation-stores:menu.stores')
  })

  it('🚩 fails closed — group and all — on no flags, a 403 or failed probe, a malformed answer, or while pending', () => {
    for (const state of [probed(NONE), errored, probed({}), probed([]), probed({ canManageStores: 'true', canManageCatalog: 1, canViewOrders: 'yes' }), pending])
      expect(resolveMenu([hungerstation!], each(state)).items).toEqual([])
  })
})
