import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, FilterChangedEvent, GridApi, ICellRendererParams, IRowNode, RowSelectionOptions } from 'ag-grid-community'
import { ArrowLeft, Filter, Loader2, Search } from 'lucide-react'
// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type {
  BbyMaintainOutcome,
  BbyOverviewRow,
  BbyPromotion,
} from '@/core/models/bonus-buy-maintenance'
import { confirmAction } from '@/core/services/confirm'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import ScreenGate from '@/core/ui/ScreenGate'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatCount, fsi } from '@/core/util/bidi'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import {
  bbyMaintainAccessQuery,
  bbyMaintainApi,
  canMarkTested,
  canOpenBbyMaintain,
  promotionKey,
  promotionListKey,
} from './api'
import ActReport, { type Report, type ReportRow } from './ActReport'
import { TEST_NOTE_MAX } from './editor'
import { DateInput, TextInput } from './fields'
import UploadDialog from './UploadDialog'
import {
  BBY_MAINTAIN_ROOT,
  canActivateSelection,
  canDeletePromotion,
  editorPath,
  type EachOutcome,
  isPromotionNotFound,
  matchesOverview,
  type OverviewChip,
  overviewChips,
  overviewDayComparator,
  overviewStatusCounts,
  overviewSeverity,
  overviewStatus,
  PROMOTION_NAME_MAX,
  readPromotionFlip,
  runEach,
  testableNumbers,
} from './overview'

/**
 * "Change promotion: Bonus Buy Overview", copied from SAP (ticket 416, screenshots 1/11).
 * The header (number, name, type `SACH`, the sales window with Purchase/Listed shown equal),
 * the promotion's own acts, and the one Bonus Buy tab SAP's screen has that this copy keeps.
 */
export default function PromotionPage() {
  const { t } = useTranslation('bonus-buy-maintenance')
  const { promoNumber = '' } = useParams()
  return (
    <ScreenGate
      query={bbyMaintainAccessQuery()}
      can={canOpenBbyMaintain}
      ns="bonus-buy-maintenance"
      title={t('promotion.title')}
      subtitle={t('promotion.subtitle')}
    >
      <PromotionLoader promoNumber={promoNumber} />
    </ScreenGate>
  )
}

function PromotionLoader({ promoNumber }: { promoNumber: string }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const promo = useQuery({
    queryKey: promotionKey(promoNumber),
    queryFn: () => bbyMaintainApi.promotion(promoNumber),
  })
  return (
    <>
      <Link
        to={BBY_MAINTAIN_ROOT}
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {/* Flips under RTL: "back" points to the reading start. */}
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        {t('promotion.back')}
      </Link>
      {promo.isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        </div>
      ) : promo.isError ? (
        <ErrorBanner
          message={apiErrorMessage(promo.error, t('promotion.loadFailed'))}
          className="px-3 py-2"
        />
      ) : isPromotionNotFound(promo.data) ? (
        <ErrorBanner message={t('promotion.notFound', { number: fsi(promoNumber) })} className="px-3 py-2" />
      ) : (
        // Keyed so the header form starts from the promotion it shows.
        <PromotionBody key={promo.data.promoNumber} promo={promo.data} />
      )}
    </>
  )
}

const OVERVIEW_SELECTION: RowSelectionOptions<BbyOverviewRow> = {
  mode: 'multiRow',
  checkboxes: true,
  headerCheckbox: true,
  enableClickSelection: true,
  // A filtered select-all selects only the rows shown: a bulk act never reaches a hidden row.
  selectAll: 'filtered',
}

/** A command bar: the strip of buttons on top of the promotion card and of the bonus buy list. */
const BAR = 'flex flex-wrap items-center gap-2 border-b border-border-strong bg-card-2 px-3 py-2'
const SEP = 'h-5 w-px bg-border-strong'
/** A status chip and the column-filter toggle: pressed reads as a state, not an action. */
const CHIP = 'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium'
const CHIP_ON = 'border-primary/40 bg-primary/10 text-primary'
const CHIP_IDLE = 'border-border bg-card text-foreground hover:bg-accent'

