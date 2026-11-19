/**
 * The Mini POS nav group (oms 915, BackOffice spec 4032): three leaves, each on `MiniPosAdmin:03` off the one permissions
 * answer, failing closed. `MiniPosAdmin:06` alone (or the promoter's `MiniPos:03`) opens nothing. Read out of the real
 * `MENU`, never re-declared.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { MENU, type ShellMenuItem } from './menu-model'
import { isGated, resolveMenu } from './useVisibleMenu'

const group = MENU.find((g) => g.labelKey === 'mini-pos-assignments:menu.group')
const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])
const holding = (...screens: string[]) => permissionsOf({ screens })

describe('the Mini POS nav group', () => {
  it('has the three screens under /mini-pos, each gated', () => {
    expect(group).toBeDefined()
    expect(group!.items!.map((i) => i.routerLink)).toEqual(['/mini-pos/assignments', '/mini-pos/stores', '/mini-pos/items'])
    for (const leaf of group!.items!) expect(isGated(leaf)).toBe(true)
  })

  it('appears whole for MiniPosAdmin:03', () => {
    expect(labels(resolveMenu([group!], holding('MiniPosAdmin:03')).items)).toEqual([
      'mini-pos-assignments:menu.group',
      'mini-pos-assignments:menu.assignments',
      'mini-pos-assignments:menu.stores',
      'mini-pos-assignments:menu.items',
    ])
  })

  it('disappears for a denial, the manage key alone, the promoter key, an error and pending', () => {
    const errored = permissionsFromQuery({ isPending: false, isError: true, data: undefined })
    const pending = permissionsFromQuery({ isPending: true, isError: false, data: undefined })
    for (const p of [holding(), holding('MiniPosAdmin:06'), holding('MiniPos:03'), errored, pending])
      expect(resolveMenu([group!], p).items).toEqual([])
  })
})
