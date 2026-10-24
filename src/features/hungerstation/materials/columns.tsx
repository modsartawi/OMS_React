import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Pencil } from 'lucide-react'
import type { HungerStationMaterialRow } from '@/core/models/hungerstation'
import { pinStart } from '@/core/theme/direction'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'

type Row = HungerStationMaterialRow

/** A machine value (a code, a time) isolated left-to-right once, as the formatter shaped it. */
function LtrCell({ value, valueFormatted }: ICellRendererParams) {
  const text = valueFormatted ?? (value == null ? '' : String(value))
  return text === '' ? null : <Ltr>{text}</Ltr>
}

/** `null` renders blank — a `0001-01-01` stamp arrives as `null` (contract § Materials). */
const time = ({ value }: ValueFormatterParams<Row, string | null>) => formatDateTime(value)

/**
 * The HungerStation materials grid (ticket 555): material number, SKU, both names, disabled,
 * deleted, updated at/by, and the row's Change. A flag that is set reads as a badge (disabled
 * amber, deleted red); a clear one is blank, so the set ones stand out down the column.
 */
export function materialColumns(t: TFunction, act: { onChange: (row: Row) => void }): ColDef<Row>[] {
  const code = 'font-mono text-[12px]'
  const flag = (field: 'disabled' | 'deleted', sev: 'warn' | 'bad'): ColDef<Row> => ({
    field,
    headerName: t(`columns.${field}`),
    width: 110,
    valueFormatter: ({ value }: ValueFormatterParams<Row, boolean>) => (value ? t(`flag.${field}`) : ''),
    cellRenderer: ({ data, valueFormatted }: ICellRendererParams<Row>) =>
      data?.[field] ? (
        <span {...{ [`data-flag-${field}`]: '' }}>
          <StatusBadge sev={sev}>{valueFormatted}</StatusBadge>
        </span>
      ) : null,
  })
  return [
    { field: 'materialNumber', headerName: t('columns.material'), width: 170, pinned: pinStart, cellClass: code, cellRenderer: LtrCell },
    { field: 'sku', headerName: t('columns.sku'), width: 150, cellClass: code, cellRenderer: LtrCell },
    { field: 'nameEn', headerName: t('columns.nameEn'), width: 260, tooltipField: 'nameEn' },
    { field: 'nameAr', headerName: t('columns.nameAr'), width: 260, tooltipField: 'nameAr' },
    flag('disabled', 'warn'),
    flag('deleted', 'bad'),
    { field: 'updatedAt', headerName: t('columns.updatedAt'), width: 150, valueFormatter: time, cellRenderer: LtrCell },
    { field: 'updatedBy', headerName: t('columns.updatedBy'), width: 130, cellClass: code, cellRenderer: LtrCell },
    {
      colId: 'actions',
      headerName: t('columns.actions'),
      width: 140,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data ? (
          <span className="flex h-full items-center gap-1.5">
            <Button variant="ghost" onClick={() => act.onChange(data)} data-material-change={data.materialNumber}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              {t('change.button')}
            </Button>
          </span>
        ) : null,
    },
  ]
}
