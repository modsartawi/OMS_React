import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { ChevronLeft, ChevronRight, RotateCcw, Search, Upload } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage } from '@/core/api'
import { hungerStationAccessQuery } from '@/core/hungerstation/api'
import { canManageCatalog } from '@/core/hungerstation/access'
import type {
  HungerStationMaterialImportResult,
  HungerStationMaterialRow,
  HungerStationMaterialState,
  HungerStationMaterialsQuery,
} from '@/core/models/hungerstation'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatRange } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { MATERIALS_KEY, materialsApi } from './api'
import { materialColumns } from './columns'
import { ChangeDialog, ImportDialog, ImportResultDialog } from './MaterialDialogs'
import { MATERIAL_STATES, materialsFromParams, materialsPage, materialsToParams } from './materials-query'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'

/**
 * HungerStation materials (ticket 555, BackOffice spec 3028): the list of materials offered to
 * HungerStation — the WPF material inquiry and import on the web. Server-paged, filtered by state
 * (active by default) and text, both in the URL. Change one material's disabled / deleted flags, or
 * import the WPF sheet, each with a reason.
 *
 * Behind `canManageCatalog` on the ONE HungerStation probe, the same predicate the menu leaf reads.
 * Its doors are BackOffice 3035.
 */
export default function MaterialsPage() {
  const { t } = useTranslation('hungerstation-materials')
  return (
    <ScreenGate query={hungerStationAccessQuery()} can={canManageCatalog} ns="hungerstation-materials" title={t('title')} subtitle={t('subtitle')}>
      <Materials />
    </ScreenGate>
  )
}

type Row = HungerStationMaterialRow

const DEFAULT_COL_DEF: ColDef<Row> = {
  ...OMS_GRID_BASE_COL_DEF,
  // One server page at a time: a client sort or filter would only reorder this page, so neither is offered.
  sortable: false,
  resizable: true,
  suppressHeaderMenuButton: true,
}

const STATE_KEY: Record<HungerStationMaterialState, string> = {
  active: 'filters.stateActive',
  disabled: 'filters.stateDisabled',
  deleted: 'filters.stateDeleted',
  any: 'filters.stateAny',
}

type Dialog = { kind: 'import' } | { kind: 'result'; result: HungerStationMaterialImportResult } | { kind: 'change'; row: Row } | null

function Materials() {
  const { t } = useTranslation('hungerstation-materials')
  const [params, setParams] = useSearchParams()
  // 🔑 The URL is the query: read from it every render, every change written back (replace, so
  // Back leaves the screen rather than stepping through each filter tweak).
  const query = useMemo(() => materialsFromParams(params), [params])
  const [draft, setDraft] = useState(query.q ?? '')
  useEffect(() => setDraft(query.q ?? ''), [query.q])
  // A filter change takes the text box as it reads, and starts again at the first page.
  const update = (change: Partial<HungerStationMaterialsQuery>) =>
    setParams(materialsToParams({ ...query, q: draft.trim() || null, skip: 0, ...change }), { replace: true })

  const materials = useQuery({
    queryKey: [...MATERIALS_KEY, materialsToParams(query).toString()],
    queryFn: () => materialsApi.list(query),
    placeholderData: keepPreviousData,
    retry: false,
  })
  // Rows only from an answer to THIS query: never after a failed read, nor while the previous page
  // stands in for the next one (its rows would not match `skip`).
  const current = !materials.isError && !materials.isPlaceholderData
  const rows = useMemo(() => (current ? (materials.data?.rows ?? []) : []), [materials.data, current])
  const page = materialsPage(query, current ? (materials.data?.total ?? 0) : 0, rows.length)
  const loading = materials.isFetching && (!materials.data || materials.isPlaceholderData)

  const [dialog, setDialog] = useState<Dialog>(null)
  const columns = useMemo(() => materialColumns(t, { onChange: (row) => setDialog({ kind: 'change', row }) }), [t])

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          if ((draft.trim() || null) === query.q && query.skip === 0) void materials.refetch()
          else update({})
        }}
        data-materials-filters=""
      >
        <Field label={t('filters.state')}>
          <Select
            value={query.state}
            onChange={(e) => update({ state: e.target.value as HungerStationMaterialState })}
            data-filter-state=""
          >
            {MATERIAL_STATES.map((s) => (
              <option key={s} value={s}>
                {t(STATE_KEY[s])}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('filters.q')} className="min-w-[16rem] flex-1">
          <Input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('filters.qPlaceholder')}
            data-filter-q=""
          />
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
        <Button className="ms-auto h-9" onClick={() => setDialog({ kind: 'import' })} data-materials-import="">
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {t('import.button')}
        </Button>
      </form>

      {materials.isError && (
        <ErrorBanner className="p-2.5" title={t('results.failedTitle')} message={apiErrorMessage(materials.error, t('results.failed'))} />
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="relative h-[calc(100vh-20rem)] min-h-96" data-materials-grid="">
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
            // Nine columns: render every one, so a cell off to the side is in the DOM for
            // find-in-page and for the drive.
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
            ) : rows.length > 0 && page.total > rows.length ? (
              <span data-status-count="">
                <Trans
                  t={t}
                  i18nKey="results.page"
                  values={{ range: formatRange(figure(page.first), figure(page.last)), total: figure(page.total) }}
                  components={{ range: <Ltr />, total: <Ltr /> }}
                />
              </span>
            ) : (
              <span data-status-count="">
                <Trans t={t} i18nKey="results.count" count={rows.length} values={{ n: figure(rows.length) }} components={{ n: <Ltr /> }} />
              </span>
            )}
            {(page.previous !== null || page.next !== null) && (
              <span className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  disabled={page.previous === null || materials.isFetching}
                  onClick={() => page.previous !== null && update({ q: query.q, skip: page.previous })}
                  data-materials-previous=""
                >
                  {/* The arrow points back along the reading direction. */}
                  <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
                  {t('results.previous')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={page.next === null || materials.isFetching}
                  onClick={() => page.next !== null && update({ q: query.q, skip: page.next })}
                  data-materials-next=""
                >
                  {t('results.next')}
                  <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
                </Button>
              </span>
            )}
          </div>
        )}
      </div>

      {dialog?.kind === 'import' && <ImportDialog onClose={() => setDialog(null)} onDone={(result) => setDialog({ kind: 'result', result })} />}
      {dialog?.kind === 'result' && <ImportResultDialog result={dialog.result} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'change' && <ChangeDialog row={dialog.row} onClose={() => setDialog(null)} />}
    </div>
  )
}

/** An empty answer — nothing matches, not a failure. */
function NoRows() {
  const { t } = useTranslation('hungerstation-materials')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
