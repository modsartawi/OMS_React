/**
 * oms 914 (BackOffice spec 4002): the REAL `MENU` through the real `resolveMenu`, answered by the one permissions
 * answer. Pending hides every gated leaf and is not settled; an error hides every gated leaf and is settled; an
 * ADMIN-shaped answer (every two-field key, no three-field Attachments key — the engine's rule, brief 3995) shows every
 * leaf, and every leaf is gated.
 */
import { describe, expect, it } from 'vitest'
import { SCREEN_KEYS, permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { MENU, type ShellMenuItem } from './menu-model'
import { isGated, resolveMenu } from './useVisibleMenu'

const leaves = (items: ShellMenuItem[]): ShellMenuItem[] => items.flatMap((i) => (i.items ? leaves(i.items) : [i]))
const gatedLeaves = (items: ShellMenuItem[], above = false): ShellMenuItem[] =>
  items.flatMap((i) => {
    const gated = above || isGated(i)
    return i.items ? gatedLeaves(i.items, gated) : gated ? [i] : []
  })
const labels = (items: ShellMenuItem[]): string[] => leaves(items).map((i) => i.labelKey)

/** ADMIN on a host with every extra on (the extras are host facts, not grants). */
const HOST_ON = {
  fileServerReady: true,
  notificationCenterOn: true,
  nphiesContractVersion: '1.3',
  canManageRoles: true,
  canManageUsers: true,
}
const ADMIN = permissionsOf({ screens: [...SCREEN_KEYS], extras: HOST_ON })
const offered = () => true

describe('the real MENU over the one permissions answer', () => {
  it('every leaf is gated (an ungated one would need a reason)', () => {
    const ungated = leaves(MENU).filter((l) => !gatedLeaves(MENU).includes(l))
    expect(ungated.map((l) => l.labelKey)).toEqual([])
  })

  it('pending ⇒ every gated leaf hidden, and not settled', () => {
    const r = resolveMenu(MENU, permissionsFromQuery({ isPending: true, isError: false, data: undefined }), offered)
    expect(r.settled).toBe(false)
    expect(r.items).toEqual([])
  })

  it('error ⇒ every gated leaf hidden, settled', () => {
    const r = resolveMenu(MENU, permissionsFromQuery({ isPending: false, isError: true, data: undefined }), offered)
    expect(r.settled).toBe(true)
    expect(r.items).toEqual([])
  })

  it('no grants ⇒ an empty, settled menu', () => {
    const r = resolveMenu(MENU, permissionsOf({ screens: [] }), offered)
    expect(r.settled).toBe(true)
    expect(r.items).toEqual([])
  })

  it('an ADMIN-shaped answer ⇒ every leaf', () => {
    expect(labels(resolveMenu(MENU, ADMIN, offered).items)).toEqual(labels(MENU))
  })

  it('…but My schedules (886) and the two My exports leaves (4318) still wait for their doors to offer them', () => {
    const shown = labels(resolveMenu(MENU, ADMIN).items)
    expect(labels(MENU).filter((l) => !shown.includes(l))).toEqual([
      'inquiry-export:menu.myExports',
      'inquiry-export:menu.myExports',
      'boards:menu.mySchedules',
    ])
  })

  it('ADMIN on a host with the notification center off ⇒ every leaf but Send broadcast (an extra, not a grant)', () => {
    const off = permissionsOf({ screens: [...SCREEN_KEYS], extras: { ...HOST_ON, notificationCenterOn: false } })
    const shown = labels(resolveMenu(MENU, off, offered).items)
    expect(labels(MENU).filter((l) => !shown.includes(l))).toEqual(['broadcast:menu.sendBroadcast'])
  })

  it('every key a leaf reads is one ADMIN holds — no leaf hangs on a three-field Attachments key', () => {
    for (const leaf of gatedLeaves(MENU)) {
      if (leaf.key) expect(SCREEN_KEYS).toContain(leaf.key)
    }
  })

  it('a single grant shows exactly its own leaves', () => {
    expect(labels(resolveMenu(MENU, permissionsOf({ screens: ['CallCenter:03'] }), offered).items)).toEqual([
      'callcenter:menu.console',
    ])
  })
})
