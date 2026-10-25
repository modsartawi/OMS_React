import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ServingListRow } from '@/core/models/serving-list'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { listFlag, membersLabel, pointingChips } from './list-view'
import PointingChips from './PointingChips'

/** Read-only grid; the door orders it by English name, and the user may re-sort. */
export const LISTS_DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  filter: false,
  resizable: true,
  cellDataType: false,
}

function StatusCell(p: ICellRendererParams<ServingListRow>) {
  const { t } = useTranslation('serving-lists')
  if (!p.data) return null
  const active = p.data.isActive
  return (
    <span data-status={active ? 'active' : 'deactivated'}>
      <StatusBadge sev={active ? 'ok' : 'mute'}>{t(active ? 'status.active' : 'status.deactivated')}</StatusBadge>
    </span>
  )
}

/** `enabled / all` isolated once, then the row's flag (a competed type with nothing to bid, or an empty list). */
function MembersCell(p: ICellRendererParams<ServingListRow>) {
  const { t } = useTranslation('serving-lists')
  if (!p.data) return null
  const flag = listFlag(p.data)
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-[12px] tabular-nums" data-members="">
        <Ltr>{membersLabel(p.data)}</Ltr>
      </span>
      {flag && (
        <span title={t(`flag.${flag}Hint`)} data-flag={flag}>
          <StatusBadge sev={flag === 'empty' ? 'mute' : 'warn'}>
            {flag !== 'empty' && <TriangleAlert className="me-1 h-3 w-3" aria-hidden />}
            {t(`flag.${flag}`)}
          </StatusBadge>
        </span>
      )}
    </span>
  )
}

/** One chip per pointing type: the code, the description as its tooltip, a competed type marked. */
function PointingCell(p: ICellRendererParams<ServingListRow>) {
  const { t } = useTranslation('serving-lists')
  if (!p.data) return null
  const chips = pointingChips(p.data)
  if (chips.length === 0) return <span className="text-muted-foreground" data-pointing-none="">{t('pointing.none')}</span>
  return <PointingChips chips={chips} />
}

/** Updated at · by — a pair led by a machine value, isolated once. */
function UpdatedCell(p: ICellRendererParams<ServingListRow>) {
  if (!p.data) return null
  return (
    <span className="font-mono text-[12px]" data-updated="">
      <Ltr>{formatPair(formatDateTime(p.data.updatedAt), p.data.updatedBy)}</Ltr>
    </span>
  )
}

export function buildListColumns(t: TFunction): ColDef<ServingListRow>[] {
  return [
    { headerName: t('columns.nameEn'), field: 'nameEn', flex: 1, minWidth: 180, cellClass: 'font-medium' },
    { headerName: t('columns.nameAr'), field: 'nameAr', flex: 1, minWidth: 160 },
    { headerName: t('columns.status'), colId: 'status', width: 130, valueGetter: (p) => (p.data?.isActive ? 0 : 1), cellRenderer: StatusCell },
    {
      headerName: t('columns.members'),
      headerTooltip: t('columns.membersTooltip'),
      colId: 'members',
      width: 260,
      valueGetter: (p) => p.data?.enabledMemberCount ?? 0,
      cellRenderer: MembersCell,
    },
    {
      headerName: t('columns.pointingTypes'),
      colId: 'pointing',
      flex: 1,
      minWidth: 200,
      sortable: false,
      autoHeight: true,
      wrapText: true,
      valueGetter: (p) => (p.data?.pointingTypes ?? []).map((x) => `${x.documentType}:${x.isCompeted}`).join(','),
      cellRenderer: PointingCell,
    },
    { headerName: t('columns.updated'), colId: 'updated', width: 230, valueGetter: (p) => p.data?.updatedAt ?? '', cellRenderer: UpdatedCell },
  ]
}
