import { describe, expect, it } from 'vitest'
import type { AnalyticsItem, AnalyticsTier } from '@/core/models/analytics'
import { definitionKnown, paletteViews } from './palette'

const item = (id: string, tier: AnalyticsTier, owner: string, updatedAt: string, en: string, extra: Partial<AnalyticsItem> = {}): AnalyticsItem => ({
  id,
  kind: 'view',
  title: { en, ar: '' },
  subtitle: { en: '', ar: '' },
  owner,
  tier,
  sourceChangedSinceCopy: false,
  revision: 1,
  updatedAt,
  updatedBy: owner,
  definition: { chart: { type: 'bar' }, query: { measures: ['orders'], dimensions: ['city'], filters: [] } },
  ...extra,
})

const ME = 'msartawi'
const TODAY = '2026-11-07'
const ITEMS = [
  item('mine-old', 'personal', ME, '2026-10-01T08:00:00', 'My drafts'),
  item('shared-other', 'shared', 'ahmad', '2026-11-01T08:00:00', 'Orders by channel'),
  item('shared-mine', 'shared', ME, '2026-11-02T08:00:00', 'My shared orders'),
  item('cert', 'certified', 'curator', '2026-09-01T08:00:00', 'Weekly value'),
  item('mine-new', 'personal', ME, '2026-11-04T08:00:00', 'Late orders'),
  item('a-board', 'shared', 'ahmad', '2026-11-05T08:00:00', 'A board', { kind: 'board' }),
  item('gone', 'personal', ME, '2026-11-06T08:00:00', 'Deleted view', { deletedAt: '2026-11-06T09:00:00' }),
]
const ids = (xs: AnalyticsItem[]) => xs.map((x) => x.id)

describe('837: the views palette', () => {
  it('All lists every view I can read, newest change first; never a board, never a deleted view', () => {
    expect(ids(paletteViews(ITEMS, 'all', '', ME, TODAY))).toEqual(['mine-new', 'shared-mine', 'shared-other', 'mine-old', 'cert'])
  })
  it('Mine is what I own, whatever its tier', () => {
    expect(ids(paletteViews(ITEMS, 'mine', '', ME, TODAY))).toEqual(['mine-new', 'shared-mine', 'mine-old'])
  })
  it('Certified is the certified tier', () => {
    expect(ids(paletteViews(ITEMS, 'certified', '', ME, TODAY))).toEqual(['cert'])
  })
  it('Shared with me is Shared and not mine', () => {
    expect(ids(paletteViews(ITEMS, 'sharedWithMe', '', ME, TODAY))).toEqual(['shared-other'])
  })
  it('the search narrows by title, with the chip', () => {
    expect(ids(paletteViews(ITEMS, 'all', 'orders', ME, TODAY))).toEqual(['mine-new', 'shared-mine', 'shared-other'])
    expect(ids(paletteViews(ITEMS, 'mine', 'orders', ME, TODAY))).toEqual(['mine-new', 'shared-mine'])
  })
  it('an untitled view is found by the title it is shown by', () => {
    const untitled = item('ai', 'personal', ME, '2026-11-03T08:00:00', '')
    expect(ids(paletteViews([untitled], 'all', 'orders by', ME, TODAY, () => ({ en: 'Orders by city', ar: '' })))).toEqual(['ai'])
  })
})

describe('837: a listed view without its definition', () => {
  it('is known when its query has a measure, and fetched first when it has none', () => {
    expect(definitionKnown(ITEMS[0])).toBe(true)
    expect(definitionKnown(item('bare', 'personal', ME, '', '', { definition: { chart: { type: 'bar' }, query: { measures: [], dimensions: [], filters: [] } } }))).toBe(false)
  })
})
