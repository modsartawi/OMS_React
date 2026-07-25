import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk (the
// Pricing-Elements panel below still renders an AG Grid; the results grid no longer does).
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { confirmAction } from '@/core/services/confirm'
import ErrorBanner from '@/core/ui/ErrorBanner'
import type { SimulateRequest, SimulationResult } from '@/core/models/simulation'
import { simulationApi } from './api'
// The header form is no longer rendered here — it is the run strip's expansion
// (ticket 113); only its state shape and defaults are the Page's.
import { defaultHeader, type SimHeaderState } from './SimHeaderForm'
import SimItemsEntry, { emptyItemRow, type SimItemRow } from './SimItemsEntry'
import SimManualConditions, { type SimManualConditionRow } from './SimManualConditions'
import SimItemDetail from './SimItemDetail'
import SimBonusBuyPanel from './SimBonusBuyPanel'
import SimPromoBlocks from './SimPromoBlocks'
// SimMissedPromotions temporarily hidden — Potential Bonus Buys held back for now.
// import SimMissedPromotions from './SimMissedPromotions'
import SimResultsGrid, { type PromoHot } from './SimResultsGrid'
import SimRunStrip from './SimRunStrip'
import { promoView } from './promo-view'
import { runChips } from './run-chips'

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

  // Whole-cache clear (ticket 052). On success a confirmation toast; on the server's
  // rate-limit (a success:false BUSINESS envelope, thrown as ApiError) surface its
  // message via apiErrorMessage — NO retry, no "unexpected" wording (api-envelope rule).
  const clearCache = useMutation({
    mutationFn: () => simulationApi.clearCache(),
    onSuccess: () => toast.success(t('clearCache.success')),
    onError: (err) => {
      const title = t('clearCache.denied')
      toast.error(title, { description: apiErrorMessage(err, title) })
    },
  })

  // Confirm before firing — the clear evicts every user's warm pricing on the instance,
  // so it must never be a stray click (spec 022).
  async function runClearCache() {
    if (clearCache.isPending) return
    const ok = await confirmAction(t('clearCache.confirmBody'), t('clearCache.confirmTitle'))
    if (ok) clearCache.mutate()
  }

  const [header, setHeader] = useState<SimHeaderState>(defaultHeader)
  const [promotion, setPromotion] = useState(true)
  const [pricingElements, setPricingElements] = useState(false)
  const [items, setItems] = useState<SimItemRow[]>(() => [emptyItemRow()])
  const [manualConditions, setManualConditions] = useState<SimManualConditionRow[]>([])
  // Which result line's pricing detail is shown (ticket 014). Selecting a line in
  // the results grid drives the detail below; a fresh Process selects the first line.
  const [selectedItemNumber, setSelectedItemNumber] = useState<number | null>(null)
  // The run strip's disclosure (ticket 113). The Page owns it because it collapses
  // on every Process — and auto-expands NEVER, including a Process that fails,
  // which is still a Process: the screen must not move itself while the analyst is
  // starting to read a failure.
  const [stripOpen, setStripOpen] = useState(false)

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
  // pointer/focus, wherever it entered. The results grid raises it on line hover/focus and
  // lights its own matching lines; SimPromoBlocks raises it on block hover and reads it back.
  // Keyed on `conditionKey` — the per-application buy↔get join — so a grid-line hover lights
  // only its application's partner lines. On the degradation path (or a whole-block hover)
  // `conditionKey` is null and the whole bby lights instead; the precision therefore sharpens
  // automatically once the projection (044) lands, no code change (per the ticket).
  const [hot, setHot] = useState<PromoHot | null>(null)

  const validItems = items.filter((r) => r.materialNumber.trim() !== '')
  const canProcess = validItems.length > 0 && !process.isPending

  // The request the inputs on screen currently describe. Built once and read
  // twice: Process posts it, and the run strip's chip set reads its determination
  // off it (ticket 113 — the chips are the request, not a second spelling of it).
  const request = useMemo<SimulateRequest>(() => {
    const built: SimulateRequest = {
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
      built.manualConditions = validManual.map((c) => ({
        itemNumber: Number(c.itemNumber) || 0,
        conditionType: c.conditionType.trim(),
        rate: Number(c.rate) || 0,
        rateUnit: c.rateUnit.trim(),
      }))
    }
    return built
    // `validItems` is derived from `items` on every render, so the item rows are
    // the dependency, not the filtered array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header, promotion, pricingElements, items, manualConditions])

  const chips = useMemo(() => runChips(request), [request])

  const runProcess = useCallback(() => {
    if (request.items.length === 0 || process.isPending) return
    // Collapse on EVERY Process (ticket 113) — the determination is settled the
    // moment it is sent, and the results deserve the width.
    setStripOpen(false)
    process.mutate(request)
    // `process` is a stable mutation object bar its flags; the request is what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, process.isPending])

  // Ctrl+Enter processes from ANYWHERE — including inside the items grid and the
  // expanded form (102 §6), which is what makes the tweak-one-field-and-re-run loop
  // mouse-free. Signposted on the button itself (`▶ Process ⌃⏎`). A window listener
  // rather than a container handler so "anywhere" means anywhere on the screen.
  const runProcessRef = useRef(runProcess)
  runProcessRef.current = runProcess
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        runProcessRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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

  // `@container` declares the WORK AREA as the measurement everything on this
  // screen responds to (ticket 113). Every responsive rule in the rework is a
  // container query on this element, never a viewport media query: the nav eats
  // 200–260 px, so a 1280 laptop is a *960* screen and the viewport systematically
  // lies. (`SimResultsGrid` declares its own inner container for its 820 px
  // table↔card swap; nothing below reads the viewport again.)
  return (
    <section className="@container flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold tracking-tight">{t('title')}</h1>
      </div>

      {/* ===== THE RUN STRIP (ticket 113): the header form, the Summary tile and
          the Actions card dissolved into ONE unframed row — chip set · status slot ·
          money · run controls. ===== */}
      <SimRunStrip
        chips={chips}
        header={header}
        onHeaderChange={(patch) => setHeader((h) => ({ ...h, ...patch }))}
        promotion={promotion}
        pricingElements={pricingElements}
        onPromotionChange={setPromotion}
        onPricingElementsChange={setPricingElements}
        expanded={stripOpen}
        onExpandedChange={setStripOpen}
        // A total belongs to a run: absent before the first Process and after a
        // failure, rather than zeroed or placeheld.
        money={
          result && data
            ? {
                netTotal: result.header.netTotal,
                currency: result.header.currency,
                totalDiscount: result.header.totalDiscount,
                taxValue: result.header.taxValue,
                elapsedMs: data.elapsedMs,
              }
            : null
        }
        pending={process.isPending}
        canProcess={canProcess}
        onProcess={runProcess}
        onClear={clearAll}
        canClearCache={canClearCache}
        clearCachePending={clearCache.isPending}
        onClearCache={() => void runClearCache()}
      />

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
              className="flex items-center gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-sm text-attention-800"
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
              <SimResultsGrid
                items={result.items}
                promoByItem={promoByItem}
                hot={hot}
                selectedItemNumber={selectedItem?.itemNumber ?? null}
                currency={result.header.currency}
                onSelect={setSelectedItemNumber}
                onHotChange={setHot}
              />
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
              048); absent when nothing was missed. Temporarily hidden — the Potential
              Bonus Buys surface is held back for now (re-enable to restore). */}
          {/* {result ? <SimMissedPromotions missed={view.missed} currency={result.header.currency} /> : null} */}

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
