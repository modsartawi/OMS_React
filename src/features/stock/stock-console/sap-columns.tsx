import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import type { StockConsoleSapDay, StockConsoleSapLine } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import LtrCell from '@/core/ui/LtrCell'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { localizedName } from '@/core/util/localized-name'
import { formatFigure } from '@/core/util/number-format'
import { MONO, formatQuantity } from './columns'
import { itemHref } from './console-pages'
import { markCell } from './movements'

type DayCell = ICellRendererParams<StockConsoleSapDay>
type LineCell = ICellRendererParams<StockConsoleSapLine>

/** One summary row per entry day and movement type. */
export const sapDayRowId = (row: StockConsoleSapDay) => `${row.day}\u0000${row.movementType}`
/** One SAP line per material document, year and line. */
export const sapLineRowId = (row: StockConsoleSapLine) => `${row.materialDocument}\u0000${row.year}\u0000${row.line}`

/** A figure column: grouped Latin digits, isolated as a machine value. */
const figure = <T,>(headerName: string, field: string): ColDef<T> => ({
  headerName,
  field: field as ColDef<T>['field'],
  width: 110,
  type: 'numericColumn',
  valueFormatter: formatQuantity,
  cellRenderer: LtrCell,
})

/**
 * The SAP summary's columns (oms 945): entry day, movement type, documents, lines, quantity in and out. The movement type
 * is the link that opens the row's lines (`openHref`, the address with the row opened); the opened row is marked.
 */
export function buildSapDayColumns(
  t: TFunction,
  openHref: (row: StockConsoleSapDay) => string,
  opened: { day: string; type: string },
): ColDef<StockConsoleSapDay>[] {
  return [
    {
      headerName: t('sap.column.day'),
      field: 'day',
      width: 120,
      cellClass: MONO,
      valueFormatter: (p) => formatDay(p.value as string | null),
      cellRenderer: LtrCell,
    },
    {
      headerName: t('sap.column.movementType'),
      field: 'movementType',
      width: 150,
      cellRenderer: (p: DayCell) => {
        if (!p.data) return null
        const isOpen = p.data.day === opened.day && p.data.movementType === opened.type
        return (
          <Link
            to={openHref(p.data)}
            replace
            title={t('sap.open')}
            className={'font-mono text-primary underline-offset-2 hover:underline ' + (isOpen ? 'font-semibold underline' : '')}
            data-sap-open={sapDayRowId(p.data)}
            aria-current={isOpen ? 'true' : undefined}
          >
            <Ltr>{p.data.movementType}</Ltr>
          </Link>
        )
      },
    },
    figure(t('sap.column.documents'), 'documents'),
    figure(t('sap.column.lines'), 'lines'),
    figure(t('sap.column.quantityIn'), 'quantityIn'),
    figure(t('sap.column.quantityOut'), 'quantityOut'),
  ]
}

/** A SAP entry time as drawn: a date and time formatted; a bare time of day as sent [guess: either may come]. */
const entryTime = (value: string | null): string => (value && value.includes('T') ? formatDateTime(value) : (value ?? ''))

/**
 * An opened row's lines (oms 945): document, line, item and name, batch, quantity, posting day, entry time, and our mark
 * — applied, received not applied, not received by us.
 */
export function buildSapLineColumns(t: TFunction, language: string, store: string): ColDef<StockConsoleSapLine>[] {
  return [
    {
      headerName: t('sap.lines.column.document'),
      colId: 'document',
      width: 160,
      cellClass: MONO,
      // Document and year are one key: one value, isolated once.
      valueGetter: (p) => (p.data ? formatPair(p.data.materialDocument, p.data.year) : ''),
      cellRenderer: LtrCell,
    },
    {
      headerName: t('sap.lines.column.line'),
      colId: 'line',
      width: 70,
      cellClass: MONO,
      valueGetter: (p) => (p.data ? String(p.data.line) : ''),
      cellRenderer: LtrCell,
    },
    {
      headerName: t('sap.lines.column.item'),
      field: 'item',
      width: 100,
      cellClass: MONO,
      cellRenderer: (p: LineCell) =>
        p.data?.item ? (
          <Link
            to={itemHref(store, p.data.item)}
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-item-link={p.data.item}
          >
            <Ltr>{p.data.item}</Ltr>
          </Link>
        ) : null,
    },
    // Free text in either script: the base cell isolates it as `<bdi>`.
    {
      headerName: t('sap.lines.column.name'),
      colId: 'name',
      width: 200,
      valueGetter: (p) => (p.data ? localizedName(p.data, language) : ''),
    },
    { headerName: t('sap.lines.column.batch'), field: 'batch', width: 120, cellClass: MONO, cellRenderer: LtrCell },
    {
      headerName: t('sap.lines.column.quantity'),
      colId: 'quantity',
      width: 110,
      type: 'numericColumn',
      // The signed quantity and its unit are one machine value, isolated once.
      valueGetter: (p) => (p.data ? [formatFigure(p.data.quantity), p.data.unit ?? ''].filter((s) => s !== '').join(' ') : ''),
      cellRenderer: LtrCell,
    },
    {
      headerName: t('sap.lines.column.postingDay'),
      field: 'postingDay',
      width: 120,
      cellClass: MONO,
      valueFormatter: (p) => formatDay(p.value as string | null),
      cellRenderer: LtrCell,
    },
    {
      headerName: t('sap.lines.column.entryTime'),
      field: 'entryTime',
      width: 140,
      cellClass: MONO,
      valueFormatter: (p) => entryTime(p.value as string | null),
      cellRenderer: LtrCell,
    },
    {
      headerName: t('sap.lines.column.mark'),
      field: 'mark',
      width: 180,
      cellRenderer: (p: LineCell) => {
        if (!p.data) return null
        const cell = markCell(p.data.mark)
        return (
          <span data-sap-mark={p.data.mark}>
            <StatusBadge sev={cell.sev}>{'key' in cell ? t(cell.key) : <bdi>{cell.raw}</bdi>}</StatusBadge>
          </span>
        )
      },
    },
  ]
}
