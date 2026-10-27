import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { ArrowLeft, FileSpreadsheet, Info, Loader2, PackageX, ShieldOff, Tag } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import ScreenGate from '@/core/ui/ScreenGate'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { buttonClass } from '@/core/ui/control-classes'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { materialAccessQuery } from '@/core/materials/api'
import { canSearchMaterials } from '@/core/materials/access'
import { isStockUnavailable, materialStockQuery } from '@/core/materials/stock'
import StockUnavailable from '@/core/materials/StockUnavailable'
import { MATERIAL_ERRORS, type MaterialAccessResult, type MaterialDetail as Detail, type MaterialMaster } from '@/core/models/materials'
import { materialDetailQuery } from './api'
import { EXPORT_AS_TEXT, barcodeColumns, batchColumns, detailStockColumns } from './columns'
import {
  detailStockRequest,
  detailStockRows,
  detailTabs,
  resolveDetailTab,
  simulatorHref,
  stockTabVisible,
  type DetailTab,
} from './detail-view'
import { masterSections, type MasterRow } from './master-groups'

/**
 * Material detail (ticket 452, BackOffice spec 2544 stories 17–23): one material's master record —
 * Item and ItemInfo read together — its barcodes, its batches (serialised materials only) and its
 * live stock at every store, each on a tab, with a link to the pricing simulator prefilled with it.
 *
 * Behind `canSearchMaterials` on the ONE Materials probe, the same predicate the search reads. The
 * Stock tab needs `canCheckStock` too, and without it asks nothing. Its doors
 * (`MaterialWeb/Material/{no}`, `MaterialWeb/Stock`) are BackOffice 2547/2548.
 */
export default function MaterialDetailPage() {
  const { t } = useTranslation('materials-detail')
  return (
    <ScreenGate query={materialAccessQuery()} can={canSearchMaterials} ns="materials-detail" title={t('title')} subtitle={t('subtitle')}>
      <MaterialDetail />
    </ScreenGate>
  )
}

const PANEL = 'rounded-lg border border-border/60 bg-card'
const LINK = 'inline-flex items-center gap-1.5 text-xs font-medium text-primary-800 underline-offset-2 hover:underline'

/** The number a sentence names, grouped as figures are drawn across the app. */
const figure = (n: number) => n.toLocaleString('en-US')

function MaterialDetail() {
  const { t } = useTranslation('materials-detail')
  const { no = '' } = useParams()
  const detail = useQuery(materialDetailQuery(no))
  // The probe the gate already read — cached, so this is no second call. The Stock tab reads it.
  const access = useQuery(materialAccessQuery())
  const notFound = detail.isError && apiErrorCode(detail.error) === MATERIAL_ERRORS.notFound

  return (
    <div className="flex flex-col gap-3" data-material-detail={no}>
      <Link to="/materials" className={LINK} data-material-back="">
        <ArrowLeft className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
        {t('back')}
      </Link>
      {detail.isPending ? (
        <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('loading')}
        </div>
      ) : notFound ? (
        <NotFound materialNumber={no} />
      ) : detail.isError || !detail.data ? (
        <ErrorBanner className="p-2.5" title={t('failedTitle')} message={apiErrorMessage(detail.error, t('failed'))} />
      ) : (
        <>
          <Header master={detail.data.master} />
          <Tabs detail={detail.data} access={access.data} />
        </>
      )}
    </div>
  )
}

/** `MAT-00001`: no such material — said plainly, with the way back to the search. */
function NotFound({ materialNumber }: { materialNumber: string }) {
  const { t } = useTranslation('materials-detail')
  return (
    <div className={`${PANEL} mx-auto mt-8 max-w-md p-6 text-center`} role="alert" data-material-not-found="">
      <PackageX className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="text-base font-semibold tracking-tight">{t('notFound.title')}</div>
      <p className="mt-2 text-sm text-muted-foreground">
        <Trans t={t} i18nKey="notFound.body" values={{ no: materialNumber }} components={{ n: <Ltr /> }} />
      </p>
      <Link to="/materials" className={`${LINK} mt-4`} data-material-not-found-back="">
        {t('notFound.back')}
      </Link>
    </div>
  )
}

