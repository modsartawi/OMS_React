import { describe, expect, it } from 'vitest'
import type { AnalyticsItem, AnalyticsTier } from '@/core/models/analytics'
import { homeGroups, itemsQuery } from './home'

const label = (en: string, ar: string) => ({ en, ar })

const item = (id: string, tier: AnalyticsTier, updatedAt: string, en = '', ar = ''): AnalyticsItem => ({
  id,
  kind: 'view',
  title: label(en, ar),
  subtitle: label('', ''),
  owner: 'msartawi',
  tier,
  sourceChangedSinceCopy: false,
  revision: 1,
  updatedAt,
  updatedBy: 'msartawi',
  definition: { chart: { type: 'bar' }, query: { measures: [], dimensions: [], filters: [] } },
})

const ITEMS = [
  item('p-old', 'personal', '2026-10-01T08:00:00', 'My drafts', 'مسوداتي'),
  item('s-1', 'shared', '2026-11-01T08:00:00', 'Orders by channel', 'الطلبات حسب القناة'),
  item('c-old', 'certified', '2026-09-01T08:00:00', 'Weekly value', 'القيمة الأسبوعية'),
  item('p-new', 'personal', '2026-11-04T08:00:00', 'Late orders', 'الطلبات المتأخرة'),
  item('c-new', 'certified', '2026-11-03T08:00:00', 'Orders this month', 'طلبات هذا الشهر'),
]

const ids = (groups: ReturnType<typeof homeGroups>) => groups.map((g) => [g.tier, g.items.map((i) => i.id)])

describe('home grouping', () => {
  it('lists Certified, then Shared, then Mine, newest first within each', () => {
    expect(ids(homeGroups(ITEMS, ''))).toEqual([
      ['certified', ['c-new', 'c-old']],
      ['shared', ['s-1']],
      ['personal', ['p-new', 'p-old']],
    ])
  })

  it('drops a group that has nothing to show', () => {
    expect(ids(homeGroups([ITEMS[1]], ''))).toEqual([['shared', ['s-1']]])
    expect(homeGroups([], '')).toEqual([])
  })

  it('search matches the English title, ignoring case and surrounding space', () => {
    expect(ids(homeGroups(ITEMS, '  ORDERS '))).toEqual([
      ['certified', ['c-new']],
      ['shared', ['s-1']],
      ['personal', ['p-new']],
    ])
  })

  it('search matches the Arabic title, ignoring its short vowels', () => {
    expect(ids(homeGroups(ITEMS, 'مسودات'))).toEqual([['personal', ['p-old']]])
    expect(ids(homeGroups(ITEMS, 'الطَّلبات'))).toEqual([
      ['shared', ['s-1']],
      ['personal', ['p-new']],
    ])
  })

  it('search reads an untitled item through the generated title it is shown with', () => {
    const untitled = item('ai', 'personal', '2026-11-05T08:00:00')
    const named = () => label('Orders by Store', 'الطلبات حسب الفرع')
    expect(ids(homeGroups([untitled], 'by store', named))).toEqual([['personal', ['ai']]])
    expect(ids(homeGroups([untitled], 'الفرع', named))).toEqual([['personal', ['ai']]])
    expect(homeGroups([untitled], 'by store')).toEqual([])
  })

  it('a search that matches nothing leaves no groups', () => {
    expect(homeGroups(ITEMS, 'refunds')).toEqual([])
  })
})

describe('GET Analytics/Items asks the server to narrow (766 §C: kind and tier, plus search)', () => {
  it('sends the search trimmed, and kind / tier where the caller has them', () => {
    expect(itemsQuery({ search: '  orders ' })).toEqual({ search: 'orders' })
    expect(itemsQuery({ kind: 'view' })).toEqual({ kind: 'view' })
    expect(itemsQuery({ kind: 'board', tier: 'certified', search: 'ops' })).toEqual({ kind: 'board', tier: 'certified', search: 'ops' })
  })
  it('leaves out what is blank, so an empty search is the whole list', () => {
    expect(itemsQuery({ search: '   ' })).toEqual({})
    expect(itemsQuery({})).toEqual({})
  })
})
