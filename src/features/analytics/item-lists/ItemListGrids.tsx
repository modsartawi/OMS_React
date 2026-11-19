import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import type { ItemListMember, ItemListPeriod, ItemListStatus } from '@/core/models/item-list'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import type { Severity } from '@/core/ui/severity'
import StatusBadge from '@/core/ui/StatusBadge'

/** A stated status's chip: out of the market red, limited amber, delisted neutral, back green. */
export const STATUS_SEV: Record<ItemListStatus, Severity> = {
  unavailable: 'bad',
  blocked: 'bad',
  delisted: 'mute',
  limited: 'warn',
  available: 'ok',
}

/** A status the five do not name is drawn neutral in the server's own words (`statusText`), never as one of them. */
function StatusCell({ value, data }: ICellRendererParams<{ statusText?: string }>) {
  const { t } = useTranslation('item-lists')
  if (value)
    return (
      <span data-item-list-status={value}>
        <StatusBadge sev={STATUS_SEV[value as ItemListStatus]}>{t(`status.${value}`)}</StatusBadge>
      </span>
    )
  const said = data?.statusText?.trim()
  if (!said) return null
  return (
    <span data-item-list-status-unknown={said}>
      <StatusBadge sev="mute">
        <bdi>{said}</bdi>
      </StatusBadge>
    </span>
  )
}

const COL_DEF: ColDef = { ...OMS_GRID_BASE_COL_DEF, sortable: true, resizable: true, suppressHeaderMenuButton: true }

/** Past this many rows the grid scrolls inside a fixed height rather than growing the page. */
const AUTO_HEIGHT_ROWS = 12

function Grid<T>({ rows, columns, testId }: { rows: T[]; columns: ColDef<T>[]; testId: string }) {
  const auto = rows.length <= AUTO_HEIGHT_ROWS
  return (
    <div data-item-list-grid={testId} style={auto ? undefined : { height: '26rem' }}>
      <AgGridReact<T>
        theme={omsGridTheme}
        rowData={rows}
        columnDefs={columns}
        defaultColDef={COL_DEF as ColDef<T>}
        rowHeight={OMS_GRID_ROW_HEIGHT}
        headerHeight={OMS_GRID_HEADER_HEIGHT}
        animateRows={false}
        domLayout={auto ? 'autoHeight' : 'normal'}
      />
    </div>
  )
}

/** The level's words; the base column def isolates the cell. */
const useLevelWords = () => {
  const { t } = useTranslation('item-lists')
  return (level: unknown) => (typeof level === 'string' && level ? t(`level.${level}`, { defaultValue: level }) : '')
}

interface MemberRow extends ItemListMember {
  periods: number
}

/** The list's members with their level, and how many periods each has. */
export function MembersGrid({ members, periods }: { members: ItemListMember[]; periods: ItemListPeriod[] }) {
  const { t } = useTranslation('item-lists')
  const levelWords = useLevelWords()
  const rows = useMemo(
    (): MemberRow[] => members.map((m) => ({ ...m, periods: periods.filter((p) => p.member === m.key && p.level === m.level).length })),
    [members, periods],
  )
  const columns = useMemo(
    (): ColDef<MemberRow>[] => [
      { colId: 'level', field: 'level', headerName: t('columns.level'), width: 170, valueFormatter: ({ value }) => levelWords(value) },
      { colId: 'key', field: 'key', headerName: t('columns.key'), width: 170, cellClass: 'font-mono' },
      { colId: 'label', field: 'label', headerName: t('columns.label'), flex: 1, minWidth: 200 },
      { colId: 'periods', field: 'periods', headerName: t('list.periods'), width: 110 },
    ],
    [t, levelWords],
  )
  return <Grid rows={rows} columns={columns} testId="members" />
}

interface PeriodRow extends ItemListPeriod {
  label: string
}

/** The list's periods: the member, its dates (an open `to` reads "still"), the status chip and the note. */
export function PeriodsGrid({ members, periods }: { members: ItemListMember[]; periods: ItemListPeriod[] }) {
  const { t } = useTranslation('item-lists')
  const levelWords = useLevelWords()
  const rows = useMemo(
    (): PeriodRow[] => periods.map((p) => ({ ...p, label: members.find((m) => m.key === p.member && m.level === p.level)?.label ?? '' })),
    [members, periods],
  )
  const columns = useMemo(
    (): ColDef<PeriodRow>[] => [
      { colId: 'level', field: 'level', headerName: t('columns.level'), width: 150, valueFormatter: ({ value }) => levelWords(value) },
      { colId: 'member', field: 'member', headerName: t('columns.member'), width: 150, cellClass: 'font-mono' },
      { colId: 'label', field: 'label', headerName: t('columns.label'), flex: 1, minWidth: 180 },
      { colId: 'from', field: 'from', headerName: t('columns.from'), width: 120 },
      { colId: 'to', field: 'to', headerName: t('columns.to'), width: 120, valueFormatter: ({ value }) => (value ? String(value) : t('open')) },
      { colId: 'status', field: 'status', headerName: t('columns.status'), width: 190, cellRenderer: StatusCell },
      { colId: 'note', field: 'note', headerName: t('columns.note'), flex: 1, minWidth: 180 },
    ],
    [t, levelWords],
  )
  return <Grid rows={rows} columns={columns} testId="periods" />
}
