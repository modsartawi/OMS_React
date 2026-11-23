import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, ICellRendererParams, IRowNode, MultiRowSelectionOptions, RowClassRules } from 'ag-grid-community'
import { Loader2, Lock } from 'lucide-react'

import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import BbyStatusBadge from '@/core/bonus-buy/BbyStatusBadge'
import { readSalesArea } from '@/core/bonus-buy/sales-area'
import type { BbyBulkListRow, BbyBulkTarget } from '@/core/models/bonus-buy-bulk'
import { confirmAction } from '@/core/services/confirm'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { formatPair, fsi } from '@/core/util/bidi'
import { bbyBulkChangeApi, bulkListKey, bulkPromotionsKey, canOpenBbyBulkChange } from './api'
import { EMPTY_FORM, hasOperations, toOperations, type BulkForm } from './operations'
import PresetChips from './PresetChips'
import ResultPanel from './ResultPanel'
import RulesForm from './RulesForm'
import { readBulkResult, type BulkResultReading } from './result'
import { BULK_CAP, batchProblem, lockReason, selectAllPlanned } from './selection'

/**
 * Bonus Buy Bulk Change (BackOffice spec 4190, design F; oms 958): promotion filter → the list with
 * checkboxes (locked rows greyed, with the reason) → the engine-rules form → Preview (the server's dry
 * run) → Apply → per-row results with the batch id, then the list refreshes.
 *
 * Gated by the maintenance grant (`BbyMaintain:03`). There is no bulk Activate anywhere.
 * Presets (oms 960) and bulk Mark Tested (oms 959) slot in beside the form and the result.
 */
export default function BonusBuyBulkChangePage() {
  const { t } = useTranslation('bonus-buy-bulk-change')
  return (
    <ScreenGate can={canOpenBbyBulkChange} ns="bonus-buy-bulk-change" title={t('title')} subtitle={t('subtitle')}>
      <BulkChange />
    </ScreenGate>
  )
}

/** Only Planned OMS rows take a checkbox; the select-all header is off — the page's own Select all says what it skipped. */
const SELECTION: MultiRowSelectionOptions<BbyBulkListRow> = {
  mode: 'multiRow',
  checkboxes: true,
  headerCheckbox: false,
  enableClickSelection: true,
  isRowSelectable: (n) => !!n.data && lockReason(n.data) === null,
}

/** A locked row is drawn greyed. */
const ROW_CLASS: RowClassRules<BbyBulkListRow> = { 'opacity-60': (p) => !!p.data && lockReason(p.data) !== null }

const BAR = 'flex flex-wrap items-center gap-2 border-b border-border-strong bg-card-2 px-3 py-2'

