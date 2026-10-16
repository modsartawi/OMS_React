import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'
import type { RuleCampaignListRow } from '@/core/models/rule-campaign'
import CampaignStateBadge from '@/core/rules/CampaignStateBadge'
import { campaignPath, campaignState, stateOrder, type CampaignState } from '@/core/rules/campaign-state'
import { formatDateTime } from '@/core/util/date-format'

type Row = RuleCampaignListRow

/** The English name as a link into the campaign's workspace — the keyboard's way in, beside the
 *  row click. Free text, so a plain `<bdi>`. */
function NameCell({ data, value, context }: ICellRendererParams<Row, string, { untitled: string }>) {
  if (!data) return null
  return (
    <Link to={campaignPath(data.id)} className="font-medium text-primary hover:underline" data-campaign-link={data.id}>
      {/* A draft may have only its Arabic name yet: the link must still read as something. */}
      <bdi>{value || context.untitled}</bdi>
    </Link>
  )
}

function StateCell({ value }: ICellRendererParams<Row, CampaignState>) {
  return value ? <CampaignStateBadge state={value} /> : null
}

/**
 * The campaigns grid (ticket 501): the name in English and in Arabic (both, wherever a name is
 * read), the code, the state at the reader's local now, the schedule's local days and who
 * created it. Plain cells are isolated by the core grid base; the two renderers isolate their own.
 */
export function campaignColumns(t: TFunction, now: () => Date): ColDef<Row>[] {
  return [
    {
      colId: 'name',
      headerName: t('columns.name'),
      valueGetter: ({ data }) => data?.name.en ?? '',
      cellRenderer: NameCell,
      flex: 2,
      minWidth: 260,
    },
    {
      colId: 'nameAr',
      headerName: t('columns.nameAr'),
      valueGetter: ({ data }) => data?.name.ar ?? '',
      flex: 2,
      minWidth: 220,
    },
    { colId: 'code', field: 'code', headerName: t('columns.code'), width: 150 },
    {
      colId: 'state',
      headerName: t('columns.state'),
      valueGetter: ({ data }) => (data ? campaignState(data, now()) : null),
      cellRenderer: StateCell,
      // Lifecycle order, as the tiles read — not the keys' alphabet.
      comparator: (a: CampaignState | null, b: CampaignState | null) => (a ? stateOrder(a) : -1) - (b ? stateOrder(b) : -1),
      width: 190,
    },
    {
      colId: 'start',
      headerName: t('columns.start'),
      valueGetter: ({ data }) => data?.schedule.from ?? null,
      valueFormatter: ({ value }) => value ?? t('schedule.immediately'),
      width: 130,
    },
    {
      colId: 'end',
      headerName: t('columns.end'),
      valueGetter: ({ data }) => data?.schedule.until ?? null,
      valueFormatter: ({ value }) => value ?? t('schedule.openEnded'),
      width: 150,
    },
    {
      colId: 'created',
      headerName: t('columns.created'),
      valueGetter: ({ data }) => data?.created?.at ?? null,
      valueFormatter: ({ value }) => formatDateTime(value),
      width: 160,
    },
    {
      colId: 'createdBy',
      headerName: t('columns.createdBy'),
      valueGetter: ({ data }) => data?.created?.by ?? '',
      width: 170,
    },
  ]
}
