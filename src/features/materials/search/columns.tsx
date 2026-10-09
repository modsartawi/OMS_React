import type { ColDef, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'
import type { MaterialLevel, MaterialSearchRow } from '@/core/models/materials'
import { pinStart } from '@/core/theme/direction'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair } from '@/core/util/bidi'
import { formatMoney3 } from '@/core/util/number-format'
import { MATERIAL_LEVELS } from './search-query'

type Row = MaterialSearchRow

/** A material's own page — the detail (ticket 452). */
export const materialPath = (materialNumber: string) => `/materials/${encodeURIComponent(materialNumber)}`

/** Identities the export writes as text, so Excel never totals one or strips its leading zeros. */
export const EXPORT_AS_TEXT: ReadonlySet<string> = new Set([
  'materialNumber',
  'vendor',
  'itemType',
  ...MATERIAL_LEVELS.map((l) => levelColId(l)),
])

/** A column the export leaves out: AG Grid's own row-selection checkboxes hold no value. */
export const isExportSkipped = (colId: string) => colId.startsWith('ag-Grid-')

function levelColId(level: MaterialLevel): string {
  return `${level.toLowerCase()}Code`
}

/**
 * A cell whose WHOLE shown value is a pair led by a machine value (`200345 · GSK`): isolated
 * left-to-right once, so under RTL the number stays first. It shows `valueFormatted ?? value`, the
 * way the core base cell does, so the column's formatter survives (`Ltr` itself is not a renderer).
 */
function LtrPairCell({ value, valueFormatted }: ICellRendererParams) {
  const text = valueFormatted ?? (value == null ? '' : String(value))
  return text === '' ? null : <Ltr>{text}</Ltr>
}

/**
 * The Material search grid (ticket 451, spec 2544 story 12): material number, EN and AR
 * descriptions, the A–E codes, vendor, brand, status, blocked and serialised badges, and the
 * price ex VAT at 3 decimals.
 *
 * Every plain cell is isolated by the core grid base (`<bdi>`, dir auto): the descriptions are free
 * text in either script. A column with its own renderer isolates its own whole value.
 */
export function materialColumns(t: TFunction): ColDef<Row>[] {
  const code = 'font-mono text-[12px]'
  const yes = (label: string) => ({ value }: ValueFormatterParams<Row, boolean>) => (value === true ? label : '')

  return [
    {
      field: 'materialNumber',
      headerName: t('columns.materialNumber'),
      width: 120,
      pinned: pinStart,
      cellClass: code,
      // A link, so the row opens its material (and a middle-click opens it in a new tab).
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data ? (
          <Link to={materialPath(data.materialNumber)} className="text-primary-800 underline-offset-2 hover:underline" data-material-link="">
            <Ltr>{data.materialNumber}</Ltr>
          </Link>
        ) : null,
    },
    { field: 'description', headerName: t('columns.description'), width: 260, tooltipField: 'description' },
    { field: 'description2', headerName: t('columns.description2'), width: 240, tooltipField: 'description2' },
    ...MATERIAL_LEVELS.map(
      (level): ColDef<Row> => ({
        colId: levelColId(level),
        field: levelColId(level) as keyof Row,
        headerName: t(`columns.level${level}`),
        width: 90,
        cellClass: code,
      }),
    ),
    {
      colId: 'vendor',
      headerName: t('columns.vendor'),
      width: 200,
      // The vendor's number and its name as ONE pair, led by the number.
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data ? formatPair(data.vendorNo, data.vendorName) : ''),
      cellRenderer: LtrPairCell,
    },
    { field: 'brand', headerName: t('columns.brand'), width: 140 },
    { field: 'status', headerName: t('columns.status'), width: 110 },
    { field: 'itemType', headerName: t('columns.itemType'), width: 90, cellClass: code },
    {
      field: 'blocked',
      headerName: t('columns.blocked'),
      width: 100,
      valueFormatter: yes(t('badges.blocked')),
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data?.blocked ? <StatusBadge sev="bad">{t('badges.blocked')}</StatusBadge> : null,
    },
    {
      field: 'serialised',
      headerName: t('columns.serialised'),
      width: 110,
      valueFormatter: yes(t('badges.serialised')),
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data?.serialised ? <StatusBadge sev="go">{t('badges.serialised')}</StatusBadge> : null,
    },
    {
      field: 'unitPriceExVat',
      headerName: t('columns.price'),
      width: 130,
      type: 'numericColumn',
      cellClass: 'text-end tabular-nums',
      // As the master holds it: 3 decimals, ex VAT (the header says so). The export keeps the number.
      valueFormatter: ({ value }: ValueFormatterParams<Row, number>) => formatMoney3(value),
    },
  ]
}
