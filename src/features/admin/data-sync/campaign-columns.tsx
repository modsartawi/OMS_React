import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Ltr from '@/core/ui/Ltr'
import { JOBS_BY_STATE_KEYS, type Campaign } from '@/core/models/data-sync'
import { formatDateTime } from '@/core/util/date-format'
import CodeBadgeView from './CodeBadgeView'
import { campaignStatusBadge, figure } from './helpers'

/**
 * What every Data sync grid shares. Sorting and paging are the door's, so no column is
 * client-sortable or filterable: a sort over one page of 50 would reorder a page, not the list.
 */
export const DATA_SYNC_DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: false,
  filter: false,
  resizable: true,
  cellDataType: false,
}

/** A machine value's cell: monospaced, a size under the body text. */
export const MONO = 'font-mono text-[12px]'

/** A DataSync time (UTC, `Z`) drawn local; `null` is blank. */
export const formatTime = (p: ValueFormatterParams) => formatDateTime(p.value as string | null)

/** The campaign page's address. */
export const campaignPath = (campaignId: string) => `/admin/data-sync/campaigns/${encodeURIComponent(campaignId)}`

/**
 * The campaigns grid's columns (ticket 559). `profileName` resolves a campaign's `profileId`
 * against the Profiles read; an id it does not know (a disabled profile) shows raw.
 */
export function buildCampaignColumns(t: TFunction, profileName: (id: string) => string | null): ColDef<Campaign>[] {
  return [
    {
      // 🔑 The way into the campaign page — a real anchor, so it can be middle-clicked and linked.
      headerName: t('campaigns.columns.name'),
      colId: 'name',
      width: 260,
      cellRenderer: (p: ICellRendererParams<Campaign>) =>
        p.data ? (
          <Link
            to={campaignPath(p.data.campaignId)}
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-campaign-link={p.data.campaignId}
          >
            {p.data.name ? <bdi>{p.data.name}</bdi> : t('campaigns.unnamed')}
          </Link>
        ) : null,
    },
    {
      headerName: t('campaigns.columns.profile'),
      colId: 'profile',
      width: 220,
      valueGetter: (p) => (p.data ? (profileName(p.data.profileId) ?? p.data.profileId) : ''),
    },
    {
      headerName: t('campaigns.columns.mode'),
      field: 'mode',
      width: 110,
      // A mode this bundle does not know shows its raw code, never a raw key.
      valueFormatter: (p: ValueFormatterParams<Campaign, string>) =>
        p.value ? t(`mode.${p.value}`, { defaultValue: p.value }) : '',
    },
    {
      headerName: t('campaigns.columns.status'),
      field: 'status',
      width: 120,
      cellRenderer: (p: ICellRendererParams<Campaign>) =>
        p.data ? (
          <span data-campaign-status={p.data.status}>
            <CodeBadgeView badge={campaignStatusBadge(p.data.status)} code={p.data.status} />
          </span>
        ) : null,
    },
    {
      // Only the buckets that hold a job, each a word and its count (`Running 3`), in contract order.
      headerName: t('campaigns.columns.jobsByState'),
      colId: 'jobsByState',
      width: 300,
      cellRenderer: (p: ICellRendererParams<Campaign>) =>
        p.data ? (
          <span className="flex h-full flex-wrap items-center gap-x-3 text-xs" data-jobs-by-state="">
            {JOBS_BY_STATE_KEYS.filter((k) => (p.data as Campaign).jobsByState[k] > 0).map((k) => (
              <span key={k} data-bucket={k}>
                {t(`jobsByState.${k}`)}{' '}
                <span className="font-mono tabular-nums">
                  <Ltr>{figure((p.data as Campaign).jobsByState[k])}</Ltr>
                </span>
              </span>
            ))}
          </span>
        ) : null,
    },
    {
      headerName: t('campaigns.columns.totalJobs'),
      field: 'totalJobs',
      width: 90,
      type: 'rightAligned',
      valueFormatter: (p: ValueFormatterParams<Campaign, number>) => (p.value == null ? '' : figure(p.value)),
    },
    { headerName: t('campaigns.columns.createdAt'), field: 'createdAt', width: 150, cellClass: MONO, valueFormatter: formatTime },
  ]
}
