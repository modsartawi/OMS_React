import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import type { PriceAlertView } from '@/core/models/price-watch'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { drillDownSearch } from './drilldown'

/**
 * 🔌 The alert row's "open drill-down" hook point (oms 934 → 936). The material cell of every price alert row is drawn
 * here and only here: the material number is the link that opens the material's drill-down (`?material=`, built by
 * `drillDownSearch`, the open tab kept), and its A-level code sits beneath. The wire carries no product title.
 */
export default function AlertMaterialCell({ alert }: { alert: PriceAlertView }) {
  const { t } = useTranslation('price-command-center')
  const { search } = useLocation()
  return (
    <div className="flex flex-col" data-alert-material={alert.materialNumber}>
      <Link
        to={{ search: drillDownSearch(search, alert.materialNumber) }}
        replace
        className="font-mono text-xs text-primary underline-offset-2 hover:underline"
        title={t('drilldown.open', { material: fsi(alert.materialNumber) })}
        data-open-drilldown={alert.materialNumber}
      >
        <Ltr>{alert.materialNumber}</Ltr>
      </Link>
      {alert.categoryCode && (
        <span className="text-xs text-muted-foreground">
          <Ltr>{alert.categoryCode}</Ltr>
        </span>
      )}
    </div>
  )
}