function BulkChange() {
  const { t } = useTranslation('bonus-buy-bulk-change')
  const queryClient = useQueryClient()
  const gridApi = useRef<GridApi<BbyBulkListRow> | null>(null)

  const [promoNumber, setPromoNumber] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [selectNote, setSelectNote] = useState<{ selected: number; skipped: number } | null>(null)
  const [form, setForm] = useState<BulkForm>(EMPTY_FORM)
  const [result, setResult] = useState<{ reading: BulkResultReading; key: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const promotions = useQuery({ queryKey: bulkPromotionsKey, queryFn: () => bbyBulkChangeApi.promotions() })
  const list = useQuery({ queryKey: bulkListKey(promoNumber), queryFn: () => bbyBulkChangeApi.list(promoNumber) })
  const rows = useMemo(() => list.data ?? [], [list.data])

  const selectedRows = useMemo(() => {
    const picked = new Set(selected)
    return rows.filter((r) => picked.has(r.bbyNumber))
  }, [rows, selected])
  const targets: BbyBulkTarget[] = selectedRows.map((r) => ({ bbyNumber: r.bbyNumber, version: r.version }))
  const { operations, problems } = toOperations(form)
  const batch = batchProblem(selectedRows)
  const requestKey = JSON.stringify({ targets, operations })
  const currency = selectedRows.length > 0 && batch !== 'mixedSalesArea' ? readSalesArea(selectedRows[0]).currency : ''

  const blocked = batch !== null || problems.length > 0 || !hasOperations(operations)
  const previewReason = batch
    ? t(`batch.${batch}`, { cap: fsi(String(BULK_CAP)) })
    : problems.length > 0
      ? t('form.fixProblems')
      : !hasOperations(operations)
        ? t('form.nothing')
        : undefined
  const previewFresh = result?.reading.dryRun === true && result.key === requestKey
  const canApply = !blocked && previewFresh && result.reading.counts.save > 0

  const run = async (dryRun: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const answer = await bbyBulkChangeApi.change({ bonusBuys: targets, operations, dryRun })
      setResult({ reading: readBulkResult(answer), key: requestKey })
      if (!dryRun) {
        gridApi.current?.deselectAll()
        setSelected([])
        setSelectNote(null)
        await queryClient.invalidateQueries({ queryKey: ['bonus-buy-bulk-change', 'list'] })
      }
    } catch (err) {
      setError(apiErrorMessage(err, t('error.change')))
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    if (!result) return
    const ok = await confirmAction(
      t('apply.confirmBody', { count: result.reading.counts.save, n: fsi(String(result.reading.counts.save)) }),
      t('apply.confirmTitle'),
    )
    if (ok) await run(false)
  }

  const selectAll = () => {
    const grid = gridApi.current
    if (!grid) return
    const shown: BbyBulkListRow[] = []
    grid.forEachNodeAfterFilter((n) => n.data && shown.push(n.data))
    const pick = selectAllPlanned(shown)
    const wanted = new Set(pick.selected)
    const nodes: IRowNode<BbyBulkListRow>[] = []
    grid.forEachNode((n) => n.data && wanted.has(n.data.bbyNumber) && nodes.push(n))
    grid.setNodesSelected({ nodes, newValue: true })
    setSelectNote({ selected: pick.selected.length, skipped: pick.skipped })
  }

  const clearSelection = () => {
    gridApi.current?.deselectAll()
    setSelectNote(null)
  }

  const columns = useMemo<ColDef<BbyBulkListRow>[]>(
    () => [
      { field: 'bbyNumber', headerName: t('col.number'), width: 150, cellClass: 'font-mono' },
      { field: 'description', headerName: t('col.description'), flex: 1, minWidth: 180 },
      { field: 'promoNumber', headerName: t('col.promotion'), width: 130, cellClass: 'font-mono' },
      {
        field: 'bbyStatus',
        headerName: t('col.status'),
        width: 130,
        cellRenderer: (p: ICellRendererParams<BbyBulkListRow>) => <BbyStatusBadge code={p.data?.bbyStatus} />,
      },
      {
        colId: 'lock',
        headerName: t('col.lock'),
        width: 280,
        valueGetter: (p) => {
          const reason = p.data ? lockReason(p.data) : null
          return reason ? t(`lock.${reason}`) : ''
        },
        cellRenderer: (p: ICellRendererParams<BbyBulkListRow, string>) =>
          p.value ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Lock className="size-3.5 shrink-0" aria-hidden />
              {p.value}
            </span>
          ) : null,
      },
      { colId: 'score', headerName: t('field.score'), width: 90, valueGetter: (p) => p.data?.engineRules?.score },
      {
        colId: 'isStackable',
        headerName: t('field.isStackable'),
        width: 110,
        valueGetter: (p) => (p.data?.engineRules ? t(p.data.engineRules.isStackable ? 'value.yes' : 'value.no') : ''),
      },
      { colId: 'maxValue', headerName: t('field.maxValue'), width: 110, valueGetter: (p) => p.data?.engineRules?.maxValue },
      { colId: 'originFilter', headerName: t('field.originFilter'), width: 140, valueGetter: (p) => p.data?.engineRules?.originFilter },
      { colId: 'excludes', headerName: t('field.excludes'), width: 180, valueGetter: (p) => p.data?.engineRules?.excludes },
    ],
    [t],
  )
  const defaultColDef = useMemo<ColDef<BbyBulkListRow>>(
    () => ({ ...OMS_GRID_BASE_COL_DEF, sortable: true, resizable: true, filter: 'agTextColumnFilter', cellDataType: false }),
    [],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* ── 1. the promotion filter and the list ── */}
      <div className="flex flex-col rounded-lg border border-border/60 bg-card">
        <div className={BAR}>
          <Field label={t('filter.promotion')} className="w-72">
            <Select
              value={promoNumber}
              data-testid="bulk-promotion"
              onChange={(e) => {
                setPromoNumber(e.target.value)
                setSelectNote(null)
              }}
            >
              <option value="">{t('filter.allPromotions')}</option>
              {(promotions.data ?? []).map((p) => (
                <option key={p.promoNumber} value={p.promoNumber}>
                  {fsi(formatPair(p.promoNumber, p.name))}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap items-center gap-2 self-end">
            <Button variant="secondary" disabled={rows.length === 0 || busy} onClick={selectAll} data-testid="bulk-select-all">
              {t('select.all')}
            </Button>
            <Button variant="text" disabled={selected.length === 0 || busy} onClick={clearSelection}>
              {t('select.clear')}
            </Button>
            <span className="text-xs text-muted-foreground" data-testid="bulk-selected">
              {t('select.count', { count: selected.length, n: fsi(String(selected.length)) })}
            </span>
            {selectNote && selectNote.skipped > 0 && (
              <span className="text-xs text-muted-foreground" data-testid="bulk-select-note">
                {t('select.skipped', { count: selectNote.skipped, n: fsi(String(selectNote.skipped)) })}
              </span>
            )}
          </div>
        </div>

        {list.isError ? (
          <ErrorBanner className="m-3" message={apiErrorMessage(list.error, t('error.list'))} />
        ) : list.isPending ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('list.loading')}
          </div>
        ) : (
          <div className="h-[24rem]">
            <AgGridReact<BbyBulkListRow>
              theme={omsGridTheme}
              rowData={rows}
              columnDefs={columns}
              defaultColDef={defaultColDef}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
              rowSelection={SELECTION}
              rowClassRules={ROW_CLASS}
              getRowId={(p) => p.data.bbyNumber}
              onGridReady={(e) => (gridApi.current = e.api)}
              onGridPreDestroyed={() => (gridApi.current = null)}
              onSelectionChanged={(e) => setSelected(e.api.getSelectedRows().map((r) => r.bbyNumber))}
            />
          </div>
        )}
      </div>

      {/* ── 2. the engine-rules form, Preview and Apply ── */}
      <div className="flex flex-col rounded-lg border border-border/60 bg-card">
        <div className={BAR}>
          <span className="font-medium">{t('form.title')}</span>
          <span className="flex-1" />
          <Button
            variant="secondary"
            aria-disabled={blocked || busy}
            title={previewReason}
            data-testid="bulk-preview"
            onClick={() => !blocked && !busy && run(true)}
          >
            {t('preview.button')}
          </Button>
          <Button
            variant="primary"
            aria-disabled={!canApply || busy}
            title={canApply ? undefined : t('apply.needsPreview')}
            data-testid="bulk-apply"
            onClick={() => canApply && !busy && apply()}
          >
            {t('apply.button')}
          </Button>
        </div>
        <div className="flex flex-col gap-3 p-3">
          <PresetChips form={form} onPick={setForm} disabled={busy} />
          <RulesForm form={form} onChange={setForm} problems={problems} currency={currency} disabled={busy} />
        </div>
        {previewReason && selected.length > 0 && (
          <p className="px-3 pb-3 text-xs text-muted-foreground" data-testid="bulk-blocked">
            {previewReason}
          </p>
        )}
      </div>

      {error && <ErrorBanner message={error} />}
      {result && (
        <>
          {result.reading.dryRun && !previewFresh && (
            <p className="text-xs text-muted-foreground">{t('preview.stale')}</p>
          )}
          <ResultPanel reading={result.reading} />
        </>
      )}
    </div>
  )
}
