import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import type { TFunction } from 'i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams, RowClickedEvent, RowSelectionOptions } from 'ag-grid-community'
import { Search } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import type { RulePromotionCampaignPage } from '@/core/models/rule-promotion'
import {
  PROMOTION_CAMPAIGN_STATUSES,
  PROMOTION_PAGE_SIZE,
  campaignInPromotionPath,
  withPromotionFilter,
  type PromotionQuery,
} from '@/core/rules/promotion-query'
import ErrorBanner from '@/core/ui/ErrorBanner'
import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import { showsPager } from '@/core/ui/pager'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatRange } from '@/core/util/bidi'
import { CAMPAIGN_ROW_STATUS_SEV, campaignRowView, mechanicChips, type CampaignRowView } from './promotion-page'

/** A row as the grid draws it: the campaign, and its workspace's address with this list's context. */
interface GridRow extends CampaignRowView {
  path: string
}

/** How long typing settles before the search reaches the URL (and HQ). */
const SEARCH_SETTLE_MS = 300

/**
 * A promotion's campaigns (ticket 535; `Promotions/Campaigns`): a search over the id and both names,
 * the mechanic chips (every key HQ counts, `builder` included) and the status filter, then the table,
 * paged on the server — 50 a page, `total` drives the pager. Every filter and the page live in the URL
 * (`?q=&mechanic=&status=&page=`, replaced), so Back and a shared link restore the view; a changed
 * filter goes back to page 1. A row opens the campaign's workspace with this list's context (537).
 *
 * The rows are HQ's, in HQ's order (by id): no column sorts them. A rule count, never the rules.
 *
 * On a hand-made promotion (ticket 536) each row has a checkbox, for Unassign: the ticks are the
 * page's (a new page or filter starts with none).
 */