/** The number, both descriptions, the badges, and the simulator link. */
function Header({ master }: { master: MaterialMaster }) {
  const { t } = useTranslation('materials-detail')
  return (
    <div className={`${PANEL} flex flex-wrap items-start justify-between gap-3 p-4`} data-material-header="">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-lg font-semibold tracking-tight" data-material-number="">
            <Ltr>{master.materialNumber}</Ltr>
          </span>
          <div className="flex flex-wrap items-center gap-1.5" data-material-badges="">
            {master.status && (
              <span data-material-badge="status">
                <StatusBadge sev="mute">
                  <Trans t={t} i18nKey="badges.status" values={{ status: master.status }} components={{ v: <Ltr /> }} />
                </StatusBadge>
              </span>
            )}
            {master.blocked && (
              <span data-material-badge="blocked">
                <StatusBadge sev="bad">{t('badges.blocked')}</StatusBadge>
              </span>
            )}
            {master.serialised && (
              <span data-material-badge="serialised">
                <StatusBadge sev="go">{t('badges.serialised')}</StatusBadge>
              </span>
            )}
            {!master.hasInfo && (
              <span data-material-badge="notInInfo">
                <StatusBadge sev="warn">{t('badges.notInInfo')}</StatusBadge>
              </span>
            )}
          </div>
        </div>
        <div className="text-sm font-medium" data-material-description="">
          <bdi>{master.description}</bdi>
        </div>
        {master.description2 && (
          <div className="text-sm text-muted-foreground" data-material-description2="">
            <bdi>{master.description2}</bdi>
          </div>
        )}
      </div>
      <Link
        to={simulatorHref(master.materialNumber)}
        className={buttonClass('secondary')}
        data-material-simulator=""
      >
        <Tag className="h-3.5 w-3.5" aria-hidden />
        {t('simulator')}
      </Link>
    </div>
  )
}

const TAB_PANEL_ID = 'material-detail-panel'

/**
 * The tab strip. `?tab=` is the open tab, so a pasted link lands on it; switching REPLACES the
 * history entry (the loyalty member's tabs precedent). Only the open tab's panel is mounted, so a
 * tab asks the server only once it is opened.
 */
function Tabs({ detail, access }: { detail: Detail; access: MaterialAccessResult | undefined }) {
  const { t } = useTranslation('materials-detail')
  const [params, setParams] = useSearchParams()
  const { master } = detail
  const tabs = detailTabs(master.serialised)
  const open = resolveDetailTab(params.get('tab'), master.serialised)

  const select = (tab: DetailTab) => {
    const next = new URLSearchParams(params)
    next.set('tab', tab)
    setParams(next, { replace: true })
  }

  return (
    <div className={`${PANEL} overflow-hidden`}>
      <div role="tablist" aria-label={t('tabs.ariaLabel')} className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
        {tabs.map((tab) => (
          <Chip
            key={tab}
            variant="tab"
            on={open === tab}
            id={`material-tab-${tab}`}
            aria-controls={TAB_PANEL_ID}
            onClick={() => select(tab)}
            data-material-tab={tab}
          >
            {t(`tabs.label.${tab}`)}
          </Chip>
        ))}
      </div>
      <div role="tabpanel" id={TAB_PANEL_ID} aria-labelledby={`material-tab-${open}`} className="p-3" data-material-panel={open}>
        {open === 'master' ? (
          <MasterTab master={master} />
        ) : open === 'barcodes' ? (
          <DetailGrid
            // A key per tab: Barcodes and Batches stand at the same place, and must not share a grid.
            key="barcodes"
            rows={detail.barcodes}
            columns={barcodeColumns}
            exportName="barcodes"
            materialNumber={master.materialNumber}
            emptyKey="barcodes.empty"
            dataKey="barcodes"
          />
        ) : open === 'batches' ? (
          <DetailGrid
            key="batches"
            rows={detail.batches}
            columns={batchColumns}
            exportName="batches"
            materialNumber={master.materialNumber}
            emptyKey="batches.empty"
            dataKey="batches"
          />
        ) : (
          <StockTab materialNumber={master.materialNumber} access={access} />
        )}
      </div>
    </div>
  )
}

/** The Master tab: four labelled groups — or, without ItemInfo, one note in place of the empty ones. */
function MasterTab({ master }: { master: MaterialMaster }) {
  const { t } = useTranslation('materials-detail')
  const sections = useMemo(() => masterSections(master), [master])
  return (
    <div className="grid gap-3 md:grid-cols-2" data-material-master="">
      {sections.map((section) =>
        section.kind === 'notInInfo' ? (
          <div
            key="notInInfo"
            className="flex items-start gap-2 rounded-md border border-attention-border bg-attention-050 p-3 text-attention-800"
            role="note"
            data-material-not-in-info={section.replaces.join(' ')}
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold">{t('master.notInInfo.title')}</div>
              <p className="text-[0.8125rem]">{t('master.notInInfo.body')}</p>
            </div>
          </div>
        ) : (
          <section key={section.id} className="rounded-md border border-border/60 p-3" data-material-group={section.id}>
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">{t(`master.groups.${section.id}`)}</h2>
            <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
              {section.rows.map((row) => (
                <MasterField key={row.id} row={row} />
              ))}
            </dl>
          </section>
        ),
      )}
    </div>
  )
}

function MasterField({ row }: { row: MasterRow }) {
  const { t } = useTranslation('materials-detail')
  return (
    <>
      <dt className="text-muted-foreground">{t(`master.fields.${row.id}`)}</dt>
      <dd className={row.kind === 'machine' ? 'font-mono text-[13px]' : ''} data-material-field={row.id}>
        {row.value === '' ? (
          <span className="text-muted-foreground">{t('master.none')}</span>
        ) : row.kind === 'machine' ? (
          // A code, number, date or a `code · name` pair: ONE string, isolated once.
          <Ltr>{row.value}</Ltr>
        ) : (
          <bdi>{row.value}</bdi>
        )}
      </dd>
    </>
  )
}

