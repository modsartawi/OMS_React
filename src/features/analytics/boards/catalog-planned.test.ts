import { describe, expect, it } from 'vitest'
import { groupPlanned, plannedNaming, plannedSources } from './catalog-planned'
import { searchCatalog } from './catalog-search'
import { buildCatalogTree, type CatalogNode } from './catalog-tree'
import { readCatalog } from './catalog-wire'

const label = (en: string, ar: string) => ({ en, ar })
const planned = (key: string, status: string, sources: string[], unknownSources: string[] = []) => ({
  key,
  label: label(`Planned ${key}`, `مخطط ${key}`),
  status,
  questions: [label(`What does ${key} answer?`, `ماذا يجيب ${key}؟`)],
  sources,
  unknownSources,
})

/** BackOffice 3440's roadmap and untapped list, as `GET Analytics/Catalog` answers them. */
const WIRE = {
  imageVersion: '1.4.0',
  lineageAvailable: true,
  areas: [{ key: 'till_sales', label: label('Till sales', 'مبيعات الصندوق'), available: true, measures: [], dimensions: [], marts: [] }],
  marts: [],
  sources: [{ key: 'pos.RetailTrx', server: 'POS-SQL01', database: 'POS', table: 'RetailTrx', description: 'Till headers.', usedBy: [] }],
  planned: [
    planned('stock_cover', 'building', ['pos.StockMove', 'pos.RetailTrx']),
    planned('loyalty_churn', 'idea', ['loy.LoyMember', 'loy.Ghost'], ['loy.Ghost']),
    planned('supplier_fill', 'approved', []),
    planned('basket_mix', 'idea', ['pos.RetailTrx']),
  ],
  untappedSources: [
    { key: 'pos.StockMove', server: 'POS-SQL01', database: 'POS', table: 'StockMove', note: 'Stock movements; nothing reads them yet.' },
    { key: 'loy.LoyMember', server: 'LOY-SQL01', database: 'Loyalty', table: 'LoyMember', note: 'Members.' },
  ],
}

type Outline = [string, ...Outline[]] | string
const outline = (n: CatalogNode): Outline => (n.children.length ? [n.id, ...n.children.map(outline)] : n.id)

describe('the Planned / untapped section', () => {
  it('planned areas group by status; untapped lists sources', () => {
    const catalog = readCatalog(WIRE)
    // Roadmap order (idea → approved → building → live), the wire's order inside a status, empty statuses left out.
    expect(groupPlanned(catalog.planned).map((g) => [g.status, g.planned.map((p) => p.key)])).toEqual([
      ['idea', ['loyalty_churn', 'basket_mix']],
      ['approved', ['supplier_fill']],
      ['building', ['stock_cover']],
    ])

    // Each named source resolved: a lineage source, a known-untapped one, or one naming neither (flagged once).
    const churn = catalog.planned.find((p) => p.key === 'loyalty_churn')!
    expect(plannedSources(churn, catalog).map((s) => [s.key, s.kind])).toEqual([
      ['loy.LoyMember', 'untapped'],
      ['loy.Ghost', 'unknown'],
    ])
    const cover = catalog.planned.find((p) => p.key === 'stock_cover')!
    const resolved = plannedSources(cover, catalog)
    expect(resolved.map((s) => [s.key, s.kind])).toEqual([
      ['pos.StockMove', 'untapped'],
      ['pos.RetailTrx', 'lineage'],
    ])
    expect(resolved[0].kind === 'untapped' && resolved[0].untapped.note).toBe('Stock movements; nothing reads them yet.')
    // Which planned areas would read an untapped table.
    expect(plannedNaming('pos.StockMove', catalog.planned).map((p) => p.key)).toEqual(['stock_cover'])

    // The tree: areas first, then one Planned / untapped section.
    const tree = buildCatalogTree(catalog)
    expect(outline(tree.roots[tree.roots.length - 1])).toEqual([
      'roadmap',
      [
        'roadmap/planned',
        ['roadmap/planned/status:idea', 'roadmap/planned/status:idea/planned:loyalty_churn', 'roadmap/planned/status:idea/planned:basket_mix'],
        ['roadmap/planned/status:approved', 'roadmap/planned/status:approved/planned:supplier_fill'],
        ['roadmap/planned/status:building', 'roadmap/planned/status:building/planned:stock_cover'],
      ],
      ['roadmap/untapped', 'roadmap/untapped/source:pos.StockMove', 'roadmap/untapped/source:loy.LoyMember'],
    ])
    const member = tree.byId.get('roadmap/untapped/source:loy.LoyMember')
    expect(member?.kind === 'untapped' && member.untapped.note).toBe('Members.')
    expect(member?.kind === 'untapped' && member.plannedBy.map((p) => p.key)).toEqual(['loyalty_churn'])
    const churnNode = tree.byId.get('roadmap/planned/status:idea/planned:loyalty_churn')
    expect(churnNode?.kind === 'planned' && churnNode.sources.map((s) => s.kind)).toEqual(['untapped', 'unknown'])

    // Searchable by a planned area's name in either language and by an untapped table.
    expect([...searchCatalog(tree, 'مخطط basket').matches]).toEqual(['roadmap/planned/status:idea/planned:basket_mix'])
    expect([...searchCatalog(tree, 'StockMove').matches]).toEqual(['roadmap/untapped/source:pos.StockMove'])

    // An image without the roadmap: no section at all.
    const bare = buildCatalogTree(readCatalog({ ...WIRE, planned: [], untappedSources: [] }))
    expect(bare.roots.map((r) => r.id)).toEqual(['area:till_sales'])
  })
})