/** What the grid shows when the filter leaves no row (an empty promotion never mounts the grid). */
function NoMatch() {
  const { t } = useTranslation('bonus-buy-maintenance')
  return <span className="text-sm text-muted-foreground">{t('overview.filter.none')}</span>
}

/** The day and datetime columns filter by calendar day. */
const DAY_FILTER: ColDef<BbyOverviewRow> = {
  filter: 'agDateColumnFilter',
  filterParams: { comparator: overviewDayComparator },
}

type EachAct = 'activate' | 'deactivate' | 'delete' | 'test'

function StatusCell({ value }: ICellRendererParams<BbyOverviewRow, string | null>) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const status = overviewStatus(value)
  // An unknown code is shown beside its label, isolated by the renderer itself — never
  // through `fsi` in a `t()` sentence, whose invisible characters would reach Ctrl+C.
  return (
    <span className="inline-flex items-center gap-1">
      <StatusBadge sev={overviewSeverity(status)}>{t(`overview.status.${status}`)}</StatusBadge>
      {status === 'unknown' && value != null && (
        <span className="font-mono text-xs text-muted-foreground">
          <Ltr>{value}</Ltr>
        </span>
      )}
    </span>
  )
}

function PromotionBody({ promo }: { promo: BbyPromotion }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState(promo.name)
  const [from, setFrom] = useState(formatDay(promo.salesFrom))
  const [to, setTo] = useState(formatDay(promo.salesTo))
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [copySapOpen, setCopySapOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  // The tester grant, off the access answer the screen gate already holds (no second probe).
  const canTest = canMarkTested(useQuery(bbyMaintainAccessQuery()).data)

  // The overview's filter: search + status chip narrow the rows handed to the grid; the grid's
  // own column filters (the toggled filter row) narrow them further.
  const [query, setQuery] = useState('')
  const [chip, setChip] = useState<OverviewChip>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [columnFiltered, setColumnFiltered] = useState(false)
  const [shown, setShown] = useState(promo.bonusBuys.length)
  const gridApi = useRef<GridApi<BbyOverviewRow> | null>(null)
  const counts = useMemo(() => overviewStatusCounts(promo.bonusBuys), [promo.bonusBuys])
  const rowData = useMemo(
    () => promo.bonusBuys.filter((b) => matchesOverview(b, query, chip)),
    [promo.bonusBuys, query, chip],
  )
  const filtered = query.trim() !== '' || chip !== 'all' || columnFiltered

  // A refresh can drop selected rows (a multi-delete, an act elsewhere), and so can the search
  // or a chip: a row the filter hides is unselected, so no act ever reaches a row not shown.
  // When every row goes, the grid unmounts and never reports the change, so prune from the data.
  useEffect(() => {
    const present = new Set(rowData.map((b) => b.bbyNumber))
    setSelected((s) => (s.every((n) => present.has(n)) ? s : s.filter((n) => present.has(n))))
  }, [rowData])

  /** A column filter hides rows the grid still holds: unselect every selected one it hid. */
  const onFilterChanged = ({ api }: FilterChangedEvent<BbyOverviewRow>) => {
    setColumnFiltered(api.isColumnFilterPresent())
    const kept = new Set<string>()
    api.forEachNodeAfterFilter((n) => n.data && kept.add(n.data.bbyNumber))
    const hidden: IRowNode<BbyOverviewRow>[] = []
    api.forEachNode((n) => n.isSelected() && n.data && !kept.has(n.data.bbyNumber) && hidden.push(n))
    if (hidden.length) api.setNodesSelected({ nodes: hidden, newValue: false })
  }

  const clearFilters = () => {
    setQuery('')
    setChip('all')
    gridApi.current?.setFilterModel(null)
  }

  const toggleColumnFilters = () => {
    // Hiding the filter row also drops what it held: a filter nobody can see must not apply.
    if (showFilters) gridApi.current?.setFilterModel(null)
    setShowFilters((v) => !v)
  }

  const notFoundReport = (): Report => ({
    title: t('promotion.notFound', { number: fsi(promo.promoNumber) }),
    tone: 'bad',
    rows: [],
  })

  const dirty =
    name.trim() !== promo.name || from !== formatDay(promo.salesFrom) || to !== formatDay(promo.salesTo)
  const one = selected.length === 1 ? selected[0] : null
  // Only a Tested bonus buy goes live (spec 2396): Activate is not offered on a Planned one.
  const selectedRows = promo.bonusBuys
    .filter((b) => selected.includes(b.bbyNumber))
    .map((b) => ({ number: b.bbyNumber, status: overviewStatus(b.bbyStatus) }))
  const activatable = canActivateSelection(selectedRows.map((r) => r.status))
  // Mark Tested on a selection (select-all over hundreds of rows): only its Planned ones are sent.
  const testable = testableNumbers(selectedRows)

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: promotionKey(promo.promoNumber) }),
      queryClient.invalidateQueries({ queryKey: promotionListKey }),
    ])

  const outcomeWord = (kind: EachOutcome['kind']) => t(`overview.report.${kind}`)

  /** Runs one promotion-level or single act, turning a throw into a report. */
  async function guarded(act: () => Promise<void>) {
    setBusy(true)
    try {
      await act()
    } catch (err) {
      setReport({
        title: t('promotion.actFailed'),
        tone: 'bad',
        rows: [{ message: apiErrorMessage(err, t('promotion.actFailed')), refusals: [] }],
      })
    } finally {
      setBusy(false)
    }
  }

  const saveHeader = () =>
    guarded(async () => {
      const outcome = await bbyMaintainApi.savePromotion({
        promoNumber: promo.promoNumber,
        name: name.trim(),
        salesFrom: from,
        salesTo: to,
      })
      if (outcome.status === 'notFound') {
        setReport(notFoundReport())
        return
      }
      if (outcome.status !== 'saved') {
        setReport({
          title: t('promotion.saveFailed'),
          tone: 'bad',
          rows: [{ refusals: outcome.refusals ?? [] }],
        })
        return
      }
      setReport({ title: t('promotion.saved'), tone: 'ok', rows: warningRows(outcome) })
      await refresh()
    })

  const flipPromotion = async (act: 'activate' | 'deactivate') => {
    const body = act === 'activate' ? 'promotion.confirmActivateBody' : 'promotion.confirmDeactivateBody'
    if (!(await confirmAction(t(body, { number: fsi(promo.promoNumber) }), t('promotion.confirmFlipTitle'))))
      return
    await guarded(async () => {
      const outcome =
        act === 'activate'
          ? await bbyMaintainApi.activatePromotion(promo.promoNumber)
          : await bbyMaintainApi.deactivatePromotion(promo.promoNumber)
      const view = readPromotionFlip(promo.promoNumber, outcome)
      if (view.notFound) {
        setReport(notFoundReport())
        return
      }
      if (!view.changed) {
        // All-or-nothing: nothing changed, so nothing is refetched — every refused bonus
        // buy is listed with all of its refusals.
        setReport({
          title: t('promotion.flipRefused'),
          tone: 'bad',
          rows: view.refused.map((g) => ({ number: g.number, refusals: g.refusals })),
        })
        return
      }
      setReport({
        title: t(act === 'activate' ? 'promotion.activated' : 'promotion.deactivated'),
        tone: 'ok',
        rows: [],
      })
      await refresh()
    })
  }

  const deletePromotion = async () => {
    if (
      !(await confirmAction(
        t('promotion.confirmDeleteBody', { number: fsi(promo.promoNumber) }),
        t('promotion.confirmDeleteTitle'),
      ))
    )
      return
    await guarded(async () => {
      const outcome = await bbyMaintainApi.deletePromotion(promo.promoNumber)
      if (outcome.status === 'deleted') {
        await queryClient.invalidateQueries({ queryKey: promotionListKey })
        navigate(BBY_MAINTAIN_ROOT)
        return
      }
      if (outcome.status === 'notFound') {
        setReport(notFoundReport())
        return
      }
      setReport({
        title: t('promotion.deleteRefused'),
        tone: 'bad',
        rows: [{ refusals: outcome.refusals ?? [] }],
      })
    })
  }

  /** The multi-select loop: one number per call, every outcome shown, never stopping. */
  async function runSelected(act: EachAct, note = '') {
    const numbers = act === 'test' ? testable : [...selected]
    if (numbers.length === 0) return
    if (
      act === 'delete' &&
      !(await confirmAction(
        t('overview.confirmDeleteBody', { count: numbers.length }),
        t('overview.confirmDeleteTitle'),
      ))
    )
      return
    // Mark Tested: one shared note for every bonus buy sent, as the tester typed it once.
    const markTested = (bbyNumber: string) => bbyMaintainApi.markTested({ bbyNumber, note: note.trim() || null })
    const call = {
      activate: bbyMaintainApi.activate,
      deactivate: bbyMaintainApi.deactivate,
      delete: bbyMaintainApi.delete,
      test: markTested,
    }[act]
    setBusy(true)
    setReport(null)
    setProgress({ done: 0, total: numbers.length })
    const rows = await runEach(numbers, call, t('promotion.actFailed'), (_, done) =>
      setProgress({ done, total: numbers.length }),
    )
    setProgress(null)
    setBusy(false)
    const anyBad = rows.some((r) => r.kind !== 'done')
    setReport({
      title: t(`overview.report.${act}`),
      tone: anyBad ? 'bad' : 'ok',
      rows: rows.map<ReportRow>((r) => ({
        number: r.number,
        outcome: outcomeWord(r.kind),
        message: r.message,
        refusals: r.refusals,
      })),
    })
    await refresh()
  }

  /** Copy (SAP's "create with reference"): the server makes a Planned OMS copy, and the
   *  editor opens on it — the same place SAP lands the user. */
  const copy = (sourceNumber: string) =>
    guarded(async () => {
      const outcome = await bbyMaintainApi.copy(sourceNumber, promo.promoNumber)
      if (outcome.status === 'saved' && outcome.number) {
        await refresh()
        navigate(editorPath(promo.promoNumber, 'change', outcome.number))
        return
      }
      setReport({
        title: t('overview.report.copy'),
        tone: 'bad',
        rows: [
          {
            number: sourceNumber,
            outcome: outcomeWord(outcome.status === 'notFound' ? 'notFound' : 'refused'),
            refusals: outcome.refusals ?? [],
          },
        ],
      })
    })

  const columns = useMemo<ColDef<BbyOverviewRow>[]>(
    () => [
      { field: 'bbyNumber', headerName: t('overview.col.bbyNumber'), width: 160 },
      { field: 'description', headerName: t('overview.col.text'), flex: 1, minWidth: 220 },
      {
        field: 'validFrom',
        headerName: t('overview.col.validFrom'),
        width: 150,
        valueFormatter: (p) => formatDay(p.value),
        ...DAY_FILTER,
      },
      {
        field: 'validTo',
        headerName: t('overview.col.validTo'),
        width: 150,
        valueFormatter: (p) => formatDay(p.value),
        ...DAY_FILTER,
      },
      // Status is filtered by the chips above the grid, not by a column filter.
      { field: 'bbyStatus', headerName: t('overview.col.status'), width: 140, cellRenderer: StatusCell, filter: false },
      // The test mark (spec 2396 story 7); blank while untested. The base column def isolates each cell.
      { field: 'testedBy', headerName: t('overview.col.testedBy'), width: 130 },
      {
        field: 'testedAt',
        headerName: t('overview.col.testedAt'),
        width: 160,
        valueFormatter: (p) => formatDateTime(p.value),
        ...DAY_FILTER,
      },
      { field: 'testNote', headerName: t('overview.col.testNote'), flex: 1, minWidth: 160 },
    ],
    [t],
  )
  const defaultColDef = useMemo<ColDef<BbyOverviewRow>>(
    () => ({
      ...OMS_GRID_BASE_COL_DEF,
      sortable: true,
      resizable: true,
      filter: 'agTextColumnFilter',
      floatingFilter: showFilters,
      cellDataType: false,
    }),
    [showFilters],
  )

  const deletable = canDeletePromotion(promo)

  return (
    <>
      {/* ── the promotion header: its command bar on top, then its fields ── */}
      <div className="flex flex-col rounded-lg border border-border/60 bg-card">
        <div className={BAR}>
          <Button
            variant="primary"
            disabled={busy || !dirty || name.trim() === '' || !from || !to}
            onClick={saveHeader}
          >
            {t('promotion.save')}
          </Button>
          <span className={SEP} aria-hidden />
          <Button variant="secondary" disabled={busy} onClick={() => flipPromotion('activate')}>
            {t('promotion.activate')}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => flipPromotion('deactivate')}>
            {t('promotion.deactivate')}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setUploadOpen(true)}>
            {t('promotion.upload')}
          </Button>
          <Button
            variant="danger-outlined"
            className="ms-auto"
            disabled={busy || !deletable}
            title={deletable ? undefined : t('promotion.deleteOnlyEmpty')}
            onClick={deletePromotion}
          >
            {t('promotion.delete')}
          </Button>
        </div>

        <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <TextInput label={t('promotion.number')} value={promo.promoNumber} disabled className="w-32" />
          <TextInput label={t('promotion.name')} value={name} maxLength={PROMOTION_NAME_MAX} onChange={setName} />
          <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t('promotion.type')}
            <div className="flex h-8 items-center gap-2 text-sm text-foreground">
              <span className="rounded-md border border-border/60 px-2 py-1 font-mono">
                <Ltr>SACH</Ltr>
              </span>
              {t('promotion.typeName')}
            </div>
          </div>
        </div>

        <fieldset className="flex w-fit flex-col gap-2 rounded-md border border-border/60 p-3">
          <legend className="px-1 text-xs font-semibold">{t('promotion.periods')}</legend>
          <div className="flex flex-wrap gap-3">
            <DateInput label={t('promotion.onSaleFrom')} value={from} onChange={setFrom} />
            <DateInput label={t('promotion.to')} value={to} onChange={setTo} />
          </div>
          {/* Shown equal to the On-sale window and disabled: SAP's screen has them, the
              engine never reads them (story 4). */}
          <div className="flex flex-wrap gap-3">
            <DateInput label={t('promotion.purchaseFrom')} value={from} disabled />
            <DateInput label={t('promotion.to')} value={to} disabled />
          </div>
          <div className="flex flex-wrap gap-3">
            <DateInput label={t('promotion.listedFrom')} value={from} disabled />
            <DateInput label={t('promotion.to')} value={to} disabled />
          </div>
        </fieldset>
        </div>
      </div>

      {/* ── the one tab SAP's promotion screen keeps here ── */}
      <div className="flex flex-col">
        <div className="flex">
          <span className="rounded-t-md border border-b-0 border-border/60 bg-card px-3 py-1 text-sm font-semibold">
            {t('promotion.tab')}
          </span>
        </div>
        <div className="flex flex-col rounded-e-lg rounded-b-lg border border-border/60 bg-card">
          {/* SAP's buttons, in SAP's order, plus Copy and Copy from SAP… — above the list */}
          <div className={BAR}>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => navigate(editorPath(promo.promoNumber, 'create'))}
            >
              {t('overview.create')}
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !one}
              title={one ? undefined : t('overview.needOne')}
              onClick={() => one && navigate(editorPath(promo.promoNumber, 'change', one))}
            >
              {t('overview.change')}
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !one}
              title={one ? undefined : t('overview.needOne')}
              onClick={() => one && navigate(editorPath(promo.promoNumber, 'display', one))}
            >
              {t('overview.display')}
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !one}
              title={one ? undefined : t('overview.needOne')}
              onClick={() => one && copy(one)}
            >
              {t('overview.copy')}
            </Button>
            <span className={SEP} aria-hidden />
            <Button
              variant="secondary"
              disabled={busy || !activatable}
              title={
                selected.length === 0 ? t('overview.needSome') : activatable ? undefined : t('status.activateNeedsTest')
              }
              onClick={() => runSelected('activate')}
            >
              {t('overview.activate')}
            </Button>
            {canTest && (
              <Button
                variant="secondary"
                disabled={busy || testable.length === 0}
                title={
                  selected.length === 0
                    ? t('overview.needSome')
                    : testable.length
                      ? undefined
                      : t('overview.testNeedsPlanned')
                }
                onClick={() => setTestOpen(true)}
                data-testid="bby-overview-test"
              >
                {t('overview.test')}
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={busy || selected.length === 0}
              title={selected.length ? undefined : t('overview.needSome')}
              onClick={() => runSelected('deactivate')}
            >
              {t('overview.deactivate')}
            </Button>
            <Button
              variant="danger-outlined"
              disabled={busy || selected.length === 0}
              title={selected.length ? undefined : t('overview.needSome')}
              onClick={() => runSelected('delete')}
            >
              {t('overview.delete')}
            </Button>
            <span className={SEP} aria-hidden />
            <Button variant="secondary" disabled={busy} onClick={() => setCopySapOpen(true)}>
              {t('overview.copyFromSap')}
            </Button>
            <span className="ms-auto flex items-center gap-3">
              {selected.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {t('overview.selected', { count: selected.length })}
                </span>
              )}
              {progress && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  <Ltr>{formatCount(progress.done, progress.total)}</Ltr>
                </span>
              )}
            </span>
          </div>

          <div className="flex flex-col gap-2 p-3">
            <div className="text-sm font-semibold">{t('overview.title')}</div>
            {promo.bonusBuys.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('overview.empty')}</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2" data-testid="bby-overview-filters">
                  <label className="relative w-72 max-w-full">
                    <span className="sr-only">{t('overview.filter.searchLabel')}</span>
                    <Search
                      className="pointer-events-none absolute start-2.5 top-2 h-4 w-4 text-muted-foreground"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t('overview.filter.search')}
                      className="h-8 w-full rounded-full border border-border bg-background ps-8 pe-3 text-sm text-foreground focus:border-primary/50 focus:outline-none"
                      data-testid="bby-overview-search"
                    />
                  </label>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('overview.filter.statusGroup')}>
                    {overviewChips(counts).map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={chip === c}
                        onClick={() => setChip(c)}
                        className={`${CHIP} ${chip === c ? CHIP_ON : CHIP_IDLE}`}
                        data-testid={`bby-overview-chip-${c}`}
                      >
                        {t(c === 'all' ? 'overview.filter.all' : `overview.status.${c}`)}
                        <span className="font-mono text-[11px] opacity-75">
                          <Ltr>{c === 'all' ? promo.bonusBuys.length : counts[c]}</Ltr>
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-pressed={showFilters}
                    onClick={toggleColumnFilters}
                    className={`${CHIP} ${showFilters ? CHIP_ON : CHIP_IDLE}`}
                    data-testid="bby-overview-column-filters"
                  >
                    <Filter className="h-3.5 w-3.5" aria-hidden />
                    {t('overview.filter.columns')}
                  </button>
                  {filtered && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="px-1 text-xs text-primary hover:underline"
                      data-testid="bby-overview-clear"
                    >
                      {t('overview.filter.clear')}
                    </button>
                  )}
                </div>

                <div className="h-[28rem]">
                  <AgGridReact<BbyOverviewRow>
                    theme={omsGridTheme}
                    rowData={rowData}
                    columnDefs={columns}
                    defaultColDef={defaultColDef}
                    rowHeight={OMS_GRID_ROW_HEIGHT}
                    headerHeight={OMS_GRID_HEADER_HEIGHT}
                    animateRows={false}
                    rowSelection={OVERVIEW_SELECTION}
                    getRowId={(p) => p.data.bbyNumber}
                    noRowsOverlayComponent={NoMatch}
                    onGridReady={(e) => (gridApi.current = e.api)}
                    onGridPreDestroyed={() => (gridApi.current = null)}
                    onFilterChanged={onFilterChanged}
                    onModelUpdated={({ api }) => setShown(api.getDisplayedRowCount())}
                    onSelectionChanged={(e) =>
                      setSelected(e.api.getSelectedRows().map((r) => r.bbyNumber))
                    }
                    onRowDoubleClicked={(e) =>
                      e.data && navigate(editorPath(promo.promoNumber, 'change', e.data.bbyNumber))
                    }
                  />
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="bby-overview-shown">
                  {t('overview.filter.shown')}
                  <span className="font-mono text-foreground">
                    <Ltr>{formatCount(shown, promo.bonusBuys.length)}</Ltr>
                  </span>
                </div>
              </>
            )}

            {report && <ActReport report={report} />}
          </div>
        </div>
      </div>

      <CopyFromSapDialog
        open={copySapOpen}
        onClose={() => setCopySapOpen(false)}
        onCopy={(n) => {
          setCopySapOpen(false)
          void copy(n)
        }}
      />

      <MarkSelectedTestedDialog
        open={testOpen}
        count={testable.length}
        skipped={selected.length - testable.length}
        onClose={() => setTestOpen(false)}
        onRun={(note) => {
          setTestOpen(false)
          void runSelected('test', note)
        }}
      />

      <UploadDialog
        open={uploadOpen}
        promoNumber={promo.promoNumber}
        onClose={() => setUploadOpen(false)}
        onLoaded={(loaded) => {
          void refresh()
          // The file's AKTNR may name another promotion: its overview is stale too.
          if (loaded !== promo.promoNumber)
            void queryClient.invalidateQueries({ queryKey: promotionKey(loaded) })
        }}
      />
    </>
  )
}

