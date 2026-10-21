import { useId, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import type { TFunction } from 'i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams, RowClickedEvent } from 'ag-grid-community'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import type { RuleUploadSummary } from '@/core/models/rule-upload'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatDateTime } from '@/core/util/date-format'
import { campaignUploadPath, campaignUploadsQuery } from './api'
import { windowDays } from './report'
import { UPLOAD_STATE_FILTERS, stateFilterFromParams, stateFilterToParams, uploadListFilter } from './review'
import UploadStateBadge from './UploadStateBadge'

/**
 * Campaigns ▸ Campaign uploads (ticket 532; BackOffice brief 2839 U3): every promotion's upload, one row
 * per promotion, newest upload first (`Uploads/List`), filtered by state — `pending` by default, held in
 * the address. A row opens the upload, where an approver activates or sends it back as a whole.
 *
 * Readers (03) see it; there is no access probe, so a session without the grant is a bare 403 that
 * reads "You do not have access to this action", never an empty list.
 */
export default function UploadsPage() {
  const { t } = useTranslation('campaign-uploads')
  const navigate = useNavigate()
  const filterId = useId()
  const { query: filter, update } = useUrlQuery(stateFilterFromParams, stateFilterToParams)
  const uploads = useQuery(campaignUploadsQuery())
  const rows = useMemo(() => uploadListFilter(uploads.data ?? [], filter), [uploads.data, filter])
  const columns = useMemo(() => uploadColumns(t), [t])
  const denied = isBareDenial(uploads.error)

  const open = (e: RowClickedEvent<RuleUploadSummary>) => {
    // The promotion code is a link: a click on it has already navigated.
    if ((e.event?.target as Element | null)?.closest?.('a')) return
    if (e.data) navigate(campaignUploadPath(e.data.promotionCode))
  }

  return (
    <section className="flex h-full w-full flex-col gap-4" data-campaign-uploads="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('uploads.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('uploads.lede')}</p>
      </header>

      <label htmlFor={filterId} className="flex w-fit flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('uploads.filter')}
        <select
          id={filterId}
          value={filter}
          onChange={(e) => update(() => e.target.value as typeof filter)}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground"
          data-uploads-filter=""
        >
          {UPLOAD_STATE_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? t('uploads.allStates') : t(`state.${s}`)}
            </option>
          ))}
        </select>
      </label>

      {/* A failed refetch keeps the rows already shown; only a list never read is replaced by the refusal. */}
      {uploads.isError && !uploads.data ? (
        <div data-uploads-failed="" data-upload-denied={denied ? '' : undefined}>
          <ErrorBanner className="p-2.5" title={denied ? undefined : t('uploads.failedTitle')} message={denied ? t('denied') : apiErrorMessage(uploads.error, t('uploads.failed'))} />
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-1">
          <div className="relative h-[calc(100vh-20rem)] min-h-96" data-uploads-grid="">
            <AgGridReact<RuleUploadSummary>
              theme={omsGridTheme}
              rowData={rows}
              columnDefs={columns}
              defaultColDef={DEFAULT_COL_DEF}
              getRowId={({ data }) => data.promotionCode}
              onRowClicked={open}
              rowClass="cursor-pointer"
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
              suppressColumnVirtualisation
              loading={uploads.isPending}
              noRowsOverlayComponent={NoRows}
            />
          </div>
          <div
            className="flex h-7 shrink-0 items-center gap-3 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
            data-status-bar=""
          >
            {uploads.isPending ? (
              <span>{t('uploads.loading')}</span>
            ) : (
              <span data-status-count="">
                <Trans t={t} i18nKey="uploads.count" count={rows.length} components={{ n: <Ltr /> }} />
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function NoRows() {
  const { t } = useTranslation('campaign-uploads')
  return (
    <span className="text-sm text-muted-foreground" data-uploads-none="">
      {t('uploads.none')}
    </span>
  )
}

const DEFAULT_COL_DEF: ColDef<RuleUploadSummary> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
}

function PromotionCell({ data }: ICellRendererParams<RuleUploadSummary>) {
  if (!data) return null
  return (
    <Link to={campaignUploadPath(data.promotionCode)} className="font-mono font-medium text-primary hover:underline" data-uploads-open={data.promotionCode}>
      <Ltr>{data.promotionCode}</Ltr>
    </Link>
  )
}

function StateCell({ data }: ICellRendererParams<RuleUploadSummary>) {
  return data ? <UploadStateBadge state={data.state} /> : null
}

/** A reviewed upload's own columns read blank until it is reviewed (`reviewedBy` "", `versionNo` 0). */
function uploadColumns(t: TFunction<'campaign-uploads'>): ColDef<RuleUploadSummary>[] {
  return [
    { colId: 'promotionCode', field: 'promotionCode', headerName: t('uploads.columns.promotionCode'), cellRenderer: PromotionCell, minWidth: 240, flex: 1 },
    { colId: 'state', field: 'state', headerName: t('uploads.columns.state'), cellRenderer: StateCell, width: 130 },
    { colId: 'revision', field: 'revision', headerName: t('uploads.columns.revision'), width: 110 },
    { colId: 'campaignCount', field: 'campaignCount', headerName: t('uploads.columns.campaignCount'), width: 120 },
    { colId: 'skuCount', field: 'skuCount', headerName: t('uploads.columns.skuCount'), width: 100 },
    {
      // The sheet's days, the last one INCLUSIVE, as one range.
      colId: 'window',
      headerName: t('uploads.columns.window'),
      valueGetter: ({ data }) => (data ? (windowDays(data.windowFrom, data.windowUntil) ?? '') : ''),
      width: 220,
    },
    { colId: 'uploadedBy', field: 'uploadedBy', headerName: t('uploads.columns.uploadedBy'), width: 140 },
    { colId: 'uploadedAt', field: 'uploadedAt', headerName: t('uploads.columns.uploadedAt'), valueFormatter: ({ value }) => formatDateTime(value), width: 160 },
    { colId: 'reviewedBy', field: 'reviewedBy', headerName: t('uploads.columns.reviewedBy'), width: 140 },
    { colId: 'reviewedAt', field: 'reviewedAt', headerName: t('uploads.columns.reviewedAt'), valueFormatter: ({ value }) => formatDateTime(value), width: 160 },
    {
      colId: 'versionNo',
      field: 'versionNo',
      headerName: t('uploads.columns.versionNo'),
      valueFormatter: ({ value }) => (value ? String(value) : ''),
      width: 110,
    },
  ]
}
