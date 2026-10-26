import { useCallback, useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { Loader2 } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Select from '@/core/ui/Select'
import ScreenGate from '@/core/ui/ScreenGate'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { CAMPAIGN_STATUSES, DATA_SYNC_PAGE_SIZE, type Campaign, type CampaignStatus } from '@/core/models/data-sync'
import { campaignsListQuery, canOpenDataSync, dataSyncAccessQuery, profilesQuery } from './api'
import { campaignsFilterFromParams, campaignsFilterToParams } from './helpers'
import { DATA_SYNC_DEFAULT_COL_DEF, buildCampaignColumns } from './campaign-columns'
import { NewCampaignButton } from './NewCampaignDialog'
import Pager from './Pager'
import ProfilesPanel from './ProfilesPanel'
import ServiceBannerView from './ServiceBannerView'

/**
 * Data sync's landing page (spec 558, ticket 559) — `/admin/data-sync`.
 *
 * The service banner, the campaigns (newest first, 50 a page, a status filter kept in the URL,
 * refetched every 30 s) and the read-only Profiles panel. Gated on `DataSync.View` by the same
 * probe the menu leaf reads.
 */
export default function DataSyncPage() {
  const { t } = useTranslation('data-sync')
  return (
    <ScreenGate query={dataSyncAccessQuery()} can={canOpenDataSync} ns="data-sync" title={t('title')} subtitle={t('subtitle')}>
      <Campaigns />
    </ScreenGate>
  )
}

const campaignId = ({ data }: { data: Campaign }) => data.campaignId

function Campaigns() {
  const { t } = useTranslation('data-sync')
  const { query: filter, update } = useUrlQuery(campaignsFilterFromParams, campaignsFilterToParams)
  const campaigns = useQuery({ ...campaignsListQuery(filter), placeholderData: keepPreviousData })
  const profiles = useQuery(profilesQuery())

  const names = useMemo(() => new Map((profiles.data ?? []).map((p) => [p.profileId, p.name])), [profiles.data])
  const profileName = useCallback((id: string) => names.get(id) ?? null, [names])
  const columns = useMemo(() => buildCampaignColumns(t, profileName), [t, profileName])

  // 🚩 A failed read draws no rows: a kept previous answer belongs to the filter BEFORE the one
  // that failed, and Running campaigns under a Failed filter would mislead.
  const shown = campaigns.isError ? undefined : campaigns.data
  const rows = shown ?? []

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ServiceBannerView />

      <section className="flex min-w-0 flex-col gap-2" aria-labelledby="ds-campaigns-heading" data-campaigns="">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="ds-campaigns-heading" className="me-auto text-sm font-semibold">
            {t('campaigns.heading')}
          </h2>
          {campaigns.isFetching && !campaigns.isPending && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {t('refreshing')}
            </span>
          )}
          <NewCampaignButton />
          <Select
            value={filter.status ?? ''}
            onChange={(e) => update(() => ({ status: (e.target.value || null) as CampaignStatus | null, page: 1 }))}
            aria-label={t('campaigns.status')}
            data-status-filter=""
          >
            <option value="">{t('campaigns.statusAny')}</option>
            {CAMPAIGN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`campaignStatus.${s}`)}
              </option>
            ))}
          </Select>
        </div>

        {campaigns.isError && <ErrorBanner className="p-3" message={apiErrorMessage(campaigns.error, t('campaigns.failed'))} />}

        {campaigns.isPending ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('campaigns.loading')}
          </div>
        ) : (
          shown && (
            <div className="overflow-hidden rounded-md border border-border/60">
              {rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground" data-campaigns-empty="">
                  {t(filter.page > 1 ? 'campaigns.emptyPage' : filter.status ? 'campaigns.emptyFiltered' : 'campaigns.empty')}
                </p>
              ) : (
                <div className="h-[28rem]" data-campaigns-grid="">
                  <AgGridReact<Campaign>
                    theme={omsGridTheme}
                    rowData={rows}
                    columnDefs={columns}
                    defaultColDef={DATA_SYNC_DEFAULT_COL_DEF}
                    getRowId={campaignId}
                    rowHeight={OMS_GRID_ROW_HEIGHT}
                    headerHeight={OMS_GRID_HEADER_HEIGHT}
                    animateRows={false}
                    suppressColumnVirtualisation
                  />
                </div>
              )}
              {/* Drawn on page 1 only when it is full; always beyond it (the only way back from an empty page). */}
              {(rows.length >= DATA_SYNC_PAGE_SIZE || filter.page > 1) && (
                <Pager
                  page={filter.page}
                  pageSize={DATA_SYNC_PAGE_SIZE}
                  rowCount={rows.length}
                  // Inert while the NEXT page is in flight, not during the 30 s poll.
                  busy={campaigns.isPlaceholderData}
                  onPage={(page) => update((f) => ({ ...f, page }))}
                />
              )}
            </div>
          )
        )}
      </section>

      <ProfilesPanel />
    </div>
  )
}
