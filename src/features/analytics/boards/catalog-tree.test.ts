import { describe, expect, it } from 'vitest'
import { buildCatalogTree, cannotCutBy, type CatalogNode } from './catalog-tree'
import { readCatalog } from './catalog-wire'

/** The wire as `GET Analytics/Catalog` answers it on BackOffice spec3437 (camelCase, nulls written). */
const WIRE = {
  imageVersion: '1.4.0',
  lineageAvailable: true,
  areas: [
    {
      key: 'till_sales',
      label: { en: 'Till sales', ar: 'مبيعات الصندوق' },
      description: { en: 'Sales rung up at the till.', ar: 'المبيعات المسجلة على الصندوق.' },
      owner: 'Analytics team',
      available: true,
      unavailableReason: null,
      dataAsOf: '2026-11-05T09:45:12',
      historyStart: '2026-01-01',
      refresh: { en: 'Every hour.', ar: 'كل ساعة.' },
      boundary: [{ en: 'Values include VAT.', ar: 'القيم تشمل الضريبة.' }],
      readBy: ['copilot', 'designer'],
      usedBy: { views: 3, boards: 1, reports: 0 },
      access: { grant: 'AnalyticsView' },
      measures: [
        {
          key: 'net_sales',
          area: 'till_sales',
          shape: 'additive',
          unit: 'SAR',
          maxWindowDays: null,
          label: { en: 'Net sales', ar: 'صافي المبيعات' },
          description: { en: 'Sales after returns.', ar: 'المبيعات بعد المرتجعات.' },
          dimensions: ['date', 'store'],
          caveat: null,
          mayStillRiseDays: null,
        },
        {
          key: 'return_rate',
          area: 'till_sales',
          shape: 'rate',
          unit: 'share',
          maxWindowDays: null,
          label: { en: 'Return rate', ar: 'معدل الإرجاع' },
          description: { en: 'Share of sales returned.', ar: 'نسبة المبيعات المرتجعة.' },
          dimensions: ['date'],
          caveat: null,
          mayStillRiseDays: null,
        },
      ],
      dimensions: [
        { key: 'date', kind: 'time', label: { en: 'Date', ar: 'التاريخ' }, description: { en: 'The day.', ar: 'اليوم.' }, values: [] },
        { key: 'store', kind: 'category', label: { en: 'Store', ar: 'الفرع' }, description: { en: 'The store.', ar: 'الفرع.' }, values: [] },
        { key: 'item', kind: 'category', label: { en: 'Item', ar: 'الصنف' }, description: { en: 'The item.', ar: 'الصنف.' }, values: [] },
      ],
      marts: ['mart_till_sales_daily', 'dim_date'],
    },
    {
      key: 'coupon_redemptions',
      label: { en: 'Coupon redemptions', ar: 'استبدال القسائم' },
      description: { en: 'Coupons redeemed.', ar: 'القسائم المستبدلة.' },
      owner: 'Analytics team',
      available: false,
      unavailableReason: { en: 'Waiting on the coupon feed.', ar: 'بانتظار تغذية القسائم.' },
      dataAsOf: '',
      historyStart: '400d',
      refresh: { en: 'Daily.', ar: 'يوميًا.' },
      boundary: [{ en: 'No personal data.', ar: 'لا بيانات شخصية.' }],
      readBy: [],
      usedBy: null,
      access: { grant: 'AnalyticsView' },
      measures: [],
      dimensions: [],
      marts: [],
    },
  ],
  marts: [
    {
      key: 'mart_till_sales_daily',
      kind: 'mart',
      description: 'Till sales by day.',
      grain: 'One row per day × store × item × channel',
      sources: ['pos.RetailTrx', 'pos.RetailTrxDetail'],
      columns: null,
      rows: null,
      sizeMb: null,
    },
    { key: 'dim_date', kind: 'dim', description: 'The calendar.', grain: '', sources: [], columns: null, rows: null, sizeMb: null },
  ],
  sources: [
    { key: 'pos.RetailTrx', server: 'POS01', database: 'POS', table: 'RetailTrx', description: 'Till headers.', usedBy: ['mart_till_sales_daily'] },
    { key: 'pos.RetailTrxDetail', server: 'POS01', database: 'POS', table: 'RetailTrxDetail', description: 'Till lines.', usedBy: ['mart_till_sales_daily'] },
  ],
  planned: [],
  untappedSources: [],
}