/** A saved outcome's warnings (dates outside the window, SAP allows it) as one report row. */
function warningRows(outcome: BbyMaintainOutcome): ReportRow[] {
  return outcome.warnings?.length ? [{ refusals: outcome.warnings }] : []
}

/** Mark Tested on the overview's selection: one optional note for every Planned bonus buy sent. */
function MarkSelectedTestedDialog({
  open,
  count,
  skipped,
  onClose,
  onRun,
}: {
  open: boolean
  count: number
  skipped: number
  onClose: () => void
  onRun: (note: string) => void
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const [note, setNote] = useState('')
  const close = () => {
    setNote('')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={close}
      title={t('test.title')}
      width="28rem"
      footer={
        <>
          <Button variant="text" onClick={close}>
            {t('test.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const typed = note
              setNote('')
              onRun(typed)
            }}
          >
            {t('test.run')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm">{t('overview.testBody', { count })}</p>
        {skipped > 0 && <p className="text-xs text-muted-foreground">{t('overview.testSkipped', { count: skipped })}</p>}
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('test.note')}
          <textarea
            value={note}
            maxLength={TEST_NOTE_MAX}
            rows={3}
            placeholder={t('test.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            data-testid="bby-overview-test-note"
            autoFocus
          />
        </label>
      </div>
    </Modal>
  )
}

function CopyFromSapDialog({
  open,
  onClose,
  onCopy,
}: {
  open: boolean
  onClose: () => void
  onCopy: (sourceNumber: string) => void
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const [number, setNumber] = useState('')
  const trimmed = number.trim()
  const close = () => {
    setNumber('')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={close}
      title={t('copySap.title')}
      width="26rem"
      footer={
        <>
          <Button variant="text" onClick={close}>
            {t('copySap.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={trimmed === ''}
            onClick={() => {
              setNumber('')
              onCopy(trimmed)
            }}
          >
            {t('copySap.run')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextInput label={t('copySap.label')} value={number} onChange={setNumber} className="w-48" autoFocus />
        <p className="text-xs text-muted-foreground">{t('copySap.hint')}</p>
      </div>
    </Modal>
  )
}
