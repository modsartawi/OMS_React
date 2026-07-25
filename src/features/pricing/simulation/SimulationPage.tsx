import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// No AG Grid import here any more: ticket 116 dissolved the Pricing-Elements panel into
// the line expansion as a plain table, which was the feature's LAST grid. The screen now
// renders zero grids, so the setup side-effect import and the column-definition builder
// went with it.
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
import SimPromotionsRail from './SimPromotionsRail'
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
  // Which result lines have their expansion OPEN (ticket 116). A set, not a selection:
  // the detail panel it replaced could show one line at a time, and comparing two lines'
  // rules is the reason to open two. Empty at rest — nothing ever auto-opens, so the
  // Results frame's resting height depends only on how many lines were priced.
  const [openLines, setOpenLines] = useState<ReadonlySet<number>>(() => new Set())
  const toggleLine = useCallback((itemNumber: number) => {
    setOpenLines((prev) => {
      const next = new Set(prev)
      if (!next.delete(itemNumber)) next.add(itemNumber)
      return next
    })
  }, [])
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
    // A re-run CLOSES every expansion (ticket 115, ruled in 104 §6) — it never
    // auto-opens the first line. The new result is new lines, `conditionKey` is not
    // stable across runs (098 finding 4), and a stale expansion showing the previous
    // run's conditions is worse than an extra click. The first line's detail used to
    // open itself via the old right-hand panel's fallback; ticket 116 signed for
    // losing that in the design ledger.
    onSuccess: ({ result, elapsedMs, request }) => {
      setRun({ result, elapsedMs, request })
      setOpenLines(new Set())
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
    setOpenLines(new Set())
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

  // Whether the run ON SCREEN measured promotions at all — read off the request that
  // produced it, never off the checkbox as it currently stands, which may already
  // describe the NEXT run (that difference is what the status slot's stale mark is
  // for). It is the difference between the rail saying "nothing fired" and "nothing
  // was measured", so it is named here rather than walked inline in the JSX.
  const ranWithPromotions = run?.request.header.isPromotionApplicable === true

  // `@container` declares the WORK AREA as the measurement everything on this
  // screen responds to (ticket 113, completed in 119). Every responsive rule in the
  // rework is a container query on this element, never a viewport media query: the
  // nav eats 200–260 px, so a 1280 laptop is a *960* screen and the viewport
  // systematically lies. Nothing under this element reads the viewport — the
  // feature's last `md:` prefix went with ticket 119, and the only measurement left
  // in JavaScript is the elements trace's own width, which the shed order needs as a
  // number because it is a pure module rather than CSS.
  //
  // `min-w-[780px]` is the FLOOR (spec 110): below 780 px of work area — roughly a
  // 1024 px window with the nav open — the shell scrolls horizontally and no further
  // arrangement exists. There is no phone layout, ever: this is an internal
  // back-office tool run by an analyst at a desk, and a fourth arrangement for a
  // width nobody works at would be three rules maintained for none.
  return (
    <section
      data-sim-work-area
      className="@container flex min-w-[780px] flex-col gap-3"
    >
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

      {/* Items never collapse, never join the strip, and never move: they are the
          instrument retyped every run, and a failed run must leave them exactly where
          they were so the offending line is corrected in place (ticket 120). Manual
          conditions fold in as a disclosure — no fourth frame.

          They take the FULL width (ticket 117). The 66/34 split below is between the
          results and the promotions rail — the two things the split is about — so Items
          is not squeezed into two thirds to make room for a frame that describes a run
          rather than an input. */}
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

          {/* ===== THE 66/34 SPLIT (ticket 117) — the results table left, the promotions
              rail right, so the screen's PRIMARY question ("did the promotion fire?") is
              answered at eye level rather than in a right-hand column below the fold.

              The two frames are SIBLINGS in one grid rather than the rail riding at the
              top of a column beside Items: they align at the top, and the rail — held
              apart as its own frame — grows and shrinks without ever shifting the lines
              it explains.

              The split is a `@container` query on the work area, not a viewport media
              query (ticket 113's mechanism): the nav eats 200–260 px, so a 1280 laptop
              is a *960* screen.

              THE ONE BREAKPOINT — 900 px of work area (ticket 119), derived rather than
              chosen: the rebuilt line needs ~470 px and the rail has a 250 px floor, so
              *beside* is structurally possible from ~740, and 900 leaves headroom rather
              than sitting on the limit. The rejected 1140 would have kept every
              beside-layout roomy at the price that a 1280 or 1366 laptop with the nav
              open never sees the approved device — making the arrangement the exception
              rather than the rule.

              Below 900 the grid falls back to one column and the RESULTS take
              `order-last`, which puts the rail ABOVE them: the verdict may not sit under
              the evidence it explains. So the order of the three frames changes with
              width — beside is Items → Results | Promotions, stacked is Items →
              Promotions → Results — and that is deliberate, not a fallout.

              The `order` lives on the results rather than on the rail so the SOURCE
              order stays results-then-rail, which is the reading and tab order at the
              width the screen is normally worked at. ===== */}
          {/* `items-start` is what "held apart as its own frame" means in CSS: without
              it the grid stretches both frames to the taller one, so a rail carrying
              three cards would print a Results frame with a hand's width of empty card
              under two lines. Each frame is as tall as its own content (ticket 115's
              rule for the table, and the rail inherits it). */}
          <div className="grid items-start gap-3 @[900px]:grid-cols-[66fr_34fr]">
            <div
              data-work-area="results"
              className="order-last min-w-0 rounded-lg border border-border/60 bg-card p-3 @[900px]:order-none"
            >
              <h2 className="mb-2 text-sm font-semibold tracking-tight">{t('results.title')}</h2>
              <SimResultsGrid
                items={result.items}
                promoByItem={promoByItem}
                hot={hot}
                // The table marks — and expands — exactly the lines the analyst
                // opened (ticket 116). Empty after a re-run; never seeded with a
                // first line.
                openItemNumbers={openLines}
                currency={result.header.currency}
                onToggle={toggleLine}
                onHotChange={setHot}
              />
            </div>

            {/* Fires AND near-misses in ONE column: the fired buy→get cards (ticket 047)
                and the reinstated "Could have applied" cards (048), sharing the results
                table's hot-promotion state for the cross-highlight. `promotionApplicable`
                comes off the REQUEST that produced this result — never the checkbox as it
                currently stands, which may already describe the next run. */}
            <SimPromotionsRail
              view={view}
              currency={result.header.currency}
              promotionApplicable={ranWithPromotions}
              // A card spans a whole bby (potentially several applications), so it
              // raises the whole bby: `conditionKey` null. The results table narrows to
              // one application when the projection (044) supplies a key; a card cannot.
              hotBby={hot?.bby ?? null}
              onHotChange={(bby) => setHot(bby ? { bby, conditionKey: null } : null)}
            />
          </div>
        </>
      )}
    </section>
  )
}
