/**
 * The Loyalty nav group, gated (ticket 234, spec 231 §11).
 *
 * `resolveMenu` is the pure half of `useVisibleMenu` (ticket 124), so what the
 * shell does with each answer the Loy probe can produce is provable with no
 * renderer — which, while the `LoyWeb` door is unbuilt, is the only proof this
 * wave has. The group is read out of the **real** `MENU`, never re-declared, so
 * a leaf that lost its probe or drifted off the shared key fails here.
 *
 * 🚩 A denial, a thrown probe and a malformed answer must be indistinguishable:
 * fail-closed is the whole ticket, and the failure it is designed against is a
 * customer-PII surface left in the nav because a probe errored.
 */
import { describe, expect, it } from 'vitest'
import { LOY_GROUPS_ACCESS_KEY } from '@/core/loy-groups/api'
import { LOY_ACCESS_KEY } from '@/features/loy/member/api'
import { MENU, type ShellMenuItem } from './menu-model'
import { resolveMenu, type ProbeState } from './useVisibleMenu'

const loyalty = MENU.find((g) => g.labelKey === 'loy:menu.loyalty')

const gatedLeaves = (items: ShellMenuItem[]): ShellMenuItem[] =>
  items.flatMap((i) => [...(i.access ? [i] : []), ...gatedLeaves(i.items ?? [])])
const labels = (items: ShellMenuItem[]): string[] =>
  items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])

const probed = (data: unknown): ProbeState => ({ isPending: false, isSuccess: true, data })
/** An errored probe: settled, unsuccessful, no data — the thrown-probe case. */
const errored: ProbeState = { isPending: false, isSuccess: false, data: undefined }
const pending: ProbeState = { isPending: true, isSuccess: false, data: undefined }

describe('the Loyalty nav group', () => {
  it('exists, with the member lookup gated behind the ONE shared key', () => {
    expect(loyalty).toBeDefined()
    const leaves = gatedLeaves([loyalty!])
    expect(leaves).toHaveLength(2)
    expect(leaves[0].routerLink).toBe('/loy/members')
    // The screen's own guard reads this same exported key — that identity is what
    // makes the nav and the screen one answer and one network call.
    expect(leaves[0].access!.key).toBe(LOY_ACCESS_KEY)
  })

  it('appears for a granted session', () => {
    expect(labels(resolveMenu([loyalty!], [probed({ canOpenLoyMember: true }), errored]).items)).toEqual([
      'loy:menu.loyalty',
      'loy:menu.members',
    ])
  })

  it('🚩 disappears — group and all — for a denial, an ERROR and a malformed answer alike', () => {
    for (const state of [
      probed({ canOpenLoyMember: false }),
      errored,
      probed({}),
      probed({ canOpenLoyMember: 'true' }),
      pending,
    ]) {
      // The group vanishes with its only child, so an empty "Loyalty" header is
      // never left offering a screen that cannot be opened.
      expect(resolveMenu([loyalty!], [state, state]).items).toEqual([])
    }
  })

  it('reports an errored probe as SETTLED — failing closed must not hang the menu', () => {
    expect(resolveMenu([loyalty!], [errored, errored]).settled).toBe(true)
  })
})

/**
 * The Loyalty groups leaf (oms ticket 629, BackOffice spec 3173) — its own probe on its own key,
 * `GET LoyGroupWeb/Access`, failing closed like the member leaf beside it.
 */
describe('the Loyalty groups leaf', () => {
  const groupsLeaf = () => gatedLeaves([loyalty!])[1]

  it('sits beside Members, gated on the shared loy-groups key', () => {
    expect(groupsLeaf().routerLink).toBe('/loy/groups')
    expect(groupsLeaf().labelKey).toBe('loy-groups:menu.groups')
    expect(groupsLeaf().access!.key).toBe(LOY_GROUPS_ACCESS_KEY)
  })

  it('appears on a view grant, alone if the member grant is missing', () => {
    expect(labels(resolveMenu([loyalty!], [errored, probed({ canView: true, canMaintain: false })]).items)).toEqual([
      'loy:menu.loyalty',
      'loy-groups:menu.groups',
    ])
  })

  it('🚩 hides on a denial, an error, a pending probe, a malformed answer and maintain-without-view', () => {
    for (const state of [
      probed({ canView: false, canMaintain: false }),
      probed({ canMaintain: true }),
      probed({}),
      probed({ canView: 'true' }),
      errored,
      pending,
    ]) {
      expect(labels(resolveMenu([loyalty!], [probed({ canOpenLoyMember: true }), state]).items)).toEqual([
        'loy:menu.loyalty',
        'loy:menu.members',
      ])
    }
  })
})
