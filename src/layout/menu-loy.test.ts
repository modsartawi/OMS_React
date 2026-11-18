/**
 * The Loyalty nav group, gated (ticket 234, spec 231 §11).
 *
 * `resolveMenu` is the pure half of `useVisibleMenu` (ticket 124), so what the shell does with each answer is provable
 * with no renderer. Since oms 909 both leaves read the ONE permissions answer (brief 3995 rows 22–23): Members =
 * `LoyMember:03`, Groups = `LoyaltyGroup:03`. The group is read out of the **real** `MENU`, never re-declared.
 *
 * 🚩 A denial, an errored answer and a pending one must be indistinguishable: fail-closed is the whole ticket, and the
 * failure it is designed against is a customer-PII surface left in the nav because the answer errored.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { MENU, type ShellMenuItem } from './menu-model'
import { isGated, resolveMenu } from './useVisibleMenu'

const loyalty = MENU.find((g) => g.labelKey === 'loy:menu.loyalty')

const leavesOf = (items: ShellMenuItem[]): ShellMenuItem[] => items.flatMap((i) => (i.items ? leavesOf(i.items) : [i]))
const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])
const holding = (...screens: string[]) => permissionsOf({ screens })
const errored = permissionsFromQuery({ isPending: false, isError: true, data: undefined })
const pending = permissionsFromQuery({ isPending: true, isError: false, data: undefined })

describe('the Loyalty nav group', () => {
  it('exists, with the member lookup gated', () => {
    expect(loyalty).toBeDefined()
    const leaves = leavesOf([loyalty!])
    expect(leaves).toHaveLength(2)
    expect(leaves[0].routerLink).toBe('/loy/members')
    for (const leaf of leaves) expect(isGated(leaf)).toBe(true)
  })

  it('appears for a session holding LoyMember:03', () => {
    expect(labels(resolveMenu([loyalty!], holding('LoyMember:03')).items)).toEqual(['loy:menu.loyalty', 'loy:menu.members'])
  })

  it('🚩 disappears — group and all — for a denial, a near-miss key, an ERROR and pending alike', () => {
    for (const p of [holding(), holding('LoyMember:02', 'LoyMember:04'), errored, pending]) {
      // The group vanishes with its children, so an empty "Loyalty" header is never left offering nothing.
      expect(resolveMenu([loyalty!], p).items).toEqual([])
    }
  })

  it('reports an errored answer as SETTLED — failing closed must not hang the menu', () => {
    expect(resolveMenu([loyalty!], errored).settled).toBe(true)
  })
})

/** The Loyalty groups leaf (oms ticket 629, BackOffice spec 3173) — its own key, failing closed like Members. */
describe('the Loyalty groups leaf', () => {
  const groupsLeaf = () => leavesOf([loyalty!])[1]

  it('sits beside Members', () => {
    expect(groupsLeaf().routerLink).toBe('/loy/groups')
    expect(groupsLeaf().labelKey).toBe('loy-groups:menu.groups')
  })

  it('appears on the view key, alone if the member grant is missing', () => {
    expect(labels(resolveMenu([loyalty!], holding('LoyaltyGroup:03')).items)).toEqual([
      'loy:menu.loyalty',
      'loy-groups:menu.groups',
    ])
  })

  it('🚩 hides without the view key — maintain-without-view (LoyaltyGroup:02 alone) included', () => {
    for (const extra of [[], ['LoyaltyGroup:02']]) {
      expect(labels(resolveMenu([loyalty!], holding('LoyMember:03', ...extra)).items)).toEqual([
        'loy:menu.loyalty',
        'loy:menu.members',
      ])
    }
  })
})
