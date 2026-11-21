import type { PriceAlertView } from '@/core/models/price-watch'
import Ltr from '@/core/ui/Ltr'

/**
 * 🔌 The alert row's "open drill-down" hook point (oms 934 → 936). The material cell of every price alert row is drawn
 * here and only here, so the drill-down ticket (936) turns it into the link that opens the material's comparison by
 * editing this one file — the row, the table and the tab stay as they are.
 *
 * Today: the material number (a machine value, `Ltr`) and its A-level code beneath. The wire carries no product title.
 */
export default function AlertMaterialCell({ alert }: { alert: PriceAlertView }) {
  return (
    <div className="flex flex-col" data-alert-material={alert.materialNumber}>
      <span className="font-mono text-xs">
        <Ltr>{alert.materialNumber}</Ltr>
      </span>
      {alert.categoryCode && (
        <span className="text-xs text-muted-foreground">
          <Ltr>{alert.categoryCode}</Ltr>
        </span>
      )}
    </div>
  )
}
