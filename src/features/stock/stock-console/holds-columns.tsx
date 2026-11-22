import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import type { StockConsoleHoldRow } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import LtrCell from '@/core/ui/LtrCell'
import StatusBadge from '@/core/ui/StatusBadge'
import { localizedName } from '@/core/util/localized-name'
import { MONO, formatQuantity, formatTime } from './columns'
import { rowKey } from './row-ids'
import { holdAge, holdColumns, holdDocument, holdStateCell, type HoldColumn } from './holds'
import { itemHref } from './items-columns'

type Cell = ICellRendererParams<StockConsoleHoldRow>

/** A hold is one take's hold on one batch [guess: take id and batch are unique within a store's page]. */
export const holdRowId = (row: StockConsoleHoldRow) => rowKey(row.takeId, row.batch, row.takenAt)

/**
 * The Holds grid's columns (oms 942), in the prototype's order (`holdColumns`, pure and tested): take id, item, name,
 * batch, quantity, taken at, age, state, source, picking document or till sale — and, on the released list, when and
 * why it was released. `now` is the reader's clock when the list was drawn, for the age.
 */
export function buildHoldsColumns(
  t: TFunction,
  language: string,
  store: string,
  filter: string,
  now: number,
): ColDef<StockConsoleHoldRow>[] {
  const all: Record<HoldColumn, ColDef<StockConsoleHoldRow>> = {
    takeId: { headerName: t('holds.column.takeId'), field: 'takeId', width: 150, cellClass: MONO, cellRenderer: LtrCell },
    item: {
      headerName: t('holds.column.item'),
      field: 'item',
      width: 100,
      cellClass: MONO,
      cellRenderer: (p: Cell) =>
        p.data ? (
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
    name: {
      headerName: t('holds.column.name'),
      colId: 'name',
      width: 200,
      valueGetter: (p) => (p.data ? localizedName(p.data, language) : ''),
    },
    batch: {
      headerName: t('holds.column.batch'),
      field: 'batch',
      width: 120,
      cellClass: MONO,
      cellRenderer: (p: Cell) =>
        p.data?.batch ? <Ltr>{p.data.batch}</Ltr> : <span className="text-muted-foreground">{t('holds.noBatch')}</span>,
    },
    quantity: {
      headerName: t('holds.column.quantity'),
      field: 'quantity',
      width: 90,
      type: 'numericColumn',
      valueFormatter: formatQuantity,
      cellRenderer: LtrCell,
    },
    takenAt: {
      headerName: t('holds.column.takenAt'),
      field: 'takenAt',
      width: 140,
      cellClass: MONO,
      valueFormatter: formatTime,
      cellRenderer: LtrCell,
    },
    age: {
      headerName: t('holds.column.age'),
      colId: 'age',
      width: 100,
      // A machine value: the base cell isolates the formatted string.
      valueGetter: (p) => {
        const age = p.data ? holdAge(p.data, now) : null
        return age ? t(age.key, age.values) : ''
      },
    },
    state: {
      headerName: t('holds.column.state'),
      field: 'state',
      width: 150,
      cellRenderer: (p: Cell) => {
        if (!p.data) return null
        const cell = holdStateCell(p.data.state)
        return (
          <span data-hold-state={p.data.state}>
            <StatusBadge sev={cell.sev}>{'key' in cell ? t(cell.key) : <bdi>{cell.raw}</bdi>}</StatusBadge>
          </span>
        )
      },
    },
    source: { headerName: t('holds.column.source'), field: 'source', width: 110 },
    document: {
      headerName: t('holds.column.document'),
      colId: 'document',
      width: 220,
      cellRenderer: (p: Cell) => {
        const doc = p.data ? holdDocument(p.data) : null
        if (!doc) return null
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{t(doc.key)}</span>
            <span className={MONO}>
              <Ltr>{doc.text}</Ltr>
            </span>
          </span>
        )
      },
    },
    releasedAt: {
      headerName: t('holds.column.releasedAt'),
      field: 'releasedAt',
      width: 140,
      cellClass: MONO,
      valueFormatter: formatTime,
      cellRenderer: LtrCell,
    },
    // Server text: the base cell isolates it as `<bdi>`.
    releaseReason: { headerName: t('holds.column.releaseReason'), field: 'releaseReason', width: 240 },
  }
  return holdColumns(filter).map((c) => all[c])
}
