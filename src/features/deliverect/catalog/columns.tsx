import type { ColDef, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Ban, ListChecks, RotateCcw, Trash2 } from 'lucide-react'
import type { DeliverectWhitelistRow } from '@/core/models/deliverect'
import { pinStart } from '@/core/theme/direction'
import Button from '@/core/ui/Button'
import LtrCell from '@/core/ui/LtrCell'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import PlatformChip from './PlatformChip'
import { rowActions, type WhitelistAction } from './whitelist-state'

type Row = DeliverectWhitelistRow

const ACTION_ICON = { disable: Ban, delete: Trash2, restore: RotateCcw } as const

const time = ({ value }: ValueFormatterParams<Row, string | null>) => formatDateTime(value)

/**
 * The Deliverect whitelist grid (ticket 479; contract § Catalog): material, the EN and AR names,
 * the GTINs, disabled, deleted, the platforms the material is excluded on (chips), updated at / by —
 * then the row's Exclusions and its Disable / Delete / Restore.
 *
 * Every plain cell is isolated by the core grid base (a name in either script is free text). A
 * column with its own renderer isolates its own whole value: the GTINs are ONE string, isolated
 * once; each platform chip is its own isolate.
 */
export function whitelistColumns(
  t: TFunction,
  act: { onExclusions: (row: Row) => void; onAction: (row: Row, action: WhitelistAction) => void },
): ColDef<Row>[] {
  const code = 'font-mono text-[12px]'
  const flag = (field: 'disabled' | 'deleted', sev: 'warn' | 'bad'): ColDef<Row> => ({
    field,
    headerName: t(`columns.${field}`),
    width: 110,
    valueFormatter: ({ value }: ValueFormatterParams<Row, boolean>) => (value ? t(`flags.${field}`) : ''),
    cellRenderer: ({ value, valueFormatted }: ICellRendererParams<Row, boolean>) =>
      value ? (
        <span data-whitelist-flag={field}>
          <StatusBadge sev={sev}>{valueFormatted}</StatusBadge>
        </span>
      ) : null,
  })
  return [
    { field: 'materialNumber', headerName: t('columns.material'), width: 130, pinned: pinStart, cellClass: code, cellRenderer: LtrCell },
    { field: 'nameEn', headerName: t('columns.nameEn'), width: 230, tooltipField: 'nameEn' },
    { field: 'nameAr', headerName: t('columns.nameAr'), width: 230, tooltipField: 'nameAr' },
    {
      field: 'gtins',
      headerName: t('columns.gtins'),
      width: 200,
      cellClass: code,
      valueFormatter: ({ value }: ValueFormatterParams<Row, string[]>) => (value ?? []).join(', '),
      cellRenderer: LtrCell,
    },
    flag('disabled', 'warn'),
    flag('deleted', 'bad'),
    {
      field: 'excludedPlatforms',
      headerName: t('columns.excluded'),
      width: 220,
      valueFormatter: ({ value }: ValueFormatterParams<Row, string[]>) => (value ?? []).join(', '),
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data?.excludedPlatforms?.length ? (
          <span className="flex h-full flex-wrap items-center gap-1" data-excluded-cell={data.materialNumber}>
            {data.excludedPlatforms.map((k) => (
              <PlatformChip key={k} platformKey={k} />
            ))}
          </span>
        ) : null,
    },
    { field: 'updatedAt', headerName: t('columns.updatedAt'), width: 150, valueFormatter: time, cellRenderer: LtrCell },
    { field: 'updatedBy', headerName: t('columns.updatedBy'), width: 130, cellClass: code, cellRenderer: LtrCell },
    {
      colId: 'actions',
      headerName: t('columns.actions'),
      width: 300,
      sortable: false,
      filter: false,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data ? data.materialNumber : ''),
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data ? (
          <span className="flex h-full items-center gap-1.5">
            <Button variant="ghost" onClick={() => act.onExclusions(data)} data-row-exclusions={data.materialNumber}>
              <ListChecks className="h-3.5 w-3.5" aria-hidden />
              {t('actions.exclusions')}
            </Button>
            {rowActions(data).map((action) => {
              const Icon = ACTION_ICON[action]
              return (
                <Button
                  key={action}
                  variant="ghost"
                  onClick={() => act.onAction(data, action)}
                  data-row-action={action}
                  data-row-material={data.materialNumber}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {t(`actions.${action}`)}
                </Button>
              )
            })}
          </span>
        ) : null,
    },
  ]
}