type ExportName = 'barcodes' | 'batches' | 'stock'

/** A tab's grid with its own "Export to Excel" — the grid as shown, through the core writer. */
function DetailGrid<T>({
  rows,
  columns,
  exportName,
  materialNumber,
  emptyKey,
  dataKey,
  loading = false,
  footer,
}: {
  rows: T[]
  columns: (t: TFunction) => ColDef<T>[]
  exportName: ExportName
  materialNumber: string
  emptyKey: string
  dataKey: string
  loading?: boolean
  footer?: (shown: number) => ReactNode
}) {
  const { t } = useTranslation('materials-detail')
  const columnDefs = useMemo(() => columns(t), [columns, t])
  const defaultColDef = useMemo<ColDef<T>>(
    () => ({ ...OMS_GRID_BASE_COL_DEF, sortable: true, resizable: true, filter: true, suppressHeaderMenuButton: true }),
    [],
  )
  const gridApi = useRef<GridApi<T> | null>(null)
  const [shown, setShown] = useState(0)
  const NoRows = useMemo(() => () => <span className="text-sm text-muted-foreground">{t(emptyKey)}</span>, [t, emptyKey])

  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api, t(`export.sheet.${exportName}`), { asText: (colId) => EXPORT_AS_TEXT.has(colId) })
      // The material's number names the file: `material-101234-barcodes-…xlsx`.
      await writeWorkbook([sheet], xlsxFileName(t(`export.fileName.${exportName}`, { no: materialNumber })))
      notify.success(t('export.done'), t('export.doneDetail', { count: sheet.count, n: fsi(figure(sheet.count)) }))
    } catch {
      notify.error(t('export.failed'), t('export.failedDetail'))
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outlined" disabled={loading || shown === 0} onClick={() => void exportXlsx()} data-material-export={dataKey}>
          <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
          {t('export.button')}
        </Button>
      </div>
      <div className="relative h-[calc(100vh-30rem)] min-h-72" data-material-grid={dataKey}>
        <AgGridReact<T>
          theme={omsGridTheme}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={({ api }) => {
            gridApi.current = api
          }}
          onModelUpdated={({ api }) => setShown(api.getDisplayedRowCount())}
          rowHeight={OMS_GRID_ROW_HEIGHT}
          headerHeight={OMS_GRID_HEADER_HEIGHT}
          tooltipShowDelay={500}
          animateRows={false}
          loading={loading}
          noRowsOverlayComponent={NoRows}
        />
      </div>
      {footer?.(shown)}
    </div>
  )
}

/**
 * The Stock tab: this material's live ATP at every store (`stores: null`), highest first, zero
 * stores only when asked for. 🚩 Without `canCheckStock` it says "not permitted" and makes NO call
 * (the request is `null`, so the query is disabled). 🚩 `MAT-00004` is the unavailable panel the
 * stock check shows, NEVER an empty grid.
 */
function StockTab({ materialNumber, access }: { materialNumber: string; access: MaterialAccessResult | undefined }) {
  const { t } = useTranslation('materials-detail')
  const [includeZero, setIncludeZero] = useState(false)
  const request = detailStockRequest(materialNumber, access, includeZero)
  const stock = useQuery(materialStockQuery(request))
  const rows = useMemo(
    () => (stock.isError ? [] : detailStockRows(stock.data?.cells ?? [], includeZero)),
    [stock.isError, stock.data, includeZero],
  )

  if (!stockTabVisible(access)) {
    return (
      <div className="mx-auto my-8 max-w-md text-center" role="note" data-material-stock-denied="">
        <ShieldOff className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-sm font-semibold">{t('stock.deniedTitle')}</div>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">{t('stock.deniedBody')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" data-material-stock="">
      <label className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-foreground">
        <input type="checkbox" checked={includeZero} onChange={(e) => setIncludeZero(e.target.checked)} data-material-stock-zero="" />
        {t('stock.includeZero')}
      </label>
      {stock.isError && isStockUnavailable(stock.error) ? (
        <StockUnavailable onRetry={() => void stock.refetch()} retrying={stock.isFetching} />
      ) : stock.isError ? (
        <ErrorBanner className="p-2.5" title={t('stock.failedTitle')} message={apiErrorMessage(stock.error, t('stock.failed'))} />
      ) : (
        <DetailGrid
          rows={rows}
          columns={detailStockColumns}
          exportName="stock"
          materialNumber={materialNumber}
          emptyKey={includeZero ? 'stock.emptyWithZero' : 'stock.empty'}
          dataKey="stock"
          loading={stock.isFetching}
          footer={(shown) => (
            <div
              className="flex h-7 shrink-0 items-center gap-4 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
              data-material-stock-summary={stock.isFetching ? '' : shown}
            >
              {stock.isFetching ? (
                <span>{t('stock.loading')}</span>
              ) : (
                <Trans t={t} i18nKey="stock.count" count={shown} values={{ n: figure(shown) }} components={{ n: <Ltr /> }} />
              )}
            </div>
          )}
        />
      )}
    </div>
  )
}
