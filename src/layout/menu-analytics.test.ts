/**
 * The Analytics nav group (spec 766 §F, ticket 767), read out of the REAL `MENU`: every leaf behind `Analytics:03`
 * (`canViewAnalytics`) off the ONE permissions answer (oms 914) — the predicate the pages' gate reads — failing closed.
 * My schedules (886) also waits for its door to offer it.
 */
import { describe, expect, it } from 'vitest'
import { MY_SCHEDULES_PATH } from '@/core/analytics-routes'
import { permissionsFromQuery, permissionsOf, type Permissions } from '@/core/permissions'
import { MY_SCHEDULES_OFFERED_KEY } from '@/features/analytics/boards/access'
import { MENU, markedLeaf, type ShellMenuItem } from './menu-model'
import { isGated, resolveMenu } from './useVisibleMenu'

const group = MENU.find((g) => g.labelKey === 'boards:menu.analytics')
const leaves = (items: ShellMenuItem[]): ShellMenuItem[] => items.flatMap((i) => (i.items ? leaves(i.items) : [i]))
const holding = (...screens: string[]) => permissionsOf({ screens })
const shown = (p: Permissions, offered = true) => resolveMenu([group!], p, () => offered).items.length > 0

describe('the Analytics nav group', () => {
  it('menu lists eight library leaves behind the view grant, then My schedules behind its door', () => {
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
    for (const leaf of library) expect(isGated(leaf)).toBe(true)
    const mine = leaves([group!]).at(-1)!
    expect([mine.labelKey, mine.routerLink, mine.offered?.queryKey]).toEqual([
      'boards:menu.mySchedules',
      MY_SCHEDULES_PATH,
      MY_SCHEDULES_OFFERED_KEY,
    ])
    expect(isGated(mine)).toBe(true)
  })

  it('886 review: the menu holds My schedules when it is offered, and not otherwise', () => {
    const links = (offered: boolean) =>
      leaves(resolveMenu([group!], holding('Analytics:03'), () => offered).items).map((l) => l.routerLink)
    expect(links(true)).toContain(MY_SCHEDULES_PATH)
    expect(links(true)).toHaveLength(9)
    expect(links(false)).not.toContain(MY_SCHEDULES_PATH)
    expect(links(false)).toHaveLength(8)
    // Not told at all (the default) is not offered.
    expect(leaves(resolveMenu([group!], holding('Analytics:03')).items).map((l) => l.routerLink)).not.toContain(MY_SCHEDULES_PATH)
  })

  it('an offered My schedules still needs the view grant', () => {
    expect(shown(holding())).toBe(false)
  })

  it('shows on Analytics:03; the other analytics keys without it (half-grant), a near-miss, errored or pending hide it', () => {
    expect(shown(holding('Analytics:03'))).toBe(true)
    expect(shown(holding('Analytics:02', 'Analytics:06', 'Analytics:07'))).toBe(false)
    expect(shown(holding('Analytics:02'))).toBe(false)
    expect(shown(holding('Analytics:07'))).toBe(false)
    expect(shown(holding('Copilot:01'))).toBe(false)
    expect(shown(permissionsFromQuery({ isPending: false, isError: true, data: undefined }))).toBe(false)
    expect(shown(permissionsFromQuery({ isPending: true, isError: false, data: undefined }))).toBe(false)
  })

  it('each leaf lights only itself; an item page keeps the group lit on Home', () => {
    for (const leaf of leaves([group!])) expect(markedLeaf(MENU, leaf.routerLink!)).toBe(leaf)
    for (const item of ['/analytics/view/v-1', '/analytics/board/b-1', '/analytics/report/r-1/edit', '/analytics/new'])
      expect(markedLeaf(MENU, item)?.routerLink).toBe('/analytics')
  })
})
