import { useTranslation } from 'react-i18next'
import type { CatalogNode } from './catalog-tree'
import CatalogAreaDetail from './CatalogAreaDetail'
import CatalogDimensionDetail from './CatalogDimensionDetail'
import CatalogMartDetail from './CatalogMartDetail'
import CatalogMeasureDetail from './CatalogMeasureDetail'
import CatalogSourceDetail from './CatalogSourceDetail'

/**
 * The Catalog's detail pane (ticket 841): one small component per node kind, so each follower edits its own file
 * (842 area facts, 843 area/measure actions, 844 mart raw preview). A group or the lineage note shows its area.
 */
export default function CatalogDetail({ node }: { node: CatalogNode | null }) {
  const { t } = useTranslation('boards')
  if (!node)
    return (
      <p className="text-sm text-muted-foreground" data-catalog-detail="none">
        {t('catalog.pickNode')}
      </p>
    )
  switch (node.kind) {
    case 'area':
    case 'group':
    case 'lineageNote':
      return <CatalogAreaDetail area={node.area} />
    case 'measure':
      return <CatalogMeasureDetail area={node.area} measure={node.measure} />
    case 'dimension':
      return <CatalogDimensionDetail dimension={node.dimension} />
    case 'mart':
      return <CatalogMartDetail martKey={node.key} mart={node.mart} />
    case 'source':
      return <CatalogSourceDetail sourceKey={node.key} source={node.source} />
  }
}
