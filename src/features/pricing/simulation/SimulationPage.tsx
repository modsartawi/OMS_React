import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Play } from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { formatMoney } from '@/core/util/number-format'
import type { SimulateRequest, SimulationResult } from '@/core/models/simulation'
import { simulationApi } from './api'
import SimHeaderForm, { EMPTY_HEADER, type SimHeaderState } from './SimHeaderForm'
import SimItemsEntry, { emptyItemRow, type SimItemRow } from './SimItemsEntry'
import { buildSimulationColumns, SIM_RESULT_DEFAULT_COL_DEF } from './columns'

// Ticket 013 — the POS Simulation tracer. Self-guards on Pricing/Access (issue-429
// pattern, shared ['simulation','access'] key with the menu probe), then: a 4-column
// header form + a basic items entry → Process (POST Pricing/Simulate) → Net Total +
// per-line results grid with red/amber/green status dots + an error/warning banner.
// The condition-card detail (014), bonus-buy tabs (015) and editable grids (016)
// build out from this frontier.
export default function SimulationPage() {
  const { t } = useTranslation('simulation')

  const access = useQuery({ queryKey: ['simulation', 'access'], queryFn: () => simulationApi.access() })

  const [header, setHeader] = useState<SimHeaderState>(EMPTY_HEADER)
  const [promotion, setPromotion] = useState(true)
  const [pricingElements, setPricingElements] = useState(false)
  const [items, setItems] = useState<SimItemRow[]>(() => [emptyItemRow()])

  const columns = useMemo(() => buildSimulationColumns(t), [t])

  const process = useMutation({
    mutationFn: async (request: SimulateRequest) => {
      const start = performance.now()
      const result = await simulationApi.simulate(request)
      return { result, elapsedMs: Math.round(performance.now() - start) }
    },
  })

  const validItems = items.filter((r) => r.materialNumber.trim() !== '')
  const canProcess = validItems.length > 0 && !process.isPending

  function runProcess() {
    if (validItems.length === 0) return
    const request: SimulateRequest = {
      header: {
        plant: header.plant.trim(),
        salesOrganization: header.salesOrganization.trim(),
        distributionChannel: header.distributionChannel.trim(),
        // A blank date lets the engine use "now"; a set date goes as midnight ISO.
        pricingDate: header.pricingDate ? `${header.pricingDate}T00:00:00` : '',
        documentPricingProcedureKey: header.documentPricingProcedureKey.trim(),
        loyId: header.loyId.trim() || null,
        loyGroups: header.loyGroups.trim() || null,
        loyTier: header.loyTier.trim() || null,
        isPromotionApplicable: promotion,
      },
      items: validItems.map((r) => ({
        materialNumber: r.materialNumber.trim(),
        quantity: Number(r.quantity) || 0,
        qtyUnit: r.qtyUnit.trim(),
        itemConditionControl: null,
      })),
      includeConditions: true,
      includePricingElements: pricingElements,
    }
    process.mutate(request)
  }

  function clearAll() {
    setHeader(EMPTY_HEADER)
    setPromotion(true)
    setPricingElements(false)
    setItems([emptyItemRow()])
    process.reset()
  }

  // ----- access states ------------------------------------------------------
  if (access.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('access.checking')}
      </div>
    )
  }
  if (access.data?.canOpen !== true) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert">
        <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
      </div>
    )
  }

  const data = process.data ?? null
  const result: SimulationResult | null = data?.result ?? null
  const errorCount = result ? result.items.filter((i) => i.pricingStatus === 'E').length : 0
  const warnCount = result ? result.items.filter((i) => i.pricingStatus === 'W').length : 0
  const showStatusBanner = errorCount + warnCount > 0

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold tracking-tight">{t('title')}</h1>
      </div>

      <SimHeaderForm
        value={header}
        onChange={(patch) => setHeader((h) => ({ ...h, ...patch }))}
        promotion={promotion}
        pricingElements={pricingElements}
        onPromotionChange={setPromotion}
        onPricingElementsChange={setPricingElements}
        disabled={process.isPending}
      />

      <SimItemsEntry rows={items} onChange={setItems} disabled={process.isPending} />

      {/* Action bar: Process / Clear + the Net Total summary. */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
        <button
          type="button"
          onClick={runProcess}
          disabled={!canProcess}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85 disabled:opacity-50"
        >
          {process.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
          {process.isPending ? t('actions.processing') : t('actions.process')}
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={process.isPending}
          className="inline-flex h-9 items-center rounded-full border border-input px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {t('actions.clear')}
        </button>

        <div className="flex-1" />

        {result ? (
          <div className="flex items-baseline gap-3">
            <span className="text-xs text-muted-foreground">{t('summary.netTotal')}</span>
            <span className="text-lg font-semibold tabular-nums">
              {formatMoney(result.header.netTotal)} {result.header.currency}
            </span>
            {data ? (
              <span className="text-xs text-muted-foreground">{t('summary.elapsed', { ms: data.elapsedMs })}</span>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{t('summary.noResult')}</span>
        )}
      </div>

      {/* A pricing rejection (400 [PRICING_ERROR] message) — the whole run failed. */}
      {process.isError ? (
        <ErrorBanner title={t('banner.failed')} message={apiErrorMessage(process.error, t('banner.failed'))} className="p-4" />
      ) : null}

      {/* Per-item E/W summary — one bad line among good ones (still HTTP 200). */}
      {showStatusBanner ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {t('banner.counts', { errors: errorCount, warnings: warnCount })}
        </div>
      ) : null}

      {/* Results grid. */}
      <div className="rounded-lg border border-border/60 bg-card p-3">
        <h2 className="mb-2 text-sm font-semibold tracking-tight">{t('results.title')}</h2>
        {result === null ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {t('results.empty')}
          </div>
        ) : (
          <div className="h-[24rem] min-h-64">
            <AgGridReact<SimulationResult['items'][number]>
              theme={omsGridTheme}
              rowData={result.items}
              columnDefs={columns}
              defaultColDef={SIM_RESULT_DEFAULT_COL_DEF}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
            />
          </div>
        )}
      </div>
    </section>
  )
}
