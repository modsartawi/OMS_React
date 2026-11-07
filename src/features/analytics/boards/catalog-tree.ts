import type {
  AnalyticsCatalog,
  AnalyticsCatalogArea,
  AnalyticsCatalogMart,
  AnalyticsCatalogSource,
  AnalyticsDimension,
  AnalyticsMeasure,
} from '@/core/models/analytics'

/**
 * The Catalog page's tree (BackOffice spec 3437 §G, ticket 841): areas, then their Measures / Dimensions / Marts
 * groups, then each mart's sources. Pure — the page renders it, `./catalog-search` narrows it.
 *
 * Every node carries a path id (`area:sales/mart:mart_x/source:pos.RetailTrx`): a mart or source shared by two areas
 * is one node per place it appears, so expanding one never expands the other.
 *
 * Extending (842's Planned / untapped section, 843/844's actions): add a node kind here, a case in
 * `CatalogDetail.tsx`, and that kind's own detail component — never a branch inside another kind's detail.
 */

export type CatalogGroup = 'measures' | 'dimensions' | 'marts'

interface NodeBase {
  id: string
  children: CatalogNode[]
}

export type CatalogNode =
  | (NodeBase & { kind: 'area'; area: AnalyticsCatalogArea })
  | (NodeBase & { kind: 'group'; group: CatalogGroup; area: AnalyticsCatalogArea })
  | (NodeBase & { kind: 'measure'; area: AnalyticsCatalogArea; measure: AnalyticsMeasure })
  | (NodeBase & { kind: 'dimension'; area: AnalyticsCatalogArea; dimension: AnalyticsDimension })
  /** `mart: null` = the area names a mart the lineage does not describe (tolerated, shown by key). */
  | (NodeBase & { kind: 'mart'; area: AnalyticsCatalogArea; key: string; mart: AnalyticsCatalogMart | null })
  /** `source: null` = the mart names a source the lineage does not describe. */
  | (NodeBase & { kind: 'source'; area: AnalyticsCatalogArea; key: string; source: AnalyticsCatalogSource | null })
  /** In place of the marts group when the image serves no lineage (`lineageAvailable: false`). */
  | (NodeBase & { kind: 'lineageNote'; area: AnalyticsCatalogArea })

export type CatalogNodeKind = CatalogNode['kind']

export interface CatalogTree {
  roots: CatalogNode[]
  lineageAvailable: boolean
  imageVersion: string
  /** Every node by id. */
  byId: Map<string, CatalogNode>
  /** Each node's parent id (roots absent). */
  parentOf: Map<string, string>
}

export function buildCatalogTree(catalog: AnalyticsCatalog): CatalogTree {
  const marts = new Map(catalog.marts.map((m) => [m.key, m]))
  const sources = new Map(catalog.sources.map((s) => [s.key, s]))

  const roots = catalog.areas.map((area): CatalogNode => {
    const at = `area:${area.key}`
    const measures: CatalogNode = {
      kind: 'group',
      group: 'measures',
      area,
      id: `${at}/measures`,
      children: area.measures.map((measure) => ({ kind: 'measure', area, measure, id: `${at}/measure:${measure.key}`, children: [] })),
    }
    const dimensions: CatalogNode = {
      kind: 'group',
      group: 'dimensions',
      area,
      id: `${at}/dimensions`,
      children: area.dimensions.map((dimension) => ({ kind: 'dimension', area, dimension, id: `${at}/dimension:${dimension.key}`, children: [] })),
    }
    const lineage: CatalogNode = catalog.lineageAvailable
      ? {
          kind: 'group',
          group: 'marts',
          area,
          id: `${at}/marts`,
          children: area.marts.map((key): CatalogNode => {
            const mart = marts.get(key) ?? null
            const id = `${at}/mart:${key}`
            return {
              kind: 'mart',
              area,
              key,
              mart,
              id,
              children: (mart?.sources ?? []).map((s) => ({ kind: 'source', area, key: s, source: sources.get(s) ?? null, id: `${id}/source:${s}`, children: [] })),
            }
          }),
        }
      : { kind: 'lineageNote', area, id: `${at}/lineage`, children: [] }
    return { kind: 'area', area, id: at, children: [measures, dimensions, lineage] }
  })

  const byId = new Map<string, CatalogNode>()
  const parentOf = new Map<string, string>()
  const index = (n: CatalogNode, parent?: string) => {
    byId.set(n.id, n)
    if (parent) parentOf.set(n.id, parent)
    for (const c of n.children) index(c, n.id)
  }
  for (const r of roots) index(r)

  return { roots, lineageAvailable: catalog.lineageAvailable, imageVersion: catalog.imageVersion, byId, parentOf }
}

/** The ids of a node's ancestors, nearest first. */
export function ancestorsOf(tree: Pick<CatalogTree, 'parentOf'>, id: string): string[] {
  const out: string[] = []
  for (let p = tree.parentOf.get(id); p; p = tree.parentOf.get(p)) out.push(p)
  return out
}

/** The area's dimensions a measure cannot be cut by (there is no `notBy` on the wire: area's minus the measure's). */
export function cannotCutBy(area: AnalyticsCatalogArea, measure: AnalyticsMeasure): AnalyticsDimension[] {
  const can = new Set(measure.dimensions)
  return area.dimensions.filter((d) => !can.has(d.key))
}
