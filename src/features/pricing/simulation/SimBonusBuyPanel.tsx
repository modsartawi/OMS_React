import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AgGridReact, type AgGridReactProps } from 'ag-grid-react'
import type { RowClickedEvent } from 'ag-grid-community'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import type {
  PotentialBonusBuy,
  SimulationResult,
  SimulationResultItem,
} from '@/core/models/simulation'
import {
  BONUS_DEFAULT_COL_DEF,
  buildPotentialBonusColumns,
  buildPrereqColumns,
  buildPricingElementColumns,
} from './bonus-columns'

// Lower tabbed panel completing result-parity with the WPF (ticket 015):
//  • Potential Bonus Buys — grid of promotions that could apply; selecting a row drives
//    a second stacked Prerequisites grid below it. TWO ag-grid Community grids driven by
//    row selection, NOT Enterprise master-detail — mirrors the desktop.
//  • Pricing Elements — the SELECTED line's raw pricing-procedure trace; the tab appears
//    only when the request set `includePricingElements` (so the trace data is present).
//
// The result-level Applied Bonus Buys tab was folded into the plain-language buy→get
// blocks (`SimPromoBlocks`, ticket 047) and no longer lives here.
interface Props {
  result: SimulationResult
  selectedItem: SimulationResultItem | null
}

type Tab = 'potential' | 'elements'

export default function SimBonusBuyPanel({ result, selectedItem }: Props) {
  const { t } = useTranslation('simulation')

  const potentialCols = useMemo(() => buildPotentialBonusColumns(t), [t])
  const prereqCols = useMemo(() => buildPrereqColumns(t), [t])
  const elementCols = useMemo(() => buildPricingElementColumns(t), [t])

  // The Pricing Elements trace only exists when the run asked for it — surface the
  // tab off the presence of the data, not a toggle that may have changed since.
  const elements = selectedItem?.pricingElements ?? []
  const hasElements = result.items.some((i) => (i.pricingElements?.length ?? 0) > 0)

  const tabs: Tab[] = hasElements ? ['potential', 'elements'] : ['potential']
  const [tab, setTab] = useState<Tab>('potential')
  const activeTab = tabs.includes(tab) ? tab : 'potential'

  // Two-grid selection: which potential bonus buy's prerequisites the lower grid shows.
  const [selectedBby, setSelectedBby] = useState<string | null>(null)
  const selectedPotential =
    result.potentialBonusBuys.find((p) => p.bbyNumber === selectedBby) ??
    result.potentialBonusBuys[0] ??
    null
  const prereqs = selectedPotential?.prerequisites ?? []

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div
        className="mb-3 inline-flex gap-1 self-start rounded-lg border border-border/60 bg-muted/40 p-1"
        role="tablist"
        aria-label={t('bonus.tabsAriaLabel')}
      >
        {tabs.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setTab(id)}
            className={
              'rounded-md px-4 py-1.5 text-sm font-semibold ' +
              (activeTab === id
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {t(`bonus.tabs.${id}`)}
          </button>
        ))}
      </div>

      {activeTab === 'potential' ? (
        result.potentialBonusBuys.length === 0 ? (
          <EmptyPane message={t('bonus.potential.empty')} />
        ) : (
          <div className="flex flex-col gap-3">
            <BonusGrid<PotentialBonusBuy>
              heightClass="h-56"
              rowData={result.potentialBonusBuys}
              columnDefs={potentialCols}
              rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
              onRowClicked={(e: RowClickedEvent<PotentialBonusBuy>) =>
                setSelectedBby(e.data?.bbyNumber ?? null)
              }
              // Keep AG Grid's highlight in sync with our source of truth, including the
              // first row shown selected by default before any click.
              onRowDataUpdated={(e) =>
                e.api.forEachNode((node) =>
                  node.setSelected(node.data?.bbyNumber === selectedPotential?.bbyNumber),
                )
              }
            />

            <div>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                {selectedPotential
                  ? t('bonus.prereq.titleFor', { bby: selectedPotential.bbyNumber })
                  : t('bonus.prereq.title')}
              </h3>
              {prereqs.length === 0 ? (
                <EmptyPane
                  message={selectedPotential ? t('bonus.prereq.none') : t('bonus.prereq.empty')}
                />
              ) : (
                <BonusGrid heightClass="h-56" rowData={prereqs} columnDefs={prereqCols} />
              )}
            </div>
          </div>
        )
      ) : null}

      {activeTab === 'elements' ? (
        elements.length === 0 ? (
          <EmptyPane message={t('bonus.elements.empty')} />
        ) : (
          <BonusGrid heightClass="h-72" rowData={elements} columnDefs={elementCols} />
        )
      ) : null}
    </div>
  )
}

// The four bonus-buy grids share one config (theme, row/header height, default col
// def, no row animation); this wrapper carries it so each call site names only what
// differs — its height, data, columns, and (for the potential grid) row selection.
function BonusGrid<T>({ heightClass, ...props }: AgGridReactProps<T> & { heightClass: string }) {
  return (
    <div className={heightClass}>
      <AgGridReact<T>
        theme={omsGridTheme}
        defaultColDef={BONUS_DEFAULT_COL_DEF}
        rowHeight={OMS_GRID_ROW_HEIGHT}
        headerHeight={OMS_GRID_HEADER_HEIGHT}
        animateRows={false}
        {...props}
      />
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
