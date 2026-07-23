import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import type { SimulationResult, SimulationResultItem } from '@/core/models/simulation'
import { BONUS_DEFAULT_COL_DEF, buildPricingElementColumns } from './bonus-columns'

// The lower Pricing Elements panel — the SELECTED line's raw pricing-procedure trace,
// mirroring the WPF. It renders only when the request set `includePricingElements` (so
// the trace data is present); otherwise the panel is absent.
//
// The result-level Applied Bonus Buys tab was folded into the plain-language buy→get
// blocks (`SimPromoBlocks`, ticket 047); the Potential Bonus Buys tab was folded into
// the "Could have applied" section (`SimMissedPromotions`, ticket 048). Neither lives
// here any longer — this panel is now the Pricing Elements trace alone (the spec's
// "Advanced layer"; ticket 049 moves it into the block disclosure).
interface Props {
  result: SimulationResult
  selectedItem: SimulationResultItem | null
}

export default function SimBonusBuyPanel({ result, selectedItem }: Props) {
  const { t } = useTranslation('simulation')

  const elementCols = useMemo(() => buildPricingElementColumns(t), [t])

  // The Pricing Elements trace only exists when the run asked for it — surface the
  // panel off the presence of the data, not a toggle that may have changed since.
  const elements = selectedItem?.pricingElements ?? []
  const hasElements = result.items.some((i) => (i.pricingElements?.length ?? 0) > 0)
  if (!hasElements) return null

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <h2 className="mb-3 text-sm font-semibold tracking-tight">{t('bonus.tabs.elements')}</h2>
      {elements.length === 0 ? (
        <EmptyPane message={t('bonus.elements.empty')} />
      ) : (
        <div className="h-72">
          <AgGridReact
            theme={omsGridTheme}
            rowData={elements}
            columnDefs={elementCols}
            defaultColDef={BONUS_DEFAULT_COL_DEF}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
          />
        </div>
      )}
    </div>
  )
}

function EmptyPane({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border/60 text-sm text-muted-foreground">
      {message}
    </div>
  )
}
