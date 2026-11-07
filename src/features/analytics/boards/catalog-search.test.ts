import { describe, expect, it } from 'vitest'
import { buildCatalogTree } from './catalog-tree'
import { searchCatalog } from './catalog-search'
import { readCatalog } from './catalog-wire'

const label = (en: string, ar: string) => ({ en, ar })
const measure = (key: string, en: string, ar: string) => ({ key, area: 'till_sales', shape: 'rate', unit: 'share', label: label(en, ar), description: label('', ''), dimensions: ['date'] })

const TREE = buildCatalogTree(
  readCatalog({
    imageVersion: '1.4.0',
    lineageAvailable: true,
    areas: [
      {
        key: 'till_sales',
        label: label('Till sales', 'مبيعات الصندوق'),
        available: true,
        measures: [measure('net_sales', 'Net sales', 'صافي المبيعات'), measure('return_rate', 'Return rate', 'مُعَدَّل الإرجاع')],
        dimensions: [{ key: 'store', kind: 'category', label: label('Store', 'الفرع'), values: [] }],
        marts: ['mart_till_sales_daily'],
      },
      {
        key: 'delivery_speed',
        label: label('Delivery speed', 'سرعة التوصيل'),
        available: true,
        measures: [],
        dimensions: [{ key: 'store', kind: 'category', label: label('Store', 'الفرع'), values: [] }],
        marts: [],
      },
    ],
    marts: [{ key: 'mart_till_sales_daily', kind: 'mart', description: '', grain: '', sources: ['pos.RetailTrx'] }],
    sources: [{ key: 'pos.RetailTrx', server: 'POS01', database: 'POS', table: 'RetailTrx', usedBy: ['mart_till_sales_daily'] }],
  }),
)

describe('catalog search', () => {
  it('search matches Arabic and English labels and expands ancestors', () => {
    // English, any case: the measure matches; its group and area open.
    const en = searchCatalog(TREE, 'RETURN rate')
    expect([...en.matches]).toEqual(['area:till_sales/measure:return_rate'])
    expect([...en.open].sort()).toEqual(['area:till_sales', 'area:till_sales/measures'])

    // Arabic without the harakat the label is written with (معدل vs مُعَدَّل), and with a tatweel.
    const ar = searchCatalog(TREE, 'معـدل')
    expect([...ar.matches]).toEqual(['area:till_sales/measure:return_rate'])
    expect([...ar.open].sort()).toEqual(['area:till_sales', 'area:till_sales/measures'])

    // A label two areas share matches in both, each with its own ancestors open.
    const shared = searchCatalog(TREE, 'الفرع')
    expect([...shared.matches].sort()).toEqual(['area:delivery_speed/dimension:store', 'area:till_sales/dimension:store'])
    expect([...shared.open].sort()).toEqual(['area:delivery_speed', 'area:delivery_speed/dimensions', 'area:till_sales', 'area:till_sales/dimensions'])

    // A source table by name: the mart and the marts group open too.
    const table = searchCatalog(TREE, 'retailtrx')
    expect([...table.matches]).toEqual(['area:till_sales/mart:mart_till_sales_daily/source:pos.RetailTrx'])
    expect([...table.open].sort()).toEqual(['area:till_sales', 'area:till_sales/mart:mart_till_sales_daily', 'area:till_sales/marts'])
  })

  it('the shown nodes are the matches, their ancestors and what is under a match; a blank search shows everything', () => {
    const r = searchCatalog(TREE, 'speed')
    expect(r.shown && [...r.shown].sort()).toEqual(['area:delivery_speed', 'area:delivery_speed/dimension:store', 'area:delivery_speed/dimensions', 'area:delivery_speed/marts', 'area:delivery_speed/measures'])
    expect(searchCatalog(TREE, '  ').shown).toBeNull()
    expect(searchCatalog(TREE, '  ').matches.size).toBe(0)
    expect(searchCatalog(TREE, 'nothing like it').matches.size).toBe(0)
  })
})