/** The tree as `[id, kind, children…]` — what a reader of the tree sees, without the payloads. */
type Outline = [string, ...Outline[]] | string
const outline = (n: CatalogNode): Outline => (n.children.length ? [n.id, ...n.children.map(outline)] : n.id)

describe('catalog tree', () => {
  it('catalog tree builds area -> members -> marts -> sources from the wire', () => {
    const tree = buildCatalogTree(readCatalog(WIRE))
    expect(tree.lineageAvailable).toBe(true)
    expect(tree.roots.map(outline)).toEqual([
      [
        'area:till_sales',
        ['area:till_sales/measures', 'area:till_sales/measure:net_sales', 'area:till_sales/measure:return_rate'],
        ['area:till_sales/dimensions', 'area:till_sales/dimension:date', 'area:till_sales/dimension:store', 'area:till_sales/dimension:item'],
        [
          'area:till_sales/marts',
          [
            'area:till_sales/mart:mart_till_sales_daily',
            'area:till_sales/mart:mart_till_sales_daily/source:pos.RetailTrx',
            'area:till_sales/mart:mart_till_sales_daily/source:pos.RetailTrxDetail',
          ],
          'area:till_sales/mart:dim_date',
        ],
      ],
      // An unavailable area keeps its node (greyed by the page) and an empty marts group.
      ['area:coupon_redemptions', 'area:coupon_redemptions/measures', 'area:coupon_redemptions/dimensions', 'area:coupon_redemptions/marts'],
    ])
    const [sales, coupons] = tree.roots
    expect(sales.kind === 'area' && sales.area.label.ar).toBe('مبيعات الصندوق')
    expect(coupons.kind === 'area' && coupons.area.available).toBe(false)
    expect(coupons.kind === 'area' && coupons.area.unavailableReason).toEqual({ en: 'Waiting on the coupon feed.', ar: 'بانتظار تغذية القسائم.' })
    const source = tree.byId.get('area:till_sales/mart:mart_till_sales_daily/source:pos.RetailTrx')
    expect(source?.kind === 'source' && source.source?.server).toBe('POS01')
    expect(source?.kind === 'source' && source.source?.usedBy).toEqual(['mart_till_sales_daily'])
    const mart = tree.byId.get('area:till_sales/mart:mart_till_sales_daily')
    expect(mart?.kind === 'mart' && mart.mart?.grain).toBe('One row per day × store × item × channel')
  })

  it('a measure lists the area dimensions it cannot be cut by', () => {
    const catalog = readCatalog(WIRE)
    const area = catalog.areas[0]
    expect(cannotCutBy(area, area.measures[1]).map((d) => d.key)).toEqual(['store', 'item'])
    expect(cannotCutBy(area, area.measures[0]).map((d) => d.key)).toEqual(['item'])
  })

  it('a mart or source key the wire does not describe is kept, undescribed', () => {
    const wire = { ...WIRE, marts: [], sources: [] }
    const tree = buildCatalogTree(readCatalog(wire))
    const mart = tree.byId.get('area:till_sales/mart:mart_till_sales_daily')
    expect(mart?.kind === 'mart' && mart.mart).toBeNull()
    expect(mart?.children).toEqual([])
  })
})

describe('catalog tree without lineage', () => {
  it('lineage unavailable shows the note and keeps areas', () => {
    // An image without /catalog (< 1.4.0): marts, sources, planned and untapped empty, areas still served.
    const wire = { ...WIRE, imageVersion: '', lineageAvailable: false, marts: [], sources: [] }
    const tree = buildCatalogTree(readCatalog(wire))
    expect(tree.lineageAvailable).toBe(false)
    expect(tree.roots.map(outline)).toEqual([
      [
        'area:till_sales',
        ['area:till_sales/measures', 'area:till_sales/measure:net_sales', 'area:till_sales/measure:return_rate'],
        ['area:till_sales/dimensions', 'area:till_sales/dimension:date', 'area:till_sales/dimension:store', 'area:till_sales/dimension:item'],
        'area:till_sales/lineage',
      ],
      ['area:coupon_redemptions', 'area:coupon_redemptions/measures', 'area:coupon_redemptions/dimensions', 'area:coupon_redemptions/lineage'],
    ])
    expect(tree.byId.get('area:till_sales/lineage')?.kind).toBe('lineageNote')
    expect([...tree.byId.values()].some((n) => n.kind === 'mart' || n.kind === 'source')).toBe(false)
  })
})
