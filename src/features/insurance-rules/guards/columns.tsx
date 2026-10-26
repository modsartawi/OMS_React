import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { GuardFlags, GuardSeverityBadge, GuardStateBadge } from '@/core/insurance-rules/badges'
import { GUARD_STATES, severityRank, type GuardRuleRow } from '@/core/insurance-rules/model'
import { saysIn } from '@/core/rules/sentence'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { formatDateTime } from '@/core/util/date-format'

/** Read-only; in the door's order (by id), the user may re-sort. */
export const GUARDS_DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  filter: false,
  resizable: true,
  cellDataType: false,
}

/** The name in the reader's language, the other one under it — both are the author's free text. */
function NameCell(p: ICellRendererParams<GuardRuleRow>) {
  const { i18n } = useTranslation()
  if (!p.data) return null
  const ar = i18n.language.startsWith('ar')
  return (
    <span className="flex flex-col py-1 leading-tight" data-name="">
      <bdi className="font-medium" data-name-main="">
        {saysIn(p.data.name, i18n.language)}
      </bdi>
      <bdi className="text-xs text-muted-foreground" dir={ar ? 'ltr' : 'rtl'} lang={ar ? 'en' : 'ar'} data-name-other="">
        {ar ? p.data.name.en : p.data.name.ar}
      </bdi>
    </span>
  )
}

const StateCell = (p: ICellRendererParams<GuardRuleRow>) => (p.data ? <GuardStateBadge state={p.data.state} /> : null)
const SeverityCell = (p: ICellRendererParams<GuardRuleRow>) => (p.data ? <GuardSeverityBadge severity={p.data.severity} /> : null)
const FlagsCell = (p: ICellRendererParams<GuardRuleRow>) => (p.data ? <GuardFlags flags={p.data.flags} /> : null)

export function buildGuardColumns(t: TFunction): ColDef<GuardRuleRow>[] {
  return [
    { headerName: t('columns.id'), field: 'id', width: 110, cellClass: 'font-mono text-[12px]' },
    { headerName: t('columns.name'), colId: 'name', flex: 1, minWidth: 240, autoHeight: true, valueGetter: (p) => p.data?.name.en ?? '', cellRenderer: NameCell },
    { headerName: t('columns.state'), colId: 'state', width: 190, valueGetter: (p) => (p.data ? GUARD_STATES.indexOf(p.data.state) : 0), cellRenderer: StateCell },
    { headerName: t('columns.severity'), colId: 'severity', width: 130, valueGetter: (p) => (p.data ? severityRank(p.data.severity) : 0), cellRenderer: SeverityCell },
    { headerName: t('columns.folder'), field: 'folder', width: 210 },
    {
      headerName: t('columns.lastFired'),
      colId: 'lastFired',
      width: 170,
      valueGetter: (p) => p.data?.lastFired ?? '',
      valueFormatter: (p) => (p.value ? formatDateTime(p.value as string) : t('list.never')),
    },
    {
      headerName: t('columns.flags'),
      colId: 'flags',
      width: 190,
      sortable: false,
      valueGetter: (p) => (p.data?.flags ?? []).map((f) => f.kind).join(','),
      cellRenderer: FlagsCell,
    },
  ]
}
