import type { PriceAlertView } from '@/core/models/price-watch'
import Ltr from '@/core/ui/Ltr'
import DrillDownLink from './DrillDownLink'

/**
 * 🔌 The alert row's "open drill-down" hook point (oms 934 → 936). The material cell of every price alert row is drawn
 * here and only here: the material number is the link that opens the material's drill-down (`DrillDownLink`), and its
 * A-level code sits beneath. The wire carries no product title.
 */
export default function AlertMaterialCell({ alert }: { alert: PriceAlertView }) {
  return (
    <div className="flex flex-col" data-alert-material={alert.materialNumber}>
      <DrillDownLink material={alert.materialNumber} className="text-xs" />
      {alert.categoryCode && (
        <span className="text-xs text-muted-foreground">
          <Ltr>{alert.categoryCode}</Ltr>
        </span>
      )}
    </div>
  )
}
