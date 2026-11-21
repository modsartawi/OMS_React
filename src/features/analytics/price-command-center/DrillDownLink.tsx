import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { drillDownSearch } from './drilldown'

/**
 * 🔗 A material number that opens its drill-down (oms 936): a router link to the page's own address with `?material=`
 * set and the open tab kept (`drillDownSearch`), replacing the entry like the tab strip does. Every entry point — the
 * alert row (934), the product grid (935), the cross-check examples (939) — draws this, so the drill-down opens one way.
 */
export default function DrillDownLink({ material, className = '', data }: { material: string; className?: string; data?: Record<`data-${string}`, string> }) {
  const { t } = useTranslation('price-command-center')
  const { search } = useLocation()
  return (
    <Link
      to={{ search: drillDownSearch(search, material) }}
      replace
      className={`font-mono text-primary underline-offset-2 hover:underline ${className}`}
      title={t('drilldown.open', { material: fsi(material) })}
      data-open-drilldown={material}
      {...data}
    >
      <Ltr>{material}</Ltr>
    </Link>
  )
}
