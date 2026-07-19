import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, DatabaseZap, Loader2, Play } from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { formatMoney } from '@/core/util/number-format'
import type { SimulateRequest, SimulationResult } from '@/core/models/simulation'
import { simulationApi } from './api'
import SimHeaderForm, { defaultHeader, type SimHeaderState } from './SimHeaderForm'
import SimItemsEntry, { emptyItemRow, type SimItemRow } from './SimItemsEntry'
import SimManualConditions, { type SimManualConditionRow } from './SimManualConditions'
import SimItemDetail from './SimItemDetail'
import SimBonusBuyPanel from './SimBonusBuyPanel'
import SimPromoBlocks from './SimPromoBlocks'
import SimMissedPromotions from './SimMissedPromotions'
import { buildSimulationColumns, SIM_RESULT_DEFAULT_COL_DEF } from './columns'
import { promoView } from './promo-view'
import type { PromoCellContext, PromoHot } from './PromoCell'
import type {
  CellMouseOverEvent,
  GridApi,
  GridReadyEvent,
  RowClassParams,
  RowClassRules,
  RowClickedEvent,
} from 'ag-grid-community'

// Ticket 013 — the POS Simulation tracer. Self-guards on Pricing/Access (issue-429
// pattern, shared ['simulation','access'] key with the menu probe), then: a 4-column
// header form + a basic items entry → Process (POST Pricing/Simulate) → Net Total +
// per-line results grid with red/amber/green status dots + an error/warning banner.
// The condition-card detail (014), bonus-buy tabs (015) and editable grids (016)
// build out from this frontier.
export default function SimulationPage() {
  const { t } = useTranslation('simulation')

  const access = useQuery({ queryKey: ['simulation', 'access'], queryFn: () => simulationApi.access() })

  // Pricing-cache-admin probe (ticket 051, spec 022). Its OWN key — a DISTINCT grant
  // from screen-open — gating the "Clear cache" button below. Show/hide hygiene only:
  // the server enforces the grant on the clear call (ticket 052). Errors/absence leave
  // canClear falsy → no button, the safe default for a not-yet-deployed endpoint.
  const cacheAccess = useQuery({
    queryKey: ['simulation', 'cacheAccess'],
    queryFn: () => simulationApi.cacheAccess(),
  })
  const canClearCache = cacheAccess.data?.canClear === true

  const [header, setHeader] = useState<SimHeaderState>(defaultHeader)
  const [promotion, setPromotion] = useState(true)
  const [pricingElements, setPricingElements] = useState(false)
  const [items, setItems] = useState<SimItemRow[]>(() => [emptyItemRow()])
  const [manualConditions, setManualConditions] = useState<SimManualConditionRow[]>([])
  // Which result line's pricing detail is shown (ticket 014). Selecting a line in
  // the results grid drives the detail below; a fresh Process selects the first line.
  const [selectedItemNumber, setSelectedItemNumber] = useState<number | null>(null)

  const columns = useMemo(() => buildSimulationColumns(t), [t])

  const process = useMutation({
    mutationFn: async (request: SimulateRequest) => {
      const start = performance.now()
      const result = await simulationApi.simulate(request)
      return { result, elapsedMs: Math.round(performance.now() - start) }
    },
    onSuccess: ({ result }) => setSelectedItemNumber(result.items[0]?.itemNumber ?? null),
  })

  // The reworked promotions view model (promoView, ticket 045): per-line refs for the
  // grid's Promotion column (046) and the fired promotions as buy→get blocks (047).
  const view = useMemo(() => promoView(process.data?.result ?? null), [process.data])
  const promoByItem = useMemo(
    () => new Map(view.lines.map((l) => [l.itemNumber, l.promos])),
    [view],
  )

  // Bidirectional grid↔block cross-highlight (ticket 047): the promotion hot under the
  // pointer/focus, wherever it entered. Handed to the grid via `context` (the cell reads
  // row data, the row-class rule reads context.hot); redraw the rows when it changes so
  // the rule re-runs. Keyed on `conditionKey` — the per-application buy↔get join — so a
  // grid-line hover lights only its application's partner lines. On the degradation path
  // (or a whole-block hover) `conditionKey` is null and the whole bby lights instead; the
  // precision therefore sharpens automatically once the projection (044) lands, no code
  // change (per the ticket).
  const [hot, setHot] = useState<PromoHot | null>(null)
  const hotKey = hot ? `${hot.bby}|${hot.conditionKey ?? ''}` : null
  const gridApiRef = useRef<GridApi<SimulationResult['items'][number]> | null>(null)
  useEffect(() => {
    gridApiRef.current?.redrawRows()
  }, [hotKey])

  const gridContext = useMemo<PromoCellContext>(() => ({ promoByItem, hot }), [promoByItem, hot])

  const rowClassRules = useMemo<RowClassRules<SimulationResult['items'][number]>>(
    () => ({
      'sim-row-hot': (p: RowClassParams<SimulationResult['items'][number]>) => {
        const ctx = p.context as PromoCellContext | undefined
        const h = ctx?.hot
        if (!ctx || !h || !p.data) return false
        return (ctx.promoByItem.get(p.data.itemNumber) ?? []).some(
          (r) => r.bbyNumber === h.bby && (h.conditionKey == null || r.conditionKey === h.conditionKey),
        )
      },
    }),
    [],
  )

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
        loyGroups: header.loyGroups.trim() || null,
        loyTier: header.loyTier.trim() || null,
        isPromotionApplicable: promotion,
      },
      items: validItems.map((r) => ({
        materialNumber: r.materialNumber.trim(),
        quantity: Number(r.quantity) || 0,
        qtyUnit: r.qtyUnit.trim(),
        itemConditionControl: r.itemConditionControl.trim() || null,
      })),
      includeConditions: true,
      includePricingElements: pricingElements,
    }
    // Only rows carrying a condition type ride the request; item number defaults to
    // 0 (a header condition) when blank or non-numeric.
    const validManual = manualConditions.filter((c) => c.conditionType.trim() !== '')
    if (validManual.length > 0) {
      request.manualConditions = validManual.map((c) => ({
        itemNumber: Number(c.itemNumber) || 0,
        conditionType: c.conditionType.trim(),
        rate: Number(c.rate) || 0,
        rateUnit: c.rateUnit.trim(),
      }))
    }
    process.mutate(request)
  }

  function clearAll() {
    setHeader(defaultHeader())
    setPromotion(true)
    setPricingElements(false)
    setItems([emptyItemRow()])
    setManualConditions([])
    setSelectedItemNumber(null)
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

  const selectedItem =
    result?.items.find((i) => i.itemNumber === selectedItemNumber) ?? result?.items[0] ?? null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold tracking-tight">{t('title')}</h1>
      </div>

      {/* ===== TOP BAR: header input form | Net-Total summary | actions (spec 503). ===== */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,3fr)_auto_auto]">
        <SimHeaderForm
          value={header}
          onChange={(patch) => setHeader((h) => ({ ...h, ...patch }))}
          promotion={promotion}
          pricingElements={pricingElements}
          onPromotionChange={setPromotion}
          onPricingElementsChange={setPricingElements}
          disabled={process.isPending}
        />

        {/* Net-Total summary — the run's headline figure + calc time. */}
        <div className="flex min-w-52 flex-col justify-center rounded-lg border border-border/60 bg-card p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('summary.title')}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{t('summary.netTotal')}</div>
          {result ? (
            <>
              <div className="mt-0.5">
                <span className="text-3xl font-bold tabular-nums tracking-tight">
                  {formatMoney(result.header.netTotal)}
                </span>
                <span className="ms-1.5 text-sm text-muted-foreground">{result.header.currency}</span>
              </div>
              {/* Discount (red) + tax (blue) breakdown beneath the headline net total. */}
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                <span className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">
                  <span className="me-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t('summary.totalDiscount')}
                  </span>
                  {formatMoney(result.header.totalDiscount)}
                </span>
                <span className="text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                  <span className="me-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t('summary.tax')}
                  </span>
                  {formatMoney(result.header.taxValue)}
                </span>
              </div>
              {data ? (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {t('summary.calc', { ms: data.elapsedMs })}
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-0.5 text-3xl font-bold tabular-nums tracking-tight text-muted-foreground/40">
              {t('summary.placeholder')}
            </div>
          )}
        </div>

        {/* Actions — Process + Clear, plus a Clear-cache button gated on the pricing-
            cache-admin grant (ticket 051, spec 022 — reinstating the WPF "Clear Cache"
            that spec 503 had dropped). The clear behaviour lands in ticket 052. */}
        <div className="flex min-w-36 flex-col justify-center gap-2 rounded-lg border border-border/60 bg-card p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('actions.title')}
          </div>
          <button
            type="button"
            onClick={runProcess}
            disabled={!canProcess}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85 disabled:opacity-50"
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
            className="inline-flex h-9 w-full items-center justify-center rounded-full border border-input px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {t('actions.clear')}
          </button>
          {/* Cache-admins only. Wired but inert this slice — confirm + clear + toasts
              are ticket 052; the onClick lands there. */}
          {canClearCache ? (
            <button
              type="button"
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-input px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <DatabaseZap className="h-4 w-4" aria-hidden />
              {t('clearCache.button')}
            </button>
          ) : null}
        </div>
      </div>

      {/* A pricing rejection (400 [PRICING_ERROR] message) — the whole run failed. */}
      {process.isError ? (
        <ErrorBanner title={t('banner.failed')} message={apiErrorMessage(process.error, t('banner.failed'))} className="p-4" />
      ) : null}

      {/* ===== MAIN: 7/5 split — left = inputs + results; right = detail + bonus buys. ===== */}
      <div className="grid gap-3 xl:grid-cols-[7fr_5fr]">
        {/* LEFT column. */}
        <div className="flex min-w-0 flex-col gap-3">
          {/* Editable items grid + manual-conditions grid, side by side. */}
          <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
            <SimItemsEntry rows={items} onChange={setItems} disabled={process.isPending} />
            <SimManualConditions
              rows={manualConditions}
              onChange={setManualConditions}
              disabled={process.isPending}
            />
          </div>

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
              // onMouseLeave clears the cross-highlight once — per-cell mouse-out would
              // flicker as the pointer crosses cells within a row.
              <div className="h-[24rem] min-h-64" onMouseLeave={() => setHot(null)}>
                <AgGridReact<SimulationResult['items'][number]>
                  theme={omsGridTheme}
                  rowData={result.items}
                  columnDefs={columns}
                  context={gridContext}
                  rowClassRules={rowClassRules}
                  defaultColDef={SIM_RESULT_DEFAULT_COL_DEF}
                  rowHeight={OMS_GRID_ROW_HEIGHT}
                  headerHeight={OMS_GRID_HEADER_HEIGHT}
                  animateRows={false}
                  rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
                  onGridReady={(e: GridReadyEvent<SimulationResult['items'][number]>) => {
                    gridApiRef.current = e.api
                  }}
                  onRowClicked={(e: RowClickedEvent<SimulationResult['items'][number]>) =>
                    setSelectedItemNumber(e.data?.itemNumber ?? null)
                  }
                  // Hovering a line lights its promotion block (ticket 047) — raise the
                  // first promotion touching the row (with its conditionKey for per-
                  // application precision); null on a plain, un-promoted line. Bail if
                  // unchanged so crossing cells within a row doesn't churn a redraw.
                  onCellMouseOver={(e: CellMouseOverEvent<SimulationResult['items'][number]>) => {
                    const ref = e.data ? (promoByItem.get(e.data.itemNumber) ?? [])[0] : undefined
                    const next: PromoHot | null = ref
                      ? { bby: ref.bbyNumber, conditionKey: ref.conditionKey }
                      : null
                    setHot((prev) =>
                      prev?.bby === next?.bby && prev?.conditionKey === next?.conditionKey ? prev : next,
                    )
                  }}
                  // Highlight the selected line — including the first line auto-selected on
                  // Process — by syncing AG Grid's native selection to our source of truth.
                  onRowDataUpdated={(e) =>
                    e.api.forEachNode((node) => node.setSelected(node.data?.itemNumber === selectedItem?.itemNumber))
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT column — fired-promotion blocks + pricing detail + bonus-buy tabs. */}
        <div className="flex min-w-0 flex-col gap-3">
          {/* Fired promotions as plain-language buy→get blocks (ticket 047), linked to
              the results grid by the shared hot-promotion state. */}
          {result ? (
            <SimPromoBlocks
              blocks={view.blocks}
              currency={result.header.currency}
              // A block spans a whole bby (potentially several applications), so it lights
              // on bby alone; hovering one raises the whole bby (conditionKey null).
              hotBby={hot?.bby ?? null}
              onHotChange={(bby) => setHot(bby ? { bby, conditionKey: null } : null)}
            />
          ) : null}

          {/* "Could have applied" — the near-misses beneath the fired blocks (ticket
              048); absent when nothing was missed. */}
          {result ? <SimMissedPromotions missed={view.missed} currency={result.header.currency} /> : null}

          {selectedItem ? (
            /* Per-line pricing detail + aggregated condition cards (ticket 014). */
            <SimItemDetail key={selectedItem.itemNumber} item={selectedItem} currency={result?.header.currency ?? ''} />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border/60 bg-card text-sm text-muted-foreground">
              {t('summary.noResult')}
            </div>
          )}

          {/* Bonus-buy tabs + pricing-elements trace (ticket 015). */}
          {result ? <SimBonusBuyPanel result={result} selectedItem={selectedItem} /> : null}
        </div>
      </div>
    </section>
  )
}
