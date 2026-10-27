import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { liveBonusBuysOf, loyGroupName } from '@/core/loy-groups/api'
import type { LoyGroup } from '@/core/models/loy-groups'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'

/** Read-only grid; the user may re-sort. */
export const GROUPS_DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  filter: false,
  resizable: true,
  cellDataType: false,
}

/** The code opens the group's page (ticket 630); isolated whole, like every machine value. */
function CodeCell(p: ICellRendererParams<LoyGroup>) {
  if (!p.data) return null
  return (
    <Link to={`/loy/groups/${encodeURIComponent(p.data.groupId)}`} className="text-primary hover:underline" data-group-open={p.data.groupId}>
      <Ltr>{p.data.code}</Ltr>
    </Link>
  )
}

function ActiveCell(p: ICellRendererParams<LoyGroup>) {
  const { t } = useTranslation('loy-groups')
  if (!p.data) return null
  const active = p.data.isActive === true
  return (
    <span data-group-active={active ? 'true' : 'false'}>
      <StatusBadge sev={active ? 'ok' : 'mute'}>{t(active ? 'status.active' : 'status.inactive')}</StatusBadge>
    </span>
  )
}

/** One promo number per live bonus-buy, its description as the tooltip; "None" while the list is empty. */
function BonusBuysCell(p: ICellRendererParams<LoyGroup>) {
  const { t } = useTranslation('loy-groups')
  if (!p.data) return null
  const buys = liveBonusBuysOf(p.data)
  if (buys.length === 0) {
    return (
      <span className="text-muted-foreground" data-group-bby="none">
        {t('bonusBuys.none')}
      </span>
    )
  }
  return (
    <span className="inline-flex flex-wrap gap-1" data-group-bby={String(buys.length)}>
      {buys.map((b) => (
        <span
          key={b.promoNumber}
          title={fsi(b.description)}
          className="rounded-sm border border-border/60 px-1.5 font-mono text-[12px] tabular-nums"
          data-group-bby-promo={b.promoNumber}
        >
          <Ltr>{b.promoNumber}</Ltr>
        </span>
      ))}
    </span>
  )
}

export function buildGroupColumns(t: TFunction, lang: string): ColDef<LoyGroup>[] {
  return [
    { colId: 'code', field: 'code', headerName: t('columns.code'), width: 160, cellClass: 'font-mono', cellRenderer: CodeCell },
    {
      colId: 'name',
      headerName: t('columns.name'),
      flex: 1,
      minWidth: 220,
      valueGetter: (p) => (p.data ? loyGroupName(p.data, lang) : ''),
    },
    { colId: 'active', headerName: t('columns.active'), width: 130, valueGetter: (p) => p.data?.isActive === true, cellRenderer: ActiveCell },
    {
      colId: 'mobileCount',
      field: 'mobileCount',
      headerName: t('columns.mobileCount'),
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => formatNumber(p.value),
    },
    {
      colId: 'liveBonusBuys',
      headerName: t('columns.liveBonusBuys'),
      flex: 1,
      minWidth: 220,
      sortable: false,
      valueGetter: (p) => (p.data ? liveBonusBuysOf(p.data).length : 0),
      cellRenderer: BonusBuysCell,
    },
  ]
}
