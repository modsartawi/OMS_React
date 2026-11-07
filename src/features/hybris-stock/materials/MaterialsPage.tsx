import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { Download, Loader2, Plus, RotateCcw, Search, Upload } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage } from '@/core/api'
import { canManageHybrisStock, canViewHybrisStock } from '@/core/hybris-stock/access'
import { hybrisStockAccessQuery } from '@/core/hybris-stock/api'
import ModeBanner from '@/core/hybris-stock/ModeBanner'
import type { HybrisStockEnabledFilter, HybrisStockMaterialRow, HybrisStockMaterialsQuery } from '@/core/models/hybris-stock'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import GridPager from '@/core/ui/GridPager'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { saveBlob } from '@/core/util/download-file'
import { formatFigure as figure } from '@/core/util/number-format'
import { MATERIALS_KEY, materialsApi } from './api'
import { materialColumns } from './columns'
import { AddDialog, EnabledDialog, UploadDialog } from './MaterialDialogs'
import { ENABLED_FILTERS, MATERIALS_PAGE_SIZE, materialsFromParams, materialsToParams } from './materials-query'

/**
 * Hybris stock materials (ticket 848, BackOffice spec 3447): the list of materials whose stock OMS
 * sends to Hybris — search by number or name, filter by enabled, a page of 50; add, enable and
 * disable one with a reason; upload a CSV/XLSX with a preview, then commit under a reason (an upload
 * never deletes, and the page says so); download the current list to edit and upload back.
 *
 * Behind `canViewHybrisStock`; every write behind `canManageHybrisStock` on the same probe. Its doors
 * are BackOffice 3454.
 */
export default function MaterialsPage() {
  const { t } = useTranslation('hybris-stock-materials')
  return (
    <ScreenGate query={hybrisStockAccessQuery()} can={canViewHybrisStock} ns="hybris-stock-materials" title={t('title')} subtitle={t('subtitle')}>
      <Materials />
    </ScreenGate>
  )
}

type Row = HybrisStockMaterialRow

const DEFAULT_COL_DEF: ColDef<Row> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}

const ENABLED_KEY: Record<HybrisStockEnabledFilter, string> = { any: 'filters.enabledAny', enabled: 'filters.enabledOnly', disabled: 'filters.disabledOnly' }

type Dialog = { kind: 'add' } | { kind: 'upload' } | { kind: 'toggle'; row: Row } | null

function Materials() {
  const { t } = useTranslation('hybris-stock-materials')
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => materialsFromParams(params), [params])
  const [draft, setDraft] = useState(query.q ?? '')
  useEffect(() => setDraft(query.q ?? ''), [query.q])
  // A filter change takes the text box as it reads, and starts again on the first page.
  const update = (change: Partial<HybrisStockMaterialsQuery>) => setParams(materialsToParams({ ...query, q: draft.trim() || null, page: 1, ...change }), { replace: true })

  const access = useQuery(hybrisStockAccessQuery())
  const canManage = canManageHybrisStock(access.data)

  const materials = useQuery({
    queryKey: [...MATERIALS_KEY, materialsToParams(query).toString()],
    queryFn: () => materialsApi.list(query),
    placeholderData: keepPreviousData,
    retry: false,
  })
  const current = !materials.isError && !materials.isPlaceholderData
  const rows = useMemo(() => (current ? (materials.data?.rows ?? []) : []), [materials.data, current])
  const total = current ? (materials.data?.total ?? 0) : 0
  const loading = materials.isFetching && (!materials.data || materials.isPlaceholderData)
  // The pager keeps the last known total while the next page loads, so it never unmounts under the click.
  const pagerTotal = materials.isError ? 0 : (materials.data?.total ?? 0)

  const download = useMutation({
    mutationFn: () => materialsApi.download(),
    onSuccess: (file) => saveBlob(file.filename ?? 'hybris-stock-materials.csv', file.blob),
  })

  const [dialog, setDialog] = useState<Dialog>(null)
  const columns = useMemo(() => materialColumns(t, canManage ? (row) => setDialog({ kind: 'toggle', row }) : null), [t, canManage])

  return (
    <div className="flex flex-col gap-3">
      <ModeBanner />

      <form
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          if ((draft.trim() || null) === query.q && query.page === 1) void materials.refetch()
          else update({})
        }}
        data-materials-filters=""
      >
        <Field label={t('filters.enabled')}>
          <Select value={query.enabled} onChange={(e) => update({ enabled: e.target.value as HybrisStockEnabledFilter })} data-filter-enabled="">
            {ENABLED_FILTERS.map((s) => (
              <option key={s} value={s}>
                {t(ENABLED_KEY[s])}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('filters.q')} className="min-w-[16rem] flex-1">
          <Input type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('filters.qPlaceholder')} data-filter-q="" />
        </Field>
        <Button type="submit" disabled={materials.isFetching} data-materials-search="">
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('filters.search')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setDraft('')
            setParams(new URLSearchParams(), { replace: true })
          }}
          data-materials-clear=""
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('filters.clear')}
        </Button>
        <span className="ms-auto flex flex-wrap items-end gap-2">
          <Button variant="secondary" onClick={() => download.mutate()} disabled={download.isPending} data-materials-download="">
            {download.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
            {t('download.button')}
          </Button>
          {canManage && (
            <>
              <Button variant="secondary" onClick={() => setDialog({ kind: 'add' })} data-materials-add="">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {t('add.button')}
              </Button>
              <Button onClick={() => setDialog({ kind: 'upload' })} data-materials-upload="">
                <Upload className="h-3.5 w-3.5" aria-hidden />
                {t('upload.button')}
              </Button>
            </>
          )}
        </span>
      </form>

      <p className="text-xs text-muted-foreground" data-materials-never-deletes="">
        {t('neverDeletes')}
      </p>

      {download.isError && <ErrorBanner className="p-2.5" title={t('download.failed')} message={apiErrorMessage(download.error, t('results.failed'))} />}
      {materials.isError && <ErrorBanner className="p-2.5" title={t('results.failedTitle')} message={apiErrorMessage(materials.error, t('results.failed'))} />}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="relative h-[calc(100vh-26rem)] min-h-96" data-materials-grid="">
          <AgGridReact<Row>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.materialNumber}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            tooltipShowDelay={500}
            animateRows={false}
            suppressColumnVirtualisation
            loading={loading}
            noRowsOverlayComponent={NoRows}
            suppressNoRowsOverlay={materials.isError}
          />
        </div>
        {!materials.isError && (
          <div
            className="flex h-8 shrink-0 items-center gap-3 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
            data-status-bar=""
          >
            {loading ? (
              <span>{t('results.loading')}</span>
            ) : (
              <span data-status-count="">
                <Trans t={t} i18nKey="results.count" count={total} values={{ n: figure(total) }} components={{ n: <Ltr /> }} />
              </span>
            )}
            {!canManage && access.isSuccess && (
              <span data-view-only="">{t('results.viewOnly')}</span>
            )}
            {pagerTotal > MATERIALS_PAGE_SIZE && (
              <span className="ms-auto" data-materials-pager="">
                <GridPager page={query.page} pageSize={MATERIALS_PAGE_SIZE} totalMatches={pagerTotal} busy={materials.isFetching} onPage={(page) => update({ q: query.q, page })} />
              </span>
            )}
          </div>
        )}
      </div>

      {dialog?.kind === 'add' && <AddDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'upload' && <UploadDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'toggle' && <EnabledDialog row={dialog.row} onClose={() => setDialog(null)} />}
    </div>
  )
}

function NoRows() {
  const { t } = useTranslation('hybris-stock-materials')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