export default function PromotionCampaigns({
  promotionCode,
  query,
  update,
  changedFromOutside,
  campaigns,
  onTicked,
}: {
  /** Null for no promotion. */
  promotionCode: string | null
  query: PromotionQuery
  update: (change: (prev: PromotionQuery) => PromotionQuery) => void
  changedFromOutside: () => boolean
  campaigns: UseQueryResult<RulePromotionCampaignPage>
  /** Given: a checkbox per row, and the ticked ids on every change. */
  onTicked?: (ids: string[]) => void
}) {
  const { t } = useTranslation('campaign-promotions')
  const navigate = useNavigate()
  const columns = useMemo(() => campaignColumns(t), [t])

  // The search box keeps what is typed; it reaches the URL once typing settles. Back or a pasted link
  // (a change from outside) puts the URL's search back in the box.
  const [typed, setTyped] = useState(query.q)
  useEffect(() => {
    if (changedFromOutside()) setTyped(query.q)
  }, [query.q, changedFromOutside])
  useEffect(() => {
    if (typed === query.q) return
    const timer = setTimeout(() => update((prev) => withPromotionFilter(prev, { q: typed })), SEARCH_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [typed, query.q, update])

  const page = campaigns.data
  const rows = useMemo<GridRow[]>(
    () => (page?.campaigns ?? []).map((r) => ({ ...campaignRowView(r), path: campaignInPromotionPath(r.id, promotionCode, query) })),
    [page, promotionCode, query],
  )
  const chips = page ? mechanicChips(page.mechanics, query.mechanic) : []
  const total = page?.total ?? 0

  const open = (e: RowClickedEvent<GridRow>) => {
    // The id is a link: a click on it has already navigated; a checkbox ticks, it does not open.
    if ((e.event?.target as Element | null)?.closest?.('a, input, [col-id="ag-Grid-SelectionColumn"]')) return
    if (e.data) navigate(e.data.path)
  }

  const denied = isBareDenial(campaigns.error)
  // A read that failed with no page to show keeps the filters (so a filter HQ refused can be cleared)
  // and shows its refusal where the table was; a failed refetch keeps the page shown under it.
  const failedBare = campaigns.isError && !page

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label={t('promotion.campaigns')} data-promotion-campaigns="">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="flex w-full max-w-md flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('promotion.search.label')}
          <span className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" aria-hidden />
            <input
              type="search"
              dir="auto"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t('promotion.search.placeholder')}
              className="h-9 w-full rounded-md border border-border/60 bg-background ps-8 pe-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
              data-promotion-search=""
            />
          </span>
        </label>
        <div className="flex flex-col gap-1" role="group" aria-label={t('promotion.status.label')} data-status-filter="">
          <span className="text-xs font-medium text-muted-foreground">{t('promotion.status.label')}</span>
          <div className="flex flex-wrap gap-1">
            {(['', ...PROMOTION_CAMPAIGN_STATUSES] as const).map((s) => (
              <Chip key={s || 'all'} on={query.status === s} onClick={() => update((prev) => withPromotionFilter(prev, { status: s }))} data={{ 'data-status-chip': s }}>
                {t(`promotion.status.${s || 'all'}`)}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1" role="group" aria-label={t('promotion.mechanic.label')} data-mechanic-chips="">
          {chips.map((c) => (
            <Chip key={c.mechanic || ' all'} on={query.mechanic === c.mechanic} onClick={() => update((prev) => withPromotionFilter(prev, { mechanic: c.mechanic }))} data={{ 'data-mechanic-chip': c.mechanic }}>
              {/* A mechanic is HQ's key, shown as sent: a machine value, like its count. */}
              {c.mechanic ? <Ltr>{c.mechanic}</Ltr> : t('promotion.mechanic.all')}
              <span className="text-muted-foreground" data-chip-count="">
                <Ltr>{c.count.toLocaleString('en-US')}</Ltr>
              </span>
            </Chip>
          ))}
        </div>
      )}

      {campaigns.isError && (
        <div data-promotion-campaigns-failed="" data-denied={denied ? '' : undefined}>
          <ErrorBanner className="p-2.5" title={denied ? undefined : t('promotion.failedTitle')} message={denied ? t('denied') : apiErrorMessage(campaigns.error, t('promotion.failed'))} />
        </div>
      )}

      {!failedBare && (
        <div className="flex min-w-0 flex-col gap-1">
          <div className="relative h-[calc(100vh-30rem)] min-h-96" data-promotion-campaigns-grid="">
            <AgGridReact<GridRow>
              theme={omsGridTheme}
              rowData={rows}
              columnDefs={columns}
              defaultColDef={DEFAULT_COL_DEF}
              getRowId={({ data }) => data.id}
              onRowClicked={open}
              rowSelection={onTicked ? TICK_SELECTION : undefined}
              onSelectionChanged={onTicked ? (e) => onTicked(e.api.getSelectedRows().map((r) => r.id)) : undefined}
              rowClass="cursor-pointer"
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
              suppressColumnVirtualisation
              loading={campaigns.isPending}
              noRowsOverlayComponent={NoRows}
              noRowsOverlayComponentParams={{ pastLast: total > 0 }}
            />
          </div>
          {page && (showsPager(total, PROMOTION_PAGE_SIZE) || query.page > 1) && (
            <GridPager page={query.page} pageSize={PROMOTION_PAGE_SIZE} totalMatches={total} busy={campaigns.isPlaceholderData} onPage={(p) => update((prev) => ({ ...prev, page: p }))} />
          )}
          <div className="flex h-7 shrink-0 items-center gap-3 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground" data-status-bar="">
            {!page ? (
              <span>{t('promotion.loadingCampaigns')}</span>
            ) : total === 0 ? (
              <span data-campaigns-count="">{t('promotion.empty')}</span>
            ) : rows.length === 0 ? (
              // Past the last page HQ answers an empty page; the pager's Previous leads back.
              <span data-campaigns-count="">
                <Trans t={t} i18nKey="promotion.pastLast" values={{ total: total.toLocaleString('en-US') }} components={{ total: <Ltr /> }} />
              </span>
            ) : (
              <span data-campaigns-count="">
                <Trans
                  t={t}
                  i18nKey="promotion.count"
                  count={total}
                  values={{ range: formatRange(page.pageSize * (page.page - 1) + 1, page.pageSize * (page.page - 1) + rows.length), total: total.toLocaleString('en-US') }}
                  components={{ range: <Ltr />, total: <Ltr /> }}
                />
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function Chip({ on, onClick, data, children }: { on: boolean; onClick: () => void; data: Record<string, string>; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      {...data}
      className={
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ' +
        (on ? 'border-primary bg-primary-050 text-primary' : 'border-border/60 bg-card text-foreground hover:bg-accent')
      }
    >
      {children}
    </button>
  )
}

/** No row: nothing matches, or past the last page (HQ answers an empty page; the status bar says how many). */
function NoRows({ pastLast }: { pastLast?: boolean }) {
  const { t } = useTranslation('campaign-promotions')
  return (
    <span className="text-sm text-muted-foreground" data-promotion-campaigns-none="">
      {t(pastLast ? 'promotion.emptyPage' : 'promotion.empty')}
    </span>
  )
}

/** Checkboxes only (the header's ticks the page): a click on a row opens its campaign, never ticks it. */
const TICK_SELECTION: RowSelectionOptions<GridRow> = { mode: 'multiRow', checkboxes: true, headerCheckbox: true, enableClickSelection: false }

// HQ's order (by id) is the table's: no column sorts it, so a page never reorders under the pager.
const DEFAULT_COL_DEF: ColDef<GridRow> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: false,
  resizable: true,
  suppressHeaderMenuButton: true,
}

/** The campaign's id as a link to its workspace, with this list's context. */
function IdCell({ data }: ICellRendererParams<GridRow>) {
  if (!data) return null
  return (
    <Link to={data.path} className="font-mono font-medium text-primary hover:underline" data-promotion-campaign={data.id}>
      <Ltr>{data.id}</Ltr>
    </Link>
  )
}

/** The Arabic name, flagged when the upload generated it. */
function NameArCell({ data }: ICellRendererParams<GridRow>) {
  const { t } = useTranslation('campaign-promotions')
  if (!data) return null
  return (
    <span className="flex items-center gap-2">
      <bdi>{data.nameAr}</bdi>
      {data.nameArGenerated && (
        <span data-generated="">
          <StatusBadge sev="mute">{t('promotion.generated')}</StatusBadge>
        </span>
      )}
    </span>
  )
}

function StatusCell({ data }: ICellRendererParams<GridRow>) {
  const { t } = useTranslation('campaign-promotions')
  if (!data) return null
  return (
    <span data-campaign-status={data.status}>
      <StatusBadge sev={CAMPAIGN_ROW_STATUS_SEV[data.status]}>{t(`promotion.status.${data.status}`)}</StatusBadge>
    </span>
  )
}

function campaignColumns(t: TFunction<'campaign-promotions'>): ColDef<GridRow>[] {
  return [
    // Its value is the link's address: a filter changes the context the link carries while the row
    // (by id) stays, and the grid redraws a cell only when its value changes.
    { colId: 'id', valueGetter: ({ data }) => data?.path ?? '', headerName: t('promotion.columns.id'), cellRenderer: IdCell, minWidth: 220, flex: 1 },
    { colId: 'nameEn', field: 'nameEn', headerName: t('promotion.columns.nameEn'), minWidth: 200, flex: 1 },
    { colId: 'nameAr', headerName: t('promotion.columns.nameAr'), cellRenderer: NameArCell, minWidth: 220, flex: 1 },
    { colId: 'mechanic', field: 'mechanic', headerName: t('promotion.columns.mechanic'), width: 140 },
    { colId: 'skuCount', field: 'skuCount', headerName: t('promotion.columns.skuCount'), width: 90 },
    { colId: 'ruleCount', field: 'ruleCount', headerName: t('promotion.columns.ruleCount'), width: 90 },
    // The days, the last one INCLUSIVE, as one range.
    { colId: 'window', field: 'window', headerName: t('promotion.columns.window'), valueFormatter: ({ value }) => value ?? '', width: 220 },
    { colId: 'status', headerName: t('promotion.columns.status'), cellRenderer: StatusCell, width: 130 },
  ]
}
