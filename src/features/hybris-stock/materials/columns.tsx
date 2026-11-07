import type { ColDef, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Ban, CircleCheck } from 'lucide-react'
import type { HybrisStockMaterialRow } from '@/core/models/hybris-stock'
import { pinStart } from '@/core/theme/direction'
import Button from '@/core/ui/Button'
import LtrCell from '@/core/ui/LtrCell'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'

type Row = HybrisStockMaterialRow

const time = ({ value }: ValueFormatterParams<Row, string | null>) => formatDateTime(value)

/**
 * The Hybris stock materials grid (ticket 848): number, name, enabled, added at / by, updated at /
 * by, and — for a manager — Enable or Disable. `onToggle` is `null` for a view-only user, and the
 * actions column is then left out.
 */
export function materialColumns(t: TFunction, onToggle: ((row: Row) => void) | null): ColDef<Row>[] {
  const code = 'font-mono text-[12px]'
  const cols: ColDef<Row>[] = [
    { field: 'materialNumber', headerName: t('columns.material'), width: 130, pinned: pinStart, cellClass: code, cellRenderer: LtrCell },
    { field: 'materialName', headerName: t('columns.name'), width: 280, tooltipField: 'materialName' },
    {
      colId: 'enabled',
      headerName: t('columns.enabled'),
      width: 120,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data ? t(data.enabled ? 'state.enabled' : 'state.disabled') : ''),
      cellRenderer: ({ data, value }: ICellRendererParams<Row>) =>
        data ? (
          <span data-enabled={String(data.enabled)}>
            <StatusBadge sev={data.enabled ? 'go' : 'mute'}>{value}</StatusBadge>
          </span>
        ) : null,
    },
    { field: 'addedAt', headerName: t('columns.addedAt'), width: 150, valueFormatter: time, cellRenderer: LtrCell },
    { field: 'addedBy', headerName: t('columns.addedBy'), width: 120, cellClass: code, cellRenderer: LtrCell },
    { field: 'updatedAt', headerName: t('columns.updatedAt'), width: 150, valueFormatter: time, cellRenderer: LtrCell },
    { field: 'updatedBy', headerName: t('columns.updatedBy'), width: 120, cellClass: code, cellRenderer: LtrCell },
  ]
  if (onToggle)
    cols.push({
      colId: 'actions',
      headerName: t('columns.actions'),
      width: 140,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data ? (
          <span className="flex h-full items-center">
            <Button
              variant={data.enabled ? 'danger-outlined' : 'ghost'}
              onClick={() => onToggle(data)}
              data-material-toggle={data.materialNumber}
              data-to={data.enabled ? 'disable' : 'enable'}
            >
              {data.enabled ? <Ban className="h-3.5 w-3.5" aria-hidden /> : <CircleCheck className="h-3.5 w-3.5" aria-hidden />}
              {t(data.enabled ? 'disable.button' : 'enable.button')}
            </Button>
          </span>
        ) : null,
    })
  return cols
}
