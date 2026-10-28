import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import type { LoyGroupMember } from '@/core/models/loy-groups'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Button from '@/core/ui/Button'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'

/**
 * The Members tab's grid (oms ticket 632). 🚩 No sort and no filter: the rows are ONE page of a server
 * paging, and sorting what you are paging through would lie about the order of the whole group.
 */
export const MEMBERS_DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: false,
  filter: false,
  resizable: true,
  cellDataType: false,
}

function EnrolledCell(p: ICellRendererParams<LoyGroupMember>) {
  const { t } = useTranslation('loy-groups')
  if (!p.data) return null
  const enrolled = p.data.isEnrolled === true
  return (
    <span data-member-enrolled={enrolled ? 'true' : 'false'}>
      <StatusBadge sev={enrolled ? 'ok' : 'mute'}>{t(enrolled ? 'members.enrolled.yes' : 'members.enrolled.no')}</StatusBadge>
    </span>
  )
}

export function buildMemberColumns(
  t: TFunction,
  onRemove: ((m: LoyGroupMember) => void) | null,
): ColDef<LoyGroupMember>[] {
  const columns: ColDef<LoyGroupMember>[] = [
    // 🚩 The mobile exactly as the server returned it (canonical `9665…`) — no valueFormatter, no
    // reformatting; the base col def isolates it as a machine value.
    { colId: 'mobile', field: 'mobile', headerName: t('members.columns.mobile'), width: 180, cellClass: 'font-mono' },
    { colId: 'enrolled', headerName: t('members.columns.enrolled'), width: 140, valueGetter: (p) => p.data?.isEnrolled === true, cellRenderer: EnrolledCell },
    { colId: 'addedBy', field: 'addedBy', headerName: t('members.columns.addedBy'), flex: 1, minWidth: 160 },
    {
      colId: 'addedAt',
      field: 'addedAt',
      headerName: t('members.columns.addedAt'),
      width: 180,
      valueFormatter: (p) => formatDateTime(p.value),
    },
  ]
  if (onRemove) {
    columns.push({
      colId: 'remove',
      headerName: '',
      width: 120,
      cellRenderer: (p: ICellRendererParams<LoyGroupMember>) =>
        p.data ? (
          <Button variant="danger-outlined" onClick={() => onRemove(p.data as LoyGroupMember)} data-member-remove={p.data.mobile}>
            {t('members.remove.open')}
          </Button>
        ) : null,
    })
  }
  return columns
}
