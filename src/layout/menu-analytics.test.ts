/**
 * The Analytics nav group (spec 766 §F, ticket 767), read out of the REAL `MENU`: every leaf behind
 * `canView` on `GET Analytics/Access`, on the key the pages' gate reads, failing closed.
 */
import { describe, expect, it } from 'vitest'
import { MY_SCHEDULES_PATH } from '@/core/analytics-routes'
import { ANALYTICS_ACCESS_KEY, analyticsAccessQuery, MY_SCHEDULES_OFFERED_KEY } from '@/features/analytics/boards/access'
import { MENU, markedLeaf, type ShellMenuItem } from './menu-model'
import { resolveMenu, type ProbeState } from './useVisibleMenu'

const group = MENU.find((g) => g.labelKey === 'boards:menu.analytics')
const leaves = (items: ShellMenuItem[]): ShellMenuItem[] => items.flatMap((i) => (i.items ? leaves(i.items) : [i]))
const gated = (items: ShellMenuItem[]): ShellMenuItem[] =>
  items.flatMap((i) => [...(i.access ? [i] : []), ...gated(i.items ?? [])])

const answer = (data: unknown): ProbeState[] => gated([group!]).map(() => ({ isPending: false, isSuccess: true, data }))
const shown = (results: ProbeState[]) => resolveMenu([group!], results).items.length > 0

describe('the Analytics nav group', () => {
  it('menu lists eight library leaves behind the analytics probe, then My schedules on its own', () => {
    expect(MENU.filter((g) => g.labelKey === 'boards:menu.analytics')).toHaveLength(1)
    const library = leaves([group!]).slice(0, -1)
    expect(library.map((l) => l.routerLink)).toEqual([
      '/analytics',
      '/analytics/boards',
      '/analytics/views',
      '/analytics/reports',
      '/analytics/shared',
      '/analytics/certified',
      '/analytics/catalog',
      '/analytics/deleted',
    ])
    expect(new Set(library.map((l) => l.labelKey)).size).toBe(8)
    for (const leaf of library) expect(leaf.access?.key).toBe(ANALYTICS_ACCESS_KEY)
    const mine = leaves([group!]).at(-1)!
    expect([mine.labelKey, mine.routerLink, mine.access?.key]).toEqual(['boards:menu.mySchedules', MY_SCHEDULES_PATH, MY_SCHEDULES_OFFERED_KEY])
    expect(analyticsAccessQuery().queryKey).toBe(ANALYTICS_ACCESS_KEY)
    expect(analyticsAccessQuery().retry).toBe(false)
  })

  it('886 review: the menu holds My schedules when it is offered, and not otherwise', () => {
    // The analytics probe says yes; the My-schedules probe answers `offered`.
    const byKey = (offered: unknown): ProbeState[] =>
      gated([group!]).map((g) => ({ isPending: false, isSuccess: true, data: g.access!.key === MY_SCHEDULES_OFFERED_KEY ? offered : { canView: true } }))
    const links = (offered: unknown) => leaves(resolveMenu([group!], byKey(offered)).items).map((l) => l.routerLink)
    expect(links(true)).toContain(MY_SCHEDULES_PATH)
    expect(links(true)).toHaveLength(9)
    expect(links(false)).not.toContain(MY_SCHEDULES_PATH)
    expect(links(false)).toHaveLength(8)
    expect(links(undefined)).not.toContain(MY_SCHEDULES_PATH)
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

  it('each leaf lights only itself; an item page keeps the group lit on Home', () => {
    for (const leaf of leaves([group!])) expect(markedLeaf(MENU, leaf.routerLink!)).toBe(leaf)
    for (const item of ['/analytics/view/v-1', '/analytics/board/b-1', '/analytics/report/r-1/edit', '/analytics/new'])
      expect(markedLeaf(MENU, item)?.routerLink).toBe('/analytics')
  })
})
