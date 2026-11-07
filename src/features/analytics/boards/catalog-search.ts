import type { AnalyticsLabel } from '@/core/models/analytics'
import { ancestorsOf, type CatalogNode, type CatalogTree } from './catalog-tree'
import { fold } from './home'

/**
 * The Catalog's search (ticket 841, spec 3437 story 30): by name in either language — a node's label in English
 * AND Arabic, folded like the library's title search (`fold`: NFKC, any case, no harakat, no tatweel) — and by its
 * machine key (area, measure, dimension, mart and source keys; a source's table too). Group and note nodes have no
 * name of their own and never match.
 *
 * Pure. The page opens `open` (each match's ancestors) and, while a search stands, draws only `shown`.
 */

export interface CatalogSearch {
  /** Nodes whose name matches. */
  matches: Set<string>
  /** Every ancestor of a match — the page expands these. */
  open: Set<string>
  /** Matches, their ancestors and everything under a match; `null` = no search, show the whole tree. */
  shown: Set<string> | null
}

const labelled = (l: AnalyticsLabel) => [l.en, l.ar]

/** The texts a node answers to. */
export function nodeTerms(n: CatalogNode): string[] {
  switch (n.kind) {
    case 'area':
      return [n.area.key, ...labelled(n.area.label)]
    case 'measure':
      return [n.measure.key, ...labelled(n.measure.label)]
    case 'dimension':
      return [n.dimension.key, ...labelled(n.dimension.label)]
    case 'mart':
      return [n.key]
    case 'source':
      return [n.key, n.source?.table ?? '']
    default:
      return []
  }
}

export function searchCatalog(tree: CatalogTree, search: string): CatalogSearch {
  const needle = fold(search)
  const matches = new Set<string>()
  const open = new Set<string>()
  if (!needle) return { matches, open, shown: null }

  const shown = new Set<string>()
  const under = (n: CatalogNode) => {
    shown.add(n.id)
    n.children.forEach(under)
  }
  for (const n of tree.byId.values()) {
    if (!nodeTerms(n).some((term) => term && fold(term).includes(needle))) continue
    matches.add(n.id)
    under(n)
    for (const a of ancestorsOf(tree, n.id)) {
      open.add(a)
      shown.add(a)
    }
  }
  return { matches, open, shown }
}
