import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Trans } from 'react-i18next'
import { Link } from 'react-router'

import type { StockConsoleTakeRow } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import LtrCell from '@/core/ui/LtrCell'
import StatusBadge from '@/core/ui/StatusBadge'
import { localizedName } from '@/core/util/localized-name'
import { formatFigure } from '@/core/util/number-format'
import { MONO, formatTime } from './columns'
import { itemHref } from './items-columns'
import { takeCells } from './takes'

type Cell = ICellRendererParams<StockConsoleTakeRow>

/** One take door call per row. Module-level, as AG Grid wants. */
export const takeRowId = (row: StockConsoleTakeRow) => `${row.takeId}\u0000${row.at}`

/**
 * The Takes grid's columns (oms 942, spec 4157 stories 40–42), each cell by the row's kind (`takeCells`, pure and
 * tested): time, kind, item, name, quantity, the batches taken (or the batch the door named), a refusal's reason and a
 * failure's status.
 */
export function buildTakesColumns(t: TFunction, language: string, store: string): ColDef<StockConsoleTakeRow>[] {
  return [
    { headerName: t('takes.column.at'), field: 'at', width: 140, cellClass: MONO, valueFormatter: formatTime, cellRenderer: LtrCell },
    {
      headerName: t('takes.column.kind'),
      field: 'kind',
      width: 110,
      cellRenderer: (p: Cell) => {
        if (!p.data) return null
        const { kind } = takeCells(p.data)
        return (
          <span data-take-kind={String(p.data.kind)}>
            <StatusBadge sev={kind.sev}>{'key' in kind ? t(kind.key) : <bdi>{kind.raw}</bdi>}</StatusBadge>
          </span>
        )
      },
    },
    {
      headerName: t('takes.column.item'),
      colId: 'item',
      width: 100,
      cellClass: MONO,
      cellRenderer: (p: Cell) => {
        const item = p.data ? takeCells(p.data).item : null
        return item ? (
          <Link to={itemHref(store, item)} className="font-medium text-primary underline-offset-2 hover:underline" data-item-link={item}>
            <Ltr>{item}</Ltr>
          </Link>
        ) : null
      },
    },
    {
      // Free text in either script: the base cell isolates it as `<bdi>`.
      headerName: t('takes.column.name'),
      colId: 'name',
      width: 200,
      valueGetter: (p) => {
        const names = p.data ? takeCells(p.data).names : null
        return names ? localizedName(names, language) : ''
      },
    },
    {
      headerName: t('takes.column.quantity'),
      colId: 'quantity',
      width: 90,
      type: 'numericColumn',
      valueGetter: (p) => (p.data ? formatFigure(takeCells(p.data).quantity) : ''),
      cellRenderer: LtrCell,
    },
    {
      headerName: t('takes.column.batches'),
      colId: 'batches',
      width: 200,
      // Each batch (with its quantity) is one value, isolated once; the list itself is not a range.
      cellRenderer: (p: Cell) => {
        const batches = p.data ? takeCells(p.data).batches : []
        return batches.length === 0 ? null : (
          <span className="inline-flex flex-wrap gap-1.5">
            {batches.map((b, i) => (
              <span key={`${b}-${i}`} className={MONO}>
                <Ltr>{b}</Ltr>
              </span>
            ))}
          </span>
        )
      },
    },
    {
      // Server text (or a code): the base cell isolates it as `<bdi>`.
      headerName: t('takes.column.reason'),
      colId: 'reason',
      width: 240,
      valueGetter: (p) => (p.data ? (takeCells(p.data).reason ?? '') : ''),
    },
    {
      headerName: t('takes.column.status'),
      colId: 'status',
      width: 170,
      cellRenderer: (p: Cell) => {
        const status = p.data ? takeCells(p.data).status : null
        if (!status) return null
        return status.ms === null ? (
          <Ltr>{formatFigure(status.code)}</Ltr>
        ) : (
          <Trans
            t={t}
            i18nKey="takes.status"
            values={{ code: formatFigure(status.code), ms: formatFigure(status.ms) }}
            components={{ c: <Ltr />, ms: <Ltr /> }}
          />
        )
      },
    },
  ]
}
