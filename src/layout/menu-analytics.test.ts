/**
 * The Analytics nav group (spec 766 §F, ticket 767), read out of the REAL `MENU`: every leaf behind
 * `canView` on `GET Analytics/Access`, on the key the pages' gate reads, failing closed.
 */
import { describe, expect, it } from 'vitest'
import { ANALYTICS_ACCESS_KEY, analyticsAccessQuery } from '@/features/analytics/boards/access'
import { MENU, markedLeaf, type ShellMenuItem } from './menu-model'
import { resolveMenu, type ProbeState } from './useVisibleMenu'

const group = MENU.find((g) => g.labelKey === 'boards:menu.analytics')
const leaves = (items: ShellMenuItem[]): ShellMenuItem[] => items.flatMap((i) => (i.items ? leaves(i.items) : [i]))
const gated = (items: ShellMenuItem[]): ShellMenuItem[] =>
  items.flatMap((i) => [...(i.access ? [i] : []), ...gated(i.items ?? [])])

const answer = (data: unknown): ProbeState[] => gated([group!]).map(() => ({ isPending: false, isSuccess: true, data }))
const shown = (results: ProbeState[]) => resolveMenu([group!], results).items.length > 0

describe('the Analytics nav group', () => {
  it('is one group, every leaf gated on the one analytics key the pages read', () => {
    expect(MENU.filter((g) => g.labelKey === 'boards:menu.analytics')).toHaveLength(1)
    expect(leaves([group!]).map((l) => l.routerLink)).toEqual(['/analytics'])
    for (const leaf of leaves([group!])) expect(leaf.access?.key).toBe(ANALYTICS_ACCESS_KEY)
    expect(analyticsAccessQuery().queryKey).toBe(ANALYTICS_ACCESS_KEY)
    expect(analyticsAccessQuery().retry).toBe(false)
  })

  it('shows only for canView === true; absent, false, malformed, errored or pending hides it', () => {
    expect(shown(answer({ canView: true, canCurate: false }))).toBe(true)
    expect(shown(answer({ canView: false, canCurate: true }))).toBe(false)
    expect(shown(answer({}))).toBe(false)
    expect(shown(answer(null))).toBe(false)
    expect(shown(answer({ canView: 'true' }))).toBe(false)
    expect(shown([{ isPending: false, isSuccess: false, data: undefined }])).toBe(false)
    expect(shown([{ isPending: true, isSuccess: false, data: undefined }])).toBe(false)
  })

  it('an analytics view keeps the leaf lit', () => {
    expect(markedLeaf(MENU, '/analytics/view/v-1')?.labelKey).toBe('boards:menu.boards')
  })
})
