import { describe, expect, it } from 'vitest'
import { areaFacts, usedByHref } from './catalog-area'
import { readCatalogArea } from './catalog-wire'
import { libraryFromParams, libraryItemsQuery, libraryToParams } from './library'
import { libraryRedirect, pageChoice } from './library-pages'

/** Two areas as `GET Analytics/Catalog` answers them on BackOffice spec3437 (3439's facts written, nulls written). */
const SALES = {
  key: 'till_sales',
  label: { en: 'Till sales', ar: 'مبيعات الصندوق' },
  description: { en: 'Sales rung up at the till.', ar: 'المبيعات المسجلة على الصندوق.' },
  owner: 'Analytics team',
  available: true,
  unavailableReason: null,
  dataAsOf: '2026-11-05T09:45:12',
  historyStart: '2026-01-01',
  refresh: { en: 'Every hour.', ar: 'كل ساعة.' },
  boundary: [
    { en: 'No personal data.', ar: 'لا بيانات شخصية.' },
    { en: 'Values include VAT.', ar: 'القيم تشمل الضريبة.' },
  ],
  readBy: ['copilot', 'designer', 'someone-new'],
  usedBy: { views: 3, boards: 1, reports: 0 },
  access: { grant: 'AnalyticsView' },
  measures: [],
  dimensions: [],
  marts: [],
}
const COUPONS = {
  ...SALES,
  key: 'coupon_redemptions',
  available: false,
  unavailableReason: { en: 'Waiting on the coupon feed.', ar: 'بانتظار تغذية القسائم.' },
  dataAsOf: '',
  historyStart: '400d',
  readBy: [],
  usedBy: null,
}

describe('catalog area facts', () => {
  it('area detail renders boundary, readers and used-by from the wire', () => {
    const facts = areaFacts(readCatalogArea(SALES))
    expect(facts.dataAsOf).toEqual({ day: '2026-11-05', at: '2026-11-05T09:45:12' })
    expect(facts.history).toEqual({ kind: 'date', day: '2026-01-01' })
    expect(facts.refresh).toEqual({ en: 'Every hour.', ar: 'كل ساعة.' })
    expect(facts.boundary).toEqual([
      { en: 'No personal data.', ar: 'لا بيانات شخصية.' },
      { en: 'Values include VAT.', ar: 'القيم تشمل الضريبة.' },
    ])
    // An unknown reader is dropped by the reader; the two known ones keep the wire's order.
    expect(facts.readers).toEqual(['copilot', 'designer'])
    expect(facts.usedBy).toEqual([
      { kind: 'view', count: 3, href: '/analytics/library?kind=view&area=till_sales' },
      { kind: 'board', count: 1, href: '/analytics/library?kind=board&area=till_sales' },
      { kind: 'report', count: 0, href: '/analytics/library?kind=report&area=till_sales' },
    ])
    expect(facts.grant).toBe('AnalyticsView')

    // An unavailable area: data as of not known, history in days, no readers, used-by not known (never 0).
    const bare = areaFacts(readCatalogArea(COUPONS))
    expect(bare.dataAsOf).toBeNull()
    expect(bare.history).toEqual({ kind: 'days', days: 400 })
    expect(bare.readers).toEqual([])
    expect(bare.usedBy).toBeNull()
    expect(areaFacts(readCatalogArea({ ...SALES, historyStart: '', dataAsOf: 'soon' })).history).toEqual({ kind: 'unknown' })
    expect(areaFacts(readCatalogArea({ ...SALES, dataAsOf: 'soon' })).dataAsOf).toBeNull()
  })
})

describe('the used-by link', () => {
  it('used-by link opens the library narrowed to the area', () => {
    const href = usedByHref('till_sales', 'view')
    const [path, qs] = href.split('?')
    expect(path).toBe('/analytics/library')
    const params = new URLSearchParams(qs)
    // All my items keeps the area (a kind alone is not a leaf's slice), and the choice carries it.
    expect(libraryRedirect('library', params)).toBeNull()
    const choice = pageChoice('library', params)
    expect(choice.kind).toBe('view')
    expect(choice.area).toBe('till_sales')
    // The Items door is asked with `area` (BackOffice ask: the server ignores it until it takes the param).
    expect(libraryItemsQuery(choice, '2026-11-07')).toEqual({ kind: 'view', area: 'till_sales' })
    // The URL round-trips; no area is no param.
    expect(libraryToParams(choice).toString()).toBe('kind=view&area=till_sales')
    expect(libraryFromParams(new URLSearchParams('kind=view')).area).toBe('')
    expect(libraryItemsQuery(libraryFromParams(new URLSearchParams('')), '2026-11-07')).toEqual({})
    // An old Home link with an area lands on All my items with it.
    expect(libraryRedirect('home', new URLSearchParams('area=till_sales'))).toBe('/analytics/library?area=till_sales')
  })
})
