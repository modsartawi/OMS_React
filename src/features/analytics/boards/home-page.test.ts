import { describe, expect, it } from 'vitest'
import { homeNewLinks, homeSections, readHome } from './home-page'

const row = (id: string, kind = 'board', tier = 'personal') => ({
  id,
  kind,
  title: { en: id, ar: '' },
  subtitle: { en: '', ar: '' },
  owner: 'msartawi',
  tier,
  revision: 1,
  updatedAt: '2026-11-07T08:00:00',
  updatedBy: 'msartawi',
  definition: null,
  audience: null,
  folderId: null,
  actions: [],
})

describe('Home renders recent, pinned and certified from the Home door', () => {
  it('reads the three lists in the order the door gives them', () => {
    const home = readHome({
      recent: [row('b-2'), row('v-1', 'view')],
      pinned: [row('b-9')],
      newestCertified: [row('c-1', 'board', 'certified'), row('c-2', 'report', 'certified')],
    })
    const sections = homeSections(home)
    expect(sections.map((s) => s.key)).toEqual(['recent', 'pinned', 'newestCertified'])
    expect(sections.map((s) => s.items.map((i) => i.id))).toEqual([['b-2', 'v-1'], ['b-9'], ['c-1', 'c-2']])
    expect(sections.every((s) => !s.empty)).toBe(true)
    // An item from Home carries no definition on the wire — it still reads as an empty one, never undefined.
    expect(home.recent[1].definition.query.measures).toEqual([])
  })

  it('an absent or empty list is that section\'s empty state, the other sections still shown', () => {
    const sections = homeSections(readHome({ recent: [row('b-2')], pinned: [] }))
    expect(sections.map((s) => [s.key, s.empty])).toEqual([
      ['recent', false],
      ['pinned', true],
      ['newestCertified', true],
    ])
  })

  it('keeps at most 10 recent and 5 certified, whatever the door sends', () => {
    const many = (n: number, p: string) => Array.from({ length: n }, (_, i) => row(`${p}${i}`))
    const [recent, pinned, certified] = homeSections(readHome({ recent: many(12, 'r'), pinned: many(14, 'p'), newestCertified: many(7, 'c') }))
    expect(recent.items).toHaveLength(10)
    expect(pinned.items).toHaveLength(14)
    expect(certified.items).toHaveLength(5)
  })

  it('a malformed answer reads as three empty lists', () => {
    expect(homeSections(readHome(null)).map((s) => s.items.length)).toEqual([0, 0, 0])
  })
})

describe('runner Home has no New buttons', () => {
  it('an author gets New view, New board and New report', () => {
    expect(homeNewLinks({ canView: true, canAuthor: true, canCurate: false }).map((l) => l.key)).toEqual(['view', 'board', 'report'])
    expect(homeNewLinks({ canView: true, canAuthor: false, canCurate: true }).map((l) => l.to)).toEqual([
      '/analytics/new?kind=view',
      '/analytics/new?kind=board',
      '/analytics/new?kind=report',
    ])
  })

  it('a runner, or an unknown probe, gets none', () => {
    expect(homeNewLinks({ canView: true, canAuthor: false, canCurate: false })).toEqual([])
    expect(homeNewLinks(undefined)).toEqual([])
  })
})
