import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { ComponentType } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import type { ServingListMemberRow, ServingListRow } from '@/core/models/serving-list'
import { pinEnd, pinStart } from '@/core/theme/direction'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Ltr from '@/core/ui/Ltr'
import LtrCell from '@/core/ui/LtrCell'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { dutyCell } from './duty-cell'

/**
 * The Members grid's columns (oms ticket 568, BackOffice spec 3042). Read-only here; per-row actions
 * (570) hang off it through `MembersGridContext` + the `actions` renderer.
 */

/** Sortable, resizable; the door orders by store code. */
export const MEMBERS_DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  filter: false,
  resizable: true,
  cellDataType: false,
}

/**
 * The grid's `context` (AG Grid hands it to every renderer as `p.context`): what a per-row action (570)
 * needs beyond the row itself.
 */
export interface MembersGridContext {
  servingListId: string
  /** The list's row from `GET ServingListWeb/Lists`; undefined while it loads or when the id is unknown. */
  list: ServingListRow | undefined
  /** `canEditServingLists` — every edit control reads it. */
  canEdit: boolean
}

export type MemberCellParams = ICellRendererParams<ServingListMemberRow, unknown, MembersGridContext>

/** Duty today: the state's label as a badge, then each of today's shifts, each range isolated once. */
function DutyCell(p: MemberCellParams) {
  const { t } = useTranslation('serving-lists')
  if (!p.data) return null
  const view = dutyCell(p.data)
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5" data-duty={view.state} title={view.state === 'noRoster' ? t('duty.noRosterHint') : undefined}>
      <StatusBadge sev={view.sev}>{view.labelKey ? t(view.labelKey) : <Ltr>{view.raw}</Ltr>}</StatusBadge>
      {view.hours.map((h, i) => (
        <span key={i} className="inline-flex items-baseline gap-1 font-mono text-[12px] tabular-nums" data-shift={h.overnight ? 'overnight' : ''}>
          <Ltr>{h.range}</Ltr>
          {h.overnight && <span className="font-sans text-[11px] text-muted-foreground" data-next-morning="">{t('duty.nextMorning')}</span>}
        </span>
      ))}
    </span>
  )
}

function EnabledCell(p: MemberCellParams) {
  const { t } = useTranslation('serving-lists')
  if (!p.data) return null
  const on = p.data.isEnabled
  return (
    <span data-enabled={on ? 'true' : 'false'}>
      <StatusBadge sev={on ? 'ok' : 'mute'}>{t(on ? 'member.enabled' : 'member.disabled')}</StatusBadge>
    </span>
  )
}

function ClosedCell(p: MemberCellParams) {
  const { t } = useTranslation('serving-lists')
  if (!p.data) return null
  return p.data.storeClosed ? (
    <span data-store-closed="true">
      <StatusBadge sev="warn">{t('member.storeClosed')}</StatusBadge>
    </span>
  ) : (
    <span className="text-muted-foreground" data-store-closed="false">
      {t('member.storeOpen')}
    </span>
  )
}

/** At · by — a pair led by a machine value, isolated once. */
function stampCell(at: 'addedAt' | 'updatedAt', by: 'addedBy' | 'updatedBy', hook: string) {
  return function StampCell(p: MemberCellParams) {
    if (!p.data) return null
    return (
      <span className="font-mono text-[12px]" data-stamp={hook}>
        <Ltr>{formatPair(formatDateTime(p.data[at]), p.data[by])}</Ltr>
      </span>
    )
  }
}
const AddedCell = stampCell('addedAt', 'addedBy', 'added')
const UpdatedCell = stampCell('updatedAt', 'updatedBy', 'updated')

/** Duty sorts worst first: no roster, then off duty / closed today, then on duty. */
const DUTY_ORDER: Record<string, number> = { noRoster: 0, unknown: 1, closedToday: 2, offDuty: 3, onDuty: 4 }

export function buildMemberColumns(
  t: TFunction,
  opts: { actions?: ComponentType<MemberCellParams> | null } = {},
): ColDef<ServingListMemberRow>[] {
  const cols: ColDef<ServingListMemberRow>[] = [
    { headerName: t('members.columns.storeCode'), field: 'storeCode', width: 120, pinned: pinStart, cellRenderer: LtrCell, cellClass: 'font-mono text-[12px]' },
    { headerName: t('members.columns.storeName'), field: 'storeName', flex: 1, minWidth: 180, tooltipField: 'storeName' },
    { headerName: t('members.columns.city'), field: 'city', width: 140 },
    {
      headerName: t('members.columns.duty'),
      headerTooltip: t('members.columns.dutyTooltip'),
      colId: 'duty',
      flex: 1,
      minWidth: 260,
      autoHeight: true,
      wrapText: true,
      // Changes with every input the cell reads, so the cell refreshes; sorts by state.
      valueGetter: (p) => (p.data ? `${DUTY_ORDER[dutyCell(p.data).state]}|${p.data.duty}|${JSON.stringify(p.data.todayShifts ?? [])}` : ''),
      cellRenderer: DutyCell,
    },
    { headerName: t('members.columns.storeClosed'), colId: 'storeClosed', width: 120, valueGetter: (p) => (p.data?.storeClosed ? 1 : 0), cellRenderer: ClosedCell },
    { headerName: t('members.columns.enabled'), colId: 'enabled', width: 120, valueGetter: (p) => (p.data?.isEnabled ? 1 : 0), cellRenderer: EnabledCell },
    { headerName: t('members.columns.added'), colId: 'added', width: 220, valueGetter: (p) => p.data?.addedAt ?? '', cellRenderer: AddedCell },
    { headerName: t('members.columns.updated'), colId: 'updated', width: 220, valueGetter: (p) => p.data?.updatedAt ?? '', cellRenderer: UpdatedCell },
  ]
  if (opts.actions) {
    cols.push({
      headerName: t('members.columns.actions'),
      colId: 'actions',
      pinned: pinEnd,
      width: 160,
      sortable: false,
      resizable: false,
      // Changes with the inputs a row's actions read, so the cell refreshes after a write.
      valueGetter: (p) => `${p.data?.isEnabled}|${p.data?.updatedAt}`,
      cellRenderer: opts.actions,
    })
  }
  return cols
}
