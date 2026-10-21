import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import type { TFunction } from 'i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams, RowClickedEvent } from 'ag-grid-community'
import { Upload } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { CAMPAIGN_UPLOAD_PATH } from '@/core/rules/campaign-state'
import Ltr from '@/core/ui/Ltr'
import { promotionsQuery } from './api'
import { promotionRowView, type PromotionRowView } from './promotion-row'
import PromotionsRefusal from './PromotionsRefusal'
import PromotionStateBadge from './PromotionStateBadge'

/**
 * Campaigns ▸ Promotions (ticket 534; BackOffice brief 2848 D1): the campaign area's top level, one
 * row per promotion — a weekly flyer or an ad-hoc set of campaigns — in the reply's order (newest
 * first), then the no-promotion row of the hand-built campaigns. A row opens the promotion's page.
 * **Upload a promotion** opens the campaign upload; **New promotion** is ticket 536's.
 *
 * The rows keep HQ's order (no column sorts), so the no-promotion row stays last. Grouping is not
 * publishing: nothing here writes a version, and there is no promotion budget or promotion-wide
 * disable.
 *
 * Readers (03) see it; there is no access probe, so a session without the grant is a bare 403 that
 * reads "You do not have access to this action", never an empty list.
 */
export default function PromotionsPage() {
  const { t } = useTranslation('campaign-promotions')
  const navigate = useNavigate()
  const promotions = useQuery(promotionsQuery())
  const rows = useMemo(() => (promotions.data ?? []).map(promotionRowView), [promotions.data])
  const count = rows.filter((r) => !r.noPromotion).length
  const columns = useMemo(() => promotionColumns(t), [t])

  const open = (e: RowClickedEvent<PromotionRowView>) => {
    // The promotion's code is a link: a click on it has already navigated.
    if ((e.event?.target as Element | null)?.closest?.('a')) return
    if (e.data) navigate(e.data.path)
  }

  return (
    <section className="flex h-full w-full flex-col gap-4" data-campaign-promotions="">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-lg font-semibold tracking-tight">{t('list.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('list.lede')}</p>
        </div>
        <Link
          to={CAMPAIGN_UPLOAD_PATH}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/85"
          data-promotions-upload=""
        >
          <Upload className="size-3.5" aria-hidden />
          {t('list.upload')}
        </Link>
      </header>

      {/* A failed refetch keeps the rows already shown; only a list never read is replaced by the refusal. */}
      {promotions.isError && !promotions.data ? (
        <PromotionsRefusal error={promotions.error} at="data-promotions-failed" />
      ) : (
        <div className="flex min-w-0 flex-col gap-1">
          <div className="relative h-[calc(100vh-20rem)] min-h-96" data-promotions-grid="">
            <AgGridReact<PromotionRowView>
              theme={omsGridTheme}
              rowData={rows}
              columnDefs={columns}
              defaultColDef={DEFAULT_COL_DEF}
              getRowId={({ data }) => data.key}
              onRowClicked={open}
              rowClass="cursor-pointer"
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
              suppressColumnVirtualisation
              loading={promotions.isPending}
              noRowsOverlayComponent={NoRows}
            />
          </div>
          <div
            className="flex h-7 shrink-0 items-center gap-3 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
            data-status-bar=""
          >
            {promotions.isPending ? (
              <span>{t('list.loading')}</span>
            ) : (
              <span data-status-count="">
                <Trans t={t} i18nKey="list.count" count={count} components={{ n: <Ltr /> }} />
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function NoRows() {
  const { t } = useTranslation('campaign-promotions')
  return (
    <span className="text-sm text-muted-foreground" data-promotions-none="">
      {t('list.none')}
    </span>
  )
}

// HQ's order is the list's: newest first, the no-promotion row last. No column sorts it away.
const DEFAULT_COL_DEF: ColDef<PromotionRowView> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: false,
  resizable: true,
  suppressHeaderMenuButton: true,
}

/** The promotion's code as a link to its page; the no-promotion row reads "No promotion". */
function PromotionCell({ data }: ICellRendererParams<PromotionRowView>) {
  const { t } = useTranslation('campaign-promotions')
  if (!data) return null
  return (
    <Link
      to={data.path}
      className={'font-medium text-primary hover:underline' + (data.noPromotion ? '' : ' font-mono')}
      data-promotion-open={data.promotionCode ?? ''}
      data-no-promotion={data.noPromotion ? '' : undefined}
    >
      {data.noPromotion ? t('list.noPromotion') : <Ltr>{data.promotionCode}</Ltr>}
    </Link>
  )
}

function StateCell({ data }: ICellRendererParams<PromotionRowView>) {
  return data ? <PromotionStateBadge badge={data.badge} /> : null
}

/** The upload states this namespace has words for; HQ may send another, which reads as sent. */
const UPLOAD_STATES: readonly string[] = ['pending', 'sentBack', 'activated']

function promotionColumns(t: TFunction<'campaign-promotions'>): ColDef<PromotionRowView>[] {
  return [
    { colId: 'promotion', headerName: t('list.columns.promotion'), cellRenderer: PromotionCell, minWidth: 240, flex: 1 },
    // Either name may be empty (an upload's promotion has none until someone names it): the code alone then.
    { colId: 'nameEn', field: 'nameEn', headerName: t('list.columns.nameEn'), minWidth: 180, flex: 1 },
    { colId: 'nameAr', field: 'nameAr', headerName: t('list.columns.nameAr'), minWidth: 180, flex: 1 },
    { colId: 'kind', headerName: t('list.columns.kind'), valueGetter: ({ data }) => (data?.kind ? t(`kind.${data.kind}`) : ''), width: 120 },
    // The days, the last one INCLUSIVE, as one range.
    { colId: 'window', field: 'window', headerName: t('list.columns.window'), valueFormatter: ({ value }) => value ?? '', width: 220 },
    { colId: 'campaignCount', field: 'campaignCount', headerName: t('list.columns.campaignCount'), width: 110 },
    { colId: 'skuCount', field: 'skuCount', headerName: t('list.columns.skuCount'), width: 100 },
    { colId: 'state', headerName: t('list.columns.state'), cellRenderer: StateCell, width: 120 },
    { colId: 'liveVersionNo', field: 'liveVersionNo', headerName: t('list.columns.liveVersionNo'), valueFormatter: ({ value }) => (value == null ? '' : String(value)), width: 120 },
    { colId: 'revision', headerName: t('list.columns.revision'), valueGetter: ({ data }) => (data?.upload ? String(data.upload.revision) : ''), width: 130 },
    {
      colId: 'uploadState',
      headerName: t('list.columns.uploadState'),
      // A state HQ adds later reads as sent.
      valueGetter: ({ data }) => {
        const s = data?.upload?.uploadState ?? ''
        return UPLOAD_STATES.includes(s) ? t(`uploadState.${s}`) : s
      },
      width: 120,
    },
    { colId: 'uploadedBy', headerName: t('list.columns.uploadedBy'), valueGetter: ({ data }) => data?.upload?.uploadedBy ?? '', width: 130 },
    { colId: 'approvedBy', headerName: t('list.columns.approvedBy'), valueGetter: ({ data }) => data?.upload?.approvedBy ?? '', width: 130 },
  ]
}
