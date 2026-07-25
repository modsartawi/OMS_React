import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk (the
// Pricing-Elements panel below still renders an AG Grid; the results grid no longer does).
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { confirmAction } from '@/core/services/confirm'
import type { SimulateRequest, SimulationResult } from '@/core/models/simulation'
import { simulationApi } from './api'
// The header form is no longer rendered here — it is the run strip's expansion
// (ticket 113); only its state shape and defaults are the Page's.
import { defaultHeader, type SimHeaderState } from './SimHeaderForm'
import SimItemsEntry, { emptyItemRow, type SimItemRow } from './SimItemsEntry'
import SimManualConditions, { type SimManualConditionRow } from './SimManualConditions'
import SimFailureBanner from './SimFailureBanner'
import SimItemDetail from './SimItemDetail'
import SimBonusBuyPanel from './SimBonusBuyPanel'
import SimPromoBlocks from './SimPromoBlocks'
// SimMissedPromotions temporarily hidden — Potential Bonus Buys held back for now.
// import SimMissedPromotions from './SimMissedPromotions'
import SimResultsGrid, { type PromoHot } from './SimResultsGrid'
import SimRunStrip from './SimRunStrip'
import { SimStaleResultsNote } from './SimStatusSlot'
import { promoView } from './promo-view'
import { runChips } from './run-chips'
import { isStaleRun } from './staleness'

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
  //
  // It starts OPEN (ticket 120): before any Process there is no run to condense,
  // and this is the moment the determination is actually set. The three test levers
  // — procedure key, loyalty group, loyalty tier — are reachable from the first
  // paint rather than behind a chip set describing a run that has not happened.
  const [stripOpen, setStripOpen] = useState(true)

  // The run ON SCREEN: its result, how long it took, and — the part ticket 114
  // needs — the request that produced it, which is what staleness compares
  // against. It is the Page's own state rather than `process.data` because a
  // mutation clears its data the moment `mutate` is called again, and the
  // previous results must STAY on screen while the next run is out: the captured
  // runs return in 184–268 ms, so blanking them would be a flicker of nothing.
  const [run, setRun] = useState<{
    result: SimulationResult
    elapsedMs: number
    request: SimulateRequest
  } | null>(null)

  const process = useMutation({
    mutationFn: async (request: SimulateRequest) => {
      const start = performance.now()
      const result = await simulationApi.simulate(request)
      return { result, elapsedMs: Math.round(performance.now() - start), request }
    },
    // A re-run CLEARS the selection (ticket 115, ruled in 104 §6) — it no longer
    // auto-selects the first line. The new result is new lines, `conditionKey` is not
    // stable across runs (098 finding 4), and a stale expansion showing the previous
    // run's conditions is worse than an extra click. (The detail panel on the right
    // keeps its own first-line fallback until ticket 116 folds it into the line.)
    onSuccess: ({ result, elapsedMs, request }) => {
      setRun({ result, elapsedMs, request })
      setSelectedItemNumber(null)
    },
    // A whole-run failure takes the previous run down with it (spec 110): a total
    // and an error banner side by side would invite reading the old numbers as
    // this run's. So it is absent, never zeroed and never left standing.
    onError: () => setRun(null),
  })

  // The reworked promotions view model (promoView, ticket 045): per-line refs for the
  // grid's Promotion column (046) and the fired promotions as buy→get blocks (047).
  const view = useMemo(() => promoView(run?.result ?? null), [run])
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

  // The status slot's stale state (ticket 114) — the inputs on screen against the
  // request that produced the on-screen result. It MARKS only: Process is not
  // blocked, nothing re-runs, and the results below stay readable and undimmed,
  // because comparing this total against the last one is the loop's whole point.
  const stale = useMemo(() => isStaleRun(request, run?.request ?? null), [request, run])

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
  const canProcessRef = useRef(canProcess)
  canProcessRef.current = canProcess
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return
      // Only swallow the keystroke when it actually starts a run — a shortcut
      // that eats Ctrl+Enter while the basket is empty or a run is already out
      // would be a dead key rather than a quiet no-op.
      if (!canProcessRef.current) return
      e.preventDefault()
      runProcessRef.current()
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
    setRun(null)
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

  const result: SimulationResult | null = run?.result ?? null

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
          run
            ? {
                netTotal: run.result.header.netTotal,
                currency: run.result.header.currency,
                totalDiscount: run.result.header.totalDiscount,
                taxValue: run.result.header.taxValue,
                elapsedMs: run.elapsedMs,
              }
            : null
        }
        pending={process.isPending}
        stale={stale}
        canProcess={canProcess}
        onProcess={runProcess}
        onClear={clearAll}
        canClearCache={canClearCache}
        clearCachePending={clearCache.isPending}
        onClearCache={() => void runClearCache()}
      />

      {/* ===== MAIN: 7/5 split — left = inputs + work area; right = detail + bonus
          buys, present only when there IS a run to describe. ===== */}
      <div className="grid gap-3 xl:grid-cols-[7fr_5fr]">
        {/* LEFT column. Items never collapse, never join the strip, and never move:
            they are the instrument retyped every run, and a failed run must leave
            them exactly where they were so the offending line is corrected in place
            (ticket 120). Manual conditions fold in as a disclosure — no fourth frame. */}
        <div className="flex min-w-0 flex-col gap-3">
          <SimItemsEntry rows={items} onChange={setItems} disabled={process.isPending}>
            <SimManualConditions
              rows={manualConditions}
              onChange={setManualConditions}
              disabled={process.isPending}
            />
          </SimItemsEntry>

          {/* ---- THE WORK AREA: exactly one of three things, never a stack ----
              The banner REPLACES it rather than pushing it down, and before the
              first Process it is one line of quiet text — not a framed empty box,
              not a skeleton, not a sample basket. Nothing has happened, so there
              is nothing to draw; that is the reclaim.

              The per-item E/W count banner is RETIRED (ticket 115, ruled in 104 §2):
              on the captured evidence it is a warning-only banner over a three-line
              table where the line's own badge is already in view — two surfaces for
              one fact, and the badge is the one that says WHICH line. */}
          {process.isError ? (
            <SimFailureBanner error={process.error} onOpenSettings={() => setStripOpen(true)} />
          ) : result === null ? (
            <p data-work-area="pre-run" className="px-1 py-2 text-sm text-muted-foreground">
              {t('summary.noResult')}
            </p>
          ) : (
            <>
              {/* The stale mark's second appearance (ticket 114): the strip carries it
                  where the change happened, this line carries it where the stale
                  numbers are. Only when there is a result for it to be about — and
                  never while a run is out, because the slot's three states are
                  exclusive there and two vocabularies for one state is one too many. */}
              {stale && !process.isPending ? <SimStaleResultsNote /> : null}

              <div data-work-area="results" className="rounded-lg border border-border/60 bg-card p-3">
                <h2 className="mb-2 text-sm font-semibold tracking-tight">{t('results.title')}</h2>
                <SimResultsGrid
                  items={result.items}
                  promoByItem={promoByItem}
                  hot={hot}
                  // The table marks what is actually SELECTED — `null` after a re-run.
                  // The detail panel's first-line fallback must not put a mark on a line
                  // the analyst never chose.
                  selectedItemNumber={selectedItemNumber}
                  currency={result.header.currency}
                  onSelect={setSelectedItemNumber}
                  onHotChange={setHot}
                />
              </div>
            </>
          )}
        </div>

        {/* RIGHT column — fired-promotion blocks + pricing detail + bonus-buy tabs.
            Absent entirely with no result: an empty dashed box is a frame drawn
            around nothing, which is the shape ticket 120 reclaims. */}
        {result ? (
          <div className="flex min-w-0 flex-col gap-3">
            {/* Fired promotions as plain-language buy→get blocks (ticket 047), linked to
                the results grid by the shared hot-promotion state. */}
            <SimPromoBlocks
              blocks={view.blocks}
              currency={result.header.currency}
              // A block spans a whole bby (potentially several applications), so it lights
              // on bby alone; hovering one raises the whole bby (conditionKey null).
              hotBby={hot?.bby ?? null}
              onHotChange={(bby) => setHot(bby ? { bby, conditionKey: null } : null)}
            />

            {/* "Could have applied" — the near-misses beneath the fired blocks (ticket
                048); absent when nothing was missed. Temporarily hidden — the Potential
                Bonus Buys surface is held back for now (re-enable to restore). */}
            {/* <SimMissedPromotions missed={view.missed} currency={result.header.currency} /> */}

            {/* Per-line pricing detail + aggregated condition cards (ticket 014). */}
            {selectedItem ? (
              <SimItemDetail
                key={selectedItem.itemNumber}
                item={selectedItem}
                currency={result.header.currency}
              />
            ) : null}

            {/* Bonus-buy tabs + pricing-elements trace (ticket 015). */}
            <SimBonusBuyPanel result={result} selectedItem={selectedItem} />
          </div>
        ) : null}
      </div>
    </section>
  )
}
